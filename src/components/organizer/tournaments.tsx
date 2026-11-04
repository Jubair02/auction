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
import { navigate } from '@/lib/router'
import { formatAuctionWhen } from '@/lib/format'
import { auctionTime, byUrgency, isDone, isLive, PHASE_LABELS, plural, tournamentPhase, type TournamentPhase } from '@/lib/tournament-status'
import { cn } from '@/lib/utils'
import { sportLabel, type TournamentSummary } from '@/lib/types'

const EXPORT_TYPES: { type: string; label: string }[] = [
  { type: 'players', label: 'Players' },
  { type: 'sold', label: 'Sold' },
  { type: 'unsold', label: 'Unsold' },
  { type: 'squads', label: 'Squads' },
  { type: 'bids', label: 'History' },
  { type: 'spending', label: 'Spending' },
  { type: 'audit', label: 'Audit log' },
]

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tournament'
}

type StatusFilter = 'ALL' | TournamentPhase
type SortKey = 'attention' | 'auction' | 'name' | 'newest'

const SORTS: Record<SortKey, { label: string; compare: (a: TournamentSummary, b: TournamentSummary) => number }> = {
  attention: { label: 'Most urgent', compare: byUrgency },
  auction: { label: 'Auction date', compare: (a, b) => auctionTime(a) - auctionTime(b) || a.name.localeCompare(b.name) },
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
  newest: { label: 'Newest', compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
}

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'LIVE', 'READY', 'DRAFT', 'COMPLETED']

const subtitle = (t: TournamentSummary) =>
  [sportLabel(t.sport, 'en', t.sportName), t.tournamentType, t.location].filter(Boolean).join(' · ')

/** The auction time as the table shows it — flagged when the date passed and it never ran. */
function AuctionWhen({ t }: { t: TournamentSummary }) {
  if (isLive(t)) return <span className="font-medium text-amber-700 dark:text-amber-400">Under way</span>
  const when = formatAuctionWhen(t.auctionAt)
  if (!when) return <span className="text-muted-foreground">Not set</span>
  const overdue = when.past && !isDone(t)
  return (
    <span className={cn('whitespace-nowrap', overdue && 'font-medium text-amber-700 dark:text-amber-400')}>
      {when.text}
      {overdue ? <span className="block text-xs font-normal">Date has passed</span> : null}
    </span>
  )
}

export default function TournamentsList() {
  const { data, loading, refetch: load } = useCachedGet<{ tournaments: TournamentSummary[] }>(TOURNAMENTS_URL, (ex) =>
    toast.error(ex instanceof ApiError ? ex.message : 'Could not load tournaments')
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

  const downloadExport = async (t: TournamentSummary, type: string) => {
    try {
      await apiDownload(`/api/tournaments/${t.id}/export?type=${type}`, `${slugify(t.name)}-${type}.csv`)
      toast.success(`Exported ${type} CSV`)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Export failed')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/tournaments/${deleteTarget.id}`)
      invalidateCached(tournamentDetailUrl(deleteTarget.id))
      toast.success(`Deleted "${deleteTarget.name}"`)
      setDeleteTarget(null)
      void load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const moreMenu = (t: TournamentSummary) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={`More actions for ${t.name}`}>
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {t.roomCode ? (
          <>
            <DropdownMenuItem onClick={() => navigate(`/room/${t.roomCode}`)}>
              <DoorOpen className="mr-2 h-4 w-4" /> Open auction room
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyRoomCode(t.roomCode as string)}>
              <Copy className="mr-2 h-4 w-4" /> Copy room code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => navigate(`/tournaments/${t.id}/history`)}>
          <History className="mr-2 h-4 w-4" /> Auction history
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/results/${t.id}`)}>
          <Trophy className="mr-2 h-4 w-4" /> Results
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="mr-2 h-4 w-4" /> Export
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {EXPORT_TYPES.map((e) => (
              <DropdownMenuItem key={e.type} onClick={() => void downloadExport(t, e.type)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> {e.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(t)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'All auctions you organize, in one place.'
              : `${plural(tournaments.length, 'tournament')}${liveCount ? ` · ${liveCount} live now` : ''}`}
          </p>
        </div>
        <Button size="lg" className="min-h-11" onClick={() => navigate('/tournaments/new')}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tournament
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
          title="No tournaments yet"
          description="Create your first tournament to start adding players and teams."
          action={
            <Button onClick={() => navigate('/tournaments/new')}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tournament
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
                  placeholder="Search name, room code or venue"
                  aria-label="Search tournaments"
                  className="h-10 pl-9"
                />
              </div>
              <div className={cn('grid gap-3 sm:ml-auto sm:flex', sports.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {sports.length > 1 ? (
                  <Select value={sport} onValueChange={setSport}>
                    <SelectTrigger className="h-10 w-full sm:w-36" aria-label="Filter by sport">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All sports</SelectItem>
                      {sports.map((s) => (
                        <SelectItem key={s} value={s}>
                          {sportLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Sort tournaments">
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORTS) as SortKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {SORTS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <FilterChips
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? 'All' : PHASE_LABELS[f], count: count(f) }))}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={Search}
              title="No tournaments match"
              description="Try another name, sport or status."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
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
                      <TableHead>Tournament</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Auction</TableHead>
                      <TableHead className="text-right">Teams</TableHead>
                      <TableHead>Players sold</TableHead>
                      <TableHead>Room code</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const pct = t.playerCount > 0 ? Math.round((t.soldCount / t.playerCount) * 100) : 0
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="max-w-72 py-3">
                            <button
                              type="button"
                              className="block max-w-full truncate text-left font-semibold hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                              {...prefetchTournamentProps(t.id)}
                              onClick={() => navigate(`/tournaments/${t.id}`)}
                            >
                              {t.name}
                            </button>
                            <p className="truncate text-xs text-muted-foreground">{subtitle(t)}</p>
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
                              <span className="text-muted-foreground">No players yet</span>
                            ) : (
                              <div className="w-32">
                                <p className="text-xs tabular-nums">
                                  <span className="font-semibold">{t.soldCount}</span> of {t.playerCount}
                                </p>
                                <Progress value={pct} className="mt-1 h-1.5" aria-label={`${pct}% of players sold`} />
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
                                  aria-label={`Copy room code ${t.roomCode}`}
                                  onClick={() => copyRoomCode(t.roomCode as string)}
                                >
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                </Button>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Not set up</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9"
                                {...prefetchTournamentProps(t.id)}
                                onClick={() => navigate(`/tournaments/${t.id}`)}
                              >
                                Manage
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
                        <Button className="min-h-10 flex-1" {...prefetchTournamentProps(t.id)} onClick={() => navigate(`/tournaments/${t.id}`)}>
                          <LayoutList className="mr-1.5 h-4 w-4" aria-hidden /> Manage
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
            <AlertDialogTitle>Delete tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}"` : 'This tournament'} and all its players, teams and bid
              history will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete tournament'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
