import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { loadTournamentForOwner, readJson, requireSession } from '../../../../_lib/helpers'
import { GROUP_NAME_RE } from '../../../../matches/_lib/league-server'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// PATCH /api/tournaments/:id/league/groups — owner / ADMIN / co-organizer.
// Body: { assignments: [{ teamId, groupName | null }] }. Used before making
// group-stage fixtures; existing fixtures are not changed.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response

  const body = await readJson(req)
  if (!body || !Array.isArray(body.assignments)) return jsonError('Provide an "assignments" array', 400)
  if (body.assignments.length > 200) return jsonError('Too many assignments', 400)

  const teams = await db.team.findMany({ where: { tournamentId: id }, select: { id: true } })
  const teamIds = new Set(teams.map((t) => t.id))
  const updates = new Map<string, string | null>()
  for (const raw of body.assignments as unknown[]) {
    if (!raw || typeof raw !== 'object') return jsonError('Each assignment needs a teamId and a groupName', 400)
    const a = raw as Record<string, unknown>
    if (typeof a.teamId !== 'string' || !teamIds.has(a.teamId)) return jsonError('Team not found in this tournament', 400)
    let groupName: string | null = null
    if (a.groupName !== null && a.groupName !== undefined && a.groupName !== '') {
      if (typeof a.groupName !== 'string' || !GROUP_NAME_RE.test(a.groupName.trim())) {
        return jsonError('Group names must be 1–20 letters or numbers, e.g. A or B', 400)
      }
      groupName = a.groupName.trim()
    }
    updates.set(a.teamId, groupName)
  }

  await db.$transaction([...updates.entries()].map(([teamId, groupName]) => db.team.update({ where: { id: teamId }, data: { groupName } })))
  return Response.json({ ok: true, updated: updates.size })
}
