import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  isOwnerOrAdmin,
  requireSession,
  serializePlayer,
  serializeTeam,
} from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tournaments/:id/results — organizer/ADMIN, or a manager of a team in it
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament) return jsonError('Tournament not found', 404)

  if (!isOwnerOrAdmin(tournament, user)) {
    const managesTeam = await db.team.findFirst({
      where: { tournamentId: id, managerUserId: user.id },
      select: { id: true },
    })
    if (!managesTeam) return jsonError('You do not have permission to view these results', 403)
  }

  const [players, teams, auction] = await Promise.all([
    db.player.findMany({ where: { tournamentId: id }, orderBy: { playerNumber: 'asc' } }),
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
    }),
    db.auction.findUnique({ where: { tournamentId: id } }),
  ])

  const soldPlayers = players.filter((p) => p.status === 'SOLD')
  const totalValue = soldPlayers.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0)
  const totalBids = auction ? await db.bid.count({ where: { auctionId: auction.id } }) : 0

  const recentBids = auction
    ? await db.bid.findMany({
        where: { auctionId: auction.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    : []

  // The results report is a squad/spending view — personal contact details stay out of it.
  const withoutPhone = (p: (typeof players)[number]) => ({ ...serializePlayer(p), phone: null })

  return Response.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      sport: tournament.sport,
      location: tournament.location,
      startDate: tournament.startDate ? tournament.startDate.toISOString() : null,
      status: tournament.status,
      roomCode: auction?.roomCode ?? null,
    },
    summary: {
      totalPlayers: players.length,
      sold: soldPlayers.length,
      unsold: players.filter((p) => p.status === 'UNSOLD').length,
      available: players.filter((p) => p.status === 'AVAILABLE').length,
      skipped: players.filter((p) => p.status === 'SKIPPED').length,
      teams: teams.length,
      totalBids,
      totalValue,
    },
    teams: teams.map((team) => ({
      ...serializeTeam(team),
      players: players
        .filter((p) => p.status === 'SOLD' && p.soldToTeamId === team.id)
        .map(withoutPhone),
    })),
    recentBids: recentBids.map((b) => ({
      playerName: b.playerName,
      teamName: b.teamName,
      amount: b.amount,
      createdAt: b.createdAt.toISOString(),
    })),
  })
}
