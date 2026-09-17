'use client'

import { useEffect, useState } from 'react'
import { Download, Gavel, Loader2, Printer, ShieldAlert, Trophy } from 'lucide-react'
import { apiDownload, apiGet, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate, formatTime } from '@/lib/format'
import type { ResultsData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { TeamAvatar } from '@/components/shared/avatars'
import { TournamentStatusBadge } from '@/components/shared/status-badges'

const EXPORT_TYPES: { type: string; label: string }[] = [
  { type: 'players', label: 'All players (CSV)' },
  { type: 'sold', label: 'Sold players (CSV)' },
  { type: 'unsold', label: 'Unsold players (CSV)' },
  { type: 'squads', label: 'Final squads (CSV)' },
  { type: 'bids', label: 'Bid log (CSV)' },
  { type: 'spending', label: 'Team spending (CSV)' },
]

export default function ResultsView({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<ResultsData>(`/api/tournaments/${tournamentId}/results`)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load results')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  async function exportCsv(type: string) {
    if (!data) return
    setExporting(type)
    try {
      const slug = data.tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      await apiDownload(`/api/tournaments/${tournamentId}/export?type=${type}`, `neelamghor-${type}-${slug || 'tournament'}.csv`)
    } catch {
      // download errors are non-fatal for the view
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={ShieldAlert}
          title="Results unavailable"
          description={error ?? 'This tournament has no results yet.'}
          action={
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          }
        />
      </div>
    )
  }

  const { tournament, summary, teams, recentBids } = data
  const allTeamsFilled = teams.length > 0 && teams.every((t) => t.players.length >= t.minSquad)

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8 print:max-w-none print:px-0">
      {/* print-only report header */}
      <div className="mb-4 hidden text-center print:block">
        <p className="text-lg font-black">NeelamGhor — Auction Report</p>
        <p className="text-sm">
          {tournament.name} · {tournament.sport === 'CRICKET' ? 'Cricket' : 'Football'}
          {tournament.roomCode ? ` · Room ${tournament.roomCode}` : ''} · {formatDate(tournament.startDate)}
        </p>
      </div>

      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tournament.name}</h1>
            <TournamentStatusBadge status={tournament.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              {tournament.sport === 'CRICKET' ? 'Cricket' : 'Football'}
            </span>
            {tournament.roomCode ? (
              <Badge variant="outline" className="font-mono text-xs tracking-[0.18em]">{tournament.roomCode}</Badge>
            ) : null}
            <span>{formatDate(tournament.startDate)}</span>
            {tournament.location ? <span>{tournament.location}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print report
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Download data</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {EXPORT_TYPES.map((e) => (
                <DropdownMenuItem key={e.type} onClick={() => void exportCsv(e.type)}>
                  {e.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total players" value={summary.totalPlayers} />
        <StatCard label="Sold" value={summary.sold} tone="success" />
        <StatCard label="Unsold" value={summary.unsold} tone="danger" />
        <StatCard label="Teams" value={summary.teams} />
        <StatCard label="Total bids" value={summary.totalBids} tone="primary" />
        <StatCard label="Auction value" value={formatBDT(summary.totalValue)} tone="warning" />
      </div>

      {allTeamsFilled ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-center print:break-inside-avoid">
          <Trophy className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />
          <p className="text-sm font-bold text-teal-900">
            Auction complete — every team has met its minimum squad. Congratulations to all the gavel winners.
          </p>
        </div>
      ) : null}

      {/* final squads */}
      <section className="mt-8" aria-label="Final squads">
        <h2 className="mb-3 text-lg font-black tracking-tight print:text-base">Final squads</h2>
        {teams.length === 0 ? (
          <EmptyState icon={Gavel} title="No teams" description="This tournament has no teams registered." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid print:grid-cols-3 print:gap-2">
            {teams.map((t) => {
              const spendPct = t.budget > 0 ? Math.min(100, (t.spent / t.budget) * 100) : 0
              const players = [...t.players].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
              return (
                <Card key={t.id} className="break-inside-avoid print:break-inside-avoid">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2.5 text-base">
                      <TeamAvatar name={t.name} color={t.color} logoUrl={t.logoUrl} className="h-9 w-9" />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <Badge variant="secondary" className="tabular-nums">{t.players.length}/{t.maxSquad}</Badge>
                    </CardTitle>
                    <div className="mt-1 space-y-1">
                      <Progress value={spendPct} className="h-1.5" aria-label={`${t.name} budget used`} />
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        Spent <span className="font-bold text-foreground">{formatBDT(t.spent)}</span> of {formatBDT(t.budget)} · left{' '}
                        <span className="font-bold text-emerald-700">{formatBDT(t.remaining)}</span>
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="max-h-96 divide-y overflow-y-auto print:max-h-none print:overflow-visible" aria-label={`${t.name} squad`}>
                      {players.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-muted-foreground">No players bought</li>
                      ) : null}
                      {players.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 px-4 py-2">
                          <span className="w-8 shrink-0 font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
                            #{String(p.playerNumber).padStart(3, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.role}
                              {p.category ? ` · Cat ${p.category}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">
                            {formatBDT(p.soldPrice ?? p.basePrice)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className={cn('border-t px-4 py-2 text-xs text-muted-foreground tabular-nums print:border-t')}>
                      {t.players.length} player{t.players.length === 1 ? '' : 's'} · min {t.minSquad} · avg{' '}
                      {t.players.length > 0 ? formatBDT(t.spent / t.players.length) : '—'}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* recent bids */}
      <section className="mt-8 print:break-inside-avoid" aria-label="Recent bids">
        <h2 className="mb-3 text-lg font-black tracking-tight print:text-base">Recent bids</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Time</th>
                    <th className="px-4 py-2.5 font-semibold">Player</th>
                    <th className="px-4 py-2.5 font-semibold">Team</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentBids.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No bids recorded
                      </td>
                    </tr>
                  ) : null}
                  {recentBids.map((b, i) => (
                    <tr key={`${b.createdAt}-${i}`} className="hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">{formatTime(b.createdAt)}</td>
                      <td className="px-4 py-2 font-semibold">{b.playerName}</td>
                      <td className="px-4 py-2">{b.teamName}</td>
                      <td className="px-4 py-2 text-right font-bold tabular-nums text-teal-700">{formatBDT(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* print footer */}
      <p className="mt-6 hidden text-center text-xs text-muted-foreground print:block">
        Generated by NeelamGhor · {formatDate(new Date(), true)}
      </p>

      {/* print tuning — report-only chrome, white background, avoid card page breaks */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
            html, body { background: #fff !important; }
            body { font-size: 12.5px; }
            .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
            .print-grid-3 { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
          }`,
        }}
      />
    </div>
  )
}
