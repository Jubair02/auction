'use client'

// Shared league wording (stages, statuses, result types, formats, placeholder
// labels) and small helpers used by the League tab and the public league page.
import { type Strings, useStrings } from '@/lib/i18n'
import { ballsToOvers, parseSlotLabel, type MatchStage, type MatchStatus, type ResultType } from '@/lib/league'
import type { LeagueData, LeagueFormat, LeagueTeamDTO, MatchDTO } from '@/lib/types'

interface LeagueLabels {
  stage: Record<MatchStage, string>
  status: Record<MatchStatus, string>
  resultType: Record<ResultType, string>
  format: Record<LeagueFormat, string>
  formatHelp: Record<LeagueFormat, string>
  round: (n: number) => string
  group: (g: string) => string
  leagueTable: string
  matchNo: (n: number) => string
  tbd: string
  vs: string
  winnerOf: (n: number) => string
  loserOf: (n: number) => string
  positionIn: (pos: number, group: string | null) => string
}

const STRINGS = {
  en: {
    stage: {
      LEAGUE: 'League',
      GROUP: 'Group stage',
      KNOCKOUT: 'Knockout round',
      ROUND_OF_16: 'Round of 16',
      QUARTER_FINAL: 'Quarter-final',
      SEMI_FINAL: 'Semi-final',
      THIRD_PLACE: 'Third-place play-off',
      FINAL: 'Final',
    },
    status: { SCHEDULED: 'Scheduled', LIVE: 'Live', COMPLETED: 'Completed', ABANDONED: 'Abandoned', POSTPONED: 'Postponed' },
    resultType: { NORMAL: 'Normal result', TIE: 'Tie / draw', NO_RESULT: 'No result', WALKOVER: 'Walkover', FORFEIT: 'Forfeit' },
    format: {
      ROUND_ROBIN: 'Round-robin league',
      DOUBLE_ROUND_ROBIN: 'Double round-robin',
      GROUPS_KNOCKOUT: 'Groups + knockout',
      KNOCKOUT: 'Knockout',
    },
    formatHelp: {
      ROUND_ROBIN: 'Every team plays every other team once. The points table decides the champion.',
      DOUBLE_ROUND_ROBIN: 'Every team plays every other team twice — home and away.',
      GROUPS_KNOCKOUT: 'Teams play a round-robin in groups; the top teams of each group go into a knockout bracket.',
      KNOCKOUT: 'Lose and you are out. Top seeds get byes when the team count is not 4, 8, 16…',
    },
    round: (n) => `Round ${n}`,
    group: (g) => `Group ${g}`,
    leagueTable: 'League table',
    matchNo: (n) => `M${n}`,
    tbd: 'TBD',
    vs: 'vs',
    winnerOf: (n) => `Winner M${n}`,
    loserOf: (n) => `Loser M${n}`,
    positionIn: (pos, g) => {
      const p = pos === 1 ? 'Winner' : pos === 2 ? 'Runner-up' : `#${pos}`
      return g === null ? `${p}, league` : `${p}, Group ${g}`
    },
  },
  bn: {
    stage: {
      LEAGUE: 'লিগ',
      GROUP: 'গ্রুপ পর্ব',
      KNOCKOUT: 'নকআউট রাউন্ড',
      ROUND_OF_16: 'শেষ ষোলো',
      QUARTER_FINAL: 'কোয়ার্টার ফাইনাল',
      SEMI_FINAL: 'সেমিফাইনাল',
      THIRD_PLACE: 'তৃতীয় স্থান নির্ধারণী',
      FINAL: 'ফাইনাল',
    },
    status: { SCHEDULED: 'নির্ধারিত', LIVE: 'লাইভ', COMPLETED: 'শেষ', ABANDONED: 'পরিত্যক্ত', POSTPONED: 'স্থগিত' },
    resultType: { NORMAL: 'সাধারণ ফলাফল', TIE: 'টাই / ড্র', NO_RESULT: 'ফলাফল নেই', WALKOVER: 'ওয়াকওভার', FORFEIT: 'ফোরফিট' },
    format: {
      ROUND_ROBIN: 'রাউন্ড-রবিন লিগ',
      DOUBLE_ROUND_ROBIN: 'ডাবল রাউন্ড-রবিন',
      GROUPS_KNOCKOUT: 'গ্রুপ + নকআউট',
      KNOCKOUT: 'নকআউট',
    },
    formatHelp: {
      ROUND_ROBIN: 'প্রতিটি দল অন্য সব দলের সাথে একবার খেলবে। পয়েন্ট টেবিলে চ্যাম্পিয়ন ঠিক হবে।',
      DOUBLE_ROUND_ROBIN: 'প্রতিটি দল অন্য সব দলের সাথে দুইবার খেলবে — হোম ও অ্যাওয়ে।',
      GROUPS_KNOCKOUT: 'দলগুলো গ্রুপে রাউন্ড-রবিন খেলবে; প্রতি গ্রুপের সেরা দলগুলো নকআউটে যাবে।',
      KNOCKOUT: 'হারলেই বিদায়। দলের সংখ্যা 4, 8, 16… না হলে সেরা সিডরা বাই পাবে।',
    },
    round: (n) => `রাউন্ড ${n}`,
    group: (g) => `গ্রুপ ${g}`,
    leagueTable: 'লিগ টেবিল',
    matchNo: (n) => `ম্যাচ ${n}`,
    tbd: 'ঠিক হয়নি',
    vs: 'বনাম',
    winnerOf: (n) => `ম্যাচ ${n}-এর বিজয়ী`,
    loserOf: (n) => `ম্যাচ ${n}-এর পরাজিত`,
    positionIn: (pos, g) => {
      const p = pos === 1 ? 'চ্যাম্পিয়ন' : pos === 2 ? 'রানার্স-আপ' : `${pos} নম্বর`
      return g === null ? `লিগের ${p}` : `গ্রুপ ${g}-এর ${p}`
    },
  },
} satisfies Strings<LeagueLabels>

