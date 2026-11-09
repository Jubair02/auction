// ============================================================
// NeelamGhor — league logic (pure, no database): fixtures, schedules,
// standings, leaderboards, result notes and knockout progression.
// Shared by the API routes and the UI; unit-tested in league.test.ts.
//
// KNOCKOUT PLACEHOLDER CONVENTION
// A match side whose team is not known yet carries a label in
// Match.homeLabel / Match.awayLabel. Labels in these exact forms are
// "managed" — the server fills in the team automatically:
//   "Winner M7"           the winner of match number 7 (same tournament)
//   "Loser M7"            the loser of match number 7 (third-place play-off)
//   "Winner Group A"      1st place in group A, once every group A match is
//   "Runner-up Group A"   2nd place      completed or abandoned
//   "3rd Group A"         3rd place (any ordinal: 4th, 5th, …)
//   "Winner League" / "Runner-up League" / "3rd League"
//                         position in the single league table (LEAGUE stage)
// The label stays on the match after the team is filled in, so correcting an
// earlier result re-routes the team. Setting a side's team by hand clears its
// label (a manual override). Any other label text is shown as-is, never resolved.
// ============================================================

export type LeagueSport = 'CRICKET' | 'FOOTBALL' | 'OTHER'
export type LeagueFormatKind = 'ROUND_ROBIN' | 'DOUBLE_ROUND_ROBIN' | 'GROUPS_KNOCKOUT' | 'KNOCKOUT'
export const LEAGUE_FORMATS: readonly LeagueFormatKind[] = ['ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'GROUPS_KNOCKOUT', 'KNOCKOUT']

/** KNOCKOUT = an early knockout round bigger than the round of 16 (round of 32, 64…). */
export const MATCH_STAGES = [
  'LEAGUE',
  'GROUP',
  'KNOCKOUT',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
] as const
export type MatchStage = (typeof MATCH_STAGES)[number]
export const KNOCKOUT_STAGES: readonly MatchStage[] = ['KNOCKOUT', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']
export const isKnockoutStage = (stage: string): boolean => (KNOCKOUT_STAGES as readonly string[]).includes(stage)

export const MATCH_STATUSES = ['SCHEDULED', 'LIVE', 'COMPLETED', 'ABANDONED', 'POSTPONED'] as const
export type MatchStatus = (typeof MATCH_STATUSES)[number]
export const RESULT_TYPES = ['NORMAL', 'TIE', 'NO_RESULT', 'WALKOVER'] as const
export type ResultType = (typeof RESULT_TYPES)[number]

/** A wicket count this high means the side was bowled out (full quota counts for NRR). */
export const DEFAULT_ALL_OUT_WICKETS = 10

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface FixtureDraft {
  matchNumber: number
  stage: MatchStage
  groupName: string | null
  round: number
  homeTeamId: string | null
  awayTeamId: string | null
  homeLabel: string | null
  awayLabel: string | null
}

/**
 * Single round-robin by the circle method. Returns rounds of [home, away]
 * pairs. With an odd team count one team sits out (bye) each round. Every
 * team plays every other exactly once, at most once per round, and its home
 * and away counts differ by at most one (home/away mostly alternate).
 */
export function roundRobinRounds(teamIds: readonly string[]): Array<Array<[string, string]>> {
  if (teamIds.length < 2) return []
  // The bye (null) is the fixed slot, so every real team rotates and stays balanced.
  const slots: (string | null)[] = teamIds.length % 2 === 1 ? [null, ...teamIds] : [...teamIds]
  const n = slots.length
  const fixed = slots[0]
  const ring = slots.slice(1)
  const half = n / 2 - 1
  const rounds: Array<Array<[string, string]>> = []
  for (let r = 0; r < n - 1; r++) {
    // Ring position p (1..n-1) holds this team in round r.
    const at = (p: number) => ring[(((p - 1 + r) % (n - 1)) + (n - 1)) % (n - 1)]
    const games: Array<[string, string]> = []
    const opp = at(n - 1)
    if (fixed !== null && opp !== null) games.push(r % 2 === 0 ? [fixed, opp] : [opp, fixed])
    for (let k = 1; k <= half; k++) {
      const top = at(k)
      const bottom = at(n - 1 - k)
      if (top === null || bottom === null) continue
      games.push(k % 2 === 1 ? [top, bottom] : [bottom, top])
    }
    rounds.push(games)
  }
  return rounds
}

/** Double round-robin: the second leg repeats the first with home and away swapped. */
export function doubleRoundRobinRounds(teamIds: readonly string[]): Array<Array<[string, string]>> {
  const first = roundRobinRounds(teamIds)
  return [...first, ...first.map((games) => games.map(([h, a]) => [a, h] as [string, string]))]
}

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function groupLetter(index: number): string {
  let s = ''
  let i = index
  do {
    s = String.fromCharCode(65 + (i % 26)) + s
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return s
}

/**
 * Splits teams into groups. Teams with a groupName keep it; the rest are
 * spread over the smallest groups first (groups A, B, … up to `groupCount`
 * are added when there are fewer named groups). Returns group → team ids,
 * sorted by group name; team order inside a group follows the input.
 */
export function assignGroups(
  teams: ReadonlyArray<{ id: string; groupName?: string | null }>,
  groupCount: number,
): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  const unassigned: string[] = []
  for (const t of teams) {
    const g = t.groupName?.trim()
    if (g) {
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)!.push(t.id)
    } else unassigned.push(t.id)
  }
  if (unassigned.length > 0) {
    const want = Math.max(1, groupCount)
    for (let i = 0; groups.size < want; i++) {
      const letter = groupLetter(i)
      if (!groups.has(letter)) groups.set(letter, [])
    }
    const names = [...groups.keys()].sort(compareGroupNames)
    for (const id of unassigned) {
      let best = names[0]
      for (const name of names) if (groups.get(name)!.length < groups.get(best)!.length) best = name
      groups.get(best)!.push(id)
    }
  }
  return new Map([...groups.entries()].sort(([a], [b]) => compareGroupNames(a, b)))
}

export function compareGroupNames(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b)
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
}

