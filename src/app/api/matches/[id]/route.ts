import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  describeResult,
  isKnockoutStage,
  MATCH_STAGES,
  MATCH_STATUSES,
  oversToBalls,
  RESULT_TYPES,
  type MatchStage,
  type MatchStatus,
  type ResultType,
} from '@/lib/league'
import type { Prisma } from '@prisma/client'
import { parseDateInput, readJson, requireSession } from '../../_lib/helpers'
import {
  allOutWickets,
  GROUP_NAME_RE,
  loadMatchForStaff,
  optionalInt,
  optionalText,
  serializeMatch,
  syncBracket,
} from '../_lib/league-server'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const SCORE_MAX: Record<string, number> = { CRICKET: 1500, FOOTBALL: 99, OTHER: 10000 }

// PATCH /api/matches/:id — owner / ADMIN / co-organizer.
// Schedule: { scheduledAt?, venue?, round?, stage?, groupName? }
// Teams:    { homeTeamId?, awayTeamId?, homeLabel?, awayLabel? } — setting a
//           team by hand clears that side's placeholder label.
// Result:   { status?, homeScore?, awayScore?, homeWickets?, awayWickets?,
//           homeBalls? | homeOvers? ("19.4"), awayBalls? | awayOvers?,
//           resultType?, winnerTeamId?, resultNote? ('' = write it for me),
//           playerOfMatchId?, battedFirst? ('HOME' | 'AWAY', cricket note only) }
// A NORMAL result's winner comes from the score; a level knockout needs the
// winner (penalties / super over). Knockout placeholders are refreshed after.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadMatchForStaff(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response
  const { match, tournament } = loaded
  const sport = tournament.sport

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const data: Prisma.MatchUncheckedUpdateInput = {}

  // ---- schedule ----
  if (body.scheduledAt !== undefined) {
    const when = parseDateInput(body.scheduledAt)
    if (!when.ok) return jsonError('Match date must be a valid date', 400)
    data.scheduledAt = when.date
  }
  const venue = optionalText(body.venue, 80)
  if (venue === false) return jsonError('Venue must be at most 80 characters', 400)
  if (venue !== undefined) data.venue = venue
  const round = optionalInt(body.round, 1, 200)
  if (round === false || round === null) {
    if (round === false) return jsonError('Round must be from 1 to 200', 400)
  } else if (round !== undefined) data.round = round
  let stage = match.stage as MatchStage
  if (body.stage !== undefined) {
    if (!MATCH_STAGES.includes(body.stage as MatchStage)) return jsonError('Unknown match stage', 400)
    stage = body.stage as MatchStage
    data.stage = stage
  }
  if (body.groupName !== undefined || body.stage !== undefined) {
    if (stage === 'GROUP') {
      const g = typeof body.groupName === 'string' ? body.groupName.trim() : (match.groupName ?? '')
      if (!GROUP_NAME_RE.test(g)) return jsonError('A group match needs a group name, e.g. A', 400)
      data.groupName = g
    } else data.groupName = null
  }

  // ---- teams ----
  let homeTeamId = match.homeTeamId
  let awayTeamId = match.awayTeamId
  const teamsInTournament = async () =>
    new Set((await db.team.findMany({ where: { tournamentId: tournament.id }, select: { id: true } })).map((t) => t.id))
  let validTeams: Set<string> | null = null
  for (const sideName of ['home', 'away'] as const) {
    const teamKey = `${sideName}TeamId` as const
    const labelKey = `${sideName}Label` as const
    if (body[teamKey] !== undefined) {
      const v = body[teamKey]
      let next: string | null = null
      if (v !== null && v !== '') {
        validTeams ??= await teamsInTournament()
        if (typeof v !== 'string' || !validTeams.has(v)) return jsonError('Team not found in this tournament', 400)
        next = v
      }
      if (sideName === 'home') homeTeamId = next
      else awayTeamId = next
      data[teamKey] = next
      // A hand-picked team overrides the placeholder.
      if (next && body[labelKey] === undefined) data[labelKey] = null
    }
    if (body[labelKey] !== undefined) {
      const label = optionalText(body[labelKey], 40)
      if (label === false) return jsonError('Placeholder must be at most 40 characters', 400)
      data[labelKey] = label
    }
  }
  if (homeTeamId && homeTeamId === awayTeamId) return jsonError('A team cannot play itself', 400)
  const teamsChanged = homeTeamId !== match.homeTeamId || awayTeamId !== match.awayTeamId

  // ---- result ----
  let status = match.status as MatchStatus
  if (body.status !== undefined) {
    if (!MATCH_STATUSES.includes(body.status as MatchStatus)) return jsonError('Unknown match status', 400)
    status = body.status as MatchStatus
  }

  const scoreMax = SCORE_MAX[sport] ?? SCORE_MAX.OTHER
  const wicketsMax = allOutWickets(tournament)
  const ballsMax = tournament.oversPerInnings ? tournament.oversPerInnings * 6 : 600
  const next = {
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeWickets: match.homeWickets,
    awayWickets: match.awayWickets,
    homeBalls: match.homeBalls,
    awayBalls: match.awayBalls,
  }
  const resultKeys = [
    'homeScore', 'awayScore', 'homeWickets', 'awayWickets', 'homeBalls', 'awayBalls', 'homeOvers', 'awayOvers',
    'resultType', 'winnerTeamId', 'playerOfMatchId',
  ]
  const resultSent = resultKeys.some((k) => body[k] !== undefined) || body.status !== undefined
  for (const key of ['homeScore', 'awayScore'] as const) {
    const n = optionalInt(body[key], 0, scoreMax)
    if (n === false) return jsonError(`Scores must be whole numbers from 0 to ${scoreMax}`, 400)
    if (n !== undefined) next[key] = n
  }
  if (sport === 'CRICKET') {
    for (const key of ['homeWickets', 'awayWickets'] as const) {
      const n = optionalInt(body[key], 0, wicketsMax)
      if (n === false) return jsonError(`Wickets must be from 0 to ${wicketsMax}`, 400)
      if (n !== undefined) next[key] = n
    }
    for (const sideName of ['home', 'away'] as const) {
      const ballsKey = `${sideName}Balls` as const
      const oversKey = `${sideName}Overs` as const
      let balls: number | null | undefined = undefined
      if (body[oversKey] !== undefined) {
        if (body[oversKey] === null || body[oversKey] === '') balls = null
        else {
          const b = oversToBalls(body[oversKey] as string | number)
          if (b === null) return jsonError('Overs must look like 19.4 (balls after the dot: 0–5)', 400)
          balls = b
        }
      } else if (body[ballsKey] !== undefined) {
        const b = optionalInt(body[ballsKey], 0, 600)
        if (b === false) return jsonError('Balls must be from 0 to 600', 400)
        balls = b
      }
      if (balls !== undefined) {
        if (balls !== null && balls > ballsMax) {
          return jsonError(`Overs can't be more than the ${tournament.oversPerInnings} overs per innings`, 400)
        }
        next[ballsKey] = balls
      }
    }
  } else {
    next.homeWickets = next.awayWickets = next.homeBalls = next.awayBalls = null
  }

  let resultType = (match.resultType ?? null) as ResultType | null
  if (body.resultType !== undefined) {
    if (body.resultType === null || body.resultType === '') resultType = null
    else if (!RESULT_TYPES.includes(body.resultType as ResultType)) return jsonError('Unknown result type', 400)
    else resultType = body.resultType as ResultType
  }
  let winnerTeamId = match.winnerTeamId
  if (body.winnerTeamId !== undefined) {
    winnerTeamId = typeof body.winnerTeamId === 'string' && body.winnerTeamId !== '' ? body.winnerTeamId : null
  }
  let playerOfMatchId = match.playerOfMatchId
  if (body.playerOfMatchId !== undefined) {
    playerOfMatchId = typeof body.playerOfMatchId === 'string' && body.playerOfMatchId !== '' ? body.playerOfMatchId : null
  }
  let resultNote = match.resultNote
  let autoNote = false
  if (body.resultNote !== undefined) {
    const note = optionalText(body.resultNote, 160)
    if (note === false) return jsonError('Result note must be at most 160 characters', 400)
    resultNote = note ?? null
    autoNote = !note
  } else if (resultSent || teamsChanged) autoNote = true

  const knockout = isKnockoutStage(stage)
  if (winnerTeamId && winnerTeamId !== homeTeamId && winnerTeamId !== awayTeamId) {
    return jsonError('The winner must be one of the two teams', 400)
  }

  if (status === 'SCHEDULED' || status === 'POSTPONED') {
    Object.assign(next, { homeScore: null, awayScore: null, homeWickets: null, awayWickets: null, homeBalls: null, awayBalls: null })
    resultType = null
    winnerTeamId = null
    playerOfMatchId = null
    resultNote = null
    autoNote = false
  } else if (status === 'LIVE') {
    // Live score only; the result comes when it is completed.
    resultType = null
    winnerTeamId = null
    resultNote = null
    autoNote = false
  } else if (status === 'ABANDONED') {
    resultType = 'NO_RESULT'
    winnerTeamId = null
    if (autoNote) resultNote = 'Match abandoned'
    autoNote = false
  } else {
    // COMPLETED
    if (!homeTeamId || !awayTeamId) return jsonError('Both teams must be set before entering a result', 400)
    const rt: ResultType = resultType ?? 'NORMAL'
    resultType = rt
    const hs = next.homeScore
    const as = next.awayScore
    if (rt === 'NORMAL') {
      if (hs === null || as === null) return jsonError('Enter both scores, or pick another result type', 400)
      if (hs !== as) {
        const derived = hs > as ? homeTeamId : awayTeamId
        if (body.winnerTeamId !== undefined && winnerTeamId && winnerTeamId !== derived) {
          return jsonError('The winner must be the team with the higher score', 400)
        }
        winnerTeamId = derived
      } else if (!knockout) {
        // Level in a league / group match: a draw (football, others) or a tie (cricket).
        winnerTeamId = null
        if (sport === 'CRICKET') resultType = 'TIE'
      }
    } else if (rt === 'TIE') {
      if (!knockout) winnerTeamId = null
    } else if (rt === 'NO_RESULT') {
      winnerTeamId = null
    } else if (rt === 'WALKOVER') {
      if (!winnerTeamId) return jsonError('Pick the team that won by walkover', 400)
    }
    if (knockout && !winnerTeamId && resultType !== 'NO_RESULT') {
      return jsonError('A knockout match needs a winner — pick who went through (e.g. on penalties or a super over)', 400)
    }
  }

  if (playerOfMatchId) {
    const player = await db.player.findFirst({
      where: { id: playerOfMatchId, tournamentId: tournament.id },
      select: { soldToTeamId: true },
    })
    if (!player || !player.soldToTeamId || (player.soldToTeamId !== homeTeamId && player.soldToTeamId !== awayTeamId)) {
      return jsonError('Player of the match must be in one of the two squads', 400)
    }
  }

  if (autoNote && status === 'COMPLETED') {
    const names = new Map(
      (
        await db.team.findMany({
          where: { id: { in: [homeTeamId, awayTeamId].filter((x): x is string => !!x) } },
          select: { id: true, name: true },
        })
      ).map((t) => [t.id, t.name]),
    )
    const batted = body.battedFirst === 'HOME' || body.battedFirst === 'AWAY' ? body.battedFirst : null
    resultNote = describeResult({
      sport,
      stage,
      homeName: names.get(homeTeamId!) ?? 'Home',
      awayName: names.get(awayTeamId!) ?? 'Away',
      homeTeamId,
      awayTeamId,
      ...next,
      winnerTeamId,
      resultType,
      battedFirst: batted,
      allOutWickets: wicketsMax,
    })
  } else if (autoNote) resultNote = null

  Object.assign(data, next, { status, resultType, winnerTeamId, playerOfMatchId, resultNote })

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.match.update({ where: { id: match.id }, data })
    // Stat lines of players whose team is no longer in this match go with it.
    if (teamsChanged) {
      await tx.matchPlayerStat.deleteMany({
        where: {
          matchId: match.id,
          OR: [{ teamId: null }, { teamId: { notIn: [homeTeamId, awayTeamId].filter((x): x is string => !!x) } }],
        },
      })
    }
    return row
  })
  await syncBracket(tournament)
  return Response.json({ match: serializeMatch(updated) })
}

// DELETE /api/matches/:id — owner / ADMIN / co-organizer. Deletes the match
// and its player stats.
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadMatchForStaff(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response

  await db.match.delete({ where: { id: loaded.match.id } })
  await syncBracket(loaded.tournament)
  return Response.json({ ok: true })
}