export function useLeagueLabels(): LeagueLabels {
  return useStrings(STRINGS)
}

/** A placeholder label in the UI language ("Winner M7" → "ম্যাচ 7-এর বিজয়ী"); free text as typed. */
export function slotLabel(label: string | null, l: LeagueLabels): string {
  const ref = parseSlotLabel(label)
  if (!ref) return label || l.tbd
  if (ref.kind === 'match') return ref.outcome === 'WINNER' ? l.winnerOf(ref.matchNumber) : l.loserOf(ref.matchNumber)
  return l.positionIn(ref.position, ref.group)
}

export type TeamMap = Map<string, LeagueTeamDTO>

export function teamMap(data: Pick<LeagueData, 'teams'>): TeamMap {
  return new Map(data.teams.map((t) => [t.id, t]))
}

/** The team on one side of a match, or its placeholder text. */
export function sideInfo(match: MatchDTO, side: 'home' | 'away', teams: TeamMap, l: LeagueLabels) {
  const id = side === 'home' ? match.homeTeamId : match.awayTeamId
  const team = id ? teams.get(id) : undefined
  return {
    team: team ?? null,
    name: team?.name ?? slotLabel(side === 'home' ? match.homeLabel : match.awayLabel, l),
  }
}

/** "156/7 (19.4)" for cricket, the plain number otherwise; '' when not entered. */
export function scoreText(sport: string, match: MatchDTO, side: 'home' | 'away'): string {
  const score = side === 'home' ? match.homeScore : match.awayScore
  if (score === null) return ''
  if (sport !== 'CRICKET') return String(score)
  const w = side === 'home' ? match.homeWickets : match.awayWickets
  const b = side === 'home' ? match.homeBalls : match.awayBalls
  // All out (10) reads as the bare total, as on a scorecard.
  const wickets = w !== null && w < 10 ? `/${w}` : ''
  return `${score}${wickets}${b !== null ? ` (${ballsToOvers(b)})` : ''}`
}

/** "+1.234" / "-0.500" / "—". */
export function formatNrr(nrr: number | null): string {
  if (nrr === null) return '—'
  return `${nrr > 0 ? '+' : nrr < 0 ? '−' : ''}${Math.abs(nrr).toFixed(3)}`
}

export const STATUS_TONE: Record<MatchStatus, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  LIVE: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900',
  COMPLETED: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-900',
  ABANDONED: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
  POSTPONED: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
}

/** Section title for a block of fixtures: "Round 3", "Group stage · Round 1", "Semi-final". */
export function sectionKey(m: MatchDTO): string {
  return m.stage === 'LEAGUE' || m.stage === 'GROUP' ? `${m.stage}:${m.round}` : `${m.stage}`
}

export function sectionTitle(m: MatchDTO, l: LeagueLabels): string {
  if (m.stage === 'LEAGUE') return l.round(m.round)
  if (m.stage === 'GROUP') return `${l.stage.GROUP} · ${l.round(m.round)}`
  return l.stage[m.stage] ?? m.stage
}

/** Fixtures in display blocks, keeping the API's order. */
export function groupMatches(matches: readonly MatchDTO[], l: LeagueLabels): Array<{ key: string; title: string; matches: MatchDTO[] }> {
  const blocks: Array<{ key: string; title: string; matches: MatchDTO[] }> = []
  const byKey = new Map<string, (typeof blocks)[number]>()
  for (const m of matches) {
    const key = sectionKey(m)
    let block = byKey.get(key)
    if (!block) {
      block = { key, title: sectionTitle(m, l), matches: [] }
      byKey.set(key, block)
      blocks.push(block)
    }
    block.matches.push(m)
  }
  return blocks
}