/** "Winner Group A", "Runner-up Group B", "3rd Group C"; group null = the league table. */
export function positionLabel(position: number, group: string | null): string {
  const pos = position === 1 ? 'Winner' : position === 2 ? 'Runner-up' : ordinal(position)
  return group === null ? `${pos} League` : `${pos} Group ${group}`
}

/** "Winner M7" / "Loser M7". */
export function matchRefLabel(outcome: 'WINNER' | 'LOSER', matchNumber: number): string {
  return `${outcome === 'WINNER' ? 'Winner' : 'Loser'} M${matchNumber}`
}

export type SlotRef =
  | { kind: 'match'; outcome: 'WINNER' | 'LOSER'; matchNumber: number }
  | { kind: 'position'; group: string | null; position: number }

/** Parses a managed placeholder label (see the convention at the top); null for free text. */
export function parseSlotLabel(label: string | null | undefined): SlotRef | null {
  if (!label) return null
  const s = label.trim()
  const m = /^(Winner|Loser) M(\d{1,4})$/i.exec(s)
  if (m) {
    return { kind: 'match', outcome: m[1].toLowerCase() === 'winner' ? 'WINNER' : 'LOSER', matchNumber: Number(m[2]) }
  }
  const p = /^(Winner|Runner-up|(\d{1,2})(?:st|nd|rd|th)) (?:Group (.{1,20})|League)$/i.exec(s)
  if (p) {
    const word = p[1].toLowerCase()
    const position = word === 'winner' ? 1 : word === 'runner-up' ? 2 : Number(p[2])
    if (position < 1) return null
    return { kind: 'position', group: p[3] !== undefined ? p[3].trim() : null, position }
  }
  return null
}

function stageForEntrants(entrants: number): MatchStage {
  if (entrants <= 2) return 'FINAL'
  if (entrants <= 4) return 'SEMI_FINAL'
  if (entrants <= 8) return 'QUARTER_FINAL'
  if (entrants <= 16) return 'ROUND_OF_16'
  return 'KNOCKOUT'
}

/** Seed order of a bracket of `size` (a power of two): 1 and 2 can only meet in the final. */
export function bracketOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const next = order.length * 2
    order = order.flatMap((s) => [s, next + 1 - s])
  }
  return order
}

export interface BracketEntrant {
  teamId: string | null
  label: string | null
}

/**
 * Knockout bracket for entrants in seed order (seed 1 first). A count that is
 * not a power of two gives the top seeds byes into the second round. Later
 * rounds refer to earlier matches as "Winner M<n>". `avoid(a, b)` flags
 * first-round pairs to swap apart (e.g. two teams from the same group).
 */
export function buildBracket(
  entrants: readonly BracketEntrant[],
  opts: { firstMatchNumber: number; firstRound: number; thirdPlace?: boolean; avoid?: (a: BracketEntrant, b: BracketEntrant) => boolean },
): FixtureDraft[] {
  const count = entrants.length
  if (count < 2) return []
  let size = 1
  while (size < count) size *= 2
  let current: (BracketEntrant | null)[] = bracketOrder(size).map((seed) => (seed <= count ? entrants[seed - 1] : null))

  if (opts.avoid) {
    const avoid = opts.avoid
    const pairs = size / 2
    for (let i = 0; i < pairs; i++) {
      const a = current[2 * i]
      const b = current[2 * i + 1]
      if (!a || !b || !avoid(a, b)) continue
      // Swap b with the lower-seeded side of another pair, if that fixes both pairs.
      for (let j = 0; j < pairs; j++) {
        if (j === i) continue
        const c = current[2 * j]
        const d = current[2 * j + 1]
        if (!c || !d) continue
        if (!avoid(a, d) && !avoid(c, b)) {
          current[2 * i + 1] = d
          current[2 * j + 1] = b
          break
        }
      }
    }
  }

  const out: FixtureDraft[] = []
  let num = opts.firstMatchNumber
  let round = opts.firstRound
  let semiNumbers: number[] = []
  while (current.length > 1) {
    const stage = stageForEntrants(current.length)
    if (stage === 'FINAL' && opts.thirdPlace && semiNumbers.length === 2) {
      out.push({
        matchNumber: num++,
        stage: 'THIRD_PLACE',
        groupName: null,
        round,
        homeTeamId: null,
        awayTeamId: null,
        homeLabel: matchRefLabel('LOSER', semiNumbers[0]),
        awayLabel: matchRefLabel('LOSER', semiNumbers[1]),
      })
    }
    const next: (BracketEntrant | null)[] = []
    const roundNumbers: number[] = []
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i]
      const b = current[i + 1]
      if (a && b) {
        out.push({
          matchNumber: num,
          stage,
          groupName: null,
          round,
          homeTeamId: a.teamId,
          awayTeamId: b.teamId,
          homeLabel: a.teamId ? null : a.label,
          awayLabel: b.teamId ? null : b.label,
        })
        roundNumbers.push(num)
        next.push({ teamId: null, label: matchRefLabel('WINNER', num) })
        num++
      } else {
        next.push(a ?? b) // bye: the seeded side goes straight through
      }
    }
    if (stage === 'SEMI_FINAL') semiNumbers = roundNumbers
    current = next
    round++
  }
  return out
}

