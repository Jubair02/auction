'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Flame, Gavel, Percent, Trophy, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { apiGet, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'

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
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<Analytics>(`/api/tournaments/${tournamentId}/analytics`)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : 'Could not load insights'))
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  if (error) return <EmptyState icon={BarChart3} title="Insights unavailable" description={error} />
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
        title="No auction activity yet"
        description="Insights appear here once bidding starts — spending by team, the most contested players and the biggest bargains and splurges."
      />
    )
  }

  const maxBudget = Math.max(...data.teams.map((t) => t.budget), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total spent" value={formatBDT(summary.totalSpend)} icon={Wallet} hint={`${summary.soldCount} players sold`} />
        <StatCard label="Average price" value={formatBDT(summary.avgPrice)} icon={Gavel} />
        <StatCard
          label="Sell-through"
          value={summary.sellThrough == null ? '—' : `${Math.round(summary.sellThrough * 100)}%`}
          icon={Percent}
          hint="Sold, of players put up"
        />
        <StatCard
          label="Top sale"
          value={summary.topSale ? formatBDT(summary.topSale.price) : '—'}
          icon={Trophy}
          tone="primary"
          hint={summary.topSale ? `${summary.topSale.name}${summary.topSale.teamName ? ` → ${summary.topSale.teamName}` : ''}` : undefined}
        />
      </div>

      <ChartCard title="Spending by team" note="Filled bar = spent; the full track is the team's budget.">
        <BarList
          rows={data.teams.map((t) => ({
            key: t.id,
            label: t.name,
            sub: `${t.squadCount}/${t.maxSquad} players${t.squadCount < t.minSquad ? ` · ${t.minSquad - t.squadCount} short of minimum` : ''}`,
            value: t.spent,
            track: t.budget / maxBudget,
            fill: t.spent / maxBudget,
            display: `${formatBDT(t.spent)} of ${formatBDT(t.budget)}`,
          }))}
        />
      </ChartCard>

      {data.categories.length > 0 ? (
        <ChartCard title="Average sale price by category">
          <BarList
            rows={(() => {
              const max = Math.max(...data.categories.map((c) => c.avgPrice), 1)
              return data.categories.map((c) => ({
                key: c.code,
                label: `Category ${c.code}`,
                sub: `${c.sold} of ${c.players} sold · ${formatBDT(c.spend)} total`,
                value: c.avgPrice,
                track: 1,
                fill: c.avgPrice / max,
                display: c.sold ? formatBDT(c.avgPrice) : 'none sold',
              }))
            })()}
          />
        </ChartCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Most contested players" icon={Flame} note={`${summary.totalBids} bids in total.`}>
          {data.mostContested.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bids yet.</p>
          ) : (
            <BarList
              rows={(() => {
                const max = Math.max(...data.mostContested.map((p) => p.bids), 1)
                return data.mostContested.map((p) => ({
                  key: p.id,
                  label: `#${p.playerNumber} ${p.name}`,
                  sub: p.soldPrice != null ? `${formatBDT(p.soldPrice)} → ${p.teamName ?? '—'}` : 'Not sold',
                  value: p.bids,
                  track: 1,
                  fill: p.bids / max,
                  display: `${p.bids} bids`,
                }))
              })()}
            />
          )}
        </ChartCard>

        <ChartCard title="Biggest premiums over base price" icon={Trophy}>
          {data.biggestPremiums.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <BarList
              rows={(() => {
                const ratio = (p: PlayerStat) => (p.soldPrice ?? 0) / p.basePrice
                const max = Math.max(...data.biggestPremiums.map(ratio), 1)
                return data.biggestPremiums.map((p) => ({
                  key: p.id,
                  label: `#${p.playerNumber} ${p.name}`,
                  sub: `${formatBDT(p.basePrice)} base → ${formatBDT(p.soldPrice)} · ${p.teamName ?? '—'}`,
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
