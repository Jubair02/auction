'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Gavel,
  Loader2,
  Printer,
  RotateCcw,
  Trophy,
  Undo2,
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
import { AppLink } from '@/components/shared/app-link'
import { formatBDT, formatDate, formatTime } from '@/lib/format'
import type { AuctionEventDTO, PlayerSaleChain, ResultsData } from '@/lib/types'
import { type Strings, useLangStore, useStrings, useLang } from '@/lib/i18n'

const BN_PLAYER_STATUS: Record<string, string> = {
  AVAILABLE: 'নিলাম বাকি',
  LIVE: 'লাইভ',
  SOLD: 'বিক্রি',
  UNSOLD: 'অবিক্রিত',
  SKIPPED: 'বাদ',
}

const STRINGS = {
  en: {
    loadFailed: 'Could not load auction history',
    exportedFull: 'Full bid history exported',
    exportFailed: 'Export failed',
    unavailable: 'History unavailable',
    unavailableDesc: 'The auction history could not be loaded.',
    backToTournaments: 'Back to tournaments',
    backToTournament: 'Back to tournament',
    title: 'Auction history',
    print: 'Print',
    downloadCsv: 'Download full CSV',
    totalBids: 'Total bids',
    soldPlayers: 'Sold players',
    unsold: 'Unsold',
    totalValue: 'Total value',
    bidLadderAria: 'Bid ladder by player',
    bidsByPlayer: 'Bids by player',
    recentShown: (n: number) => `Most recent ${n} bids shown`,
    noBids: 'No bids recorded yet',
    noBidsDesc: 'Once your auction goes live and managers start bidding, the full bid ladder appears here.',
    openAuctionRoom: 'Open auction room',
    bidsTopBid: (n: number) => `${n} bid${n === 1 ? '' : 's'} · top bid`,
    noSaleInView: 'No sale in view',
    won: 'Won',
    finalSold: (team: React.ReactNode, price: React.ReactNode) => (
      <>
        Final: sold to {team} for {price}
      </>
    ),
    latestNote: 'The results feed keeps the latest 50 bids. For the complete audit trail, download the full CSV.',
    eventLabels: { SALE: 'Sale', RE_AUCTION: 'Re-auction', REFUND: 'Refund', UNSOLD: 'Unsold', SKIPPED: 'Skipped' },
    saleHistoryAria: 'Sale history by player',
    saleHistory: 'Sale history',
    withRecord: (n: number) => `${n} player${n === 1 ? '' : 's'} with a record`,
    reauctioned: (n: number) => ` · ${n} re-auctioned`,
    salesCount: (n: number) => `${n} sale${n === 1 ? '' : 's'}`,
    reauctionCount: (n: number) => ` · ${n} re-auction${n === 1 ? '' : 's'}`,
    playerStatus: (status: string) => status.toLowerCase(),
    saleNo: (n: number | null) => `Sale #${n}`,
    returned: (amount: string) => `${amount} returned`,
    roundOpened: (round: number, actor: string | null) => `Round ${round} opened${actor ? ` by ${actor}` : ''}`,
    noBidsBy: (actor: string | null) => `No bids${actor ? ` · ${actor}` : ''}`,
    currentOwner: 'Current owner:',
    noOwner: (status: string) => `none — ${status}`,
    chainsNote:
      'Sales are never deleted. A re-auction refunds the previous team and opens a new round — only the latest sale counts towards squads and purses.',
  },
  bn: {
    loadFailed: 'নিলামের ইতিহাস লোড করা যায়নি',
    exportedFull: 'পুরো বিডের ইতিহাস এক্সপোর্ট হয়েছে',
    exportFailed: 'এক্সপোর্ট করা যায়নি',
    unavailable: 'ইতিহাস পাওয়া যাচ্ছে না',
    unavailableDesc: 'নিলামের ইতিহাস লোড করা যায়নি।',
    backToTournaments: 'টুর্নামেন্টে ফিরে যান',
    backToTournament: 'টুর্নামেন্টে ফিরে যান',
    title: 'নিলামের ইতিহাস',
    print: 'প্রিন্ট',
    downloadCsv: 'পুরো CSV ডাউনলোড করুন',
    totalBids: 'মোট বিড',
    soldPlayers: 'বিক্রি হওয়া খেলোয়াড়',
    unsold: 'অবিক্রিত',
    totalValue: 'মোট মূল্য',
    bidLadderAria: 'খেলোয়াড় অনুযায়ী বিডের ধাপ',
    bidsByPlayer: 'খেলোয়াড় অনুযায়ী বিড',
    recentShown: (n: number) => `সাম্প্রতিক ${n}টি বিড দেখানো হচ্ছে`,
    noBids: 'এখনো কোনো বিড হয়নি',
    noBidsDesc: 'নিলাম লাইভ হলে আর ম্যানেজাররা বিড শুরু করলে পুরো বিডের ধাপ এখানে দেখা যাবে।',
    openAuctionRoom: 'নিলাম রুম খুলুন',
    bidsTopBid: (n: number) => `${n}টি বিড · সর্বোচ্চ বিড`,
    noSaleInView: 'এখানে কোনো বিক্রি নেই',
    won: 'জিতেছে',
    finalSold: (team: React.ReactNode, price: React.ReactNode) => (
      <>
        চূড়ান্ত: {team}-এর কাছে {price}-এ বিক্রি
      </>
    ),
    latestNote: 'ফলাফলে শুধু সর্বশেষ 50টি বিড থাকে। পুরো অডিট ট্রেইলের জন্য পুরো CSV ডাউনলোড করুন।',
    eventLabels: { SALE: 'বিক্রি', RE_AUCTION: 'রি-অকশন', REFUND: 'রিফান্ড', UNSOLD: 'অবিক্রিত', SKIPPED: 'বাদ' },
    saleHistoryAria: 'খেলোয়াড় অনুযায়ী বিক্রির ইতিহাস',
    saleHistory: 'বিক্রির ইতিহাস',
    withRecord: (n: number) => `${n} জন খেলোয়াড়ের রেকর্ড আছে`,
    reauctioned: (n: number) => ` · ${n} জন রি-অকশনে`,
    salesCount: (n: number) => `${n} বার বিক্রি`,
    reauctionCount: (n: number) => ` · ${n} বার রি-অকশন`,
    playerStatus: (status: string) => BN_PLAYER_STATUS[status] ?? status.toLowerCase(),
    saleNo: (n: number | null) => `বিক্রি #${n}`,
    returned: (amount: string) => `${amount} ফেরত দেওয়া হয়েছে`,
    roundOpened: (round: number, actor: string | null) => `রাউন্ড ${round} শুরু হয়েছে${actor ? ` · ${actor}` : ''}`,
    noBidsBy: (actor: string | null) => `কোনো বিড নেই${actor ? ` · ${actor}` : ''}`,
    currentOwner: 'বর্তমান মালিক:',
    noOwner: (status: string) => `কেউ নেই — ${status}`,
    chainsNote:
      'বিক্রির রেকর্ড কখনো মোছা হয় না। রি-অকশনে আগের দলকে টাকা ফেরত দিয়ে নতুন রাউন্ড শুরু হয় — স্কোয়াড আর বাজেটে শুধু সর্বশেষ বিক্রিই গোনা হয়।',
  },
} satisfies Strings<{
  loadFailed: string
  exportedFull: string
  exportFailed: string
  unavailable: string
  unavailableDesc: string
  backToTournaments: string
  backToTournament: string
  title: string
  print: string
  downloadCsv: string
  totalBids: string
  soldPlayers: string
  unsold: string
  totalValue: string
  bidLadderAria: string
  bidsByPlayer: string
  recentShown: (n: number) => string
  noBids: string
  noBidsDesc: string
  openAuctionRoom: string
  bidsTopBid: (n: number) => string
  noSaleInView: string
  won: string
  finalSold: (team: React.ReactNode, price: React.ReactNode) => React.ReactNode
  latestNote: string
  eventLabels: Record<AuctionEventDTO['type'], string>
  saleHistoryAria: string
  saleHistory: string
  withRecord: (n: number) => string
  reauctioned: (n: number) => string
  salesCount: (n: number) => string
  reauctionCount: (n: number) => string
  playerStatus: (status: string) => string
  saleNo: (n: number | null) => string
  returned: (amount: string) => string
  roundOpened: (round: number, actor: string | null) => string
  noBidsBy: (actor: string | null) => string
  currentOwner: string
  noOwner: (status: string) => string
  chainsNote: string
}>

