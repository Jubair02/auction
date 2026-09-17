'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Gavel,
  Loader2,
  Printer,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { apiDownload, apiGet, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate, formatTime } from '@/lib/format'
import type { ResultsData } from '@/lib/types'

interface BidEntry {
  playerName: string
  teamName: string
  amount: number
  createdAt: string
}

export default function AuctionHistory({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [openPlayers, setOpenPlayers] = useState<Record<string, boolean>>({})
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<ResultsData>(`/api/tournaments/${tournamentId}/results`)
      setData(res)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load auction history')
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  useEffect(() => {
    void load()
  }, [load])

  // Sold lookup: player name → winner info (from teams' sold players)
  const soldByPlayer = useMemo(() => {
    const map = new Map<string, { teamName: string; price: number }>()
    for (const team of data?.teams ?? []) {
      for (const p of team.players) {
        if (p.status === 'SOLD') {
          map.set(p.name, { teamName: team.name, price: p.soldPrice ?? p.basePrice })
        }
      }
    }
    return map
  }, [data])

  // Group bids by player, keep ladder chronological (API returns latest-first)
  const grouped = useMemo(() => {
    const map = new Map<string, BidEntry[]>()
    for (const bid of data?.recentBids ?? []) {
      const list = map.get(bid.playerName) ?? []
      list.push(bid)
      map.set(bid.playerName, list)
    }
    return Array.from(map.entries()).map(([playerName, bids]) => ({
      playerName,
      ladder: [...bids].reverse(),
      topBid: Math.max(...bids.map((b) => b.amount)),
      lastAt: bids[0]?.createdAt ?? '',
    }))
  }, [data])

  const downloadCsv = async () => {
    setDownloading(true)
    try {
      await apiDownload(
        `/api/tournaments/${tournamentId}/export?type=bids`,
        `neelamghor-bids-${tournamentId.slice(0, 8)}.csv`,
      )
      toast.success('Full bid history exported')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Export failed')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-2/3 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold">History unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">The auction history could not be loaded.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tournaments')}>
          Back to tournaments
        </Button>
      </div>
    )
  }

  const { summary, tournament } = data

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 print:py-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 text-muted-foreground print:hidden"
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Back to tournament
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Gavel className="h-6 w-6 text-primary" aria-hidden /> Auction history
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{tournament.name}</span>
            <TournamentStatusBadge status={tournament.status} />
            {tournament.roomCode ? <span className="font-mono">{tournament.roomCode}</span> : null}
            {tournament.startDate ? <span>{formatDate(tournament.startDate)}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <Button variant="outline" className="min-h-10" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print
          </Button>
          <Button className="min-h-10" onClick={() => void downloadCsv()} disabled={downloading}>
            {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
            Download full CSV
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total bids" value={summary.totalBids} icon={Gavel} />
        <StatCard label="Sold players" value={summary.sold} icon={Trophy} tone="success" />
        <StatCard label="Unsold" value={summary.unsold} icon={Gavel} tone="danger" />
        <StatCard label="Total value" value={formatBDT(summary.totalValue)} icon={Trophy} tone="primary" />
      </div>

      {/* Bid ladder per player */}
      <section className="mt-8" aria-label="Bid ladder by player">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Bids by player</h2>
          <p className="text-xs text-muted-foreground">Most recent {data.recentBids.length} bids shown</p>
        </div>

        {grouped.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Gavel}
            title="No bids recorded yet"
            description="Once your auction goes live and managers start bidding, the full bid ladder appears here."
            action={
              tournament.roomCode ? (
                <Button onClick={() => navigate(`/room/${tournament.roomCode}`)}>Open auction room</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-0.5">
            {grouped.map((g) => {
              const winner = soldByPlayer.get(g.playerName)
              const open = !!openPlayers[g.playerName]
              return (
                <Collapsible
                  key={g.playerName}
                  open={open}
                  onOpenChange={(o) => setOpenPlayers((prev) => ({ ...prev, [g.playerName]: o }))}
                >
                  <Card className="py-0">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        aria-expanded={open}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{g.playerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.ladder.length} bid{g.ladder.length === 1 ? '' : 's'} · top bid{' '}
                            <span className="font-semibold tabular-nums">{formatBDT(g.topBid)}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {winner ? (
                            <Badge className="bg-teal-100 text-teal-900 hover:bg-teal-100">
                              <Trophy className="mr-1 h-3 w-3" aria-hidden /> {winner.teamName} · {formatBDT(winner.price)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              No sale in view
                            </Badge>
                          )}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="border-t pt-3">
                        <ol className="space-y-2">
                          {g.ladder.map((b, i) => {
                            const isFinal = !!winner && b.teamName === winner.teamName && b.amount === winner.price && i === g.ladder.length - 1
                            return (
                              <li
                                key={`${b.createdAt}-${b.amount}-${i}`}
                                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                                  isFinal ? 'bg-teal-50 font-semibold text-teal-900' : 'bg-muted/40'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-muted-foreground">
                                    {i + 1}
                                  </span>
                                  {b.teamName}
                                  {isFinal ? (
                                    <Badge className="bg-teal-600 text-white hover:bg-teal-600">Won</Badge>
                                  ) : null}
                                </span>
                                <span className="flex items-center gap-3 whitespace-nowrap">
                                  <span className="font-semibold tabular-nums">{formatBDT(b.amount)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(b.createdAt)}
                                  </span>
                                </span>
                              </li>
                            )
                          })}
                        </ol>
                        {winner ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Final: sold to <span className="font-semibold">{winner.teamName}</span> for{' '}
                            <span className="font-semibold">{formatBDT(winner.price)}</span>
                          </p>
                        ) : null}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          The results feed keeps the latest 50 bids. For the complete audit trail, download the full CSV.
        </p>
      </section>
    </div>
  )
}