export interface GenerateInput {
  format: LeagueFormatKind
  /** In seed order (knockout) / listing order (round-robin). */
  teams: ReadonlyArray<{ id: string; groupName?: string | null }>
  groupCount?: number
  qualifiersPerGroup?: number
  /** Add a third-place play-off between the semi-final losers. */
  thirdPlace?: boolean
}

export type GenerateResult =
  | { ok: true; fixtures: FixtureDraft[]; groups: Map<string, string[]> | null }
  | { ok: false; error: string }

function roundsToFixtures(
  rounds: Array<Array<[string, string]>>,
  stage: MatchStage,
  groupName: string | null,
  roundOffset = 0,
): Array<Omit<FixtureDraft, 'matchNumber'>> {
  return rounds.flatMap((games, r) =>
    games.map(([home, away]) => ({
      stage,
      groupName,
      round: r + 1 + roundOffset,
      homeTeamId: home,
      awayTeamId: away,
      homeLabel: null,
      awayLabel: null,
    })),
  )
}

/** All fixtures for a format, numbered from 1 in playing order. */
export function generateFixtures(input: GenerateInput): GenerateResult {
  const ids = input.teams.map((t) => t.id)
  if (ids.length < 2) return { ok: false, error: 'At least 2 teams are needed to make fixtures' }
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'Each team can appear only once' }

  const number = (list: Array<Omit<FixtureDraft, 'matchNumber'>>): FixtureDraft[] =>
    list.map((f, i) => ({ ...f, matchNumber: i + 1 }))

  switch (input.format) {
    case 'ROUND_ROBIN':
      return { ok: true, fixtures: number(roundsToFixtures(roundRobinRounds(ids), 'LEAGUE', null)), groups: null }
    case 'DOUBLE_ROUND_ROBIN':
      return { ok: true, fixtures: number(roundsToFixtures(doubleRoundRobinRounds(ids), 'LEAGUE', null)), groups: null }
    case 'KNOCKOUT':
      return {
        ok: true,
        fixtures: buildBracket(
          ids.map((id) => ({ teamId: id, label: null })),
          { firstMatchNumber: 1, firstRound: 1, thirdPlace: input.thirdPlace },
        ),
        groups: null,
      }
    case 'GROUPS_KNOCKOUT': {
      const groupCount = input.groupCount ?? Math.max(1, Math.round(ids.length / 4))
      const groups = assignGroups(input.teams, groupCount)
      const names = [...groups.keys()]
      for (const [g, members] of groups) {
        if (members.length < 2) return { ok: false, error: `Group ${g} needs at least 2 teams` }
      }
      const smallest = Math.min(...[...groups.values()].map((m) => m.length))
      const q = input.qualifiersPerGroup ?? (names.length === 1 ? Math.min(4, smallest) : 2)
      if (!Number.isInteger(q) || q < 1 || q > smallest) {
        return { ok: false, error: `Qualifiers per group must be from 1 to ${smallest} (the smallest group)` }
      }
      if (q * names.length < 2) return { ok: false, error: 'At least 2 teams must qualify for the knockouts' }

      // Group rounds interleaved: round 1 of every group, then round 2, …
      const perGroup = names.map((g) => roundRobinRounds(groups.get(g)!))
      const maxRounds = Math.max(...perGroup.map((r) => r.length))
      const groupFixtures: Array<Omit<FixtureDraft, 'matchNumber'>> = []
      for (let r = 0; r < maxRounds; r++) {
        names.forEach((g, gi) => {
          for (const [home, away] of perGroup[gi][r] ?? []) {
            groupFixtures.push({ stage: 'GROUP', groupName: g, round: r + 1, homeTeamId: home, awayTeamId: away, homeLabel: null, awayLabel: null })
          }
        })
      }
      const fixtures = number(groupFixtures)

      // Seeds: all group winners, then all runners-up, … (A, B, C order).
      const entrants: BracketEntrant[] = []
      for (let pos = 1; pos <= q; pos++) {
        for (const g of names) entrants.push({ teamId: null, label: positionLabel(pos, g) })
      }
      const groupOf = (e: BracketEntrant) => {
        const ref = parseSlotLabel(e.label)
        return ref?.kind === 'position' ? ref.group : null
      }
      const knockouts = buildBracket(entrants, {
        firstMatchNumber: fixtures.length + 1,
        firstRound: maxRounds + 1,
        thirdPlace: input.thirdPlace,
        avoid: names.length > 1 ? (a, b) => groupOf(a) !== null && groupOf(a) === groupOf(b) : undefined,
      })
      return { ok: true, fixtures: [...fixtures, ...knockouts], groups }
    }
    default:
      return { ok: false, error: 'Unknown league format' }
  }
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

export interface ScheduleOptions {
  start: Date
  /** Days from the last match day of a round to the first day of the next (0 = same day). */
  intervalDays: number
  /** Most matches on one day; null = a whole round on one day. */
  matchesPerDay: number | null
}

/**
 * Kick-off dates for fixtures in playing order: a round fills match days of
 * `matchesPerDay`, spilling to the next day; the next round starts
 * `intervalDays` after. Every match keeps the start time of day.
 */
export function scheduleFixtures(fixtures: ReadonlyArray<{ round: number }>, opts: ScheduleOptions): Date[] {
  const perDay = opts.matchesPerDay && opts.matchesPerDay > 0 ? opts.matchesPerDay : Infinity
  const interval = Math.max(0, Math.floor(opts.intervalDays))
  let day = 0
  let used = 0
  let lastRound: number | null = null
  return fixtures.map((f) => {
    if (lastRound !== null && f.round !== lastRound) {
      if (interval > 0) {
        day += interval
        used = 0
      }
    }
    if (used >= perDay) {
      day += 1
      used = 0
    }
    lastRound = f.round
    used++
    return new Date(opts.start.getTime() + day * DAY_MS)
  })
}

