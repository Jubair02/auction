'use client'

import { Award } from 'lucide-react'
import { ballsToOvers } from '@/lib/league'
import { type Strings, useStrings } from '@/lib/i18n'
import type { LeaderboardKey, LeaderRow, LeagueData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/empty-state'
import { PlayerAvatar } from '@/components/shared/avatars'
import { teamMap } from './labels'

const STRINGS = {
  en: {
    title: {
      runs: 'Most runs',
      wickets: 'Most wickets',
      catches: 'Most catches',
      sixes: 'Most sixes',
      goals: 'Top scorers',
      assists: 'Most assists',
      cleanSheets: 'Clean sheets',
      cards: 'Discipline (cards)',
      points: 'Top points scorers',
    } as Record<LeaderboardKey, string>,
    unit: {
      runs: 'runs',
      wickets: 'wkts',
      catches: 'catches',
      sixes: 'sixes',
      goals: 'goals',
      assists: 'assists',
      cleanSheets: 'clean sheets',
      cards: '',
      points: 'pts',
    } as Record<LeaderboardKey, string>,
    matches: (n: number) => `${n} match${n === 1 ? '' : 'es'}`,
    runsDetail: (balls: number, sr: string, fifties: number, hundreds: number, hs: number) =>
      `${balls} balls · SR ${sr} · HS ${hs}${fifties ? ` · 50s ${fifties}` : ''}${hundreds ? ` · 100s ${hundreds}` : ''}`,
    wicketsDetail: (overs: string, econ: string, best: string) => `${overs} ov · Econ ${econ} · Best ${best}`,
    cards: (y: number, r: number) => `${y} yellow · ${r} red`,
    withAssists: (n: number) => `${n} assist${n === 1 ? '' : 's'}`,
    withGoals: (n: number) => `${n} goal${n === 1 ? '' : 's'}`,
    saves: (n: number) => `${n} saves`,
    fours: (n: number) => `${n} fours`,
    average: (a: string) => `${a} per match`,
    empty: 'No player stats yet',
    emptyDesc: 'Leaderboards fill in as player stats are entered for each match.',
    emptyBoard: 'Nobody yet',
  },
  bn: {
    title: {
      runs: 'সর্বোচ্চ রান',
      wickets: 'সর্বোচ্চ উইকেট',
      catches: 'সর্বোচ্চ ক্যাচ',
      sixes: 'সর্বোচ্চ ছক্কা',
      goals: 'সর্বোচ্চ গোলদাতা',
      assists: 'সর্বোচ্চ অ্যাসিস্ট',
      cleanSheets: 'ক্লিন শিট',
      cards: 'শৃঙ্খলা (কার্ড)',
      points: 'সর্বোচ্চ পয়েন্ট',
    } as Record<LeaderboardKey, string>,
    unit: {
      runs: 'রান',
      wickets: 'উইকেট',
      catches: 'ক্যাচ',
      sixes: 'ছক্কা',
      goals: 'গোল',
      assists: 'অ্যাসিস্ট',
      cleanSheets: 'ক্লিন শিট',
      cards: '',
      points: 'পয়েন্ট',
    } as Record<LeaderboardKey, string>,
    matches: (n: number) => `${n} ম্যাচ`,
    runsDetail: (balls: number, sr: string, fifties: number, hundreds: number, hs: number) =>
      `${balls} বল · স্ট্রাইক রেট ${sr} · সর্বোচ্চ ${hs}${fifties ? ` · ফিফটি ${fifties}` : ''}${hundreds ? ` · সেঞ্চুরি ${hundreds}` : ''}`,
    wicketsDetail: (overs: string, econ: string, best: string) => `${overs} ওভার · ইকোনমি ${econ} · সেরা ${best}`,
    cards: (y: number, r: number) => `${y} হলুদ · ${r} লাল`,
    withAssists: (n: number) => `${n} অ্যাসিস্ট`,
    withGoals: (n: number) => `${n} গোল`,
    saves: (n: number) => `${n} সেভ`,
    fours: (n: number) => `${n} চার`,
    average: (a: string) => `ম্যাচপ্রতি ${a}`,
    empty: 'এখনো খেলোয়াড়ের পরিসংখ্যান নেই',
    emptyDesc: 'প্রতিটি ম্যাচের পরিসংখ্যান দিলে এখানে লিডারবোর্ড তৈরি হবে।',
    emptyBoard: 'এখনো কেউ নেই',
  },
} satisfies Strings<{
  title: Record<LeaderboardKey, string>
  unit: Record<LeaderboardKey, string>
  matches: (n: number) => string
  runsDetail: (balls: number, sr: string, fifties: number, hundreds: number, hs: number) => string
  wicketsDetail: (overs: string, econ: string, best: string) => string
  cards: (y: number, r: number) => string
  withAssists: (n: number) => string
  withGoals: (n: number) => string
  saves: (n: number) => string
  fours: (n: number) => string
  average: (a: string) => string
  empty: string
  emptyDesc: string
  emptyBoard: string
}>

type T = (typeof STRINGS)['en']

function detailText(key: LeaderboardKey, row: LeaderRow, t: T): string {
  const d = row.detail
  const num = (v: number | null | undefined) => v ?? 0
  const fixed = (v: number | null | undefined, digits: number) => (v === null || v === undefined ? '—' : v.toFixed(digits))
  switch (key) {
    case 'runs':
      return t.runsDetail(num(d.balls), fixed(d.strikeRate, 1), num(d.fifties), num(d.hundreds), num(d.highest))
    case 'wickets':
      return t.wicketsDetail(ballsToOvers(num(d.balls)) || '0', fixed(d.economy, 2), `${num(d.bestWickets)}/${num(d.bestRuns)}`)
    case 'goals':
      return t.withAssists(num(d.assists))
    case 'assists':
      return t.withGoals(num(d.goals))
    case 'cleanSheets':
      return t.saves(num(d.saves))
    case 'cards':
      return t.cards(num(d.yellow), num(d.red))
    case 'sixes':
      return t.fours(num(d.fours))
    case 'points':
      return t.average(fixed(d.average, 1))
    default:
      return ''
  }
}

/** Leaderboard cards (top performers). `limit` rows per board. */
export function Leaderboards({ data, limit = 10, accent }: { data: LeagueData; limit?: number; accent?: string }) {
  const t = useStrings(STRINGS)
  const teams = teamMap(data)
  const boards = data.leaderboards
  if (boards.every((b) => b.rows.length === 0)) {
    return <EmptyState icon={Award} title={t.empty} description={t.emptyDesc} />
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {boards.map((board) => (
        <section key={board.key} className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-label={t.title[board.key]}>
          <h3 className="border-b px-4 py-2.5 font-bold">{t.title[board.key]}</h3>
          {board.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.emptyBoard}</p>
          ) : (
            <ol className="divide-y">
              {board.rows.slice(0, limit).map((row, i) => {
                const team = row.teamId ? teams.get(row.teamId) : undefined
                return (
                  <li key={row.playerId} className="flex items-center gap-3 px-4 py-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black',
                        i === 0 ? 'text-white' : 'bg-muted text-muted-foreground',
                      )}
                      style={i === 0 ? { backgroundColor: accent ?? '#d97706' } : undefined}
                    >
                      {i + 1}
                    </span>
                    <PlayerAvatar name={row.name} photoUrl={row.photoUrl} className="h-8 w-8" fallbackClassName="text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {team ? `${team.name} · ` : ''}
                        {t.matches(row.matches)} · {detailText(board.key, row, t)}
                      </p>
                    </div>
                    {board.key === 'cards' ? null : (
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-black leading-none tabular-nums">{row.value}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">{t.unit[board.key]}</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  )
}
