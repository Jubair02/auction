'use client'

import { BarChart3, Flame, Gavel, Percent, Trophy, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { formatBDT } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    unavailable: 'Insights unavailable',
    loadFailed: 'Could not load insights',
    noActivity: 'No auction activity yet',
    noActivityDesc:
      'Insights appear here once bidding starts — spending by team, the most contested players and the biggest bargains and splurges.',
    totalSpent: 'Total spent',
    playersSold: (n: number) => `${n} players sold`,
    avgPrice: 'Average price',
    sellThrough: 'Sell-through',
    sellThroughHint: 'Sold, of players put up',
    topSale: 'Top sale',
    spendingByTeam: 'Spending by team',
    spendingNote: 'Filled bar = spent; the full track is the team’s budget.',
    squadLine: (count: number, max: number) => `${count}/${max} players`,
    shortOfMin: (n: number) => ` · ${n} short of minimum`,
    spentOf: (spent: string, budget: string) => `${spent} of ${budget}`,
    avgByCategory: 'Average sale price by category',
    categoryLabel: (code: string) => `Category ${code}`,
    categorySub: (sold: number, players: number, total: string) => `${sold} of ${players} sold · ${total} total`,
    noneSold: 'none sold',
    mostContested: 'Most contested players',
    totalBids: (n: number) => `${n} bids in total.`,
    noBids: 'No bids yet.',
    notSold: 'Not sold',
    bidsCount: (n: number) => `${n} bids`,
    biggestPremiums: 'Biggest premiums over base price',
    noSales: 'No sales yet.',
    premiumSub: (base: string, sold: string, team: string) => `${base} base → ${sold} · ${team}`,
  },
  bn: {
    unavailable: 'বিশ্লেষণ পাওয়া যাচ্ছে না',
    loadFailed: 'বিশ্লেষণ লোড করা যায়নি',
    noActivity: 'এখনো নিলামের কোনো কার্যক্রম নেই',
    noActivityDesc:
      'বিড শুরু হলেই এখানে বিশ্লেষণ দেখা যাবে — দল অনুযায়ী খরচ, সবচেয়ে বেশি লড়াই হওয়া খেলোয়াড়, আর সবচেয়ে সস্তা ও সবচেয়ে দামি কেনা।',
    totalSpent: 'মোট খরচ',
    playersSold: (n: number) => `${n} জন খেলোয়াড় বিক্রি`,
    avgPrice: 'গড় দাম',
    sellThrough: 'বিক্রির হার',
    sellThroughHint: 'নিলামে ওঠা খেলোয়াড়দের মধ্যে বিক্রি',
    topSale: 'সর্বোচ্চ বিক্রি',
    spendingByTeam: 'দল অনুযায়ী খরচ',
    spendingNote: 'ভরা অংশ = খরচ; পুরো দাগটা দলের বাজেট।',
    squadLine: (count: number, max: number) => `${count}/${max} জন খেলোয়াড়`,
    shortOfMin: (n: number) => ` · সর্বনিম্ন থেকে ${n} জন কম`,
    spentOf: (spent: string, budget: string) => `${budget}-এর মধ্যে ${spent}`,
    avgByCategory: 'ক্যাটাগরি অনুযায়ী গড় বিক্রয়মূল্য',
    categoryLabel: (code: string) => `ক্যাটাগরি ${code}`,
    categorySub: (sold: number, players: number, total: string) => `${players} জনের ${sold} জন বিক্রি · মোট ${total}`,
    noneSold: 'কেউ বিক্রি হয়নি',
    mostContested: 'সবচেয়ে বেশি বিড পাওয়া খেলোয়াড়',
    totalBids: (n: number) => `মোট ${n}টি বিড।`,
    noBids: 'এখনো কোনো বিড নেই।',
    notSold: 'বিক্রি হয়নি',
    bidsCount: (n: number) => `${n}টি বিড`,
    biggestPremiums: 'বেস প্রাইসের চেয়ে সবচেয়ে বেশি দামে বিক্রি',
    noSales: 'এখনো কোনো বিক্রি নেই।',
    premiumSub: (base: string, sold: string, team: string) => `বেস ${base} → ${sold} · ${team}`,
  },
} satisfies Strings<{
  unavailable: string
  loadFailed: string
  noActivity: string
  noActivityDesc: string
  totalSpent: string
  playersSold: (n: number) => string
  avgPrice: string
  sellThrough: string
  sellThroughHint: string
  topSale: string
  spendingByTeam: string
  spendingNote: string
  squadLine: (count: number, max: number) => string
  shortOfMin: (n: number) => string
  spentOf: (spent: string, budget: string) => string
  avgByCategory: string
  categoryLabel: (code: string) => string
  categorySub: (sold: number, players: number, total: string) => string
  noneSold: string
  mostContested: string
  totalBids: (n: number) => string
  noBids: string
  notSold: string
  bidsCount: (n: number) => string
  biggestPremiums: string
  noSales: string
  premiumSub: (base: string, sold: string, team: string) => string
}>

interface PlayerStat {
  id: string
  name: string
  playerNumber: number
  basePrice: number
  soldPrice: number | null
  teamName: string | null
  bids: number
}

interface Analytics {
  summary: {
    totalSpend: number
    soldCount: number
    avgPrice: number
    sellThrough: number | null
    totalBids: number
    topSale: { name: string; price: number; teamName: string | null } | null
  }
  teams: { id: string; name: string; budget: number; spent: number; squadCount: number; maxSquad: number; minSquad: number }[]
  categories: { code: string; players: number; sold: number; spend: number; avgPrice: number }[]
  mostContested: PlayerStat[]
  biggestPremiums: PlayerStat[]
}

