'use client'

import { useCallback, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Download,
  FileSpreadsheet,
  History,
  Info,
  Loader2,
  MoreVertical,
  Pencil,
  Radio,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { StatCard } from '@/components/shared/empty-state'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { PlayersTab } from '@/components/organizer/players-tab'
import { TeamsTab } from '@/components/organizer/teams-tab'
import { AuctionSetupTab } from '@/components/organizer/auction-setup-tab'
import { RegistrationsTab } from '@/components/organizer/registrations-tab'
import { InsightsTab } from '@/components/organizer/insights-tab'
import { TournamentEditDialog } from '@/components/organizer/tournament-edit-dialog'
import { apiDelete, apiDownload, ApiError } from '@/lib/api'
import { invalidateCached, peekCached, useCachedGet } from '@/lib/api-cache'
import { TOURNAMENTS_URL, tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate } from '@/lib/format'
import type { TournamentDetail as TournamentDetailDTO, TournamentSummary } from '@/lib/types'

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

/**
 * Same shape as the loaded page (header, tabs, stat cards) so nothing jumps when
 * data arrives. Coming from the tournaments list, the name is already known.
 */
function TournamentDetailSkeleton({ tournamentId }: { tournamentId: string }) {
  const summary = peekCached<{ tournaments: TournamentSummary[] }>(TOURNAMENTS_URL)?.tournaments.find(
    (t) => t.id === tournamentId
  )
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8" aria-busy="true" aria-label="Loading tournament">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="mt-3">
        {summary ? (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">{summary.name}</h1>
            <TournamentStatusBadge status={summary.status} />
          </div>
        ) : (
          <Skeleton className="h-8 w-2/3 rounded-lg" />
        )}
        <Skeleton className="mt-2 h-4 w-1/2 rounded-lg" />
      </div>
      <Skeleton className="mt-6 h-10 w-full max-w-2xl rounded-lg" />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-xl" />
    </div>
  )
}

