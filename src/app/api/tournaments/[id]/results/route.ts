import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import { getPublicBranding } from '@/lib/branding'
import {
  hiddenByArchive,
  serializePlayer,
  serializeTeam,
  accessAllows,
  tournamentAccess,
} from '../../../_lib/helpers'
import { resultsArePublic } from '../../../og/_lib/public-results'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tournaments/:id/results — tournament staff (owner, ADMIN,
// co-organizer, auctioneer), a manager of a team in it, or — once the auction
// is over and the organizer left results public — anyone, logged in or not.
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const user = await getSessionUser()

  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament || hiddenByArchive(tournament, user)) return jsonError('Tournament not found', 404)

  const auction = await db.auction.findUnique({ where: { tournamentId: id } })
  const isPublic = resultsArePublic(tournament, auction)

  const access = user ? await tournamentAccess(tournament, user) : null
  let viewer: 'staff' | 'manager' | 'public' = 'public'
  if (access) viewer = 'staff'
  else if (user) {
    const managesTeam = await db.team.findFirst({
      where: { tournamentId: id, managerUserId: user.id },
      select: { id: true },
    })
    if (managesTeam) viewer = 'manager'
  }
  if (viewer === 'public' && !isPublic) {
    return user
      ? jsonError('You do not have permission to view these results', 403)
      : jsonError('You must be logged in', 401)
  }

  const [players, teams, branding] = await Promise.all([
    db.player.findMany({ where: { tournamentId: id }, orderBy: { playerNumber: 'asc' } }),
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
    }),
    getPublicBranding(tournament),
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

  // The results report is a squad/spending view — personal contact details
  // (phone numbers, manager names and emails) stay out of it for every viewer,
  // staff included (auctioneers must never get them); exports carry those.
  const withoutPhone = (p: (typeof players)[number]) => ({ ...serializePlayer(p), phone: null })
  const publicTeam = (team: (typeof teams)[number]) => ({
    ...serializeTeam(team),
    managerName: null,
    managerEmail: null,
    ...(viewer === 'public' ? { managerUserId: null } : {}),
  })

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
      ...publicTeam(team),
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
    // CSV exports are for owner / ADMIN / co-organizer; tell the UI so it can hide them.
    canManage: accessAllows(access, 'manage'),
    resultsPublic: tournament.resultsPublic,
    /** Anyone with the link can see these results right now (share bar). */
    publicNow: isPublic,
    viewer,
    /** Logo, brand colour, sponsors and whether to hide NeelamGhor marks (PRO only). */
    branding,
  })
}
