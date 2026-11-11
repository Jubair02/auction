import { randomInt } from 'crypto'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { generateFixtures, LEAGUE_FORMATS, scheduleFixtures, type LeagueFormatKind } from '@/lib/league'
import { isUniqueViolation, loadTournamentForOwner, parseDateInput, readJson, requireSession } from '../../../../_lib/helpers'
import { optionalInt, optionalText } from '../../../../matches/_lib/league-server'

const RESULTS_EXIST = 'Some matches already have results. Confirm replacing to delete every match and its stats.'
class ResultsExist extends Error {}

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/tournaments/:id/league/generate — owner / ADMIN / co-organizer.
// Body: { format, groupCount?, qualifiersPerGroup?, thirdPlace?, shuffle?,
//         startDate?, intervalDays?, matchesPerDay?, venue?, replace? }
// Replaces the tournament's fixtures. Refuses (409) while any match has a
// result or player stats, unless replace: true — which deletes every match
// and its stats first.
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const format = body.format as LeagueFormatKind
  if (!LEAGUE_FORMATS.includes(format)) {
    return jsonError('League format must be ROUND_ROBIN, DOUBLE_ROUND_ROBIN, GROUPS_KNOCKOUT or KNOCKOUT', 400)
  }
  const groupCount = optionalInt(body.groupCount, 1, 16)
  if (groupCount === false) return jsonError('Number of groups must be from 1 to 16', 400)
  const qualifiers = optionalInt(body.qualifiersPerGroup, 1, 8)
  if (qualifiers === false) return jsonError('Teams qualifying per group must be from 1 to 8', 400)
  const intervalDays = optionalInt(body.intervalDays, 0, 60)
  if (intervalDays === false) return jsonError('Days between rounds must be from 0 to 60', 400)
  const matchesPerDay = optionalInt(body.matchesPerDay, 1, 20)
  if (matchesPerDay === false) return jsonError('Matches per day must be from 1 to 20', 400)
  const venue = optionalText(body.venue, 80)
  if (venue === false) return jsonError('Venue must be at most 80 characters', 400)
  const start = parseDateInput(body.startDate)
  if (!start.ok) return jsonError('Start date must be a valid date', 400)

  const teams = await db.team.findMany({
    where: { tournamentId: id },
    orderBy: { name: 'asc' },
    select: { id: true, groupName: true },
  })
  if (teams.length < 2) return jsonError('Add at least 2 teams before making fixtures', 400)
  if (body.shuffle === true) {
    for (let i = teams.length - 1; i > 0; i--) {
      const j = randomInt(i + 1)
      ;[teams[i], teams[j]] = [teams[j], teams[i]]
    }
  }

  // A match with a result, stats, or one being played right now (LIVE) is only
  // replaced when the organizer confirms. Checked again inside the transaction
  // below, so a result saved meanwhile is never deleted without that.
  const replace = body.replace === true
  const hasResults = (client: Pick<typeof db, 'match'>) =>
    client.match
      .count({
        where: {
          tournamentId: id,
          OR: [{ status: { in: ['COMPLETED', 'ABANDONED', 'LIVE'] } }, { stats: { some: {} } }],
        },
      })
      .then((n) => n > 0)
  if (!replace && (await hasResults(db))) return jsonError(RESULTS_EXIST, 409)

  const generated = generateFixtures({
    format,
    teams,
    groupCount: groupCount ?? undefined,
    qualifiersPerGroup: qualifiers ?? undefined,
    thirdPlace: body.thirdPlace === true,
  })
  if (!generated.ok) return jsonError(generated.error, 400)
  const { fixtures, groups } = generated
  const dates = start.date
    ? scheduleFixtures(fixtures, { start: start.date, intervalDays: intervalDays ?? 1, matchesPerDay: matchesPerDay ?? null })
    : null

  try {
    await db.$transaction(async (tx) => {
      if (!replace && (await hasResults(tx))) throw new ResultsExist()
      await tx.match.deleteMany({ where: { tournamentId: id } })
      await tx.match.createMany({
        data: fixtures.map((f, i) => ({
          tournamentId: id,
          matchNumber: f.matchNumber,
          stage: f.stage,
          groupName: f.groupName,
          round: f.round,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          homeLabel: f.homeLabel,
          awayLabel: f.awayLabel,
          scheduledAt: dates ? dates[i] : null,
          venue: venue ?? null,
        })),
      })
      await tx.tournament.update({ where: { id }, data: { leagueFormat: format } })
      // Save the (possibly auto-balanced) groups on the teams.
      for (const [groupName, ids] of groups ? [...groups.entries()] : []) {
        await tx.team.updateMany({ where: { tournamentId: id, id: { in: ids } }, data: { groupName } })
      }
    })
  } catch (e) {
    if (e instanceof ResultsExist) return jsonError(RESULTS_EXIST, 409)
    if (isUniqueViolation(e)) return jsonError('Fixtures were being changed at the same moment. Please try again.', 409)
    throw e
  }

  return Response.json({ ok: true, created: fixtures.length, format })
}
