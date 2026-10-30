import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { DEFAULT_CATEGORY_BASE_PRICES } from '@/lib/types'
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
  return Response.json({
    registrationOpen: loaded.tournament.registrationOpen,
    registrationCode: loaded.tournament.registrationCode,
    registrations: registrations.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
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

// PATCH /api/tournaments/:id/registrations {ids, action: 'approve'|'reject', category?, basePrice?}
// Approving turns PENDING sign-ups into real players (in one transaction).
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
  if (body.action !== 'approve' && body.action !== 'reject') return jsonError('action must be approve or reject', 400)

  const pending = await db.playerRegistration.findMany({
    where: { id: { in: ids }, tournamentId: id, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })
  if (pending.length === 0) return jsonError('Those registrations were already handled', 409)

  if (body.action === 'reject') {
    await db.playerRegistration.updateMany({
      where: { id: { in: pending.map((r) => r.id) }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    })
    return Response.json({ rejected: pending.length })
  }

  const category = tournament.auctionMode === 'CATEGORY' ? normalizeCategory(body.category) : null
  if (category === false) return jsonError('Category must be one of A, B, C, D, E', 400)
  let basePrice: number
  if (body.basePrice !== undefined && body.basePrice !== null && body.basePrice !== '') {
    const parsed = coercePositiveInt(body.basePrice)
    if (!parsed) return jsonError('Base price must be a positive amount in taka', 400)
    basePrice = parsed
  } else {
    basePrice = (category && DEFAULT_CATEGORY_BASE_PRICES[category]) || tournament.basePrice
  }

  const inserted = await insertPlayersNumbered(
    id,
    pending.map((r) => ({
      name: r.name,
      phone: r.phone,
      role: r.role,
      category,
      basePrice,
      previousTeam: r.previousTeam,
      photoUrl: r.photoUrl,
    })),
  )
  if (!inserted) return jsonError(PLAYER_NUMBER_CONFLICT, 409)

  // insertPlayersNumbered preserves input order, so rows line up with `pending`.
  await db.$transaction(
    pending.map((r, i) =>
      db.playerRegistration.update({ where: { id: r.id }, data: { status: 'APPROVED', playerId: inserted[i]?.id ?? null } }),
    ),
  )
  return Response.json({ approved: inserted.length })
}
