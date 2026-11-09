import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { readJson, requireSession } from '../../../_lib/helpers'
import { loadMatchForStaff, serializeStat } from '../../_lib/league-server'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

type StatKey =
  | 'runs' | 'ballsFaced' | 'fours' | 'sixes' | 'wickets' | 'ballsBowled' | 'runsConceded' | 'catches'
  | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'saves' | 'points'

/** The numbers each sport records, with sane per-match caps. */
const FIELDS: Record<string, Partial<Record<StatKey, number>>> = {
  CRICKET: { runs: 500, ballsFaced: 600, fours: 150, sixes: 150, wickets: 10, ballsBowled: 600, runsConceded: 600, catches: 15 },
  FOOTBALL: { goals: 50, assists: 50, yellowCards: 2, redCards: 1, saves: 100 },
  OTHER: { points: 10000 },
}
const ALL_KEYS: StatKey[] = [
  'runs', 'ballsFaced', 'fours', 'sixes', 'wickets', 'ballsBowled', 'runsConceded', 'catches',
  'goals', 'assists', 'yellowCards', 'redCards', 'saves', 'points',
]

// GET /api/matches/:id/stats — staff (any level): the match's player stat lines.
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadMatchForStaff(id, auth.user, 'run')
  if ('response' in loaded) return loaded.response

  const stats = await db.matchPlayerStat.findMany({ where: { matchId: loaded.match.id } })
  return Response.json({ stats: stats.map(serializeStat) })
}

// PUT /api/matches/:id/stats — owner / ADMIN / co-organizer. Replaces the
// match's stats. Body: { stats: [{ playerId, runs?, ballsFaced?, … }] } — only
// the tournament sport's numbers are kept; players must be sold to one of the
// two teams (their team is taken from the squad). Empty lines are dropped.
export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadMatchForStaff(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response
  const { match, tournament } = loaded

  if (!match.homeTeamId || !match.awayTeamId) return jsonError('Both teams must be set before entering player stats', 400)

  const body = await readJson(req)
  if (!body || !Array.isArray(body.stats)) return jsonError('Provide a "stats" array', 400)
  if (body.stats.length > 200) return jsonError('Too many stat lines', 400)

  const fields = FIELDS[tournament.sport] ?? FIELDS.OTHER
  const squad = await db.player.findMany({
    where: { tournamentId: tournament.id, status: 'SOLD', soldToTeamId: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { id: true, name: true, soldToTeamId: true },
  })
  const teamOf = new Map(squad.map((p) => [p.id, p.soldToTeamId!]))

  const seen = new Set<string>()
  const rows: Array<{ matchId: string; playerId: string; teamId: string } & Partial<Record<StatKey, number | null>>> = []
  for (const raw of body.stats as unknown[]) {
    if (!raw || typeof raw !== 'object') return jsonError('Each stat line needs a playerId', 400)
    const line = raw as Record<string, unknown>
    const playerId = line.playerId
    if (typeof playerId !== 'string' || !teamOf.has(playerId)) {
      return jsonError('Stats can only be entered for players in the two squads', 400)
    }
    if (seen.has(playerId)) return jsonError('Each player can have only one stat line', 400)
    seen.add(playerId)

    const row: (typeof rows)[number] = { matchId: match.id, playerId, teamId: teamOf.get(playerId)! }
    let any = false
    for (const key of ALL_KEYS) {
      const cap = fields[key]
      const v = line[key]
      if (cap === undefined || v === undefined || v === null || v === '') {
        row[key] = null
        continue
      }
      const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN
      if (!Number.isInteger(n) || n < 0 || n > cap) {
        return jsonError(`${key} must be a whole number from 0 to ${cap}`, 400)
      }
      row[key] = n
      any = true
    }
    if (any) rows.push(row)
  }

  await db.$transaction([
    db.matchPlayerStat.deleteMany({ where: { matchId: match.id } }),
    ...(rows.length ? [db.matchPlayerStat.createMany({ data: rows })] : []),
  ])
  return Response.json({ ok: true, saved: rows.length })
}
