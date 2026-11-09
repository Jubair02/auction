import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { MATCH_STAGES, type MatchStage } from '@/lib/league'
import { isUniqueViolation, loadTournamentForOwner, parseDateInput, readJson, requireSession } from '../../../../_lib/helpers'
import { GROUP_NAME_RE, optionalInt, optionalText, serializeMatch, syncBracket } from '../../../../matches/_lib/league-server'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const MAX_MATCHES = 500

// POST /api/tournaments/:id/league/matches — owner / ADMIN / co-organizer.
// Adds one custom match. Body: { stage?, groupName?, round?, homeTeamId?,
// awayTeamId?, homeLabel?, awayLabel?, scheduledAt?, venue? }. Each side
// needs a team or a placeholder label (e.g. "Winner M7", "Winner League").
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response
  const { tournament } = loaded

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const stage = (body.stage ?? 'LEAGUE') as MatchStage
  if (!MATCH_STAGES.includes(stage)) return jsonError('Unknown match stage', 400)
  let groupName: string | null = null
  if (stage === 'GROUP') {
    const g = typeof body.groupName === 'string' ? body.groupName.trim() : ''
    if (!GROUP_NAME_RE.test(g)) return jsonError('A group match needs a group name, e.g. A', 400)
    groupName = g
  }
  const round = optionalInt(body.round, 1, 200)
  if (round === false) return jsonError('Round must be from 1 to 200', 400)
  const venue = optionalText(body.venue, 80)
  if (venue === false) return jsonError('Venue must be at most 80 characters', 400)
  const when = parseDateInput(body.scheduledAt)
  if (!when.ok) return jsonError('Match date must be a valid date', 400)

  const teamIds = new Set((await db.team.findMany({ where: { tournamentId: id }, select: { id: true } })).map((t) => t.id))
  const side = (teamKey: string, labelKey: string): { teamId: string | null; label: string | null } | string => {
    const teamId = body[teamKey]
    if (teamId !== undefined && teamId !== null && teamId !== '') {
      if (typeof teamId !== 'string' || !teamIds.has(teamId)) return 'Team not found in this tournament'
      return { teamId, label: null }
    }
    const label = optionalText(body[labelKey], 40)
    if (label === false) return 'Placeholder must be at most 40 characters'
    if (!label) return 'Pick a team or write a placeholder (e.g. Winner M7) for both sides'
    return { teamId: null, label }
  }
  const home = side('homeTeamId', 'homeLabel')
  if (typeof home === 'string') return jsonError(home, 400)
  const away = side('awayTeamId', 'awayLabel')
  if (typeof away === 'string') return jsonError(away, 400)
  if (home.teamId && home.teamId === away.teamId) return jsonError('A team cannot play itself', 400)

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const match = await db.$transaction(async (tx) => {
        const agg = await tx.match.aggregate({ where: { tournamentId: id }, _max: { matchNumber: true, round: true }, _count: true })
        if (agg._count >= MAX_MATCHES) return null
        return tx.match.create({
          data: {
            tournamentId: id,
            matchNumber: (agg._max.matchNumber ?? 0) + 1,
            stage,
            groupName,
            round: round ?? agg._max.round ?? 1,
            homeTeamId: home.teamId,
            awayTeamId: away.teamId,
            homeLabel: home.label,
            awayLabel: away.label,
            scheduledAt: when.date,
            venue: venue ?? null,
          },
        })
      })
      if (!match) return jsonError(`A tournament can have at most ${MAX_MATCHES} matches`, 400)
      await syncBracket(tournament)
      return Response.json({ match: serializeMatch(match) }, { status: 201 })
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 1) {
        if (isUniqueViolation(e)) return jsonError('Another match was added at the same moment. Please try again.', 409)
        throw e
      }
    }
  }
  return jsonError('Could not add the match. Please try again.', 409)
}
