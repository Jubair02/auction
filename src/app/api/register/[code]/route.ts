import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit-shared'
import { track } from '@/lib/analytics'
import { normalizeBdPhone } from '@/lib/phone'
import { rolesForTournament } from '@/lib/types'
import { isUniqueViolation, readJson } from '../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ code: string }> }

const NOT_FOUND = 'This registration link is not valid. Ask the organizer for the current link.'
const MAX_PENDING_PER_TOURNAMENT = 2000

async function findTournament(code: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(code)) return null
  const t = await db.tournament.findUnique({ where: { registrationCode: code } })
  // An archived (deleted) tournament's old link must stop working.
  return t && !t.archivedAt ? t : null
}

const HOUR = 60 * 60 * 1000
// Per IP + link, generous: a whole squad often signs up from one venue Wi-Fi
// or one carrier-NAT address. The per-tournament cap bounds how fast any one
// open link can be filled, whatever the number of addresses behind it.
const SIGNUPS_PER_IP_PER_LINK = 40
const SIGNUPS_PER_IP_ANY_LINK = 200
const SIGNUPS_PER_TOURNAMENT = 300

// GET /api/register/:code — public info for the sign-up page
export async function GET(req: Request, { params }: RouteParams) {
  const retryAfter = await rateLimit(clientKey(req, 'register-player-view'), 120, 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many requests. Please try again in ${retryAfter} seconds.`, 429)

  const { code } = await params
  const t = await findTournament(code)
  if (!t) return jsonError(NOT_FOUND, 404)

  return Response.json({
    tournamentName: t.name,
    sport: t.sport,
    sportName: t.sportName,
    location: t.location,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    logoUrl: t.logoUrl,
    open: t.registrationOpen,
    roles: rolesForTournament(t),
    // Optional fee, paid straight to the organizer's own bKash / Nagad number.
    registrationFee: t.registrationFee,
    feeBkashNumber: t.registrationFee ? t.feeBkashNumber : null,
    feeNagadNumber: t.registrationFee ? t.feeNagadNumber : null,
    feeInstructions: t.registrationFee ? t.feeInstructions : null,
  })
}

const TRX_RE = /^[A-Z0-9]{6,20}$/

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  // Lenient: local (01XXXXXXXXX) or international (+8801…), spaces/dashes allowed;
  // normalizeBdPhone below turns it into the canonical 01XXXXXXXXX form.
  phone: z.string().trim().min(1, 'Enter your mobile number').max(25, 'Enter a valid phone number'),
  smsConsent: z.boolean().optional(),
  payMethod: z.enum(['BKASH', 'NAGAD']).optional().nullable(),
  payTrxId: z.string().max(40).optional().nullable(),
  paySender: z.string().max(25).optional().nullable(),
  role: z.string().trim().min(1, 'Pick your playing role'),
  previousTeam: z.string().trim().max(80).optional().nullable(),
  // Only our own uploads — never an arbitrary third-party URL.
  photoUrl: z
    .string()
    .regex(/^\/api\/uploads\/[a-z0-9]{20,40}$/i)
    .optional()
    .nullable(),
})

// POST /api/register/:code — a player signs up; lands as PENDING for the organizer
export async function POST(req: Request, { params }: RouteParams) {
  const tooManyFromHere = (seconds: number) =>
    jsonError(`Too many sign-ups from here. Please try again in ${seconds} seconds.`, 429)
  // Loose per-IP ceiling across all links (stops one address hammering lookups).
  const anyRetry = await rateLimit(clientKey(req, 'register-player'), SIGNUPS_PER_IP_ANY_LINK, HOUR)
  if (anyRetry !== null) return tooManyFromHere(anyRetry)

  const { code } = await params
  const t = await findTournament(code)
  if (!t) return jsonError(NOT_FOUND, 404)
  if (!t.registrationOpen) return jsonError('Registration for this tournament is closed.', 403)

  const ipRetry = await rateLimit(`${clientKey(req, 'register-player')}:${t.id}`, SIGNUPS_PER_IP_PER_LINK, HOUR)
  if (ipRetry !== null) return tooManyFromHere(ipRetry)
  const tournamentRetry = await rateLimit(`register-player-tournament:${t.id}`, SIGNUPS_PER_TOURNAMENT, HOUR)
  if (tournamentRetry !== null) {
    return jsonError(`This tournament is getting a lot of sign-ups right now. Please try again in ${tournamentRetry} seconds.`, 429)
  }

  const body = await readJson(req)
  const parsed = body ? schema.safeParse(body) : null
  if (!parsed?.success) return jsonError(parsed?.error.issues[0]?.message ?? 'Invalid registration', 400)
  const data = parsed.data

  const roles: readonly string[] = rolesForTournament(t)
  if (!roles.includes(data.role)) return jsonError(`Role must be one of: ${roles.join(', ')}`, 400)

  const phone = normalizeBdPhone(data.phone)
  if (!phone) return jsonError('Enter a valid Bangladeshi mobile number, e.g. 01712345678', 400)

  // Registration fee: the player pays the organizer, then gives us the Transaction ID.
  let fee: { feeAmount: number; payMethod: string; payTrxId: string; paySender: string; payStatus: 'CLAIMED' } | null = null
  if (t.registrationFee) {
    const offered = [t.feeBkashNumber ? 'BKASH' : null, t.feeNagadNumber ? 'NAGAD' : null].filter(Boolean)
    if (!data.payMethod || !offered.includes(data.payMethod)) {
      return jsonError('Choose how you paid the registration fee', 400)
    }
    const trxId = (data.payTrxId ?? '').replace(/\s/g, '').toUpperCase()
    if (!TRX_RE.test(trxId)) return jsonError('Enter the Transaction ID from your payment message (6–20 letters and numbers)', 400)
    const sender = normalizeBdPhone(data.paySender ?? '')
    if (!sender) return jsonError('Enter the mobile number you paid from, e.g. 01712345678', 400)
    fee = { feeAmount: t.registrationFee, payMethod: data.payMethod, payTrxId: trxId, paySender: sender, payStatus: 'CLAIMED' }
  }

  const [duplicate, pendingCount] = await Promise.all([
    db.playerRegistration.findFirst({
      // Older rows may hold the +880 / 880 form of the same number.
      where: { tournamentId: t.id, phone: { in: [phone, `+88${phone}`, `88${phone}`] }, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true },
    }),
    db.playerRegistration.count({ where: { tournamentId: t.id, status: 'PENDING' } }),
  ])
  if (duplicate) return jsonError('This phone number is already registered for this tournament.', 409)
  if (pendingCount >= MAX_PENDING_PER_TOURNAMENT) {
    return jsonError('Registration is full right now. Please contact the organizer.', 403)
  }

  const create = () =>
    db.playerRegistration.create({
      data: {
        tournamentId: t.id,
        name: data.name,
        phone,
        role: data.role,
        previousTeam: data.previousTeam || null,
        photoUrl: data.photoUrl || null,
        smsConsent: data.smsConsent === true,
        ...(fee ?? {}),
      },
    })
  const trxTaken = () =>
    jsonError('This Transaction ID was already used for a registration. Check the ID in your payment message.', 409)
  try {
    await create()
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    if (!fee) return trxTaken()
    // The same player's earlier sign-up for this tournament was REJECTED: they
    // may try again with the fee they already paid. That rejected row gives the
    // Transaction ID up; an ID claimed by anyone or anywhere else stays refused.
    const released = await db.playerRegistration.updateMany({
      where: {
        tournamentId: t.id,
        phone: { in: [phone, `+88${phone}`, `88${phone}`] },
        status: 'REJECTED',
        payMethod: fee.payMethod,
        payTrxId: fee.payTrxId,
      },
      data: { payTrxId: null },
    })
    if (released.count !== 1) return trxTaken()
    try {
      await create()
    } catch (retryErr) {
      if (isUniqueViolation(retryErr)) return trxTaken()
      throw retryErr
    }
  }
  await track('player_registered', { tournamentId: t.id, props: { fee: fee !== null } })
  return Response.json({ ok: true }, { status: 201 })
}