export default function TournamentDetail({ tournamentId }: { tournamentId: string }) {
  const { data, loading, refetch } = useCachedGet<TournamentDetailDTO>(tournamentDetailUrl(tournamentId), (ex) =>
    toast.error(ex instanceof ApiError ? ex.message : 'Could not load tournament')
  )
  // Called after every save on this page: the list's counts / name / status
  // may have changed too, so its cached copy must not be shown again.
  const load = useCallback(async () => {
    invalidateCached(TOURNAMENTS_URL)
    await refetch()
  }, [refetch])
  const [tab, setTab] = useState('overview')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const downloadExport = async (type: string) => {
    if (!data) return
    try {
      await apiDownload(`/api/tournaments/${tournamentId}/export?type=${type}`, `${slugify(data.tournament.name)}-${type}.csv`)
      toast.success(`Exported ${type} CSV`)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Export failed')
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await apiDelete(`/api/tournaments/${tournamentId}`)
      invalidateCached(TOURNAMENTS_URL, tournamentDetailUrl(tournamentId))
      toast.success('Tournament deleted')
      navigate('/tournaments')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Delete failed')
      setDeleting(false)
    }
  }

  if (loading) return <TournamentDetailSkeleton tournamentId={tournamentId} />


  if (!data) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold">Tournament unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted, or you may not have access.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tournaments')}>
          Back to tournaments
        </Button>
      </div>
    )
  }

  const { tournament: t, players, teams, auction } = data
  const sold = players.filter((p) => p.status === 'SOLD').length
  const unsold = players.filter((p) => p.status === 'UNSOLD').length
  const totalBudget = teams.reduce((n, tm) => n + tm.budget, 0)
  const avgSquad = teams.length > 0 ? Math.round((teams.reduce((n, tm) => n + tm.maxSquad, 0) / teams.length) * 10) / 10 : 0

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Banner */}
      {t.bannerUrl ? (
        <div className="mb-4 overflow-hidden rounded-xl border">
          <img src={t.bannerUrl} alt={`${t.name} banner`} className="h-32 w-full object-cover sm:h-44" />
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 text-muted-foreground"
            onClick={() => navigate('/tournaments')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> All tournaments
          </Button>
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            {t.logoUrl ? (
              <img src={t.logoUrl} alt={`${t.name} logo`} className="h-9 w-9 rounded-lg border object-cover" />
            ) : null}
            <span className="break-words">{t.name}</span>
            <TournamentStatusBadge status={t.status} />
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{t.sport === 'FOOTBALL' ? 'Football' : 'Cricket'}</span>
            {t.tournamentType ? <span>{t.tournamentType}</span> : null}
            {t.location ? <span>{t.location}</span> : null}
            <span>Starts {formatDate(t.startDate)}</span>
            <span>Auction {formatDate(t.auctionAt, true)}</span>
            <Badge variant="secondary" className="text-xs">
              {t.auctionMode === 'CATEGORY' ? 'Category A–E' : 'Normal mode'}
            </Badge>
          </div>
          {t.description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.description}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" className="min-h-10" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden /> Edit
          </Button>
          <Button
            variant="outline"
            className="min-h-10"
            onClick={() => navigate(`/tournaments/${tournamentId}/history`)}
          >
            <History className="mr-1.5 h-4 w-4" aria-hidden /> History
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10" aria-label="More actions">
                <MoreVertical className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download className="mr-2 h-4 w-4" /> Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {EXPORT_TYPES.map((e) => (
                    <DropdownMenuItem key={e.type} onClick={() => void downloadExport(e.type)}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> {e.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/results/${tournamentId}`)}>
                <Trophy className="mr-2 h-4 w-4" /> Results
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/tournaments/${tournamentId}/history`)}>
                <History className="mr-2 h-4 w-4" /> Auction history
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete tournament
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-0 sm:w-auto">
          <TabsTrigger value="overview" className="min-h-11">Overview</TabsTrigger>
          <TabsTrigger value="players" className="min-h-11">
            Players <span className="ml-1 text-xs text-muted-foreground">({players.length})</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="min-h-11">
            Teams <span className="ml-1 text-xs text-muted-foreground">({teams.length})</span>
          </TabsTrigger>
          <TabsTrigger value="registrations" className="min-h-11">Registrations</TabsTrigger>
          <TabsTrigger value="insights" className="min-h-11">Insights</TabsTrigger>
          <TabsTrigger value="auction" className="min-h-11">
            Auction Setup
            {auction ? (
              <span className="ml-1.5 flex h-2 w-2">
                <span className={`h-2 w-2 rounded-full ${auction.status === 'LIVE' ? 'bg-amber-500' : 'bg-teal-500'}`} />
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ---------------- OVERVIEW ---------------- */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {t.status === 'COMPLETED' ? (
            <Card className="border-teal-300 bg-teal-50/60">
              <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-teal-700" aria-hidden />
                  <div>
                    <p className="font-bold text-teal-900">This auction has wrapped up</p>
                    <p className="text-sm text-teal-800/80">The final squads and spending are ready to view.</p>
                  </div>
                </div>
                <Button className="min-h-10 w-full sm:w-auto" onClick={() => navigate(`/results/${tournamentId}`)}>
                  View final results <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Players" value={players.length} icon={Users} />
            <StatCard label="Sold" value={sold} icon={Trophy} tone="success" />
            <StatCard label="Unsold" value={unsold} icon={Ban} tone="danger" />
            <StatCard label="Teams" value={teams.length} icon={Users} />
            <StatCard label="Total budget" value={formatBDT(totalBudget)} icon={Wallet} hint="Across all teams" />
            <StatCard label="Avg max squad" value={avgSquad} icon={Radio} hint="Players per team" />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" aria-hidden /> Tournament details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {[
                  { k: 'Name', v: t.name },
                  { k: 'Sport', v: t.sport === 'FOOTBALL' ? 'Football' : 'Cricket' },
                  { k: 'Type', v: t.tournamentType ?? '—' },
                  { k: 'Location', v: t.location ?? '—' },
                  { k: 'Start date', v: formatDate(t.startDate) },
                  { k: 'Auction at', v: formatDate(t.auctionAt, true) },
                  { k: 'Auction mode', v: t.auctionMode === 'CATEGORY' ? 'Category-Based (A–E)' : 'Normal' },
                  {
                    k: 'Base price',
                    v: t.auctionMode === 'NORMAL' ? formatBDT(t.basePrice) : 'Set per category',
                  },
                  { k: 'Status', v: t.status },
                  { k: 'Created', v: formatDate(t.createdAt, true) },
                ].map((row) => (
                  <div key={row.k} className="flex items-start justify-between gap-4 border-b pb-2 text-sm last:border-b-0">
                    <dt className="shrink-0 font-medium text-muted-foreground">{row.k}</dt>
                    <dd className="text-right font-semibold">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="border-rose-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-rose-700">
                <Trash2 className="h-4 w-4" aria-hidden /> Danger zone
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Deleting removes the tournament with all players, teams and bids. This cannot be undone.
              </p>
              <Button variant="destructive" className="min-h-10 shrink-0" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Delete tournament
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- PLAYERS ---------------- */}
        <TabsContent value="players" className="mt-4">
          <PlayersTab
            tournamentId={tournamentId}
            sport={t.sport}
            auctionMode={t.auctionMode}
            basePrice={t.basePrice}
            players={players}
            refetch={load}
            loading={loading}
          />
        </TabsContent>

        {/* ---------------- TEAMS ---------------- */}
        <TabsContent value="teams" className="mt-4">
          <TeamsTab tournamentId={tournamentId} teams={teams} refetch={load} loading={loading} />
        </TabsContent>

        {/* ---------------- REGISTRATIONS ---------------- */}
        <TabsContent value="registrations" className="mt-4">
          <RegistrationsTab
            tournamentId={tournamentId}
            tournamentName={t.name}
            auctionMode={t.auctionMode}
            basePrice={t.basePrice}
            onPlayersChanged={load}
          />
        </TabsContent>

        {/* ---------------- INSIGHTS ---------------- */}
        <TabsContent value="insights" className="mt-4">
          {tab === 'insights' ? <InsightsTab tournamentId={tournamentId} /> : null}
        </TabsContent>

        {/* ---------------- AUCTION SETUP ---------------- */}
        <TabsContent value="auction" className="mt-4">
          <AuctionSetupTab
            key={auction?.id ?? 'no-auction'}
            tournamentId={tournamentId}
            tournamentName={t.name}
            auction={auction}
            auctionMode={t.auctionMode}
            players={players}
            teams={teams}
            refetch={load}
          />
        </TabsContent>
      </Tabs>

      <Separator className="mt-8" />

      {/* Edit details — remounted per open so the form always starts from fresh data */}
      {editOpen ? (
        <TournamentEditDialog
          tournament={t}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={load}
        />
      ) : null}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{t.name}&rdquo; and all its players, teams and bid history will be permanently removed. This
              cannot be undone.
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
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Deleting…
                </>
              ) : (
                'Delete tournament'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