// ---------------------------------------------------------------------------
// Overs
// ---------------------------------------------------------------------------

/** "19.4" → 118 balls; "20" → 120. Null when not valid overs (x.6 and above are not overs). */
export function oversToBalls(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  const s = String(input).trim()
  const m = /^(\d{1,3})(?:\.([0-5]))?$/.exec(s)
  if (!m) return null
  return Number(m[1]) * 6 + (m[2] ? Number(m[2]) : 0)
}

/** 118 → "19.4"; 120 → "20". */
export function ballsToOvers(balls: number | null | undefined): string {
  if (balls === null || balls === undefined || !Number.isFinite(balls) || balls < 0) return ''
  const overs = Math.floor(balls / 6)
  const rest = balls % 6
  return rest ? `${overs}.${rest}` : String(overs)
}

// ---------------------------------------------------------------------------
// Points & outcomes
// ---------------------------------------------------------------------------

export interface PointsRules {
  win: number
  draw: number
  loss: number
}

/** Sport defaults: cricket 2/1/0 (tie or no result = 1 each), football and others 3/1/0. */
export function defaultPoints(sport: string): PointsRules {
  return sport === 'CRICKET' ? { win: 2, draw: 1, loss: 0 } : { win: 3, draw: 1, loss: 0 }
}

export function pointsRules(
  sport: string,
  custom?: { pointsWin?: number | null; pointsDraw?: number | null; pointsLoss?: number | null },
): PointsRules {
  const d = defaultPoints(sport)
  return {
    win: custom?.pointsWin ?? d.win,
    draw: custom?.pointsDraw ?? d.draw,
    loss: custom?.pointsLoss ?? d.loss,
  }
}

export interface MatchLike {
  stage: string
  groupName?: string | null
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeScore?: number | null
  awayScore?: number | null
  homeWickets?: number | null
  awayWickets?: number | null
  homeBalls?: number | null
  awayBalls?: number | null
  winnerTeamId?: string | null
  resultType?: string | null
}

export type Outcome = { kind: 'WIN'; winner: string; loser: string } | { kind: 'DRAW' } | { kind: 'NR' }

/**
 * What a match means for the table: null when it does not count yet
 * (not played, or teams missing). Abandoned = no result. A NORMAL result
 * without a winner is read from the score (level = draw / tie).
 */
