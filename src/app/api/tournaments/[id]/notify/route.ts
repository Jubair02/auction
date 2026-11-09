import { after } from 'next/server'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { auctionReminderBody, dhakaDay } from '@/lib/notify'
import { toSmsNumber } from '@/lib/phone'
import { rateLimit, rateLimitBlocked } from '@/lib/rate-limit-shared'
import { loadTournamentForOwner, readJson, requireSession } from '../../../_lib/helpers'

export const runtime = 'nodejs'

const REMINDER_WINDOW_MS = 10 * 60 * 1000

/** Base URL for links in texts. Never taken from the Host header in production (see forgot-password). */
function appBaseUrl(req: Request): string | null {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') return null
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return host ? `${proto}://${host}` : null
}

/**
 * Everyone a reminder goes to: team managers (account phone) and the
 * tournament's players, minus self-registered players who did not consent.
 * Returns distinct 880… numbers and how many entries had no usable number.
 */
async function reminderRecipients(tournamentId: string): Promise<{ numbers: string[]; invalid: number }> {
  const [teams, players, noConsent] = await Promise.all([
    db.team.findMany({
      where: { tournamentId, managerUserId: { not: null } },
      select: { manager: { select: { phone: true, deletedAt: true, status: true } } },
    }),
    db.player.findMany({ where: { tournamentId, phone: { not: null } }, select: { id: true, phone: true } }),
    db.playerRegistration.findMany({
      where: { tournamentId, smsConsent: false, playerId: { not: null } },
      select: { playerId: true },
    }),
  ])
  const optedOut = new Set(noConsent.map((r) => r.playerId))
  const raw: (string | null)[] = [
    ...teams.filter((t) => t.manager && !t.manager.deletedAt && t.manager.status === 'ACTIVE').map((t) => t.manager!.phone),
    ...players.filter((p) => !optedOut.has(p.id)).map((p) => p.phone),
  ]
  const numbers = new Set<string>()
  let invalid = 0
  for (const phone of raw) {
    const n = phone ? toSmsNumber(phone) : null
    if (n) numbers.add(n)
    else invalid++
  }
  return { numbers: [...numbers], invalid }
}

// POST /api/tournaments/:id/notify {kind:'AUCTION_REMINDER', dryRun?:boolean}
//   dryRun → {recipients} (nothing is sent); otherwise → {queued, skipped}.
//   Pro tournaments with SMS turned on only; at most once per 10 minutes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth
  const { id } = await params

  const loaded = await loadTournamentForOwner(id, user, 'manage')
  if ('response' in loaded) return loaded.response
  const { tournament } = loaded

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  if (body.kind !== 'AUCTION_REMINDER') return jsonError('Unknown notification kind', 400)
  const dryRun = body.dryRun === true

  if (tournament.plan !== 'PRO') {
    return jsonError('SMS notifications are a Pro feature — upgrade this tournament to send reminders.', 402)
  }
  if (!tournament.smsEnabled) {
    return jsonError('Turn on SMS notifications for this tournament first.', 409)
  }
  const auction = await db.auction.findUnique({ where: { tournamentId: id }, select: { roomCode: true, status: true } })
  if (!auction) return jsonError('Create the auction room first — the reminder links to it.', 409)
  if (auction.status === 'ENDED') return jsonError('This auction has already ended.', 409)

  const { numbers, invalid } = await reminderRecipients(id)
  const rateKey = `sms-reminder:${id}`
  if (dryRun) {
    const wait = await rateLimitBlocked(rateKey, 1)
    return Response.json({ recipients: numbers.length, invalid, retryAfter: wait })
  }
  if (numbers.length === 0) return jsonError('Nobody to remind — no team manager or player has a valid mobile number.', 409)

  const baseUrl = appBaseUrl(req)
  if (!baseUrl) {
    console.error('[notify] APP_URL is not set — cannot build the room link in production')
    return jsonError('The site address (APP_URL) is not configured. Please contact support.', 500)
  }

  const retryAfter = await rateLimit(rateKey, 1, REMINDER_WINDOW_MS)
  if (retryAfter !== null) {
    return jsonError(`A reminder was sent recently. You can send another in ${Math.ceil(retryAfter / 60)} min.`, 429)
  }

  const text = auctionReminderBody(tournament, tournament.auctionAt, `${baseUrl}/room/${auction.roomCode}`).slice(0, 480)
  const day = dhakaDay()
  // One insert for everyone; a number already reminded today is skipped by its dedupeKey.
  const result = await db.notification.createMany({
    data: numbers.map((to) => ({
      channel: 'SMS',
      to,
      body: text,
      kind: 'AUCTION_REMINDER',
      tournamentId: id,
      dedupeKey: `reminder:${id}:${day}:${to}`,
    })),
    skipDuplicates: true,
  })
  const queued = result.count
  const skipped = numbers.length - queued + invalid

  after(() => track('sms_reminder_sent', { userId: user.id, tournamentId: id, props: { queued, skipped } }))
  return Response.json({ queued, skipped })
}
