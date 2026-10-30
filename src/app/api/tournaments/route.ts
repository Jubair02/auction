import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  clampInt,
  coercePositiveInt,
  parseDateInput,
  readJson,
  requireSession,
  requireSessionRole,
  serializeTournamentSummary,
} from '../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/tournaments — ORGANIZER → own tournaments, ADMIN → all, MANAGER → [] (use /api/my/teams)
export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const where = user.role === 'ADMIN' ? {} : { organizerId: user.id }
  // Sold counts filter by the same owner condition, so both queries run at once
  // instead of the second waiting for the first one's ids.
  const [tournaments, soldGroups] = await Promise.all([
    db.tournament.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { players: true, teams: true } },
        auction: { select: { roomCode: true, status: true } },
      },
    }),
    db.player.groupBy({
      by: ['tournamentId'],
      where: { status: 'SOLD', tournament: where },
      _count: { _all: true },
    }),
  ])
  const soldMap = new Map(soldGroups.map((g) => [g.tournamentId, g._count._all]))

  return Response.json({
    tournaments: tournaments.map((t) =>
      serializeTournamentSummary({ ...t, soldCount: soldMap.get(t.id) ?? 0 }),
    ),
  })
}

// POST /api/tournaments — ORGANIZER/ADMIN creates a DRAFT tournament
export async function POST(req: Request) {
  const auth = await requireSessionRole('ORGANIZER', 'ADMIN')
  if ('response' in auth) return auth.response
  const { user } = auth

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 80) {
    return jsonError('Tournament name must be 2–80 characters', 400)
  }

  const sport = body.sport === 'FOOTBALL' ? 'FOOTBALL' : body.sport === 'CRICKET' ? 'CRICKET' : null
  if (!sport) return jsonError('Sport must be CRICKET or FOOTBALL', 400)

  const auctionMode =
    body.auctionMode === 'NORMAL' ? 'NORMAL' : body.auctionMode === 'CATEGORY' ? 'CATEGORY' : null
  if (body.auctionMode !== undefined && !auctionMode) {
    return jsonError('Auction mode must be CATEGORY or NORMAL', 400)
  }

  if (body.basePrice !== undefined && body.basePrice !== null && body.basePrice !== '') {
    const basePrice = coercePositiveInt(body.basePrice)
    if (!basePrice) return jsonError('Base price must be a positive integer (taka)', 400)
  }

  const optionalString = (v: unknown, max: number): string | null => {
    if (v === undefined || v === null) return null
    if (typeof v !== 'string') return null
    const s = v.trim()
    return s === '' ? null : s.slice(0, max)
  }

  let startDate: Date | null = null
  if (body.startDate !== undefined && body.startDate !== null && body.startDate !== '') {
    const parsed = parseDateInput(body.startDate)
    if (!parsed.ok) return jsonError('Start date must be a valid date (ISO string)', 400)
    startDate = parsed.date
  }
  let auctionAt: Date | null = null
  if (body.auctionAt !== undefined && body.auctionAt !== null && body.auctionAt !== '') {
    const parsed = parseDateInput(body.auctionAt)
    if (!parsed.ok) return jsonError('Auction date must be a valid date (ISO string)', 400)
    auctionAt = parsed.date
  }

  const tournament = await db.tournament.create({
    data: {
      name,
      sport,
      tournamentType: optionalString(body.tournamentType, 60),
      description: optionalString(body.description, 2000),
      location: optionalString(body.location, 120),
      startDate,
      auctionAt,
      auctionMode: auctionMode ?? 'CATEGORY',
      basePrice: clampInt(body.basePrice ?? 10000, 1, Number.MAX_SAFE_INTEGER, 10000),
      status: 'DRAFT',
      organizerId: user.id,
    },
  })

  return Response.json({ tournament: serializeTournamentSummary(tournament) }, { status: 201 })
}
