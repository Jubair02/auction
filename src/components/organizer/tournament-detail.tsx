'use client'

import { useCallback, useState } from 'react'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { PlayersTab } from '@/components/organizer/players-tab'
import { TeamsTab } from '@/components/organizer/teams-tab'
import { AuctionSetupTab } from '@/components/organizer/auction-setup-tab'
import { RegistrationsTab } from '@/components/organizer/registrations-tab'
import { InsightsTab } from '@/components/organizer/insights-tab'
import { TournamentEditDialog } from '@/components/organizer/tournament-edit-dialog'
import { goTo, nextStep, TournamentOverview, type DetailTab } from '@/components/organizer/tournament-overview'
import { apiDelete, apiDownload, ApiError } from '@/lib/api'
import { invalidateCached, peekCached, useCachedGet } from '@/lib/api-cache'
import { TOURNAMENTS_URL, tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { formatDate, slugify } from '@/lib/format'
import { sportLabel, type TournamentDetail as TournamentDetailDTO, type TournamentSummary } from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'

// CSV export types — these keys go to the API and into the file name.
const EXPORT_TYPES = ['players', 'sold', 'unsold', 'squads', 'bids', 'spending', 'audit'] as const
type ExportType = (typeof EXPORT_TYPES)[number]

const STRINGS = {
  en: {
    exportLabels: { players: 'Players', sold: 'Sold', unsold: 'Unsold', squads: 'Squads', bids: 'History', spending: 'Spending', audit: 'Audit log' },
    loadingTournament: 'Loading tournament',
    loadFailed: 'Could not load tournament',
    exported: (type: string) => `Exported ${type} CSV`,
    exportFailed: 'Export failed',
    deleted: 'Tournament deleted',
    deleteFailed: 'Delete failed',
    unavailable: 'Tournament unavailable',
    unavailableDesc: 'It may have been deleted, or you may not have access.',
    backToTournaments: 'Back to tournaments',
    bannerAlt: (name: string) => `${name} banner`,
    logoAlt: (name: string) => `${name} logo`,
    allTournaments: 'All tournaments',
    starts: (date: string) => `Starts ${date}`,
    auctionAt: (date: string) => `Auction ${date}`,
    categoryMode: 'Category A–E',
    normalMode: 'Normal mode',
    edit: 'Edit',
    moreActions: 'More actions',
    export: 'Export',
    results: 'Results',
    auctionHistory: 'Auction history',
    deleteEndFirst: 'Delete tournament (end the auction first)',
    deleteTournament: 'Delete tournament',
    tabOverview: 'Overview',
    tabPlayers: 'Players',
    tabTeams: 'Teams',
    tabRegistrations: 'Registrations',
    tabInsights: 'Insights',
    tabAuction: 'Auction Setup',
    deleteTitle: 'Delete tournament?',
    deleteDesc: (name: string) =>
      `“${name}” and all its players, teams and bid history will be permanently removed. This cannot be undone.`,
    cancel: 'Cancel',
    deleting: 'Deleting…',
  },
  bn: {
    exportLabels: { players: 'খেলোয়াড়', sold: 'বিক্রি', unsold: 'অবিক্রিত', squads: 'স্কোয়াড', bids: 'ইতিহাস', spending: 'খরচ', audit: 'অডিট লগ' },
    loadingTournament: 'টুর্নামেন্ট লোড হচ্ছে',
    loadFailed: 'টুর্নামেন্ট লোড করা যায়নি',
    exported: (type: string) => `${type} CSV এক্সপোর্ট হয়েছে`,
    exportFailed: 'এক্সপোর্ট করা যায়নি',
    deleted: 'টুর্নামেন্ট মুছে ফেলা হয়েছে',
    deleteFailed: 'মুছে ফেলা যায়নি',
    unavailable: 'টুর্নামেন্ট পাওয়া যাচ্ছে না',
    unavailableDesc: 'হয়তো এটি মুছে ফেলা হয়েছে, অথবা আপনার অ্যাক্সেস নেই।',
    backToTournaments: 'টুর্নামেন্টে ফিরে যান',
    bannerAlt: (name: string) => `${name} ব্যানার`,
    logoAlt: (name: string) => `${name} লোগো`,
    allTournaments: 'সব টুর্নামেন্ট',
    starts: (date: string) => `শুরু: ${date}`,
    auctionAt: (date: string) => `নিলাম: ${date}`,
    categoryMode: 'ক্যাটাগরি A–E',
    normalMode: 'নরমাল মোড',
    edit: 'সম্পাদনা',
    moreActions: 'আরও অপশন',
    export: 'এক্সপোর্ট',
    results: 'ফলাফল',
    auctionHistory: 'নিলামের ইতিহাস',
    deleteEndFirst: 'টুর্নামেন্ট মুছুন (আগে নিলাম শেষ করুন)',
    deleteTournament: 'টুর্নামেন্ট মুছুন',
    tabOverview: 'সংক্ষেপ',
    tabPlayers: 'খেলোয়াড়',
    tabTeams: 'দল',
    tabRegistrations: 'নিবন্ধন',
    tabInsights: 'বিশ্লেষণ',
    tabAuction: 'নিলাম সেট আপ',
    deleteTitle: 'টুর্নামেন্ট মুছবেন?',
    deleteDesc: (name: string) =>
      `“${name}” আর এর সব খেলোয়াড়, দল ও বিডের ইতিহাস চিরতরে মুছে যাবে। এটা আর ফেরানো যাবে না।`,
    cancel: 'বাতিল',
    deleting: 'মুছে ফেলা হচ্ছে…',
  },
} satisfies Strings<{
  exportLabels: Record<ExportType, string>
  loadingTournament: string
  loadFailed: string
  exported: (type: string) => string
  exportFailed: string
  deleted: string
  deleteFailed: string
  unavailable: string
  unavailableDesc: string
  backToTournaments: string
  bannerAlt: (name: string) => string
  logoAlt: (name: string) => string
  allTournaments: string
  starts: (date: string) => string
  auctionAt: (date: string) => string
  categoryMode: string
  normalMode: string
  edit: string
  moreActions: string
  export: string
  results: string
  auctionHistory: string
  deleteEndFirst: string
  deleteTournament: string
  tabOverview: string
  tabPlayers: string
  tabTeams: string
  tabRegistrations: string
  tabInsights: string
  tabAuction: string
  deleteTitle: string
  deleteDesc: (name: string) => string
  cancel: string
  deleting: string
}>

/**
 * Same shape as the loaded page (header, tabs, stat cards) so nothing jumps when
 * data arrives. Coming from the tournaments list, the name is already known.
 */
function TournamentDetailSkeleton({ tournamentId }: { tournamentId: string }) {
  const s = useStrings(STRINGS)
  const summary = peekCached<{ tournaments: TournamentSummary[] }>(TOURNAMENTS_URL)?.tournaments.find(
    (t) => t.id === tournamentId
  )
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8" aria-busy="true" aria-label={s.loadingTournament}>
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
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}

export default function TournamentDetail({ tournamentId }: { tournamentId: string }) {
  const lang = useLang()
  const s = useStrings(STRINGS)
  const { data, loading, refetch } = useCachedGet<TournamentDetailDTO>(tournamentDetailUrl(tournamentId), (ex) =>
    toast.error(ex instanceof ApiError ? ex.message : s.loadFailed)
  )
  // Called after every save on this page: the list's counts / name / status
  // may have changed too, so its cached copy must not be shown again.
  const load = useCallback(async () => {
    invalidateCached(TOURNAMENTS_URL)
    await refetch()
  }, [refetch])
  const [tab, setTab] = useState<DetailTab>('overview')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const downloadExport = async (type: ExportType) => {
    if (!data) return
    try {
      await apiDownload(`/api/tournaments/${tournamentId}/export?type=${type}`, `${slugify(data.tournament.name)}-${type}.csv`)
      toast.success(s.exported(lang === 'en' ? type : s.exportLabels[type]))
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.exportFailed)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await apiDelete(`/api/tournaments/${tournamentId}`)
      invalidateCached(TOURNAMENTS_URL, tournamentDetailUrl(tournamentId))
      toast.success(s.deleted)
      navigate('/tournaments')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.deleteFailed)
      setDeleting(false)
    }
  }

  if (loading) return <TournamentDetailSkeleton tournamentId={tournamentId} />


  if (!data) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold">{s.unavailable}</p>
        <p className="mt-1 text-sm text-muted-foreground">{s.unavailableDesc}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tournaments')}>
          {s.backToTournaments}
        </Button>
      </div>
    )
  }

  const { tournament: t, players, teams, auction } = data
  const step = nextStep(data, lang)

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Banner */}
      {t.bannerUrl ? (
        <div className="mb-4 overflow-hidden rounded-xl border">
          <img src={t.bannerUrl} alt={s.bannerAlt(t.name)} className="h-32 w-full object-cover sm:h-44" />
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
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> {s.allTournaments}
          </Button>
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            {t.logoUrl ? (
              <img src={t.logoUrl} alt={s.logoAlt(t.name)} className="h-9 w-9 rounded-lg border object-cover" />
            ) : null}
            <span className="break-words">{t.name}</span>
            <TournamentStatusBadge status={t.status} />
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{sportLabel(t.sport, lang, t.sportName)}</span>
            {t.tournamentType ? <span>{t.tournamentType}</span> : null}
            {t.location ? <span>{t.location}</span> : null}
            <span>{s.starts(formatDate(t.startDate))}</span>
            <span>{s.auctionAt(formatDate(t.auctionAt, true))}</span>
            <Badge variant="secondary" className="text-xs">
              {t.auctionMode === 'CATEGORY' ? s.categoryMode : s.normalMode}
            </Badge>
          </div>
          {t.description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.description}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button className="min-h-10 font-semibold" onClick={() => goTo(step, setTab)}>
            {step.live ? (
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-amber-300" aria-hidden />
            ) : (
              <step.icon className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            {step.label}
          </Button>
          <Button variant="outline" className="min-h-10" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden /> {s.edit}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10" aria-label={s.moreActions}>
                <MoreVertical className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download className="mr-2 h-4 w-4" /> {s.export}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {EXPORT_TYPES.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => void downloadExport(type)}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> {s.exportLabels[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => navigate(`/results/${tournamentId}`)}>
                <Trophy className="mr-2 h-4 w-4" /> {s.results}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/tournaments/${tournamentId}/history`)}>
                <History className="mr-2 h-4 w-4" /> {s.auctionHistory}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* The server refuses while the auction runs — say so instead of failing. */}
              <DropdownMenuItem
                variant="destructive"
                disabled={auction?.status === 'LIVE' || auction?.status === 'PAUSED'}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {auction?.status === 'LIVE' || auction?.status === 'PAUSED' ? s.deleteEndFirst : s.deleteTournament}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-0 sm:w-auto">
          <TabsTrigger value="overview" className="min-h-11">{s.tabOverview}</TabsTrigger>
          <TabsTrigger value="players" className="min-h-11">
            {s.tabPlayers} <span className="ml-1 text-xs text-muted-foreground">({players.length})</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="min-h-11">
            {s.tabTeams} <span className="ml-1 text-xs text-muted-foreground">({teams.length})</span>
          </TabsTrigger>
          <TabsTrigger value="registrations" className="min-h-11">{s.tabRegistrations}</TabsTrigger>
          <TabsTrigger value="insights" className="min-h-11">{s.tabInsights}</TabsTrigger>
          <TabsTrigger value="auction" className="min-h-11">
            {s.tabAuction}
            {auction ? (
              <span className="ml-1.5 flex h-2 w-2">
                <span className={`h-2 w-2 rounded-full ${auction.status === 'LIVE' ? 'bg-amber-500' : 'bg-teal-500'}`} />
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ---------------- OVERVIEW ---------------- */}
        <TabsContent value="overview" className="mt-4">
          <TournamentOverview data={data} setTab={setTab} />
        </TabsContent>

        {/* ---------------- PLAYERS ---------------- */}
        <TabsContent value="players" className="mt-4">
          <PlayersTab
            tournamentId={tournamentId}
            sport={t.sport}
            playerRoles={t.playerRoles}
            auctionMode={t.auctionMode}
            basePrice={t.basePrice}
            players={players}
            refetch={load}
            loading={loading}
          />
        </TabsContent>

        {/* ---------------- TEAMS ---------------- */}
        <TabsContent value="teams" className="mt-4">
          <TeamsTab tournamentId={tournamentId} teams={teams} refetch={load} loading={loading} defaultMaxSquad={t.playersPerTeam} />
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
            <AlertDialogTitle>{s.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{s.deleteDesc(t.name)}</AlertDialogDescription>
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
              {deleting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> {s.deleting}
                </>
              ) : (
                s.deleteTournament
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
