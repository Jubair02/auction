'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownUp,
  Copy,
  DoorOpen,
  Download,
  FileSpreadsheet,
  History,
  LayoutList,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterChips } from '@/components/shared/filter-chips'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { TournamentCard, copyRoomCode } from '@/components/organizer/tournament-card'
import { apiDelete, apiDownload, ApiError } from '@/lib/api'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { TOURNAMENTS_URL, prefetchTournamentProps, tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { AppLink } from '@/components/shared/app-link'
import { formatAuctionWhen, slugify } from '@/lib/format'
import { auctionTime, byUrgency, isDone, isLive, PHASE_LABELS, tournamentPhase, type TournamentPhase } from '@/lib/tournament-status'
import { cn } from '@/lib/utils'
import { sportLabel, type TournamentSummary } from '@/lib/types'
import { type Lang, type Strings, useLang, useStrings } from '@/lib/i18n'
import { tournamentTypeLabel } from '@/lib/tournament-types'

// CSV export types — these keys go to the API and into the file name.
const EXPORT_TYPES = ['players', 'sold', 'unsold', 'squads', 'bids', 'spending', 'audit'] as const
type ExportType = (typeof EXPORT_TYPES)[number]

type StatusFilter = 'ALL' | TournamentPhase
type SortKey = 'attention' | 'auction' | 'name' | 'newest'

const SORTS: Record<SortKey, { compare: (a: TournamentSummary, b: TournamentSummary) => number }> = {
  attention: { compare: byUrgency },
  auction: { compare: (a, b) => auctionTime(a) - auctionTime(b) || a.name.localeCompare(b.name) },
  name: { compare: (a, b) => a.name.localeCompare(b.name) },
  newest: { compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
}

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'LIVE', 'READY', 'DRAFT', 'COMPLETED']

const STRINGS = {
  en: {
    exportLabels: { players: 'Players', sold: 'Sold', unsold: 'Unsold', squads: 'Squads', bids: 'History', spending: 'Spending', audit: 'Audit log' },
    sortLabels: { attention: 'Most urgent', auction: 'Auction date', name: 'Name A–Z', newest: 'Newest' },
    phaseLabels: PHASE_LABELS,
    underWay: 'Under way',
    notSet: 'Not set',
    datePassed: 'Date has passed',
    loadFailed: 'Could not load tournaments',
    exported: (type: string) => `Exported ${type} CSV`,
    exportFailed: 'Export failed',
    deleted: (name: string) => `Deleted "${name}"`,
    archived: (name: string) => `Archived "${name}" — its auction record is kept`,
    deleteFailed: 'Delete failed',
    moreActions: (name: string) => `More actions for ${name}`,
    openAuctionRoom: 'Open auction room',
    copyRoomCode: 'Copy room code',
    auctionHistory: 'Auction history',
    results: 'Results',
    export: 'Export',
    deleteEndFirst: 'Delete (end the auction first)',
    delete: 'Delete',
    title: 'Tournaments',
    intro: 'All auctions you organize, in one place.',
    countLine: (n: number, live: number) => `${n} tournament${n === 1 ? '' : 's'}${live ? ` · ${live} live now` : ''}`,
    newTournament: 'New tournament',
    emptyTitle: 'No tournaments yet',
    emptyDesc: 'Create your first tournament to start adding players and teams.',
    searchPlaceholder: 'Search name, room code or venue',
    searchAria: 'Search tournaments',
    filterSport: 'Filter by sport',
    allSports: 'All sports',
    sortAria: 'Sort tournaments',
    filterStatus: 'Filter by status',
    all: 'All',
    noMatch: 'No tournaments match',
    noMatchDesc: 'Try another name, sport or status.',
    clearFilters: 'Clear filters',
    colTournament: 'Tournament',
    colStatus: 'Status',
    colAuction: 'Auction',
    colTeams: 'Teams',
    colPlayersSold: 'Players sold',
    colRoomCode: 'Room code',
    colActions: 'Actions',
    noPlayers: 'No players yet',
    ofTotal: (total: number) => ` of ${total}`,
    soldPct: (pct: number) => `${pct}% of players sold`,
    copyCode: (code: string) => `Copy room code ${code}`,
    notSetUp: 'Not set up',
    manage: 'Manage',
    deleteTitle: 'Delete tournament?',
    deleteDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'This tournament'} and all its players, teams and bid history will be permanently removed. This cannot be undone. If its auction has bids, it is archived instead, so the auction record is kept.`,
    cancel: 'Cancel',
    deleting: 'Deleting…',
    deleteTournament: 'Delete tournament',
  },
  bn: {
    exportLabels: { players: 'খেলোয়াড়', sold: 'বিক্রি', unsold: 'অবিক্রিত', squads: 'স্কোয়াড', bids: 'ইতিহাস', spending: 'খরচ', audit: 'অডিট লগ' },
    sortLabels: { attention: 'সবচেয়ে জরুরি', auction: 'নিলামের তারিখ', name: 'নাম A–Z', newest: 'নতুনগুলো আগে' },
    phaseLabels: { LIVE: 'লাইভ', READY: 'প্রস্তুত', DRAFT: 'খসড়া', COMPLETED: 'সম্পন্ন' },
    underWay: 'চলছে',
    notSet: 'ঠিক হয়নি',
    datePassed: 'তারিখ পার হয়ে গেছে',
    loadFailed: 'টুর্নামেন্ট লোড করা যায়নি',
    exported: (type: string) => `${type} CSV এক্সপোর্ট হয়েছে`,
    exportFailed: 'এক্সপোর্ট করা যায়নি',
    deleted: (name: string) => `"${name}" মুছে ফেলা হয়েছে`,
    archived: (name: string) => `"${name}" আর্কাইভ হয়েছে — নিলামের রেকর্ড রাখা আছে`,
    deleteFailed: 'মুছে ফেলা যায়নি',
    moreActions: (name: string) => `${name} — আরও অপশন`,
    openAuctionRoom: 'নিলাম রুম খুলুন',
    copyRoomCode: 'রুম কোড কপি করুন',
    auctionHistory: 'নিলামের ইতিহাস',
    results: 'ফলাফল',
    export: 'এক্সপোর্ট',
    deleteEndFirst: 'মুছুন (আগে নিলাম শেষ করুন)',
    delete: 'মুছুন',
    title: 'টুর্নামেন্ট',
    intro: 'আপনার আয়োজন করা সব নিলাম, এক জায়গায়।',
    countLine: (n: number, live: number) => `${n}টি টুর্নামেন্ট${live ? ` · এখন ${live}টি লাইভ` : ''}`,
    newTournament: 'নতুন টুর্নামেন্ট',
    emptyTitle: 'এখনো কোনো টুর্নামেন্ট নেই',
    emptyDesc: 'প্রথম টুর্নামেন্ট তৈরি করুন, তারপর খেলোয়াড় আর দল যোগ করা শুরু করুন।',
    searchPlaceholder: 'নাম, রুম কোড বা ভেন্যু দিয়ে খুঁজুন',
    searchAria: 'টুর্নামেন্ট খুঁজুন',
    filterSport: 'খেলা অনুযায়ী ফিল্টার',
    allSports: 'সব খেলা',
    sortAria: 'টুর্নামেন্ট সাজান',
    filterStatus: 'অবস্থা অনুযায়ী ফিল্টার',
    all: 'সব',
    noMatch: 'কোনো টুর্নামেন্ট মেলেনি',
    noMatchDesc: 'অন্য নাম, খেলা বা অবস্থা দিয়ে চেষ্টা করুন।',
    clearFilters: 'ফিল্টার মুছুন',
    colTournament: 'টুর্নামেন্ট',
    colStatus: 'অবস্থা',
    colAuction: 'নিলাম',
    colTeams: 'দল',
    colPlayersSold: 'খেলোয়াড় বিক্রি',
    colRoomCode: 'রুম কোড',
    colActions: 'অ্যাকশন',
    noPlayers: 'এখনো কোনো খেলোয়াড় নেই',
    ofTotal: (total: number) => ` / ${total}`,
    soldPct: (pct: number) => `${pct}% খেলোয়াড় বিক্রি`,
    copyCode: (code: string) => `রুম কোড ${code} কপি করুন`,
    notSetUp: 'সেট আপ হয়নি',
    manage: 'ম্যানেজ করুন',
    deleteTitle: 'টুর্নামেন্ট মুছবেন?',
    deleteDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'এই টুর্নামেন্ট'} আর এর সব খেলোয়াড়, দল ও বিডের ইতিহাস চিরতরে মুছে যাবে। এটা আর ফেরানো যাবে না। নিলামে বিড হয়ে থাকলে এটা মুছে না গিয়ে আর্কাইভ হবে, যাতে নিলামের রেকর্ড থেকে যায়।`,
    cancel: 'বাতিল',
    deleting: 'মুছে ফেলা হচ্ছে…',
    deleteTournament: 'টুর্নামেন্ট মুছুন',
  },
} satisfies Strings<{
  exportLabels: Record<ExportType, string>
  sortLabels: Record<SortKey, string>
  phaseLabels: Record<TournamentPhase, string>
  underWay: string
  notSet: string
  datePassed: string
  loadFailed: string
  exported: (type: string) => string
  exportFailed: string
  deleted: (name: string) => string
  archived: (name: string) => string
  deleteFailed: string
  moreActions: (name: string) => string
  openAuctionRoom: string
  copyRoomCode: string
  auctionHistory: string
  results: string
  export: string
  deleteEndFirst: string
  delete: string
  title: string
  intro: string
  countLine: (n: number, live: number) => string
  newTournament: string
  emptyTitle: string
  emptyDesc: string
  searchPlaceholder: string
  searchAria: string
  filterSport: string
  allSports: string
  sortAria: string
  filterStatus: string
  all: string
  noMatch: string
  noMatchDesc: string
  clearFilters: string
  colTournament: string
  colStatus: string
  colAuction: string
  colTeams: string
  colPlayersSold: string
  colRoomCode: string
  colActions: string
  noPlayers: string
  ofTotal: (total: number) => string
  soldPct: (pct: number) => string
  copyCode: (code: string) => string
  notSetUp: string
  manage: string
  deleteTitle: string
  deleteDesc: (name: string | null) => string
  cancel: string
  deleting: string
  deleteTournament: string
}>

