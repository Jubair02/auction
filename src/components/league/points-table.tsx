'use client'

import { type Strings, useStrings } from '@/lib/i18n'
import type { FormLetter, LeagueData, StandingsTableDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { TeamAvatar } from '@/components/shared/avatars'
import { formatNrr, teamMap, useLeagueLabels } from './labels'

const STRINGS = {
  en: {
    pos: '#',
    team: 'Team',
    p: 'P',
    w: 'W',
    d: 'D',
    t: 'T',
    l: 'L',
    nr: 'NR',
    pts: 'Pts',
    nrr: 'NRR',
    gf: 'GF',
    ga: 'GA',
    gd: 'GD',
    sf: 'For',
    sa: 'Ag.',
    diff: '+/−',
    form: 'Form',
    legend: {
      p: 'Played', w: 'Won', d: 'Drawn', t: 'Tied', l: 'Lost', nr: 'No result', pts: 'Points', nrr: 'Net run rate',
      gf: 'Goals for', ga: 'Goals against', gd: 'Goal difference',
    },
    qualify: (n: number) => `Top ${n} qualify for the knockouts`,
    tiebreakCricket: 'Ranked by points, then wins, net run rate, head-to-head.',
    tiebreakFootball: 'Ranked by points, then goal difference, goals scored, head-to-head.',
    tiebreakOther: 'Ranked by points, then score difference, head-to-head.',
    points: (w: number, d: number, l: number, cricket: boolean) =>
      `Win ${w} · ${cricket ? 'Tie / no result' : 'Draw'} ${d} · Loss ${l}`,
    formLetter: { W: 'W', D: 'D', L: 'L', N: 'NR' } as Record<FormLetter, string>,
    formLabel: { W: 'Won', D: 'Drawn', L: 'Lost', N: 'No result' } as Record<FormLetter, string>,
    qualified: 'Qualified',
  },
  bn: {
    pos: '#',
    team: 'দল',
    p: 'ম্যা',
    w: 'জয়',
    d: 'ড্র',
    t: 'টাই',
    l: 'হার',
    nr: 'ফলহীন',
    pts: 'পয়েন্ট',
    nrr: 'NRR',
    gf: 'গোল',
    ga: 'খেয়েছে',
    gd: 'ব্যবধান',
    sf: 'করেছে',
    sa: 'খেয়েছে',
    diff: '+/−',
    form: 'ফর্ম',
    legend: {
      p: 'ম্যাচ খেলেছে', w: 'জয়', d: 'ড্র', t: 'টাই', l: 'হার', nr: 'ফলাফল নেই', pts: 'পয়েন্ট', nrr: 'নেট রান রেট',
      gf: 'গোল করেছে', ga: 'গোল খেয়েছে', gd: 'গোল ব্যবধান',
    },
    qualify: (n: number) => `সেরা ${n} দল নকআউটে যাবে`,
    tiebreakCricket: 'ক্রম: পয়েন্ট, তারপর জয়, নেট রান রেট, মুখোমুখি লড়াই।',
    tiebreakFootball: 'ক্রম: পয়েন্ট, তারপর গোল ব্যবধান, করা গোল, মুখোমুখি লড়াই।',
    tiebreakOther: 'ক্রম: পয়েন্ট, তারপর স্কোর ব্যবধান, মুখোমুখি লড়াই।',
    points: (w: number, d: number, l: number, cricket: boolean) =>
      `জয় ${w} · ${cricket ? 'টাই / ফলহীন' : 'ড্র'} ${d} · হার ${l}`,
    formLetter: { W: 'জ', D: 'ড্র', L: 'হা', N: 'ফ' } as Record<FormLetter, string>,
    formLabel: { W: 'জয়', D: 'ড্র', L: 'হার', N: 'ফলাফল নেই' } as Record<FormLetter, string>,
    qualified: 'কোয়ালিফাইড',
  },
} satisfies Strings<{
  pos: string
  team: string
  p: string
  w: string
  d: string
  t: string
  l: string
  nr: string
  pts: string
  nrr: string
  gf: string
  ga: string
  gd: string
  sf: string
  sa: string
  diff: string
  form: string
  legend: Record<'p' | 'w' | 'd' | 't' | 'l' | 'nr' | 'pts' | 'nrr' | 'gf' | 'ga' | 'gd', string>
  qualify: (n: number) => string
  tiebreakCricket: string
  tiebreakFootball: string
  tiebreakOther: string
  points: (w: number, d: number, l: number, cricket: boolean) => string
  formLetter: Record<FormLetter, string>
  formLabel: Record<FormLetter, string>
  qualified: string
}>

const FORM_TONE: Record<FormLetter, string> = {
  W: 'bg-emerald-600 text-white',
  D: 'bg-slate-400 text-white',
  L: 'bg-rose-600 text-white',
  N: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
}

/** Every points table of the league, one card per group. */
export function PointsTables({ data, accent }: { data: LeagueData; accent?: string }) {
  const t = useStrings(STRINGS)
  const sport = data.tournament.sport
  const { win, draw, loss } = data.settings.effectivePoints
  return (
    <div className="space-y-6">
      {data.standings.map((table) => (
        <PointsTable key={table.groupName ?? '__league'} data={data} table={table} accent={accent} />
      ))}
      <p className="text-xs text-muted-foreground">
        {t.points(win, draw, loss, sport === 'CRICKET')} ·{' '}
        {sport === 'CRICKET' ? t.tiebreakCricket : sport === 'FOOTBALL' ? t.tiebreakFootball : t.tiebreakOther}
      </p>
    </div>
  )
}

function PointsTable({ data, table, accent }: { data: LeagueData; table: StandingsTableDTO; accent?: string }) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const teams = teamMap(data)
  const sport = data.tournament.sport
  const cricket = sport === 'CRICKET'
  const football = sport === 'FOOTBALL'
  const showNr = cricket || table.rows.some((r) => r.noResult > 0)
  const highlight = accent ?? '#0F766E'
  const th = 'px-2 py-2 text-center font-semibold'
  const td = 'px-2 py-2 text-center tabular-nums'

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="font-bold">{table.groupName === null ? l.leagueTable : l.group(table.groupName)}</h3>
        {table.qualifyCount > 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: highlight }} aria-hidden />
            {t.qualify(table.qualifyCount)}
          </p>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 py-2 pl-3 pr-1 text-left font-semibold" scope="col">{t.pos}</th>
              <th className="px-2 py-2 text-left font-semibold" scope="col">{t.team}</th>
              <th className={th} scope="col"><abbr title={t.legend.p} className="no-underline">{t.p}</abbr></th>
              <th className={th} scope="col"><abbr title={t.legend.w} className="no-underline">{t.w}</abbr></th>
              <th className={th} scope="col"><abbr title={t.legend.l} className="no-underline">{t.l}</abbr></th>
              <th className={th} scope="col">
                <abbr title={cricket ? t.legend.t : t.legend.d} className="no-underline">{cricket ? t.t : t.d}</abbr>
              </th>
              {showNr ? <th className={th} scope="col"><abbr title={t.legend.nr} className="no-underline">{t.nr}</abbr></th> : null}
              {cricket ? <th className={th} scope="col"><abbr title={t.legend.nrr} className="no-underline">{t.nrr}</abbr></th> : null}
              {football ? (
                <>
                  <th className={cn(th, 'hidden sm:table-cell')} scope="col"><abbr title={t.legend.gf} className="no-underline">{t.gf}</abbr></th>
                  <th className={cn(th, 'hidden sm:table-cell')} scope="col"><abbr title={t.legend.ga} className="no-underline">{t.ga}</abbr></th>
                  <th className={th} scope="col"><abbr title={t.legend.gd} className="no-underline">{t.gd}</abbr></th>
                </>
              ) : null}
              {!cricket && !football ? (
                <>
                  <th className={cn(th, 'hidden sm:table-cell')} scope="col">{t.sf}</th>
                  <th className={cn(th, 'hidden sm:table-cell')} scope="col">{t.sa}</th>
                  <th className={th} scope="col">{t.diff}</th>
                </>
              ) : null}
              <th className={cn(th, 'text-foreground')} scope="col"><abbr title={t.legend.pts} className="no-underline">{t.pts}</abbr></th>
              <th className={cn(th, 'hidden md:table-cell')} scope="col">{t.form}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.rows.map((row) => {
              const team = teams.get(row.teamId)
              const qualified = row.position <= table.qualifyCount
              return (
                <tr key={row.teamId} className={cn(qualified && 'bg-muted/40')}>
                  <td
                    className="relative py-2 pl-3 pr-1 font-bold tabular-nums text-muted-foreground"
                    style={qualified ? { boxShadow: `inset 3px 0 0 ${highlight}` } : undefined}
                  >
                    {row.position}
                    {qualified ? <span className="sr-only"> ({t.qualified})</span> : null}
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <TeamAvatar name={team?.name ?? '?'} color={team?.color} logoUrl={team?.logoUrl} className="h-6 w-6 text-[10px]" />
                      <span className="truncate font-semibold">{team?.name ?? '—'}</span>
                    </span>
                  </td>
                  <td className={td}>{row.played}</td>
                  <td className={td}>{row.won}</td>
                  <td className={td}>{row.lost}</td>
                  <td className={td}>{row.drawn}</td>
                  {showNr ? <td className={td}>{row.noResult}</td> : null}
                  {cricket ? (
                    <td className={cn(td, 'font-mono text-xs', (row.nrr ?? 0) < 0 ? 'text-rose-700 dark:text-rose-400' : '')}>{formatNrr(row.nrr)}</td>
                  ) : null}
                  {!cricket ? (
                    <>
                      <td className={cn(td, 'hidden sm:table-cell')}>{row.scoreFor}</td>
                      <td className={cn(td, 'hidden sm:table-cell')}>{row.scoreAgainst}</td>
                      <td className={td}>{row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff < 0 ? `−${Math.abs(row.scoreDiff)}` : '0'}</td>
                    </>
                  ) : null}
                  <td className={cn(td, 'font-black')}>{row.points}</td>
                  <td className={cn(td, 'hidden md:table-cell')}>
                    <span className="flex justify-center gap-0.5">
                      {row.form.map((f, i) => (
                        <span
                          key={i}
                          title={t.formLabel[f]}
                          className={cn('flex h-5 min-w-5 items-center justify-center rounded px-0.5 text-[10px] font-bold', FORM_TONE[f])}
                        >
                          {t.formLetter[f]}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
