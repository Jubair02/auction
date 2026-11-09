import { loadTournamentForOwner, requireSession } from '../../../_lib/helpers'
import { buildLeagueData } from '../../../matches/_lib/league-server'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tournaments/:id/league — staff (any level): settings, teams,
// fixtures, points tables, leaderboards and squads (for stats entry).
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user, 'run')
  if ('response' in loaded) return loaded.response

  return Response.json(await buildLeagueData(loaded.tournament, { viewer: 'staff', includeSquads: true, branding: null }))
}
