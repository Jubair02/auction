import { randomBytes } from 'crypto'
import { after } from 'next/server'
import type { Tournament } from '@prisma/client'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { notifyRegistrationDecision } from '@/lib/notify'
import { assertWithinPlan } from '@/lib/plans'
import { DEFAULT_CATEGORY_BASE_PRICES, type RegistrationDTO, type RegistrationPayStatus } from '@/lib/types'
import {
  coercePositiveInt,
  insertPlayersNumbered,
  loadTournamentForOwner,
  normalizeCategory,
  PLAYER_NUMBER_CONFLICT,
  readJson,
  requireSession,
} from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const newCode = () => randomBytes(9).toString('base64url') // 12 chars, ~72 bits

// GET /api/tournaments/:id/registrations — owner/ADMIN: link state + sign-ups (newest first)
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user)
  if ('response' in loaded) return loaded.response

  const registrations = await db.playerRegistration.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  const t = loaded.tournament
  return Response.json({
    registrationOpen: t.registrationOpen,
    registrationCode: t.registrationCode,
    // The fee settings, so the tab can edit them without the full tournament.
    registrationFee: t.registrationFee,
    feeBkashNumber: t.feeBkashNumber,
    feeNagadNumber: t.feeNagadNumber,
    feeInstructions: t.feeInstructions,
    plan: t.plan === 'PRO' ? 'PRO' : 'FREE',
    registrations: registrations.map(
      (r): RegistrationDTO => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        role: r.role,
        previousTeam: r.previousTeam,
        photoUrl: r.photoUrl,
        status: r.status as RegistrationDTO['status'],
        feeAmount: r.feeAmount,
        payMethod: r.payMethod === 'BKASH' || r.payMethod === 'NAGAD' ? r.payMethod : null,
        payTrxId: r.payTrxId,
        paySender: r.paySender,
        payStatus: r.payStatus as RegistrationPayStatus,
        smsConsent: r.smsConsent,
        createdAt: r.createdAt.toISOString(),
      }),
    ),
  })
}

/** Texts each player the organizer's decision (if the tournament has SMS on) once the response is sent. */
function notifyDecisions(
  tournament: Tournament,
  regs: { id: string; name: string; phone: string; smsConsent: boolean }[],
  decision: 'APPROVED' | 'REJECTED',
) {
  if (regs.length === 0) return
  after(async () => {
    for (const r of regs) {
      try {
        await notifyRegistrationDecision(tournament, r, decision)
      } catch (err) {
        console.error('[registrations] queueing the decision SMS failed:', (err as Error).message)
      }
    }
  })
}

// POST /api/tournaments/:id/registrations {open: boolean, rotate?: boolean}
// Opens/closes the public sign-up link. rotate=true issues a new link (the old one dies).
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user)
  if ('response' in loaded) return loaded.response

  const body = await readJson(req)
  if (!body || typeof body.open !== 'boolean') return jsonError('open must be true or false', 400)

  const needsCode = !loaded.tournament.registrationCode || body.rotate === true
  const updated = await db.tournament.update({
    where: { id },
    data: { registrationOpen: body.open, ...(needsCode ? { registrationCode: newCode() } : {}) },
    select: { registrationOpen: true, registrationCode: true },
  })
  return Response.json(updated)
}

