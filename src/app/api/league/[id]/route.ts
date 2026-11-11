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
  const user = publicView ? null : await getSessionUser()

  const tournament = await db.tournament.findUnique({ where: { id } })
  if (!tournament || hiddenByArchive(tournament, user)) return jsonError('League not found', 404)

  let viewer: 'staff' | 'manager' | 'public' = 'public'
  if (user) {
    if (await tournamentAccess(tournament, user)) viewer = 'staff'
    else {
      const managesTeam = await db.team.findFirst({
        where: { tournamentId: id, managerUserId: user.id },
        select: { id: true },
      })
      if (managesTeam) viewer = 'manager'
    }
  }
  if (viewer === 'public' && !tournament.resultsPublic) return jsonError('League not found', 404)

  const branding = await getPublicBranding(tournament)
  return Response.json(
    await buildLeagueData(tournament, { viewer, includeSquads: false, branding }),
    publicView ? { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } } : undefined,
  )
}
