import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  coercePositiveInt,
  isOwnerOrAdmin,
  parseDateInput,
  readJson,
  requireSession,
  serializeAuction,
  serializePlayer,
  serializeTeam,
  serializeTournamentFull,
} from '../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tournaments/:id — owner/ADMIN (full detail); MANAGER managing a team in it also allowed
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) return jsonError('Tournament not found', 404)

  if (!isOwnerOrAdmin(tournament, user)) {
    // Managers of a team inside this tournament can view the full detail (squad views)
    const managesTeam = await db.team.findFirst({
      where: { tournamentId: id, managerUserId: user.id },
      select: { id: true },
    })
    if (!managesTeam) return jsonError('You do not have permission to view this tournament', 403)
  }

  const [players, teams, auction] = await Promise.all([
    db.player.findMany({
      where: { tournamentId: id },
      orderBy: { playerNumber: 'asc' },
      include: { soldToTeam: { select: { name: true } } },
    }),
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { players: true } } },
    }),
    db.auction.findUnique({ where: { tournamentId: id } }),
  ])

  return Response.json({
    tournament: serializeTournamentFull(tournament),
    players: players.map(serializePlayer),
    teams: teams.map(serializeTeam),
    auction: auction ? serializeAuction(auction) : null,
  })
}

// PATCH /api/tournaments/:id — owner/ADMIN; no auctionMode/status change once LIVE/COMPLETED
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) return jsonError('Tournament not found', 404)
  if (!isOwnerOrAdmin(tournament, user)) {
    return jsonError('You do not have permission to manage this tournament', 403)
  }

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const isLocked = tournament.status === 'LIVE' || tournament.status === 'COMPLETED'
  if (isLocked && body.auctionMode !== undefined && body.auctionMode !== tournament.auctionMode) {
    return jsonError('Auction mode cannot be changed once the tournament is live or completed', 409)
  }

  const data: Partial<Prisma.TournamentUpdateInput> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 80) return jsonError('Tournament name must be 2–80 characters', 400)
    data.name = name
  }

  if (body.sport !== undefined) {
    if (body.sport !== 'CRICKET' && body.sport !== 'FOOTBALL') {
      return jsonError('Sport must be CRICKET or FOOTBALL', 400)
    }
    data.sport = body.sport
  }

  if (body.auctionMode !== undefined) {
    if (body.auctionMode !== 'CATEGORY' && body.auctionMode !== 'NORMAL') {
      return jsonError('Auction mode must be CATEGORY or NORMAL', 400)
    }
    data.auctionMode = body.auctionMode
  }

  if (body.basePrice !== undefined) {
    const basePrice = coercePositiveInt(body.basePrice)
    if (!basePrice) return jsonError('Base price must be a positive integer (taka)', 400)
    data.basePrice = basePrice
  }

  const nullableString = (key: string, max: number) => {
    if (body[key] === undefined) return
    if (body[key] === null || body[key] === '') {
      data[key] = null
      return
    }
    if (typeof body[key] !== 'string') {
      data[key] = null
      return
    }
    data[key] = (body[key] as string).trim().slice(0, max) || null
  }
  nullableString('tournamentType', 60)
  nullableString('description', 2000)
  nullableString('logoUrl', 500)
  nullableString('bannerUrl', 500)
  nullableString('location', 120)

  for (const key of ['startDate', 'auctionAt'] as const) {
    if (body[key] !== undefined) {
      const parsed = parseDateInput(body[key])
      if (!parsed.ok) return jsonError(`${key} must be a valid date (ISO string)`, 400)
      data[key] = parsed.date
    }
  }

  if (Object.keys(data).length === 0) return jsonError('No valid fields to update', 400)

  try {
    const updated = await db.tournament.update({ where: { id }, data })
    return Response.json({ tournament: serializeTournamentFull(updated) })
  } catch {
    return jsonError('Could not update tournament', 400)
  }
}

// DELETE /api/tournaments/:id — owner/ADMIN; blocked while the auction is LIVE
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const tournament = await db.tournament.findUnique({ where: { id }, include: { auction: true } })
  if (!tournament) return jsonError('Tournament not found', 404)
  if (!isOwnerOrAdmin(tournament, user)) {
    return jsonError('You do not have permission to delete this tournament', 403)
  }

  if (tournament.auction?.status === 'LIVE') {
    return jsonError('Cannot delete a tournament while its auction is live', 409)
  }

  // RoomParticipant has no FK relation in the schema — clean up manually.
  if (tournament.auction) {
    await db.roomParticipant.deleteMany({ where: { auctionId: tournament.auction.id } })
  }
  // Players/Teams/Auction/Bids cascade via onDelete: Cascade.
  await db.tournament.delete({ where: { id } })

  return Response.json({ ok: true })
}