interface BidEntry {
  playerName: string
  teamName: string
  amount: number
  createdAt: string
}

export default function AuctionHistory({ tournamentId }: { tournamentId: string }) {
  const s = useStrings(STRINGS)
  const lang = useLang()
  const [data, setData] = useState<ResultsData | null>(null)
  const [chains, setChains] = useState<PlayerSaleChain[]>([])
  const [loading, setLoading] = useState(true)
  const [openPlayers, setOpenPlayers] = useState<Record<string, boolean>>({})
  const [openChains, setOpenChains] = useState<Record<string, boolean>>({})
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    try {
      const [res, audit] = await Promise.all([
        apiGet<ResultsData>(`/api/tournaments/${tournamentId}/results`),
        apiGet<{ chains: PlayerSaleChain[] }>(`/api/tournaments/${tournamentId}/events`).catch(() => ({
          chains: [] as PlayerSaleChain[],
        })),
      ])
      setData(res)
      setChains(audit.chains)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : STRINGS[useLangStore.getState().lang].loadFailed)
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
      toast.success(s.exportedFull)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.exportFailed)
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
        <p className="text-lg font-bold">{s.unavailable}</p>
        <p className="mt-1 text-sm text-muted-foreground">{s.unavailableDesc}</p>
        <Button variant="outline" className="mt-4" asChild>
          <AppLink href="/tournaments">{s.backToTournaments}</AppLink>
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
            asChild
          >
            <AppLink href={`/tournaments/${tournamentId}`}>
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> {s.backToTournament}
            </AppLink>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Gavel className="h-6 w-6 text-primary" aria-hidden /> {s.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{tournament.name}</span>
            <TournamentStatusBadge status={tournament.status} />
            {tournament.roomCode ? <span className="font-mono">{tournament.roomCode}</span> : null}
            {tournament.startDate ? <span>{formatDate(tournament.startDate, false, lang)}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <Button variant="outline" className="min-h-10" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden /> {s.print}
          </Button>
          <Button className="min-h-10" onClick={() => void downloadCsv()} disabled={downloading}>
            {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
            {s.downloadCsv}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={s.totalBids} value={summary.totalBids} icon={Gavel} />
        <StatCard label={s.soldPlayers} value={summary.sold} icon={Trophy} tone="success" />
        <StatCard label={s.unsold} value={summary.unsold} icon={Gavel} tone="danger" />
        <StatCard label={s.totalValue} value={formatBDT(summary.totalValue)} icon={Trophy} tone="primary" />
      </div>

      {/* Sale chain per player — the permanent ownership record */}
      <SaleChains chains={chains} openChains={openChains} setOpenChains={setOpenChains} />

      {/* Bid ladder per player */}
      <section className="mt-8" aria-label={s.bidLadderAria}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{s.bidsByPlayer}</h2>
          <p className="text-xs text-muted-foreground">{s.recentShown(data.recentBids.length)}</p>
        </div>

        {grouped.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Gavel}
            title={s.noBids}
            description={s.noBidsDesc}
            action={
              tournament.roomCode ? (
                <Button asChild>
                  <AppLink href={`/room/${tournament.roomCode}`}>{s.openAuctionRoom}</AppLink>
                </Button>
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
                            {s.bidsTopBid(g.ladder.length)}{' '}
                            <span className="font-semibold tabular-nums">{formatBDT(g.topBid)}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {winner ? (
                            <Badge className="bg-teal-100 text-teal-900 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:hover:bg-teal-950/50">
                              <Trophy className="mr-1 h-3 w-3" aria-hidden /> {winner.teamName} · {formatBDT(winner.price)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {s.noSaleInView}
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
                                  isFinal ? 'bg-teal-50 font-semibold text-teal-900 dark:bg-teal-950/40 dark:text-teal-200' : 'bg-muted/40'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-muted-foreground">
                                    {i + 1}
                                  </span>
                                  {b.teamName}
                                  {isFinal ? (
                                    <Badge className="bg-teal-600 text-white hover:bg-teal-600">{s.won}</Badge>
                                  ) : null}
                                </span>
                                <span className="flex items-center gap-3 whitespace-nowrap">
                                  <span className="font-semibold tabular-nums">{formatBDT(b.amount)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(b.createdAt, lang)}
                                  </span>
                                </span>
                              </li>
                            )
                          })}
                        </ol>
                        {winner ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {s.finalSold(
                              <span className="font-semibold">{winner.teamName}</span>,
                              <span className="font-semibold">{formatBDT(winner.price)}</span>
                            )}
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
          {s.latestNote}
        </p>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const EVENT_META: Record<AuctionEventDTO['type'], { dot: string; tone: string }> = {
  SALE: { dot: 'bg-teal-500', tone: 'text-teal-900 dark:text-teal-300' },
  RE_AUCTION: { dot: 'bg-amber-500', tone: 'text-amber-900 dark:text-amber-300' },
  REFUND: { dot: 'bg-sky-500', tone: 'text-sky-900 dark:text-sky-300' },
  UNSOLD: { dot: 'bg-rose-400', tone: 'text-rose-900 dark:text-rose-300' },
  SKIPPED: { dot: 'bg-slate-400', tone: 'text-muted-foreground' },
}

/**
 * The permanent ownership chain for every player that has been through a sale:
 * SALE → RE-AUCTION → REFUND → NEW SALE. The current owner is read from the
 * player record, never from the log, so historical sales are never counted twice.
 */
function SaleChains({
  chains,
  openChains,
  setOpenChains,
}: {
  chains: PlayerSaleChain[]
  openChains: Record<string, boolean>
  setOpenChains: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  const s = useStrings(STRINGS)
  const lang = useLang()
  if (chains.length === 0) return null
  const reauctioned = chains.filter((c) => c.reauctions > 0).length

  return (
    <section className="mt-8" aria-label={s.saleHistoryAria}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{s.saleHistory}</h2>
        <p className="text-xs text-muted-foreground">
          {s.withRecord(chains.length)}
          {reauctioned > 0 ? s.reauctioned(reauctioned) : ''}
        </p>
      </div>

      <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-0.5">
        {chains.map((c) => {
          const open = !!openChains[c.playerId]
          const sales = c.events.filter((e) => e.type === 'SALE')
          return (
            <Collapsible
              key={c.playerId}
              open={open}
              onOpenChange={(o) => setOpenChains((prev) => ({ ...prev, [c.playerId]: o }))}
            >
              <Card className="py-0">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-expanded={open}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                          #{String(c.playerNumber).padStart(3, '0')}
                        </span>
                        {c.playerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.salesCount(sales.length)}
                        {c.reauctions > 0 ? s.reauctionCount(c.reauctions) : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.reauctions > 0 ? (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/50">
                          <RotateCcw className="mr-1 h-3 w-3" aria-hidden /> {c.reauctions}x
                        </Badge>
                      ) : null}
                      {c.currentTeamName ? (
                        <Badge className="hidden bg-teal-100 text-teal-900 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:hover:bg-teal-950/50 sm:inline-flex">
                          <Trophy className="mr-1 h-3 w-3" aria-hidden /> {c.currentTeamName} ·{' '}
                          {formatBDT(c.currentPrice ?? 0)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {s.playerStatus(c.status)}
                        </Badge>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="border-t pt-3">
                    <ol className="relative space-y-3 border-l pl-5">
                      {c.events.map((e) => {
                        const meta = EVENT_META[e.type]
                        const saleNo = e.type === 'SALE' ? sales.findIndex((x) => x.id === e.id) + 1 : null
                        return (
                          <li key={e.id} className="relative">
                            <span
                              className={`absolute -left-[1.5625rem] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${meta.dot}`}
                              aria-hidden
                            />
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              <p className={`text-sm font-semibold ${meta.tone}`}>
                                {e.type === 'SALE' ? s.saleNo(saleNo) : s.eventLabels[e.type]}
                                {e.teamName ? <span className="font-normal"> · {e.teamName}</span> : null}
                              </p>
                              <p className="text-xs tabular-nums text-muted-foreground">
                                {formatDate(e.createdAt, false, lang)} {formatTime(e.createdAt, lang)}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {e.type === 'REFUND' ? (
                                <span className="inline-flex items-center gap-1">
                                  <Undo2 className="h-3 w-3" aria-hidden />
                                  {s.returned(formatBDT(e.refundAmount ?? 0))}
                                </span>
                              ) : e.type === 'RE_AUCTION' ? (
                                s.roundOpened(e.cycle + 1, e.actorName ?? null)
                              ) : e.amount != null ? (
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatBDT(e.amount)}
                                </span>
                              ) : (
                                s.noBidsBy(e.actorName ?? null)
                              )}
                              {e.reason ? ` — ${e.reason}` : ''}
                            </p>
                          </li>
                        )
                      })}
                      <li className="relative">
                        <span
                          className="absolute -left-[1.5625rem] top-1.5 h-2.5 w-2.5 rounded-full bg-foreground ring-2 ring-background"
                          aria-hidden
                        />
                        <p className="text-sm font-bold">
                          {s.currentOwner}{' '}
                          {c.currentTeamName ? (
                            <>
                              {c.currentTeamName}{' '}
                              <span className="tabular-nums text-muted-foreground">
                                ({formatBDT(c.currentPrice ?? 0)})
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{s.noOwner(s.playerStatus(c.status))}</span>
                          )}
                        </p>
                      </li>
                    </ol>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {s.chainsNote}
      </p>
    </section>
  )
}