export function matchOutcome(m: MatchLike): Outcome | null {
  const home = m.homeTeamId
  const away = m.awayTeamId
  if (!home || !away) return null
  if (m.status === 'ABANDONED') return { kind: 'NR' }
  if (m.status !== 'COMPLETED') return null
  const rt = m.resultType ?? 'NORMAL'
  if (rt === 'NO_RESULT') return { kind: 'NR' }
  if (rt === 'TIE') return { kind: 'DRAW' }
  if (m.winnerTeamId === home) return { kind: 'WIN', winner: home, loser: away }
  if (m.winnerTeamId === away) return { kind: 'WIN', winner: away, loser: home }
  if (rt === 'WALKOVER') return null
  if (m.homeScore === null || m.homeScore === undefined || m.awayScore === null || m.awayScore === undefined) return null
  if (m.homeScore > m.awayScore) return { kind: 'WIN', winner: home, loser: away }
  if (m.awayScore > m.homeScore) return { kind: 'WIN', winner: away, loser: home }
  return { kind: 'DRAW' }
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export type FormLetter = 'W' | 'D' | 'L' | 'N'

export interface StandingRow {
  teamId: string
  position: number
  played: number
  won: number
  /** Draws (football / others) or ties (cricket). */
  drawn: number
  lost: number
  noResult: number
  points: number
  /** Goals / runs / points scored and conceded (counted matches with a score). */
  scoreFor: number
  scoreAgainst: number
  scoreDiff: number
  /** Cricket net run rate inputs (balls; a bowled-out side counts the full quota). */
  runsFor: number
  ballsFaced: number
  runsAgainst: number
  ballsBowled: number
  /** Cricket only; null when no run-rate data yet. */
  nrr: number | null
  /** Last five results, oldest first. */
  form: FormLetter[]
}

export interface StandingsSettings {
  sport: string
  pointsWin?: number | null
  pointsDraw?: number | null
  pointsLoss?: number | null
  /** Cricket: overs per innings — a bowled-out side counts this full quota for NRR. */
  oversPerInnings?: number | null
  /** Wickets that make a side all out (default 10; fewer for short-handed cricket). */
  allOutWickets?: number | null
}

function blankRow(teamId: string): StandingRow {
  return {
    teamId,
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    noResult: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    scoreDiff: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    nrr: null,
    form: [],
  }
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * League table for the given teams from their LEAGUE / GROUP matches (pass
 * them in playing order — `form` uses it). Knockout matches and matches
 * involving other teams are ignored.
 * Tie-breaks — cricket: points, wins, NRR, head-to-head; football: points,
 * goal difference, goals for, head-to-head; others: points, score difference,
 * head-to-head. Then name.
 */
export function computeStandings(
  teams: ReadonlyArray<{ id: string; name: string }>,
  matches: readonly MatchLike[],
  settings: StandingsSettings,
): StandingRow[] {
  const rules = pointsRules(settings.sport, settings)
  const cricket = settings.sport === 'CRICKET'
  const quota = cricket && settings.oversPerInnings ? settings.oversPerInnings * 6 : null
  const allOut = settings.allOutWickets && settings.allOutWickets > 0 ? settings.allOutWickets : DEFAULT_ALL_OUT_WICKETS
  const rows = new Map(teams.map((t) => [t.id, blankRow(t.id)]))
  const names = new Map(teams.map((t) => [t.id, t.name]))
  const counted: Array<{ m: MatchLike; o: Outcome }> = []

  const effBalls = (balls: number, wickets: number | null | undefined) =>
    quota !== null && isNum(wickets) && wickets >= allOut ? quota : balls

  for (const m of matches) {
    if (isKnockoutStage(m.stage)) continue
    if (!m.homeTeamId || !m.awayTeamId) continue
    const home = rows.get(m.homeTeamId)
    const away = rows.get(m.awayTeamId)
    if (!home || !away) continue
    const o = matchOutcome(m)
    if (!o) continue
    counted.push({ m, o })
    home.played++
    away.played++
    if (o.kind === 'WIN') {
      const w = o.winner === home.teamId ? home : away
      const l = w === home ? away : home
      w.won++
      w.points += rules.win
      w.form.push('W')
      l.lost++
      l.points += rules.loss
      l.form.push('L')
    } else if (o.kind === 'DRAW') {
      for (const r of [home, away]) {
        r.drawn++
        r.points += rules.draw
        r.form.push('D')
      }
    } else {
      for (const r of [home, away]) {
        r.noResult++
        r.points += rules.draw
        r.form.push('N')
      }
    }
    if (o.kind === 'NR') continue
    if (isNum(m.homeScore) && isNum(m.awayScore)) {
      home.scoreFor += m.homeScore
      home.scoreAgainst += m.awayScore
      away.scoreFor += m.awayScore
      away.scoreAgainst += m.homeScore
      // Net run rate: only played-out matches with overs recorded (never walkovers).
      if (cricket && m.resultType !== 'WALKOVER' && isNum(m.homeBalls) && isNum(m.awayBalls) && m.homeBalls > 0 && m.awayBalls > 0) {
        const hb = effBalls(m.homeBalls, m.homeWickets)
        const ab = effBalls(m.awayBalls, m.awayWickets)
        home.runsFor += m.homeScore
        home.ballsFaced += hb
        home.runsAgainst += m.awayScore
        home.ballsBowled += ab
        away.runsFor += m.awayScore
        away.ballsFaced += ab
        away.runsAgainst += m.homeScore
        away.ballsBowled += hb
      }
    }
  }

  for (const r of rows.values()) {
    r.scoreDiff = r.scoreFor - r.scoreAgainst
    r.form = r.form.slice(-5)
    if (cricket && r.ballsFaced > 0 && r.ballsBowled > 0) {
      r.nrr = Math.round(((r.runsFor * 6) / r.ballsFaced - (r.runsAgainst * 6) / r.ballsBowled) * 1000) / 1000
      if (Object.is(r.nrr, -0)) r.nrr = 0
    }
  }

  const primary = (a: StandingRow, b: StandingRow): number => {
    if (a.points !== b.points) return b.points - a.points
    if (cricket) {
      if (a.won !== b.won) return b.won - a.won
      const an = a.nrr ?? 0
      const bn = b.nrr ?? 0
      if (an !== bn) return bn - an
      return 0
    }
    if (a.scoreDiff !== b.scoreDiff) return b.scoreDiff - a.scoreDiff
    if (settings.sport === 'FOOTBALL' && a.scoreFor !== b.scoreFor) return b.scoreFor - a.scoreFor
    return 0
  }
  const byName = (a: StandingRow, b: StandingRow) => (names.get(a.teamId) ?? '').localeCompare(names.get(b.teamId) ?? '')

  const sorted = [...rows.values()].sort((a, b) => primary(a, b) || byName(a, b))
  // Head-to-head among teams still level on every primary criterion.
  const result: StandingRow[] = []
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1
    while (j < sorted.length && primary(sorted[i], sorted[j]) === 0) j++
    const cluster = sorted.slice(i, j)
    if (cluster.length > 1) {
      const ids = new Set(cluster.map((r) => r.teamId))
      const h2h = new Map(cluster.map((r) => [r.teamId, 0]))
      for (const { m, o } of counted) {
        if (!ids.has(m.homeTeamId!) || !ids.has(m.awayTeamId!)) continue
        if (o.kind === 'WIN') {
          h2h.set(o.winner, h2h.get(o.winner)! + rules.win)
          h2h.set(o.loser, h2h.get(o.loser)! + rules.loss)
        } else {
          h2h.set(m.homeTeamId!, h2h.get(m.homeTeamId!)! + rules.draw)
          h2h.set(m.awayTeamId!, h2h.get(m.awayTeamId!)! + rules.draw)
        }
      }
      cluster.sort((a, b) => h2h.get(b.teamId)! - h2h.get(a.teamId)! || byName(a, b))
    }
    result.push(...cluster)
    i = j
  }
  result.forEach((r, i) => (r.position = i + 1))
  return result
}

export interface LeagueTable {
  /** null = the single league table (LEAGUE stage). */
  groupName: string | null
  /** Every match of the table is completed or abandoned (and there is at least one). */
  complete: boolean
  /** Positions referenced by knockout placeholders ("Runner-up Group A" → 2). */
  qualifyCount: number
  rows: StandingRow[]
}

/**
 * All points tables of a tournament: the league table (LEAGUE-stage matches)
 * and one per group (GROUP-stage matches by groupName). A group's teams are
 * those whose Team.groupName is the group plus any team playing in it.
 */
export function leagueTables(
  teams: ReadonlyArray<{ id: string; name: string; groupName?: string | null }>,
  matches: ReadonlyArray<MatchLike & { homeLabel?: string | null; awayLabel?: string | null }>,
  settings: StandingsSettings,
): LeagueTable[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const qualify = qualifyCounts(matches.flatMap((m) => [m.homeLabel ?? null, m.awayLabel ?? null]))
  const isDone = (m: MatchLike) => m.status === 'COMPLETED' || m.status === 'ABANDONED'
  const table = (groupName: string | null, list: MatchLike[], extraTeams: string[]): LeagueTable => {
    const ids = new Set(extraTeams)
    for (const m of list) {
      if (m.homeTeamId && teamById.has(m.homeTeamId)) ids.add(m.homeTeamId)
      if (m.awayTeamId && teamById.has(m.awayTeamId)) ids.add(m.awayTeamId)
    }
    const members = [...ids].map((id) => teamById.get(id)!).filter(Boolean)
    return {
      groupName,
      complete: list.length > 0 && list.every(isDone),
      qualifyCount: qualify.get(groupName ?? LEAGUE_TABLE_KEY) ?? 0,
      rows: computeStandings(members, list, settings),
    }
  }
  const out: LeagueTable[] = []
  const leagueMatches = matches.filter((m) => m.stage === 'LEAGUE')
  if (leagueMatches.length > 0) out.push(table(null, leagueMatches, []))
  const groupNames = [...new Set(matches.filter((m) => m.stage === 'GROUP' && m.groupName).map((m) => m.groupName!))].sort(compareGroupNames)
  for (const g of groupNames) {
    out.push(
      table(
        g,
        matches.filter((m) => m.stage === 'GROUP' && m.groupName === g),
        teams.filter((t) => t.groupName === g).map((t) => t.id),
      ),
    )
  }
  return out
}

/** Tables keyed for resolveSlots: group name, or '' for the league table. */
export function tablesForResolve(tables: readonly LeagueTable[]): Map<string, ResolvedTable> {
  return new Map(tables.map((t) => [t.groupName ?? LEAGUE_TABLE_KEY, { complete: t.complete, order: t.rows.map((r) => r.teamId) }]))
}

// ---------------------------------------------------------------------------
// Knockout progression
// ---------------------------------------------------------------------------

export interface BracketMatch {
  id: string
  matchNumber: number
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeLabel: string | null
  awayLabel: string | null
  winnerTeamId: string | null
}

/** A finished table: `order` = team ids by position. Key '' = the LEAGUE table. */
export interface ResolvedTable {
  complete: boolean
  order: string[]
}

export const LEAGUE_TABLE_KEY = ''

/** The team a managed label points to right now (null = not decided yet); undefined = free text. */
export function resolveSlot(
  label: string | null,
  byNumber: ReadonlyMap<number, BracketMatch>,
  tables: ReadonlyMap<string, ResolvedTable>,
): string | null | undefined {
  const ref = parseSlotLabel(label)
  if (!ref) return undefined
  if (ref.kind === 'match') {
    const src = byNumber.get(ref.matchNumber)
    if (!src || src.status !== 'COMPLETED' || !src.winnerTeamId) return null
    if (src.winnerTeamId !== src.homeTeamId && src.winnerTeamId !== src.awayTeamId) return null
    if (ref.outcome === 'WINNER') return src.winnerTeamId
    return src.winnerTeamId === src.homeTeamId ? src.awayTeamId : src.homeTeamId
  }
  const table = tables.get(ref.group ?? LEAGUE_TABLE_KEY)
  if (!table || !table.complete) return null
  return table.order[ref.position - 1] ?? null
}

/**
 * Team changes needed so every managed placeholder side shows the team its
 * label points to. Matches already being played or finished are left alone.
 */
export function resolveSlots(
  matches: readonly BracketMatch[],
  tables: ReadonlyMap<string, ResolvedTable>,
): Array<{ id: string; homeTeamId?: string | null; awayTeamId?: string | null }> {
  const byNumber = new Map(matches.map((m) => [m.matchNumber, m]))
  const updates: Array<{ id: string; homeTeamId?: string | null; awayTeamId?: string | null }> = []
  for (const m of matches) {
    if (m.status === 'COMPLETED' || m.status === 'ABANDONED' || m.status === 'LIVE') continue
    const update: { id: string; homeTeamId?: string | null; awayTeamId?: string | null } = { id: m.id }
    const home = resolveSlot(m.homeLabel, byNumber, tables)
    const away = resolveSlot(m.awayLabel, byNumber, tables)
    if (home !== undefined && home !== m.homeTeamId) update.homeTeamId = home
    if (away !== undefined && away !== m.awayTeamId) update.awayTeamId = away
    // A team can't play itself (e.g. a hand-edited label): leave such a side empty.
    const nextHome = update.homeTeamId !== undefined ? update.homeTeamId : m.homeTeamId
    const nextAway = update.awayTeamId !== undefined ? update.awayTeamId : m.awayTeamId
    if (nextHome && nextHome === nextAway) {
      if (update.awayTeamId !== undefined) update.awayTeamId = null
      else update.homeTeamId = null
    }
    if (update.homeTeamId !== undefined || update.awayTeamId !== undefined) updates.push(update)
  }
  return updates
}

/** How many teams qualify from each table: the deepest position any label refers to. */
export function qualifyCounts(labels: ReadonlyArray<string | null>): Map<string, number> {
  const out = new Map<string, number>()
  for (const label of labels) {
    const ref = parseSlotLabel(label)
    if (ref?.kind !== 'position') continue
    const key = ref.group ?? LEAGUE_TABLE_KEY
    out.set(key, Math.max(out.get(key) ?? 0, ref.position))
  }
  return out
}

// ---------------------------------------------------------------------------
// Result notes
// ---------------------------------------------------------------------------

export interface ResultNoteInput {
  sport: string
  stage?: string
  homeName: string
  awayName: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeScore?: number | null
  awayScore?: number | null
  homeWickets?: number | null
  awayWickets?: number | null
  homeBalls?: number | null
  awayBalls?: number | null
  winnerTeamId?: string | null
  resultType?: string | null
  /** Cricket: who batted first (decides "by runs" vs "by wickets"). */
  battedFirst?: 'HOME' | 'AWAY' | null
  allOutWickets?: number | null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "Alpha won by 23 runs", "Alpha won by 5 wickets", "Alpha won 3–1", "Match tied", "No result". */
export function describeResult(r: ResultNoteInput): string {
  const rt = r.resultType ?? 'NORMAL'
  const winnerIsHome = !!r.winnerTeamId && r.winnerTeamId === r.homeTeamId
  const winnerIsAway = !!r.winnerTeamId && r.winnerTeamId === r.awayTeamId
  const winnerName = winnerIsHome ? r.homeName : winnerIsAway ? r.awayName : null
  const hs = r.homeScore
  const as = r.awayScore
  const scored = isNum(hs) && isNum(as)

  if (rt === 'NO_RESULT') return 'No result'
  if (rt === 'WALKOVER') return winnerName ? `${winnerName} won by walkover` : 'Walkover'
  if (rt === 'TIE') {
    if (!winnerName) return r.sport === 'CRICKET' ? 'Match tied' : scored ? `Match drawn ${hs}–${as}` : 'Match drawn'
    return r.sport === 'CRICKET' ? `Match tied — ${winnerName} won the super over` : `${winnerName} won on penalties`
  }

  if (r.sport === 'CRICKET') {
    if (!scored) return winnerName ? `${winnerName} won` : 'Result recorded'
    if (hs === as) return winnerName ? `Match tied — ${winnerName} won the super over` : 'Match tied'
    const homeWon = winnerName ? winnerIsHome : hs! > as!
    const name = homeWon ? r.homeName : r.awayName
    const ws = homeWon ? hs! : as!
    const ls = homeWon ? as! : hs!
    const ww = homeWon ? r.homeWickets : r.awayWickets
    const wb = homeWon ? r.homeBalls : r.awayBalls
    const lb = homeWon ? r.awayBalls : r.homeBalls
    const allOut = r.allOutWickets && r.allOutWickets > 0 ? r.allOutWickets : DEFAULT_ALL_OUT_WICKETS
    let chased: boolean
    if (r.battedFirst) chased = (r.battedFirst === 'AWAY') === homeWon
    else if (isNum(ww) && ww >= allOut) chased = false
    else if (isNum(wb) && isNum(lb)) chased = wb < lb
    else chased = false
    if (chased) {
      if (!isNum(ww)) return `${name} won`
      return `${name} won by ${plural(Math.max(1, allOut - ww), 'wicket')}`
    }
    return `${name} won by ${plural(ws - ls, 'run')}`
  }

  if (!scored) return winnerName ? `${winnerName} won` : 'Result recorded'
  if (hs === as) {
    if (winnerName) return `${winnerName} won on ${r.sport === 'FOOTBALL' ? 'penalties' : 'a tie-break'} (${hs}–${as})`
    return `Match drawn ${hs}–${as}`
  }
  const homeWon = hs! > as!
  const name = homeWon ? r.homeName : r.awayName
  return `${name} won ${Math.max(hs!, as!)}–${Math.min(hs!, as!)}`
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export interface StatLine {
  matchId: string
  playerId: string
  teamId: string | null
  runs?: number | null
  ballsFaced?: number | null
  fours?: number | null
  sixes?: number | null
  wickets?: number | null
  ballsBowled?: number | null
  runsConceded?: number | null
  catches?: number | null
  goals?: number | null
  assists?: number | null
  yellowCards?: number | null
  redCards?: number | null
  saves?: number | null
  points?: number | null
}

export interface LeaderPlayer {
  id: string
  name: string
  photoUrl: string | null
  teamId: string | null
  role?: string | null
}

export type LeaderboardKey =
  | 'runs'
  | 'wickets'
  | 'catches'
  | 'sixes'
  | 'goals'
  | 'assists'
  | 'cleanSheets'
  | 'cards'
  | 'points'

export interface LeaderRow {
  playerId: string
  name: string
  photoUrl: string | null
  teamId: string | null
  /** Matches with a stat line. */
  matches: number
  /** The number the board is ranked by. */
  value: number
  /**
   * Extra columns, per board — runs: innings, balls, strikeRate, highest,
   * fifties, hundreds, fours, sixes · wickets: balls, runsConceded, economy,
   * bestWickets, bestRuns · goals: assists · cards: yellow, red ·
   * cleanSheets: saves · points: average.
   */
  detail: Record<string, number | null>
}

export interface Leaderboard {
  key: LeaderboardKey
  rows: LeaderRow[]
}

interface Totals {
  matches: Set<string>
  runs: number
  innings: number
  ballsFaced: number
  fours: number
  sixes: number
  highest: number
  fifties: number
  hundreds: number
  wickets: number
  ballsBowled: number
  runsConceded: number
  bestWickets: number
  bestRuns: number | null
  catches: number
  goals: number
  assists: number
  yellow: number
  red: number
  saves: number
  cleanSheets: number
  points: number
}

const n0 = (v: number | null | undefined) => (isNum(v) ? v : 0)
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits

export interface LeaderboardMatch {
  id: string
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  homeScore?: number | null
  awayScore?: number | null
}

/**
 * Leaderboards from per-match stat lines. Cricket: runs (with balls, strike
 * rate, 50s/100s), wickets (economy), catches, sixes. Football: goals,
 * assists, clean sheets (goalkeepers whose side conceded none — needs
 * `matches`), cards. Others: points. Players with nothing on a board are left off it.
 */
export function computeLeaderboards(
  sport: string,
  stats: readonly StatLine[],
  players: readonly LeaderPlayer[],
  opts: { limit?: number; matches?: readonly LeaderboardMatch[] } = {},
): Leaderboard[] {
  const limit = opts.limit ?? 10
  const byId = new Map(players.map((p) => [p.id, p]))
  const matchById = new Map((opts.matches ?? []).map((m) => [m.id, m]))
  const totals = new Map<string, Totals>()
  for (const s of stats) {
    if (!byId.has(s.playerId)) continue
    let t = totals.get(s.playerId)
    if (!t) {
      t = {
        matches: new Set(),
        runs: 0,
        innings: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        highest: 0,
        fifties: 0,
        hundreds: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        bestWickets: 0,
        bestRuns: null,
        catches: 0,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        saves: 0,
        cleanSheets: 0,
        points: 0,
      }
      totals.set(s.playerId, t)
    }
    t.matches.add(s.matchId)
    const runs = n0(s.runs)
    if (isNum(s.runs) || n0(s.ballsFaced) > 0) t.innings++
    t.runs += runs
    t.ballsFaced += n0(s.ballsFaced)
    t.fours += n0(s.fours)
    t.sixes += n0(s.sixes)
    t.highest = Math.max(t.highest, runs)
    if (runs >= 100) t.hundreds++
    else if (runs >= 50) t.fifties++
    const w = n0(s.wickets)
    const rc = n0(s.runsConceded)
    t.wickets += w
    t.ballsBowled += n0(s.ballsBowled)
    t.runsConceded += rc
    if (w > t.bestWickets || (w === t.bestWickets && w > 0 && (t.bestRuns === null || rc < t.bestRuns))) {
      t.bestWickets = w
      t.bestRuns = rc
    }
    t.catches += n0(s.catches)
    t.goals += n0(s.goals)
    t.assists += n0(s.assists)
    t.yellow += n0(s.yellowCards)
    t.red += n0(s.redCards)
    t.saves += n0(s.saves)
    t.points += n0(s.points)
    const player = byId.get(s.playerId)!
    const match = matchById.get(s.matchId)
    if (sport === 'FOOTBALL' && match && match.status === 'COMPLETED' && player.role?.toLowerCase() === 'goalkeeper') {
      const team = s.teamId ?? player.teamId
      const conceded = team === match.homeTeamId ? match.awayScore : team === match.awayTeamId ? match.homeScore : null
      if (conceded === 0) t.cleanSheets++
    }
  }

  const board = (
    key: LeaderboardKey,
    value: (t: Totals) => number,
    detail: (t: Totals) => Record<string, number | null>,
    tieBreak: (a: Totals, b: Totals) => number = () => 0,
  ): Leaderboard => {
    const rows = [...totals.entries()]
      .filter(([, t]) => value(t) > 0)
      .sort(([ia, a], [ib, b]) => value(b) - value(a) || tieBreak(a, b) || byId.get(ia)!.name.localeCompare(byId.get(ib)!.name))
      .slice(0, limit)
      .map(([id, t]) => {
        const p = byId.get(id)!
        return { playerId: id, name: p.name, photoUrl: p.photoUrl, teamId: p.teamId, matches: t.matches.size, value: value(t), detail: detail(t) }
      })
    return { key, rows }
  }

  const strikeRate = (t: Totals) => (t.ballsFaced > 0 ? round((t.runs * 100) / t.ballsFaced, 2) : null)
  const economy = (t: Totals) => (t.ballsBowled > 0 ? round((t.runsConceded * 6) / t.ballsBowled, 2) : null)

  if (sport === 'CRICKET') {
    return [
      board(
        'runs',
        (t) => t.runs,
        (t) => ({
          innings: t.innings,
          balls: t.ballsFaced,
          strikeRate: strikeRate(t),
          highest: t.highest,
          fifties: t.fifties,
          hundreds: t.hundreds,
          fours: t.fours,
          sixes: t.sixes,
        }),
        (a, b) => (strikeRate(b) ?? 0) - (strikeRate(a) ?? 0),
      ),
      board(
        'wickets',
        (t) => t.wickets,
        (t) => ({ balls: t.ballsBowled, runsConceded: t.runsConceded, economy: economy(t), bestWickets: t.bestWickets, bestRuns: t.bestRuns }),
        (a, b) => (economy(a) ?? Infinity) - (economy(b) ?? Infinity),
      ),
      board('catches', (t) => t.catches, () => ({})),
      board('sixes', (t) => t.sixes, (t) => ({ fours: t.fours })),
    ]
  }
  if (sport === 'FOOTBALL') {
    return [
      board('goals', (t) => t.goals, (t) => ({ assists: t.assists }), (a, b) => b.assists - a.assists),
      board('assists', (t) => t.assists, (t) => ({ goals: t.goals }), (a, b) => b.goals - a.goals),
      board('cleanSheets', (t) => t.cleanSheets, (t) => ({ saves: t.saves }), (a, b) => b.saves - a.saves),
      board('cards', (t) => t.red * 3 + t.yellow, (t) => ({ yellow: t.yellow, red: t.red })),
    ]
  }
  return [board('points', (t) => t.points, (t) => ({ average: t.matches.size ? round(t.points / t.matches.size, 1) : null }))]
}
