import type { Prisma } from '@prisma/client'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { track } from '@/lib/analytics'
import { isSport, type TournamentDetail } from '@/lib/types'
import { jsonError } from '@/lib/auth'
import {
  clampInt,
  MAX_AMOUNT,
  coercePositiveInt,
  parseDateInput,
  readJson,
  requireSession,
  requireSessionRole,
  parseOtherSportDetails,
  serializeTournamentFull,
  serializeTournamentSummary,
} from '../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/tournaments — ORGANIZER → own tournaments plus the ones they help run
// as staff (with staffRole set), ADMIN → all, MANAGER → [] (use /api/my/teams).
// Archived tournaments are left out for everyone (ADMIN sees them in /api/admin/tournaments).
export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const where: Prisma.TournamentWhereInput =
    user.role === 'ADMIN'
      ? { archivedAt: null }
      : { archivedAt: null, OR: [{ organizerId: user.id }, { staff: { some: { userId: user.id } } }] }
  // Sold counts filter by the same condition, so all queries run at once
  // instead of the second waiting for the first one's ids.
  const [tournaments, soldGroups, staffRows] = await Promise.all([
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
    user.role === 'ADMIN'
      ? Promise.resolve([] as { tournamentId: string; role: string }[])
      : db.tournamentStaff.findMany({ where: { userId: user.id }, select: { tournamentId: true, role: true } }),
  ])
  const soldMap = new Map(soldGroups.map((g) => [g.tournamentId, g._count._all]))
  const staffMap = new Map(staffRows.map((s) => [s.tournamentId, s.role]))

  return Response.json({
    tournaments: tournaments.map((t) => {
      const staffRole = t.organizerId === user.id ? null : staffMap.get(t.id)
      return {
        ...serializeTournamentSummary({ ...t, soldCount: soldMap.get(t.id) ?? 0 }),
        staffRole: staffRole === 'CO_ORGANIZER' || staffRole === 'AUCTIONEER' ? staffRole : null,
      }
    }),
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

  const sport = isSport(body.sport) ? body.sport : null
  if (!sport) return jsonError('Sport must be CRICKET, FOOTBALL or OTHER', 400)
  const other = parseOtherSportDetails(sport, body, true)
  if (!other.ok) return jsonError(other.error, 400)

  const auctionMode =
    body.auctionMode === 'NORMAL' ? 'NORMAL' : body.auctionMode === 'CATEGORY' ? 'CATEGORY' : null
  if (body.auctionMode !== undefined && !auctionMode) {
    return jsonError('Auction mode must be CATEGORY or NORMAL', 400)
  }

  if (body.basePrice !== undefined && body.basePrice !== null && body.basePrice !== '') {
    const basePrice = coercePositiveInt(body.basePrice)
    if (!basePrice) return jsonError('Base price must be a whole amount from ৳1 to ৳1,000,000,000', 400)
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
      ...other.data,
      tournamentType: optionalString(body.tournamentType, 60),
      description: optionalString(body.description, 2000),
      location: optionalString(body.location, 120),
      startDate,
      auctionAt,
      auctionMode: auctionMode ?? 'CATEGORY',
      basePrice: clampInt(body.basePrice ?? 10000, 1, MAX_AMOUNT, 10000),
      status: 'DRAFT',
      organizerId: user.id,
    },
  })
  // after(): runs once the response is sent, and the platform waits for it (a bare promise can be frozen mid-write).
  after(() => track('tournament_created', { userId: user.id, tournamentId: tournament.id }))

  // A new tournament has no players, teams or auction yet, so this is exactly
  // what GET /api/tournaments/:id would return. Sending it now lets the Manage
  // page open instantly instead of making a second round trip for it.
  const detail: TournamentDetail = {
    tournament: serializeTournamentFull(tournament),
    myAccess: user.role === 'ADMIN' ? 'ADMIN' : 'OWNER',
    players: [],
    teams: [],
    auction: null,
  }
  return Response.json({ tournament: serializeTournamentSummary(tournament), detail }, { status: 201 })
}