// PATCH /api/tournaments/:id/registrations
//   {ids, action: 'approve'|'reject', category?, basePrice?} — approving turns PENDING sign-ups into real players.
//   {ids, action: 'verify_payment'|'reject_payment'} — the organizer checked the fee's Transaction ID.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user)
  if ('response' in loaded) return loaded.response
  const tournament = loaded.tournament

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 500) : []
  if (ids.length === 0) return jsonError('Select at least one registration', 400)
  const action = body.action
  if (action !== 'approve' && action !== 'reject' && action !== 'verify_payment' && action !== 'reject_payment') {
    return jsonError('action must be approve, reject, verify_payment or reject_payment', 400)
  }

  if (action === 'verify_payment' || action === 'reject_payment') {
    const payStatus = action === 'verify_payment' ? 'VERIFIED' : 'REJECTED'
    // Only sign-ups that claimed a fee payment; the organizer may correct an earlier call.
    const result = await db.playerRegistration.updateMany({
      where: { id: { in: ids }, tournamentId: id, payStatus: { in: ['CLAIMED', 'VERIFIED', 'REJECTED'] } },
      data: { payStatus },
    })
    if (result.count === 0) return jsonError('Those registrations have no fee payment to review', 409)
    return Response.json({ updated: result.count, payStatus })
  }

  const pending = await db.playerRegistration.findMany({
    where: { id: { in: ids }, tournamentId: id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })
  if (pending.length === 0) return jsonError('Those registrations were already handled', 409)

  if (action === 'reject') {
    const rejectedRows = await db.$queryRaw<{ id: string }[]>`
      UPDATE "PlayerRegistration" SET "status" = 'REJECTED'
      WHERE "id" = ANY(${pending.map((r) => r.id)}::text[]) AND "tournamentId" = ${id} AND "status" = 'PENDING'
      RETURNING "id"`
    const rejectedIds = new Set(rejectedRows.map((r) => r.id))
    notifyDecisions(tournament, pending.filter((r) => rejectedIds.has(r.id)), 'REJECTED')
    return Response.json({ rejected: rejectedIds.size })
  }

  // Free plan: the approved players must still fit within its player limit.
  const overLimit = await assertWithinPlan(tournament, { players: pending.length })
  if (overLimit) return overLimit

  const category = tournament.auctionMode === 'CATEGORY' ? normalizeCategory(body.category) : null
  if (category === false) return jsonError('Category must be one of A, B, C, D, E', 400)
  let basePrice: number
  if (body.basePrice !== undefined && body.basePrice !== null && body.basePrice !== '') {
    const parsed = coercePositiveInt(body.basePrice)
    if (!parsed) return jsonError('Base price must be a whole amount from ৳1 to ৳1,000,000,000', 400)
    basePrice = parsed
  } else {
    basePrice = (category && DEFAULT_CATEGORY_BASE_PRICES[category]) || tournament.basePrice
  }

  // Claim first, atomically: a double-click or a second organizer tab can't
  // both read the same PENDING rows and create every player twice — each row
  // flips to APPROVED for exactly one request.
  const claimedRows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "PlayerRegistration" SET "status" = 'APPROVED'
    WHERE "id" = ANY(${pending.map((r) => r.id)}::text[]) AND "tournamentId" = ${id} AND "status" = 'PENDING'
    RETURNING "id"`
  const claimedIds = new Set(claimedRows.map((r) => r.id))
  const claimed = pending.filter((r) => claimedIds.has(r.id))
  if (claimed.length === 0) return jsonError('Those registrations were already handled', 409)

  const inserted = await insertPlayersNumbered(
    id,
    claimed.map((r) => ({
      name: r.name,
      phone: r.phone,
      role: r.role,
      category,
      basePrice,
      previousTeam: r.previousTeam,
      photoUrl: r.photoUrl,
    })),
  ).catch((err) => {
    console.error('[registrations] creating players failed:', err)
    return null
  })
  if (!inserted) {
    // Give the claimed rows back so the organizer can simply retry.
    await db.playerRegistration.updateMany({ where: { id: { in: [...claimedIds] } }, data: { status: 'PENDING' } })
    return jsonError(PLAYER_NUMBER_CONFLICT, 409)
  }

  // insertPlayersNumbered preserves input order, so rows line up with `claimed`.
  await db.$transaction(
    claimed.map((r, i) => db.playerRegistration.update({ where: { id: r.id }, data: { playerId: inserted[i]?.id ?? null } })),
  )
  notifyDecisions(tournament, claimed, 'APPROVED')
  return Response.json({ approved: inserted.length })
}