/** Post-auction insights for the organizer (complete bid history, computed server-side). */
export function InsightsTab({ tournamentId }: { tournamentId: string }) {
  const s = useStrings(STRINGS)
  // Reopening the tab shows the last insights at once while fresh ones load.
  const { data, error } = useCachedGet<Analytics>(`/api/tournaments/${tournamentId}/analytics`)

  if (error && !data) {
    return (
      <EmptyState
        icon={BarChart3}
        title={s.unavailable}
        description={error instanceof ApiError ? error.message : s.loadFailed}
      />
    )
  }
  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  const { summary } = data
  if (summary.soldCount === 0 && summary.totalBids === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={s.noActivity}
        description={s.noActivityDesc}
      />
    )
  }

  const maxBudget = Math.max(...data.teams.map((t) => t.budget), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={s.totalSpent} value={formatBDT(summary.totalSpend)} icon={Wallet} hint={s.playersSold(summary.soldCount)} />
        <StatCard label={s.avgPrice} value={formatBDT(summary.avgPrice)} icon={Gavel} />
        <StatCard
          label={s.sellThrough}
          value={summary.sellThrough == null ? '—' : `${Math.round(summary.sellThrough * 100)}%`}
          icon={Percent}
          hint={s.sellThroughHint}
        />
        <StatCard
          label={s.topSale}
          value={summary.topSale ? formatBDT(summary.topSale.price) : '—'}
          icon={Trophy}
          tone="primary"
          hint={summary.topSale ? `${summary.topSale.name}${summary.topSale.teamName ? ` → ${summary.topSale.teamName}` : ''}` : undefined}
        />
      </div>

      <ChartCard title={s.spendingByTeam} note={s.spendingNote}>
        <BarList
          rows={data.teams.map((t) => ({
            key: t.id,
            label: t.name,
            sub: `${s.squadLine(t.squadCount, t.maxSquad)}${t.squadCount < t.minSquad ? s.shortOfMin(t.minSquad - t.squadCount) : ''}`,
            value: t.spent,
            track: t.budget / maxBudget,
            fill: t.spent / maxBudget,
            display: s.spentOf(formatBDT(t.spent), formatBDT(t.budget)),
          }))}
        />
      </ChartCard>

      {data.categories.length > 0 ? (
        <ChartCard title={s.avgByCategory}>
          <BarList
            rows={(() => {
              const max = Math.max(...data.categories.map((c) => c.avgPrice), 1)
              return data.categories.map((c) => ({
                key: c.code,
                label: s.categoryLabel(c.code),
                sub: s.categorySub(c.sold, c.players, formatBDT(c.spend)),
                value: c.avgPrice,
                track: 1,
                fill: c.avgPrice / max,
                display: c.sold ? formatBDT(c.avgPrice) : s.noneSold,
              }))
            })()}
          />
        </ChartCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={s.mostContested} icon={Flame} note={s.totalBids(summary.totalBids)}>
          {data.mostContested.length === 0 ? (
            <p className="text-sm text-muted-foreground">{s.noBids}</p>
          ) : (
            <BarList
              rows={(() => {
                const max = Math.max(...data.mostContested.map((p) => p.bids), 1)
                return data.mostContested.map((p) => ({
                  key: p.id,
                  label: `#${p.playerNumber} ${p.name}`,
                  sub: p.soldPrice != null ? `${formatBDT(p.soldPrice)} → ${p.teamName ?? '—'}` : s.notSold,
                  value: p.bids,
                  track: 1,
                  fill: p.bids / max,
                  display: s.bidsCount(p.bids),
                }))
              })()}
            />
          )}
        </ChartCard>

        <ChartCard title={s.biggestPremiums} icon={Trophy}>
          {data.biggestPremiums.length === 0 ? (
            <p className="text-sm text-muted-foreground">{s.noSales}</p>
          ) : (
            <BarList
              rows={(() => {
                const ratio = (p: PlayerStat) => (p.soldPrice ?? 0) / p.basePrice
                const max = Math.max(...data.biggestPremiums.map(ratio), 1)
                return data.biggestPremiums.map((p) => ({
                  key: p.id,
                  label: `#${p.playerNumber} ${p.name}`,
                  sub: s.premiumSub(formatBDT(p.basePrice), formatBDT(p.soldPrice), p.teamName ?? '—'),
                  value: ratio(p),
                  track: 1,
                  fill: ratio(p) / max,
                  display: `${ratio(p).toFixed(1)}×`,
                }))
              })()}
            />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  note,
  icon: Icon = BarChart3,
  children,
}: {
  title: string
  note?: string
  icon?: typeof BarChart3
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
        </CardTitle>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

interface BarRow {
  key: string
  label: string
  sub?: string
  value: number
  /** Track length as a fraction of the row (e.g. this team's budget vs the largest budget). */
  track: number
  /** Filled length as a fraction of the row. */
  fill: number
  display: string
}

/**
 * Ranked horizontal bars: one series, one hue (the primary token), label and
 * value in text colours. Every row carries its value as text, so the chart
 * also reads as a table for screen readers and in print.
 */
function BarList({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.label}: ${r.display}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{r.display}</span>
          </div>
          <div
            className="h-2.5 rounded-[4px] bg-muted"
            style={{ width: `${Math.max(2, Math.min(100, r.track * 100))}%` }}
            aria-hidden
          >
            <div
              className="h-full rounded-[4px] bg-primary transition-opacity group-hover:opacity-80"
              style={{ width: `${r.track > 0 ? Math.min(100, (r.fill / r.track) * 100) : 0}%` }}
            />
          </div>
          {r.sub ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.sub}</p> : null}
        </li>
      ))}
    </ul>
  )
}
