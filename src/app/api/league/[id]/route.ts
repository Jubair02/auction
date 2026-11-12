import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import { getPublicBranding } from '@/lib/branding'
import { hiddenByArchive, tournamentAccess } from '../../_lib/helpers'
import { buildLeagueData } from '../../matches/_lib/league-server'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/league/:id — the public league page: fixtures, results, points
// tables and top performers. Tournament staff and its team managers can
// always see it; anyone else only while "Public results page" is on (and the
// tournament is not archived). Private and missing leagues both answer 404.
// Never includes phone numbers or squads.
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params
  // ?view=public — the signed-out view whoever asks: cookie-independent, so the
  // CDN may cache it for shared links. The signed-in view is never cached.
  const publicView = new URL(req.url).searchParams.get('view') === 'public'
  // Who is asking and the tournament together; then the permission checks and
  // the branding together. Nothing is sent before the checks pass.
  const [user, tournament] = await Promise.all([
    publicView ? null : getSessionUser(),
    db.tournament.findUnique({ where: { id } }),
  ])
  if (!tournament || hiddenByArchive(tournament, user)) return jsonError('League not found', 404)

  // Owner and ADMIN are known without a query, so only others pay for the
  // "manages a team here" lookup.
  const ownerOrAdmin = !!user && (user.role === 'ADMIN' || tournament.organizerId === user.id)
  const [access, managesTeam, branding] = await Promise.all([
    user ? tournamentAccess(tournament, user) : null,
    user && !ownerOrAdmin
      ? db.team.findFirst({ where: { tournamentId: id, managerUserId: user.id }, select: { id: true } })
      : null,
    getPublicBranding(tournament),
  ])
  let viewer: 'staff' | 'manager' | 'public' = 'public'
  if (access) viewer = 'staff'
  else if (user && managesTeam) viewer = 'manager'
  if (viewer === 'public' && !tournament.resultsPublic) return jsonError('League not found', 404)

  return Response.json(
    await buildLeagueData(tournament, { viewer, includeSquads: false, branding }),
    publicView ? { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } } : undefined,
  )
}
