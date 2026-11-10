// ============================================================
// NeelamGhor — server helpers for the league API (fixtures, results, stats).
// Private folder (leading underscore) — never routed by Next.js.
// ============================================================
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  computeLeaderboards,
  leagueTables,
  pointsRules,
  resolveSlots,
  tablesForResolve,
  type MatchStage,
  type MatchStatus,
  type ResultType,
  type StandingsSettings,
} from '@/lib/league'
import type { LeagueData, LeagueFormat, MatchDTO, MatchStatDTO, PublicBranding, ResultsViewer, SafeUser, Sport } from '@/lib/types'
import type { Match, MatchPlayerStat, Tournament } from '@prisma/client'
import { accessAllows, hiddenByArchive, tournamentAccess, type AccessNeed, type StaffAccess } from '../../_lib/helpers'

/** Loads a match and its tournament and checks the caller's staff access. */
export async function loadMatchForStaff(
  matchId: string,
  user: SafeUser,
  need: AccessNeed,
): Promise<{ match: Match; tournament: Tournament; access: StaffAccess } | { response: Response }> {
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) return { response: jsonError('Match not found', 404) }
  const tournament = await db.tournament.findUnique({ where: { id: match.tournamentId } })
  if (!tournament || hiddenByArchive(tournament, user)) return { response: jsonError('Match not found', 404) }
  const access = await tournamentAccess(tournament, user)
  if (!accessAllows(access, need)) {
    return { response: jsonError('You do not have permission to manage this tournament', 403) }
  }
  return { match, tournament, access: access! }
}

/** Standings settings from a tournament row. */
export function standingsSettings(t: Pick<Tournament, 'sport' | 'pointsWin' | 'pointsDraw' | 'pointsLoss' | 'oversPerInnings' | 'playersOnField'>): StandingsSettings {
  // Short-handed cricket (e.g. 6-a-side) is all out when one batter is left.
  const allOut = t.sport === 'CRICKET' && t.playersOnField && t.playersOnField > 1 ? Math.min(10, t.playersOnField - 1) : null
  return {
    sport: t.sport,
    pointsWin: t.pointsWin,
    pointsDraw: t.pointsDraw,
    pointsLoss: t.pointsLoss,
    oversPerInnings: t.oversPerInnings,
    allOutWickets: allOut,
  }
}

/** Wickets that make a side all out in this tournament. */
export function allOutWickets(t: Pick<Tournament, 'sport' | 'playersOnField'>): number {
  return standingsSettings({ ...t, pointsWin: null, pointsDraw: null, pointsLoss: null, oversPerInnings: null }).allOutWickets ?? 10
}

export function serializeMatch(m: Match, opts: { playerOfMatchName?: string | null; statsCount?: number } = {}): MatchDTO {
  return {
    id: m.id,
    matchNumber: m.matchNumber,
    stage: m.stage as MatchStage,
    groupName: m.groupName,
    round: m.round,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeLabel: m.homeLabel,
    awayLabel: m.awayLabel,
    scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    venue: m.venue,
    status: m.status as MatchStatus,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeWickets: m.homeWickets,
    awayWickets: m.awayWickets,
    homeBalls: m.homeBalls,
    awayBalls: m.awayBalls,
    winnerTeamId: m.winnerTeamId,
    resultType: (m.resultType ?? null) as ResultType | null,
    resultNote: m.resultNote,
    playerOfMatchId: m.playerOfMatchId,
    playerOfMatchName: opts.playerOfMatchName ?? null,
    statsCount: opts.statsCount ?? 0,
  }
}

export function serializeStat(s: MatchPlayerStat): MatchStatDTO {
  return {
    playerId: s.playerId,
    teamId: s.teamId,
    runs: s.runs,
    ballsFaced: s.ballsFaced,
    fours: s.fours,
    sixes: s.sixes,
    wickets: s.wickets,
    ballsBowled: s.ballsBowled,
    runsConceded: s.runsConceded,
    catches: s.catches,
    goals: s.goals,
    assists: s.assists,
    yellowCards: s.yellowCards,
    redCards: s.redCards,
    saves: s.saves,
    points: s.points,
  }
}

/**
 * Fills knockout placeholders ("Winner M7", "Runner-up Group A", …) from the
 * current results. Run after any change to matches or results.
 */
