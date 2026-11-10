// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignGroups,
  ballsToOvers,
  bracketOrder,
  buildBracket,
  computeLeaderboards,
  computeStandings,
  describeResult,
  doubleRoundRobinRounds,
  generateFixtures,
  groupLetter,
  leagueTables,
  matchOutcome,
  oversToBalls,
  parseSlotLabel,
  pointsRules,
  positionLabel,
  qualifyCounts,
  resolveResult,
  resolveSlots,
  roundRobinRounds,
  scheduleFixtures,
  tablesForResolve,
  type BracketMatch,
  type MatchLike,
  type ResolvedTable,
} from './league.ts'

const teams = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`)

function checkRoundRobin(n: number) {
  const ids = teams(n)
  const rounds = roundRobinRounds(ids)
  assert.equal(rounds.length, n % 2 === 0 ? n - 1 : n, `rounds for ${n}`)
  const pairs = new Set<string>()
  const home = new Map(ids.map((id) => [id, 0]))
  const away = new Map(ids.map((id) => [id, 0]))
  for (const games of rounds) {
    const seen = new Set<string>()
    for (const [h, a] of games) {
      assert.notEqual(h, a)
      assert.ok(!seen.has(h) && !seen.has(a), 'a team plays at most once per round')
      seen.add(h)
      seen.add(a)
      const key = [h, a].sort().join('-')
      assert.ok(!pairs.has(key), `pair ${key} repeated`)
      pairs.add(key)
      home.set(h, home.get(h)! + 1)
      away.set(a, away.get(a)! + 1)
    }
    // Odd count: exactly one bye per round.
    assert.equal(seen.size, n % 2 === 0 ? n : n - 1)
  }
  assert.equal(pairs.size, (n * (n - 1)) / 2, 'every pair meets once')
  for (const id of ids) {
    assert.ok(Math.abs(home.get(id)! - away.get(id)!) <= 1, `${id} home/away balanced (n=${n})`)
  }
}

describe('roundRobinRounds', () => {
  it('builds a valid, balanced single round-robin for 2–12 teams', () => {
    for (let n = 2; n <= 12; n++) checkRoundRobin(n)
  })

  it('returns nothing for fewer than two teams', () => {
    assert.deepEqual(roundRobinRounds([]), [])
    assert.deepEqual(roundRobinRounds(['A']), [])
  })

  it('double round-robin swaps home and away in the second leg', () => {
    const ids = teams(5)
    const rounds = doubleRoundRobinRounds(ids)
    const single = roundRobinRounds(ids)
    assert.equal(rounds.length, single.length * 2)
    const legs = new Map<string, number>()
    for (const games of rounds) for (const [h, a] of games) legs.set(`${h}>${a}`, (legs.get(`${h}>${a}`) ?? 0) + 1)
    for (const a of ids) for (const b of ids) if (a !== b) assert.equal(legs.get(`${a}>${b}`), 1, `${a} hosts ${b} once`)
  })
})

describe('groups', () => {
  it('labels groups A..Z, AA', () => {
    assert.equal(groupLetter(0), 'A')
    assert.equal(groupLetter(25), 'Z')
    assert.equal(groupLetter(26), 'AA')
  })

  it('auto-balances unassigned teams', () => {
    const g = assignGroups(teams(7).map((id) => ({ id })), 2)
    assert.deepEqual([...g.keys()], ['A', 'B'])
    assert.deepEqual(g.get('A'), ['T1', 'T3', 'T5', 'T7'])
    assert.deepEqual(g.get('B'), ['T2', 'T4', 'T6'])
  })

  it('keeps explicit groups and fills the rest into the smallest', () => {
    const g = assignGroups(
      [
        { id: 'a', groupName: 'B' },
        { id: 'b', groupName: 'B' },
        { id: 'c', groupName: 'A' },
        { id: 'd', groupName: null },
      ],
      2,
    )
    assert.deepEqual(g.get('A'), ['c', 'd'])
    assert.deepEqual(g.get('B'), ['a', 'b'])
  })
})

describe('labels', () => {
  it('round-trips managed placeholder labels', () => {
    assert.deepEqual(parseSlotLabel('Winner M12'), { kind: 'match', outcome: 'WINNER', matchNumber: 12 })
    assert.deepEqual(parseSlotLabel('Loser M3'), { kind: 'match', outcome: 'LOSER', matchNumber: 3 })
    assert.deepEqual(parseSlotLabel(positionLabel(1, 'A')), { kind: 'position', group: 'A', position: 1 })
    assert.deepEqual(parseSlotLabel(positionLabel(2, 'B')), { kind: 'position', group: 'B', position: 2 })
    assert.deepEqual(parseSlotLabel(positionLabel(3, 'C')), { kind: 'position', group: 'C', position: 3 })
    assert.deepEqual(parseSlotLabel(positionLabel(1, null)), { kind: 'position', group: null, position: 1 })
    assert.equal(positionLabel(11, 'A'), '11th Group A')
    assert.equal(parseSlotLabel('TBD'), null)
    assert.equal(parseSlotLabel(null), null)
  })

  it('counts qualifiers per table from labels', () => {
    const q = qualifyCounts(['Winner Group A', 'Runner-up Group A', 'Winner Group B', 'Winner M3', null, '3rd League'])
    assert.equal(q.get('A'), 2)
    assert.equal(q.get('B'), 1)
    assert.equal(q.get(''), 3)
  })
})

describe('knockout bracket', () => {
  it('orders seeds so 1 and 2 meet only in the final', () => {
    assert.deepEqual(bracketOrder(4), [1, 4, 2, 3])
    assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6])
  })

  it('builds a full bracket for 8 teams', () => {
    const r = generateFixtures({ format: 'KNOCKOUT', teams: teams(8).map((id) => ({ id })) })
    assert.ok(r.ok)
    const f = r.fixtures
    assert.equal(f.length, 7)
    assert.deepEqual(f.map((m) => m.stage), ['QUARTER_FINAL', 'QUARTER_FINAL', 'QUARTER_FINAL', 'QUARTER_FINAL', 'SEMI_FINAL', 'SEMI_FINAL', 'FINAL'])
    assert.equal(f[0].homeTeamId, 'T1')
    assert.equal(f[0].awayTeamId, 'T8')
    assert.equal(f[4].homeLabel, 'Winner M1')
    assert.equal(f[4].awayLabel, 'Winner M2')
    assert.equal(f[6].homeLabel, 'Winner M5')
    assert.equal(f[6].awayLabel, 'Winner M6')
  })

  it('gives byes to top seeds when the count is not a power of two', () => {
    const r = generateFixtures({ format: 'KNOCKOUT', teams: teams(5).map((id) => ({ id })) })
    assert.ok(r.ok)
    const f = r.fixtures
    // 1 first-round match (4 v 5), 2 semis, final.
    assert.equal(f.length, 4)
    assert.equal(f[0].stage, 'QUARTER_FINAL')
    assert.deepEqual([f[0].homeTeamId, f[0].awayTeamId], ['T4', 'T5'])
    const semis = f.filter((m) => m.stage === 'SEMI_FINAL')
    assert.equal(semis.length, 2)
    assert.equal(semis[0].homeTeamId, 'T1')
    assert.equal(semis[0].awayLabel, 'Winner M1')
    assert.deepEqual([semis[1].homeTeamId, semis[1].awayTeamId], ['T2', 'T3'])
    // Every team appears in the bracket exactly once.
    const all = f.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter(Boolean)
    assert.equal(new Set(all).size, 5)
    assert.equal(all.length, 5)
  })

  it('handles two teams (final only) and adds a third-place match', () => {
    const two = generateFixtures({ format: 'KNOCKOUT', teams: teams(2).map((id) => ({ id })) })
    assert.ok(two.ok)
    assert.equal(two.fixtures.length, 1)
    assert.equal(two.fixtures[0].stage, 'FINAL')
    const four = generateFixtures({ format: 'KNOCKOUT', teams: teams(4).map((id) => ({ id })), thirdPlace: true })
    assert.ok(four.ok)
    assert.deepEqual(four.fixtures.map((m) => m.stage), ['SEMI_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'])
    assert.equal(four.fixtures[2].homeLabel, 'Loser M1')
    assert.equal(four.fixtures[3].homeLabel, 'Winner M1')
  })

  it('numbers rounds and matches consecutively for a big bracket', () => {
    const r = generateFixtures({ format: 'KNOCKOUT', teams: teams(20).map((id) => ({ id })) })
    assert.ok(r.ok)
    assert.equal(r.fixtures.length, 19)
    assert.equal(r.fixtures[0].stage, 'KNOCKOUT')
    assert.deepEqual(r.fixtures.map((m) => m.matchNumber), Array.from({ length: 19 }, (_, i) => i + 1))
    assert.equal(r.fixtures.at(-1)!.stage, 'FINAL')
  })

  it('swaps first-round pairs apart when asked to avoid them', () => {
    const entrants = ['A1', 'B1', 'A2', 'B2'].map((l) => ({ teamId: null, label: l }))
    const f = buildBracket(entrants, { firstMatchNumber: 1, firstRound: 1, avoid: (a, b) => a.label![0] === b.label![0] })
    for (const m of f.filter((x) => x.stage === 'SEMI_FINAL')) assert.notEqual(m.homeLabel![0], m.awayLabel![0])
  })
})

describe('groups + knockout', () => {
  it('makes group round-robins then a cross-over bracket', () => {
    const r = generateFixtures({ format: 'GROUPS_KNOCKOUT', teams: teams(8).map((id) => ({ id })), groupCount: 2, qualifiersPerGroup: 2 })
    assert.ok(r.ok)
    const group = r.fixtures.filter((m) => m.stage === 'GROUP')
    assert.equal(group.length, 12) // 6 per group of 4
    assert.ok(group.every((m) => m.groupName === 'A' || m.groupName === 'B'))
    const ko = r.fixtures.filter((m) => m.stage !== 'GROUP')
    assert.deepEqual(ko.map((m) => m.stage), ['SEMI_FINAL', 'SEMI_FINAL', 'FINAL'])
    assert.deepEqual([ko[0].homeLabel, ko[0].awayLabel], ['Winner Group A', 'Runner-up Group B'])
    assert.deepEqual([ko[1].homeLabel, ko[1].awayLabel], ['Winner Group B', 'Runner-up Group A'])
    assert.equal(ko[2].homeLabel, `Winner M${ko[0].matchNumber}`)
    assert.ok(ko[0].round > Math.max(...group.map((m) => m.round)))
    assert.deepEqual(r.fixtures.map((m) => m.matchNumber), r.fixtures.map((_, i) => i + 1))
  })

  it('never pairs two teams from the same group in the first knockout round', () => {
    for (const groups of [2, 3, 4]) {
      const r = generateFixtures({ format: 'GROUPS_KNOCKOUT', teams: teams(groups * 3).map((id) => ({ id })), groupCount: groups, qualifiersPerGroup: 2 })
      assert.ok(r.ok)
      for (const m of r.fixtures.filter((x) => x.stage !== 'GROUP' && x.homeLabel && x.awayLabel)) {
        const a = parseSlotLabel(m.homeLabel)
        const b = parseSlotLabel(m.awayLabel)
        if (a?.kind === 'position' && b?.kind === 'position') assert.notEqual(a.group, b.group, `${groups} groups: ${m.homeLabel} v ${m.awayLabel}`)
      }
    }
  })

  it('rejects groups that are too small or too many qualifiers', () => {
    const tiny = generateFixtures({ format: 'GROUPS_KNOCKOUT', teams: teams(3).map((id) => ({ id })), groupCount: 2 })
    assert.equal(tiny.ok, false)
    const many = generateFixtures({ format: 'GROUPS_KNOCKOUT', teams: teams(6).map((id) => ({ id })), groupCount: 2, qualifiersPerGroup: 4 })
    assert.equal(many.ok, false)
    assert.equal(generateFixtures({ format: 'ROUND_ROBIN', teams: [{ id: 'x' }] }).ok, false)
  })
})

describe('scheduleFixtures', () => {
  const start = new Date('2026-12-01T10:00:00Z')
  const day = (d: Date) => Math.round((d.getTime() - start.getTime()) / 86_400_000)

  it('puts a round on one day and spaces rounds by the interval', () => {
    const dates = scheduleFixtures([{ round: 1 }, { round: 1 }, { round: 2 }, { round: 2 }], { start, intervalDays: 7, matchesPerDay: null })
    assert.deepEqual(dates.map(day), [0, 0, 7, 7])
    assert.equal(dates[0].toISOString(), '2026-12-01T10:00:00.000Z')
  })

  it('spills to the next day past matches per day', () => {
    const dates = scheduleFixtures([{ round: 1 }, { round: 1 }, { round: 1 }, { round: 2 }], { start, intervalDays: 2, matchesPerDay: 2 })
    assert.deepEqual(dates.map(day), [0, 0, 1, 3])
  })

  it('keeps filling days when the interval is 0', () => {
    const dates = scheduleFixtures([{ round: 1 }, { round: 1 }, { round: 2 }, { round: 2 }], { start, intervalDays: 0, matchesPerDay: 3 })
    assert.deepEqual(dates.map(day), [0, 0, 0, 1])
  })
})

describe('overs', () => {
  it('converts overs and balls', () => {
    assert.equal(oversToBalls('19.4'), 118)
    assert.equal(oversToBalls('20'), 120)
    assert.equal(oversToBalls(7), 42)
    assert.equal(oversToBalls('0.5'), 5)
    assert.equal(oversToBalls('19.6'), null)
    assert.equal(oversToBalls('abc'), null)
    assert.equal(oversToBalls(''), null)
    assert.equal(ballsToOvers(118), '19.4')
    assert.equal(ballsToOvers(120), '20')
    assert.equal(ballsToOvers(null), '')
  })
})

const team = (id: string) => ({ id, name: id })
const done = (home: string, away: string, extra: Partial<MatchLike>): MatchLike => ({
  stage: 'LEAGUE',
  status: 'COMPLETED',
  homeTeamId: home,
  awayTeamId: away,
  resultType: 'NORMAL',
  ...extra,
})

describe('points and outcomes', () => {
  it('uses sport defaults unless set', () => {
    assert.deepEqual(pointsRules('CRICKET'), { win: 2, draw: 1, loss: 0 })
    assert.deepEqual(pointsRules('FOOTBALL'), { win: 3, draw: 1, loss: 0 })
    assert.deepEqual(pointsRules('FOOTBALL', { pointsWin: 2, pointsDraw: null, pointsLoss: 1 }), { win: 2, draw: 1, loss: 1 })
  })

  it('reads outcomes from the result', () => {
    assert.deepEqual(matchOutcome(done('A', 'B', { homeScore: 2, awayScore: 1 })), { kind: 'WIN', winner: 'A', loser: 'B' })
    assert.deepEqual(matchOutcome(done('A', 'B', { homeScore: 1, awayScore: 1 })), { kind: 'DRAW' })
    assert.deepEqual(matchOutcome(done('A', 'B', { resultType: 'TIE' })), { kind: 'DRAW' })
    assert.deepEqual(matchOutcome(done('A', 'B', { resultType: 'NO_RESULT' })), { kind: 'NR' })
    assert.deepEqual(matchOutcome(done('A', 'B', { resultType: 'WALKOVER', winnerTeamId: 'B' })), { kind: 'WIN', winner: 'B', loser: 'A' })
    // A forfeit goes to the named winner even when the forfeiting side was ahead at the time.
    assert.deepEqual(matchOutcome(done('A', 'B', { resultType: 'FORFEIT', winnerTeamId: 'B', homeScore: 2, awayScore: 1 })), { kind: 'WIN', winner: 'B', loser: 'A' })
    // Without a winner an awarded result does not count yet.
    assert.equal(matchOutcome(done('A', 'B', { resultType: 'FORFEIT' })), null)
    assert.deepEqual(matchOutcome({ ...done('A', 'B', {}), status: 'ABANDONED' }), { kind: 'NR' })
    assert.equal(matchOutcome({ ...done('A', 'B', { homeScore: 1, awayScore: 0 }), status: 'SCHEDULED' }), null)
    assert.equal(matchOutcome(done('A', 'B', {})), null)
  })
})

describe('resolveResult', () => {
  const base = { sport: 'FOOTBALL', knockout: false, resultType: null, homeTeamId: 'A', awayTeamId: 'B', homeScore: null, awayScore: null, winnerTeamId: null, winnerSent: false }

  it('takes a normal winner from the score', () => {
    assert.deepEqual(resolveResult({ ...base, homeScore: 2, awayScore: 1 }), { resultType: 'NORMAL', winnerTeamId: 'A' })
    assert.deepEqual(resolveResult({ ...base, homeScore: 0, awayScore: 3, resultType: 'NORMAL' }), { resultType: 'NORMAL', winnerTeamId: 'B' })
    assert.deepEqual(resolveResult({ ...base, homeScore: 2, awayScore: 1, winnerTeamId: 'B', winnerSent: true }), { error: 'The winner must be the team with the higher score' })
    assert.deepEqual(resolveResult({ ...base, homeScore: 2 }), { error: 'Enter both scores, or pick another result type' })
  })

  it('makes level league scores a draw (a tie in cricket)', () => {
    assert.deepEqual(resolveResult({ ...base, homeScore: 1, awayScore: 1, winnerTeamId: 'A' }), { resultType: 'NORMAL', winnerTeamId: null })
    assert.deepEqual(resolveResult({ ...base, sport: 'CRICKET', homeScore: 150, awayScore: 150 }), { resultType: 'TIE', winnerTeamId: null })
    assert.deepEqual(resolveResult({ ...base, resultType: 'TIE', winnerTeamId: 'A' }), { resultType: 'TIE', winnerTeamId: null })
  })

  it('needs who went through in a level knockout', () => {
    const ko = { ...base, knockout: true }
    assert.ok('error' in resolveResult({ ...ko, homeScore: 1, awayScore: 1 }))
    assert.deepEqual(resolveResult({ ...ko, homeScore: 1, awayScore: 1, winnerTeamId: 'B', winnerSent: true }), { resultType: 'NORMAL', winnerTeamId: 'B' })
    assert.deepEqual(resolveResult({ ...ko, resultType: 'TIE', winnerTeamId: 'A' }), { resultType: 'TIE', winnerTeamId: 'A' })
    assert.deepEqual(resolveResult({ ...ko, resultType: 'NO_RESULT' }), { resultType: 'NO_RESULT', winnerTeamId: null })
  })

  it('needs a named winner for walkovers and forfeits', () => {
    assert.deepEqual(resolveResult({ ...base, resultType: 'WALKOVER' }), { error: 'Pick the team that won by walkover' })
    assert.deepEqual(resolveResult({ ...base, resultType: 'FORFEIT' }), { error: 'Pick the team that won by forfeit' })
    assert.deepEqual(resolveResult({ ...base, resultType: 'FORFEIT', winnerTeamId: 'B', homeScore: 5, awayScore: 2 }), { resultType: 'FORFEIT', winnerTeamId: 'B' })
  })
})

describe('computeStandings — football', () => {
  it('ranks by points, goal difference, goals for, then head-to-head', () => {
    const rows = computeStandings(
      ['A', 'B', 'C', 'D'].map(team),
      [
        done('A', 'B', { homeScore: 3, awayScore: 0 }),
        done('C', 'D', { homeScore: 1, awayScore: 1 }),
        done('A', 'C', { homeScore: 0, awayScore: 1 }),
        done('B', 'D', { homeScore: 2, awayScore: 0 }),
        { ...done('A', 'D', { homeScore: 9, awayScore: 0 }), status: 'SCHEDULED' },
      ],
      { sport: 'FOOTBALL' },
    )
    assert.deepEqual(rows.map((r) => r.teamId), ['C', 'A', 'B', 'D'])
    const a = rows.find((r) => r.teamId === 'A')!
    assert.equal(a.played, 2)
    assert.equal(a.points, 3)
    assert.equal(a.scoreFor, 3)
    assert.equal(a.scoreAgainst, 1)
    assert.equal(a.scoreDiff, 2)
    assert.deepEqual(a.form, ['W', 'L'])
    assert.deepEqual(rows.map((r) => r.position), [1, 2, 3, 4])
  })

  it('separates teams level on everything by head-to-head', () => {
    // A and B both: 1W 1L, GF 2, GA 2 — A beat B.
    const rows = computeStandings(
      ['A', 'B', 'C'].map(team),
      [
        done('A', 'B', { homeScore: 1, awayScore: 0 }),
        done('B', 'C', { homeScore: 2, awayScore: 1 }),
        done('C', 'A', { homeScore: 2, awayScore: 1 }),
      ],
      { sport: 'FOOTBALL' },
    )
    // All three: 3 points, GD 0, GF... A:2 B:2 C:3 → C first, then A over B on head-to-head.
    assert.deepEqual(rows.map((r) => r.teamId), ['C', 'A', 'B'])
  })

  it('applies custom points and counts abandoned matches as no result', () => {
    const rows = computeStandings(
      ['A', 'B'].map(team),
      [{ ...done('A', 'B', {}), status: 'ABANDONED' }],
      { sport: 'FOOTBALL', pointsDraw: 2 },
    )
    assert.equal(rows[0].noResult, 1)
    assert.equal(rows[0].points, 2)
    assert.equal(rows[0].played, 1)
  })

  it('ignores knockout matches and outside teams', () => {
    const rows = computeStandings(
      ['A', 'B'].map(team),
      [{ ...done('A', 'B', { homeScore: 1, awayScore: 0 }), stage: 'FINAL' }, done('A', 'Z', { homeScore: 1, awayScore: 0 })],
      { sport: 'FOOTBALL' },
    )
    assert.ok(rows.every((r) => r.played === 0))
  })
})

describe('computeStandings — cricket', () => {
  it('computes NRR with the full quota for a bowled-out side', () => {
    const rows = computeStandings(
      ['A', 'B'].map(team),
      [
        // A 160/5 in 20 overs; B 140 all out in 18 overs → B's innings counts as 20 overs.
        done('A', 'B', { homeScore: 160, homeWickets: 5, homeBalls: 120, awayScore: 140, awayWickets: 10, awayBalls: 108 }),
      ],
      { sport: 'CRICKET', oversPerInnings: 20 },
    )
    const a = rows.find((r) => r.teamId === 'A')!
    const b = rows.find((r) => r.teamId === 'B')!
    assert.equal(a.points, 2)
    assert.equal(a.nrr, 1) // 160/20 - 140/20
    assert.equal(b.nrr, -1)
    assert.equal(rows[0].teamId, 'A')
  })

  it('uses actual overs without a quota and ranks wins before NRR', () => {
    const rows = computeStandings(
      ['A', 'B', 'C'].map(team),
      [
        done('A', 'B', { homeScore: 100, homeWickets: 2, homeBalls: 60, awayScore: 99, awayWickets: 10, awayBalls: 60 }),
        done('C', 'B', { resultType: 'NO_RESULT' }),
        done('C', 'A', { resultType: 'TIE', homeScore: 120, awayScore: 120, homeBalls: 120, awayBalls: 120 }),
      ],
      { sport: 'CRICKET' },
    )
    assert.deepEqual(rows.map((r) => r.teamId), ['A', 'C', 'B'])
    const c = rows.find((r) => r.teamId === 'C')!
    assert.equal(c.points, 2) // tie 1 + no result 1
    assert.equal(c.drawn, 1)
    assert.equal(c.noResult, 1)
    assert.equal(c.nrr, 0)
    const a = rows.find((r) => r.teamId === 'A')!
    assert.equal(a.nrr, 0.033) // (100+120)/30 - (99+120)/30
  })

  it('keeps forfeits out of NRR but gives the winner the points', () => {
    const rows = computeStandings(
      ['A', 'B'].map(team),
      [done('A', 'B', { resultType: 'FORFEIT', winnerTeamId: 'B', homeScore: 80, homeWickets: 2, homeBalls: 60, awayScore: 40, awayWickets: 1, awayBalls: 30 })],
      { sport: 'CRICKET' },
    )
    const b = rows.find((r) => r.teamId === 'B')!
    assert.equal(b.points, 2)
    assert.equal(b.won, 1)
    assert.equal(b.nrr, null)
    assert.equal(rows[0].teamId, 'B')
  })

  it('gives NRR null with no overs recorded', () => {
    const rows = computeStandings(['A', 'B'].map(team), [done('A', 'B', { homeScore: 10, awayScore: 5 })], { sport: 'CRICKET' })
    assert.equal(rows[0].nrr, null)
    assert.equal(rows[0].points, 2)
  })
})

describe('computeStandings — other sports', () => {
  it('ranks by points then score difference', () => {
    const rows = computeStandings(
      ['A', 'B', 'C'].map(team),
      [done('A', 'B', { homeScore: 30, awayScore: 20 }), done('C', 'B', { homeScore: 40, awayScore: 20 })],
      { sport: 'OTHER' },
    )
    assert.deepEqual(rows.map((r) => r.teamId), ['C', 'A', 'B'])
  })
})

describe('resolveSlots', () => {
  const m = (n: number, extra: Partial<BracketMatch>): BracketMatch => ({
    id: `m${n}`,
    matchNumber: n,
    status: 'SCHEDULED',
    homeTeamId: null,
    awayTeamId: null,
    homeLabel: null,
    awayLabel: null,
    winnerTeamId: null,
    ...extra,
  })

  it('fills winners and losers of completed matches', () => {
    const matches = [
      m(1, { status: 'COMPLETED', homeTeamId: 'A', awayTeamId: 'B', winnerTeamId: 'B' }),
      m(2, { homeTeamId: 'C', awayTeamId: 'D' }),
      m(3, { homeLabel: 'Loser M1', awayLabel: 'Loser M2' }),
      m(4, { homeLabel: 'Winner M1', awayLabel: 'Winner M2' }),
    ]
    const updates = resolveSlots(matches, new Map())
    assert.deepEqual(updates, [
      { id: 'm3', homeTeamId: 'A' },
      { id: 'm4', homeTeamId: 'B' },
    ])
  })

  it('re-routes after a corrected result and clears undecided sides', () => {
    const matches = [
      m(1, { status: 'COMPLETED', homeTeamId: 'A', awayTeamId: 'B', winnerTeamId: 'A' }),
      m(2, { status: 'SCHEDULED', homeTeamId: 'C', awayTeamId: 'D' }),
      m(3, { homeLabel: 'Winner M1', awayLabel: 'Winner M2', homeTeamId: 'B', awayTeamId: 'D' }),
    ]
    assert.deepEqual(resolveSlots(matches, new Map()), [{ id: 'm3', homeTeamId: 'A', awayTeamId: null }])
  })

  it('leaves completed matches and free-text labels alone', () => {
    const matches = [
      m(1, { status: 'COMPLETED', homeTeamId: 'A', awayTeamId: 'B', winnerTeamId: 'A' }),
      m(2, { status: 'COMPLETED', homeLabel: 'Winner M1', homeTeamId: 'B', awayTeamId: 'C' }),
      m(3, { homeLabel: 'TBD', homeTeamId: 'X' }),
    ]
    assert.deepEqual(resolveSlots(matches, new Map()), [])
  })

  it('fills group positions once the group is complete', () => {
    const matches = [m(7, { homeLabel: 'Winner Group A', awayLabel: 'Runner-up Group B' }), m(8, { homeLabel: 'Winner League' })]
    const tables = new Map<string, ResolvedTable>([
      ['A', { complete: true, order: ['A1', 'A2'] }],
      ['B', { complete: false, order: ['B1', 'B2'] }],
      ['', { complete: true, order: ['L1'] }],
    ])
    assert.deepEqual(resolveSlots(matches, tables), [
      { id: 'm7', homeTeamId: 'A1' },
      { id: 'm8', homeTeamId: 'L1' },
    ])
  })
})

describe('leagueTables', () => {
  it('builds the league table and group tables, with completion and qualifiers', () => {
    const teamList = [
      { id: 'A', name: 'A', groupName: 'A' },
      { id: 'B', name: 'B', groupName: 'A' },
      { id: 'C', name: 'C', groupName: 'B' },
      { id: 'D', name: 'D', groupName: 'B' },
    ]
    const matches = [
      { ...done('A', 'B', { homeScore: 2, awayScore: 0 }), stage: 'GROUP', groupName: 'A' },
      { ...done('C', 'D', {}), stage: 'GROUP', groupName: 'B', status: 'SCHEDULED' },
      { ...done('A', 'C', {}), stage: 'FINAL', status: 'SCHEDULED', homeTeamId: null, awayTeamId: null, homeLabel: 'Winner Group A', awayLabel: 'Winner Group B' },
    ]
    const tables = leagueTables(teamList, matches, { sport: 'FOOTBALL' })
    assert.deepEqual(tables.map((t) => t.groupName), ['A', 'B'])
    assert.equal(tables[0].complete, true)
    assert.equal(tables[1].complete, false)
    assert.equal(tables[0].qualifyCount, 1)
    assert.deepEqual(tables[0].rows.map((r) => r.teamId), ['A', 'B'])
    const resolved = tablesForResolve(tables)
    assert.deepEqual(resolved.get('A'), { complete: true, order: ['A', 'B'] })
  })
})

describe('describeResult', () => {
  const base = { homeName: 'Alpha', awayName: 'Beta', homeTeamId: 'a', awayTeamId: 'b' }

  it('writes cricket margins', () => {
    assert.equal(
      describeResult({ ...base, sport: 'CRICKET', homeScore: 180, awayScore: 157, homeWickets: 6, awayWickets: 10, homeBalls: 120, awayBalls: 118, winnerTeamId: 'a', battedFirst: 'HOME' }),
      'Alpha won by 23 runs',
    )
    assert.equal(
      describeResult({ ...base, sport: 'CRICKET', homeScore: 150, awayScore: 151, homeWickets: 8, awayWickets: 5, homeBalls: 120, awayBalls: 110, winnerTeamId: 'b', battedFirst: 'HOME' }),
      'Beta won by 5 wickets',
    )
    // Without who batted first: the side that needed fewer balls chased.
    assert.equal(
      describeResult({ ...base, sport: 'CRICKET', homeScore: 151, awayScore: 150, homeWickets: 9, awayWickets: 6, homeBalls: 100, awayBalls: 120 }),
      'Alpha won by 1 wicket',
    )
    assert.equal(describeResult({ ...base, sport: 'CRICKET', homeScore: 120, awayScore: 120 }), 'Match tied')
    assert.equal(describeResult({ ...base, sport: 'CRICKET', resultType: 'TIE', winnerTeamId: 'b' }), 'Match tied — Beta won the super over')
  })

  it('writes football and other scores', () => {
    assert.equal(describeResult({ ...base, sport: 'FOOTBALL', homeScore: 3, awayScore: 1 }), 'Alpha won 3–1')
    assert.equal(describeResult({ ...base, sport: 'FOOTBALL', homeScore: 0, awayScore: 2 }), 'Beta won 2–0')
    assert.equal(describeResult({ ...base, sport: 'FOOTBALL', homeScore: 1, awayScore: 1 }), 'Match drawn 1–1')
    assert.equal(describeResult({ ...base, sport: 'FOOTBALL', homeScore: 1, awayScore: 1, winnerTeamId: 'b' }), 'Beta won on penalties (1–1)')
    assert.equal(describeResult({ ...base, sport: 'OTHER', homeScore: 25, awayScore: 21 }), 'Alpha won 25–21')
  })

  it('writes special results', () => {
    assert.equal(describeResult({ ...base, sport: 'FOOTBALL', resultType: 'NO_RESULT' }), 'No result')
    assert.equal(describeResult({ ...base, sport: 'CRICKET', resultType: 'WALKOVER', winnerTeamId: 'a' }), 'Alpha won by walkover')
    assert.equal(describeResult({ ...base, sport: 'OTHER', resultType: 'FORFEIT', winnerTeamId: 'b', homeScore: 7, awayScore: 3 }), 'Beta won by forfeit')
    assert.equal(describeResult({ ...base, sport: 'FOOTBALL', resultType: 'FORFEIT' }), 'Forfeit')
  })
})

describe('computeLeaderboards', () => {
  const players = [
    { id: 'p1', name: 'Shakib', photoUrl: null, teamId: 'A', role: 'All-rounder' },
    { id: 'p2', name: 'Tamim', photoUrl: null, teamId: 'A', role: 'Batsman' },
    { id: 'p3', name: 'Mustafiz', photoUrl: null, teamId: 'B', role: 'Bowler' },
    { id: 'gk', name: 'Keeper', photoUrl: null, teamId: 'B', role: 'Goalkeeper' },
  ]

  it('builds cricket boards', () => {
    const boards = computeLeaderboards('CRICKET', [
      { matchId: 'm1', playerId: 'p1', teamId: 'A', runs: 55, ballsFaced: 40, fours: 5, sixes: 2, wickets: 2, ballsBowled: 24, runsConceded: 20, catches: 1 },
      { matchId: 'm2', playerId: 'p1', teamId: 'A', runs: 101, ballsFaced: 60, wickets: 1, ballsBowled: 24, runsConceded: 30 },
      { matchId: 'm1', playerId: 'p2', teamId: 'A', runs: 12, ballsFaced: 10 },
      { matchId: 'm1', playerId: 'p3', teamId: 'B', wickets: 3, ballsBowled: 24, runsConceded: 18, catches: 2 },
      { matchId: 'm1', playerId: 'ghost', teamId: 'B', runs: 999 },
    ], players)
    const runs = boards.find((b) => b.key === 'runs')!
    assert.deepEqual(runs.rows.map((r) => r.playerId), ['p1', 'p2'])
    assert.equal(runs.rows[0].value, 156)
    assert.equal(runs.rows[0].matches, 2)
    assert.equal(runs.rows[0].detail.fifties, 1)
    assert.equal(runs.rows[0].detail.hundreds, 1)
    assert.equal(runs.rows[0].detail.highest, 101)
    assert.equal(runs.rows[0].detail.strikeRate, 156)
    const wickets = boards.find((b) => b.key === 'wickets')!
    // p1 and p3 both 3 wickets: p3 has the better economy (4.5 vs 6.25).
    assert.deepEqual(wickets.rows.map((r) => r.playerId), ['p3', 'p1'])
    assert.equal(wickets.rows[0].detail.economy, 4.5)
    assert.equal(wickets.rows[1].detail.bestWickets, 2)
    assert.equal(wickets.rows[1].detail.bestRuns, 20)
    const catches = boards.find((b) => b.key === 'catches')!
    assert.deepEqual(catches.rows.map((r) => [r.playerId, r.value]), [['p3', 2], ['p1', 1]])
  })

  it('builds football boards with clean sheets and cards', () => {
    const boards = computeLeaderboards(
      'FOOTBALL',
      [
        { matchId: 'm1', playerId: 'p1', teamId: 'A', goals: 2, assists: 1, yellowCards: 1 },
        { matchId: 'm1', playerId: 'gk', teamId: 'B', saves: 4 },
        { matchId: 'm2', playerId: 'gk', teamId: 'B', saves: 2, redCards: 1 },
      ],
      players,
      { matches: [
        { id: 'm1', status: 'COMPLETED', homeTeamId: 'A', awayTeamId: 'B', homeScore: 2, awayScore: 0 },
        { id: 'm2', status: 'COMPLETED', homeTeamId: 'B', awayTeamId: 'C', homeScore: 1, awayScore: 0 },
      ] },
    )
    assert.deepEqual(boards.map((b) => b.key), ['goals', 'assists', 'cleanSheets', 'cards'])
    assert.equal(boards[0].rows[0].value, 2)
    assert.equal(boards[2].rows[0].playerId, 'gk')
    assert.equal(boards[2].rows[0].value, 1)
    assert.deepEqual(boards[3].rows.map((r) => r.playerId), ['gk', 'p1'])
  })

  it('builds the points board for other sports', () => {
    const boards = computeLeaderboards('OTHER', [
      { matchId: 'm1', playerId: 'p1', teamId: 'A', points: 10 },
      { matchId: 'm2', playerId: 'p1', teamId: 'A', points: 5 },
    ], players)
    assert.equal(boards.length, 1)
    assert.equal(boards[0].rows[0].value, 15)
    assert.equal(boards[0].rows[0].detail.average, 7.5)
  })
})