const subtitle = (t: TournamentSummary, lang: Lang) =>
  [sportLabel(t.sport, lang, t.sportName), tournamentTypeLabel(t.tournamentType, lang), t.location].filter(Boolean).join(' · ')

/** The auction time as the table shows it — flagged when the date passed and it never ran. */
function AuctionWhen({ t }: { t: TournamentSummary }) {
  const s = useStrings(STRINGS)
  const lang = useLang()
  if (isLive(t)) return <span className="font-medium text-amber-700 dark:text-amber-400">{s.underWay}</span>
  const when = formatAuctionWhen(t.auctionAt, lang)
  if (!when) return <span className="text-muted-foreground">{s.notSet}</span>
  const overdue = when.past && !isDone(t)
  return (
    <span className={cn('whitespace-nowrap', overdue && 'font-medium text-amber-700 dark:text-amber-400')}>
      {when.text}
      {overdue ? <span className="block text-xs font-normal">{s.datePassed}</span> : null}
    </span>
  )
}

export default function TournamentsList() {
  const lang = useLang()
  const s = useStrings(STRINGS)
  const { data, loading, refetch: load } = useCachedGet<{ tournaments: TournamentSummary[] }>(TOURNAMENTS_URL, (ex) =>
    toast.error(ex instanceof ApiError ? ex.message : s.loadFailed)
  )
  const tournaments = useMemo(() => data?.tournaments ?? [], [data])

  const [query, setQuery] = useState('')
  const [sport, setSport] = useState('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('attention')

  const [deleteTarget, setDeleteTarget] = useState<TournamentSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  // The sport filter only earns its place once there's more than one sport to pick from.
  const sports = useMemo(() => [...new Set(tournaments.map((t) => t.sport))], [tournaments])

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tournaments.filter(
      (t) =>
        (sport === 'ALL' || t.sport === sport) &&
        (!q || [t.name, t.roomCode, t.location].some((v) => v?.toLowerCase().includes(q)))
    )
  }, [tournaments, query, sport])

  const filtered = useMemo(
    () => matching.filter((t) => status === 'ALL' || tournamentPhase(t) === status).sort(SORTS[sort].compare),
    [matching, status, sort]
  )

  const count = (f: StatusFilter) => (f === 'ALL' ? matching.length : matching.filter((t) => tournamentPhase(t) === f).length)
  const liveCount = tournaments.filter(isLive).length

  const clearFilters = () => {
    setQuery('')
    setSport('ALL')
    setStatus('ALL')
  }

  const downloadExport = async (t: TournamentSummary, type: ExportType) => {
    try {
      await apiDownload(`/api/tournaments/${t.id}/export?type=${type}`, `${slugify(t.name)}-${type}.csv`)
      toast.success(s.exported(lang === 'en' ? type : s.exportLabels[type]))
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.exportFailed)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await apiDelete<{ archived?: boolean }>(`/api/tournaments/${deleteTarget.id}`)
      invalidateCached(tournamentDetailUrl(deleteTarget.id))
      toast.success(res?.archived ? s.archived(deleteTarget.name) : s.deleted(deleteTarget.name))
      setDeleteTarget(null)
      void load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  const moreMenu = (t: TournamentSummary) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={s.moreActions(t.name)}>
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {t.roomCode ? (
          <>
            <DropdownMenuItem asChild>
              <AppLink href={`/room/${t.roomCode}`}>
                <DoorOpen className="mr-2 h-4 w-4" /> {s.openAuctionRoom}
              </AppLink>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyRoomCode(t.roomCode as string, lang)}>
              <Copy className="mr-2 h-4 w-4" /> {s.copyRoomCode}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <AppLink href={`/tournaments/${t.id}/history`}>
            <History className="mr-2 h-4 w-4" /> {s.auctionHistory}
          </AppLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <AppLink href={`/results/${t.id}`}>
            <Trophy className="mr-2 h-4 w-4" /> {s.results}
          </AppLink>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="mr-2 h-4 w-4" /> {s.export}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {EXPORT_TYPES.map((type) => (
              <DropdownMenuItem key={type} onClick={() => void downloadExport(t, type)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> {s.exportLabels[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {/* The server refuses while the auction runs — say so instead of failing. */}
        <DropdownMenuItem
          variant="destructive"
          disabled={t.auctionStatus === 'LIVE' || t.auctionStatus === 'PAUSED'}
          onClick={() => setDeleteTarget(t)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t.auctionStatus === 'LIVE' || t.auctionStatus === 'PAUSED' ? s.deleteEndFirst : s.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{s.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? s.intro : s.countLine(tournaments.length, liveCount)}
          </p>
        </div>
        <Button asChild size="lg" className="min-h-11">
          <AppLink href="/tournaments/new">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {s.newTournament}
          </AppLink>
        </Button>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-10 w-full max-w-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Trophy}
          title={s.emptyTitle}
          description={s.emptyDesc}
          action={
            <Button asChild>
              <AppLink href="/tournaments/new">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {s.newTournament}
              </AppLink>
            </Button>
          }
        />
      ) : (
        <>
          {/* Filters */}
          <div className="mt-6 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={s.searchPlaceholder}
                  aria-label={s.searchAria}
                  className="h-10 pl-9"
                />
              </div>
              <div className={cn('grid gap-3 sm:ml-auto sm:flex', sports.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {sports.length > 1 ? (
                  <Select value={sport} onValueChange={setSport}>
                    <SelectTrigger className="h-10 w-full sm:w-36" aria-label={s.filterSport}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{s.allSports}</SelectItem>
                      {sports.map((sp) => (
                        <SelectItem key={sp} value={sp}>
                          {sportLabel(sp, lang)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-10 w-full sm:w-44" aria-label={s.sortAria}>
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORTS) as SortKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {s.sortLabels[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FilterChips
              label={s.filterStatus}
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? s.all : s.phaseLabels[f], count: count(f) }))}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={Search}
              title={s.noMatch}
              description={s.noMatchDesc}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  {s.clearFilters}
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop table — page scroll, sticky header */}
              <div className="mt-5 hidden rounded-lg border lg:block">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                    <TableRow>
                      <TableHead>{s.colTournament}</TableHead>
                      <TableHead>{s.colStatus}</TableHead>
                      <TableHead>{s.colAuction}</TableHead>
                      <TableHead className="text-right">{s.colTeams}</TableHead>
                      <TableHead>{s.colPlayersSold}</TableHead>
                      <TableHead>{s.colRoomCode}</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">{s.colActions}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const pct = t.playerCount > 0 ? Math.round((t.soldCount / t.playerCount) * 100) : 0
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="max-w-72 py-3">
                            <AppLink
                              href={`/tournaments/${t.id}`}
                              className="block max-w-full truncate text-left font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                              {...prefetchTournamentProps(t.id)}
                            >
                              {t.name}
                            </AppLink>
                            <p className="truncate text-xs text-muted-foreground">{subtitle(t, lang)}</p>
                          </TableCell>
                          <TableCell>
                            <TournamentStatusBadge status={isLive(t) ? 'LIVE' : t.status} />
                          </TableCell>
                          <TableCell>
                            <AuctionWhen t={t} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{t.teamCount}</TableCell>
                          <TableCell>
                            {t.playerCount === 0 ? (
                              <span className="text-muted-foreground">{s.noPlayers}</span>
                            ) : (
                              <div className="w-32">
                                <p className="text-xs tabular-nums">
                                  <span className="font-semibold">{t.soldCount}</span>{s.ofTotal(t.playerCount)}
                                </p>
                                <Progress value={pct} className="mt-1 h-1.5" aria-label={s.soldPct(pct)} />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.roomCode ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="font-mono text-xs font-bold">{t.roomCode}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={s.copyCode(t.roomCode)}
                                  onClick={() => copyRoomCode(t.roomCode as string, lang)}
                                >
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                </Button>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{s.notSetUp}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button asChild variant="outline" size="sm" className="h-9">
                                <AppLink href={`/tournaments/${t.id}`} {...prefetchTournamentProps(t.id)}>
                                  {s.manage}
                                </AppLink>
                              </Button>
                              {moreMenu(t)}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </table>
              </div>

              {/* Phone & tablet cards */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:hidden">
                {filtered.map((t) => (
                  <TournamentCard
                    key={t.id}
                    t={t}
                    actions={
                      <>
                        <Button asChild className="min-h-10 flex-1">
                          <AppLink href={`/tournaments/${t.id}`} {...prefetchTournamentProps(t.id)}>
                            <LayoutList className="mr-1.5 h-4 w-4" aria-hidden /> {s.manage}
                          </AppLink>
                        </Button>
                        {moreMenu(t)}
                      </>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{s.deleteDesc(deleteTarget ? deleteTarget.name : null)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? s.deleting : s.deleteTournament}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
