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
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params
  // ?view=public — what a visitor without an account sees, whoever asks. It
  // never depends on the cookie, so the CDN may cache it for shared links (the
  // page asks for it when nobody is signed in); the signed-in view never is.
  const publicView = new URL(req.url).searchParams.get('view') === 'public'
  // Two round trips in all: who is asking + the tournament (with its auction),
  // then the permission checks and every data query together. Nothing is sent
  // before the checks pass.
  const [user, found] = await Promise.all([
    publicView ? null : getSessionUser(),
    db.tournament.findUnique({ where: { id }, include: { auction: true } }),
  ])
  if (!found || hiddenByArchive(found, user)) return jsonError('Tournament not found', 404)
  const { auction, ...tournament } = found
  const isPublic = resultsArePublic(tournament, auction)

  // Owner and ADMIN are known without a query, so only others pay for the
  // "manages a team here" lookup.
  const ownerOrAdmin = !!user && (user.role === 'ADMIN' || tournament.organizerId === user.id)
  const [access, managesTeam, players, teams, branding, totalBids, recentBids] = await Promise.all([
    user ? tournamentAccess(tournament, user) : null,
    user && !ownerOrAdmin
      ? db.team.findFirst({ where: { tournamentId: id, managerUserId: user.id }, select: { id: true } })
      : null,
    db.player.findMany({ where: { tournamentId: id }, orderBy: { playerNumber: 'asc' } }),
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
    }),
    getPublicBranding(tournament),
    auction ? db.bid.count({ where: { auctionId: auction.id } }) : 0,
    auction
      ? db.bid.findMany({
          where: { auctionId: auction.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [],
  ])

  let viewer: 'staff' | 'manager' | 'public' = 'public'
  if (access) viewer = 'staff'
  else if (user && managesTeam) viewer = 'manager'
  if (viewer === 'public' && !isPublic) {
    return user
      ? jsonError('You do not have permission to view these results', 403)
      : jsonError('You must be logged in', 401)
  }

  const soldPlayers = players.filter((p) => p.status === 'SOLD')
  const totalValue = soldPlayers.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0)

  // The results report is a squad/spending view — personal contact details
  // (phone numbers, manager names and emails) stay out of it for every viewer,
  // staff included (auctioneers must never get them); exports carry those.
  const withoutPhone = (p: (typeof players)[number]) => ({ ...serializePlayer(p), phone: null })
  const publicTeam = (team: (typeof teams)[number]) => ({
    ...serializeTeam(team),
    managerName: null,
    managerEmail: null,
    // Account ids are organizer data too: a manager sees only their own.
    managerUserId: viewer === 'staff' || (user && team.managerUserId === user.id) ? team.managerUserId : null,
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
  }, publicView ? { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } } : undefined)
}