export async function syncBracket(tournament: Tournament): Promise<void> {
  const [teams, matches] = await Promise.all([
    db.team.findMany({ where: { tournamentId: tournament.id }, select: { id: true, name: true, groupName: true } }),
    db.match.findMany({ where: { tournamentId: tournament.id } }),
  ])
  if (!matches.some((m) => m.homeLabel || m.awayLabel)) return
  const tables = leagueTables(teams, matches, standingsSettings(tournament))
  const updates = resolveSlots(matches, tablesForResolve(tables))
  if (updates.length === 0) return
  await db.$transaction(
    updates.map((u) =>
      db.match.update({
        where: { id: u.id },
        data: {
          ...(u.homeTeamId !== undefined ? { homeTeamId: u.homeTeamId } : {}),
          ...(u.awayTeamId !== undefined ? { awayTeamId: u.awayTeamId } : {}),
        },
      }),
    ),
  )
}

/** The full league view of a tournament (staff and public endpoints). No phone numbers, ever. */
export async function buildLeagueData(
  tournament: Tournament,
  opts: { viewer: ResultsViewer; includeSquads: boolean; branding: PublicBranding | null },
): Promise<LeagueData> {
  const id = tournament.id
  const [teams, matches, stats, sold] = await Promise.all([
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true, logoUrl: true, groupName: true },
    }),
    db.match.findMany({
      where: { tournamentId: id },
      orderBy: [{ round: 'asc' }, { scheduledAt: { sort: 'asc', nulls: 'last' } }, { matchNumber: 'asc' }],
      include: { _count: { select: { stats: true } } },
    }),
    db.matchPlayerStat.findMany({ where: { match: { tournamentId: id } } }),
    opts.includeSquads
      ? db.player.findMany({
          where: { tournamentId: id, status: 'SOLD', soldToTeamId: { not: null } },
          orderBy: [{ name: 'asc' }],
          select: { id: true, name: true, role: true, photoUrl: true, soldToTeamId: true },
        })
      : Promise.resolve([]),
  ])

  const playerIds = new Set<string>(stats.map((s) => s.playerId))
  for (const m of matches) if (m.playerOfMatchId) playerIds.add(m.playerOfMatchId)
  const players = playerIds.size
    ? await db.player.findMany({
        where: { tournamentId: id, id: { in: [...playerIds] } },
        select: { id: true, name: true, photoUrl: true, role: true, soldToTeamId: true },
      })
    : []
  const playerName = new Map(players.map((p) => [p.id, p.name]))
  // A player's team on the boards: the side they played for most recently, else their squad.
  const lastTeam = new Map<string, string>()
  for (const s of stats) if (s.teamId) lastTeam.set(s.playerId, s.teamId)

  const settings = standingsSettings(tournament)
  const tables = leagueTables(teams, matches, settings)
  const leaderboards = computeLeaderboards(
    tournament.sport,
    stats,
    players.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl, role: p.role, teamId: lastTeam.get(p.id) ?? p.soldToTeamId })),
    { limit: 10, matches },
  )

  const squads = teams.map((t) => ({
    teamId: t.id,
    players: sold
      .filter((p) => p.soldToTeamId === t.id)
      .map((p) => ({ id: p.id, name: p.name, role: p.role, photoUrl: p.photoUrl })),
  }))

  return {
    tournament: {
      id,
      name: tournament.name,
      sport: tournament.sport as Sport,
      sportName: tournament.sportName,
      logoUrl: tournament.logoUrl,
      bannerUrl: tournament.bannerUrl,
      location: tournament.location,
      startDate: tournament.startDate ? tournament.startDate.toISOString() : null,
    },
    settings: {
      format: (tournament.leagueFormat ?? null) as LeagueFormat | null,
      pointsWin: tournament.pointsWin,
      pointsDraw: tournament.pointsDraw,
      pointsLoss: tournament.pointsLoss,
      oversPerInnings: tournament.oversPerInnings,
      resultsPublic: tournament.resultsPublic,
      effectivePoints: pointsRules(tournament.sport, tournament),
      allOutWickets: allOutWickets(tournament),
    },
    teams,
    matches: matches.map((m) =>
      serializeMatch(m, {
        playerOfMatchName: m.playerOfMatchId ? (playerName.get(m.playerOfMatchId) ?? null) : null,
        statsCount: m._count.stats,
      }),
    ),
    standings: tables,
    leaderboards,
    squads: opts.includeSquads ? squads : [],
    viewer: opts.viewer,
    branding: opts.branding,
  }
}

/** Optional trimmed text: undefined = not sent, null = clear, false = invalid. */
export function optionalText(value: unknown, max: number): string | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return false
  const s = value.trim()
  if (s === '') return null
  return s.length <= max ? s : false
}

/** Optional whole number in [min, max]: undefined = not sent, null = clear, false = invalid. */
export function optionalInt(value: unknown, min: number, max: number): number | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*-?\d+\s*$/.test(value) ? Number(value) : NaN
  if (!Number.isInteger(n) || n < min || n > max) return false
  return n
}

/** Group names: letters, digits, spaces, dots and dashes, up to 20 characters. */
export const GROUP_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,19}$/u
