'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  MoreVertical,
  Pencil,
  ShieldCheck,
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
import { LoadError } from '@/components/shared/load-error'
import { AppLink } from '@/components/shared/app-link'
import StaffPanel from '@/components/organizer/staff-panel'
import { PlayersTab } from '@/components/organizer/players-tab'
import { TeamsTab } from '@/components/organizer/teams-tab'
import { AuctionSetupTab } from '@/components/organizer/auction-setup-tab'
import LeagueTab from '@/components/league/league-tab'
import BrandingPanel from '@/components/organizer/branding-panel'
import { RegistrationsTab } from '@/components/organizer/registrations-tab'
import { InsightsTab } from '@/components/organizer/insights-tab'
import { TournamentEditDialog } from '@/components/organizer/tournament-edit-dialog'
import { nextStep, TournamentOverview, type DetailTab } from '@/components/organizer/tournament-overview'
import { apiDelete, apiDownload, ApiError } from '@/lib/api'
import { invalidateCached, peekCached, useCachedGet } from '@/lib/api-cache'
import { TOURNAMENTS_URL, tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { formatDate, slugify } from '@/lib/format'
import {
  sportLabel,
  type TournamentAccess,
  type TournamentDetail as TournamentDetailDTO,
  type TournamentSummary,
} from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { tournamentTypeLabel } from '@/lib/tournament-types'

// CSV export types — these keys go to the API and into the file name.
const EXPORT_TYPES = ['players', 'sold', 'unsold', 'squads', 'bids', 'spending', 'audit'] as const
type ExportType = (typeof EXPORT_TYPES)[number]
/** Exports carrying players' phone numbers — co-organizer and up (the server enforces it too). */
const CONTACT_EXPORTS: readonly ExportType[] = ['players']

/** The page's tabs: the overview checklist's tabs plus staff. Kept in the URL as ?tab=. */
type PageTab = DetailTab | 'league' | 'branding' | 'staff'
const ALL_TABS: readonly PageTab[] = ['overview', 'players', 'teams', 'registrations', 'insights', 'auction', 'league', 'branding', 'staff']
/** Auctioneers (and anyone else read-only) see the tournament, not its setup. */
const READ_ONLY_TABS: readonly PageTab[] = ['overview', 'players', 'insights', 'league', 'staff']
const isPageTab = (v: string | null): v is PageTab => v !== null && (ALL_TABS as readonly string[]).includes(v)

/** What the signed-in user may do here (see TournamentAccess). */
function permissions(access: TournamentAccess | undefined) {
  const owner = access === 'OWNER' || access === 'ADMIN'
  return { owner, manage: owner || access === 'CO_ORGANIZER' }
}

const STRINGS = {
  en: {
    exportLabels: { players: 'Players', sold: 'Sold', unsold: 'Unsold', squads: 'Squads', bids: 'History', spending: 'Spending', audit: 'Audit log' },
    loadingTournament: 'Loading tournament',
    loadFailed: 'Could not load tournament',
    tournamentWhat: 'this tournament',
    exported: (type: string) => `Exported ${type} CSV`,
    exportFailed: 'Export failed',
    deleted: 'Tournament deleted',
    archived: 'Tournament archived — its auction record is kept',
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
    tabStaff: 'Staff',
    tabLeague: 'League',
    tabBranding: 'Branding',
    staffRole: { CO_ORGANIZER: 'Co-organizer', AUCTIONEER: 'Auctioneer' },
    auctioneerNote: 'You are an auctioneer here: you can view this tournament and run its live auction room.',
    openRoom: 'Open auction room',
    deleteTitle: 'Delete tournament?',
    deleteDesc: (name: string) =>
      `“${name}” and all its players, teams and bid history will be permanently removed. This cannot be undone. If its auction has bids, it is archived instead, so the auction record is kept.`,
    cancel: 'Cancel',
    deleting: 'Deleting…',
  },
  bn: {
    exportLabels: { players: 'খেলোয়াড়', sold: 'বিক্রি', unsold: 'অবিক্রিত', squads: 'স্কোয়াড', bids: 'ইতিহাস', spending: 'খরচ', audit: 'অডিট লগ' },
    loadingTournament: 'টুর্নামেন্ট লোড হচ্ছে',
    loadFailed: 'টুর্নামেন্ট লোড করা যায়নি',
    tournamentWhat: 'টুর্নামেন্টটি',
    exported: (type: string) => `${type} CSV এক্সপোর্ট হয়েছে`,
    exportFailed: 'এক্সপোর্ট করা যায়নি',
    deleted: 'টুর্নামেন্ট মুছে ফেলা হয়েছে',
    archived: 'টুর্নামেন্ট আর্কাইভ হয়েছে — নিলামের রেকর্ড রাখা আছে',
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
    tabStaff: 'স্টাফ',
    tabLeague: 'লিগ',
    tabBranding: 'ব্র্যান্ডিং',
    staffRole: { CO_ORGANIZER: 'সহ-আয়োজক', AUCTIONEER: 'নিলামকারী' },
    auctioneerNote: 'এখানে আপনি নিলামকারী: টুর্নামেন্টটি দেখতে পারবেন আর লাইভ নিলাম রুম চালাতে পারবেন।',
    openRoom: 'নিলাম রুম খুলুন',
    deleteTitle: 'টুর্নামেন্ট মুছবেন?',
    deleteDesc: (name: string) =>
      `“${name}” আর এর সব খেলোয়াড়, দল ও বিডের ইতিহাস চিরতরে মুছে যাবে। এটা আর ফেরানো যাবে না। নিলামে বিড হয়ে থাকলে এটা মুছে না গিয়ে আর্কাইভ হবে, যাতে নিলামের রেকর্ড থেকে যায়।`,
    cancel: 'বাতিল',
    deleting: 'মুছে ফেলা হচ্ছে…',
  },
} satisfies Strings<{
  exportLabels: Record<ExportType, string>
  loadingTournament: string
  loadFailed: string
  tournamentWhat: string
  exported: (type: string) => string
  exportFailed: string
  deleted: string
  archived: string
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
  tabStaff: string
  tabLeague: string
  tabBranding: string
  staffRole: { CO_ORGANIZER: string; AUCTIONEER: string }
  auctioneerNote: string
  openRoom: string
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
  const { data, loading, error, refetch } = useCachedGet<TournamentDetailDTO>(tournamentDetailUrl(tournamentId), (ex) =>
    toast.error(ex instanceof ApiError ? ex.message : s.loadFailed)
  )
  // Called after every save on this page: the list's counts / name / status
  // may have changed too, so its cached copy must not be shown again.
  const load = useCallback(async () => {
    invalidateCached(TOURNAMENTS_URL)
    await refetch()
  }, [refetch])
  const [tab, setTabState] = useState<PageTab>('overview')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // The open tab lives in the URL (?tab=players) so refresh, back and shared
  // links keep it. Read after mount: the server render can't see the query.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab')
    setTabState(isPageTab(fromUrl) ? fromUrl : 'overview')
  }, [tournamentId])

  const setTab = useCallback((next: PageTab) => {
    setTabState(next)
    const url = new URL(window.location.href)
    if (next === 'overview') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])

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
      const res = await apiDelete<{ archived?: boolean }>(`/api/tournaments/${tournamentId}`)
      invalidateCached(TOURNAMENTS_URL, tournamentDetailUrl(tournamentId))
      toast.success(res?.archived ? s.archived : s.deleted)
      navigate('/tournaments')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.deleteFailed)
      setDeleting(false)
    }
  }

  // On phones the tab bar scrolls sideways; keep the open tab in view when it
  // changes from elsewhere (checklist links, ?tab= in the URL). Only the bar
  // scrolls — never the page.
  useEffect(() => {
    const active = document.querySelector<HTMLElement>('#tournament-tabs [role="tab"][data-state="active"]')
    const list = active?.parentElement
    if (!active || !list || list.scrollWidth <= list.clientWidth) return
    const left = active.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + active.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' })
    }
  }, [tab, loading])

  if (loading) return <TournamentDetailSkeleton tournamentId={tournamentId} />

  // Deleted or not yours can't be fixed by retrying; a network or server error can.
  if (!data && error && !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status))) {
    return (
      <div className="container mx-auto max-w-lg space-y-4 px-4 py-16">
        <LoadError what={s.tournamentWhat} error={error} onRetry={refetch} />
        <div className="text-center">
          <Button variant="ghost" asChild>
            <AppLink href="/tournaments">
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> {s.backToTournaments}
            </AppLink>
          </Button>
        </div>
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

  const { tournament: t, players, teams, auction, myAccess } = data
  const can = permissions(myAccess)
  const tabs = can.manage ? ALL_TABS : READ_ONLY_TABS
  // A tab from the URL (or a checklist link) this user can't open shows the overview.
  const activeTab: PageTab = tabs.includes(tab) ? tab : 'overview'
  const openTab = (next: PageTab) => setTab(tabs.includes(next) ? next : 'overview')
  const exportTypes = can.manage ? EXPORT_TYPES : EXPORT_TYPES.filter((x) => !CONTACT_EXPORTS.includes(x))

  // Read-only staff never get a setup step; they get the room (or results) instead.
  const fullStep = nextStep(data, lang)
  const step =
    can.manage || fullStep.href
      ? fullStep
      : auction
        ? { ...fullStep, label: s.openRoom, href: `/room/${auction.roomCode}`, tab: undefined }
        : null
  const staffRole = myAccess === 'CO_ORGANIZER' || myAccess === 'AUCTIONEER' ? myAccess : null

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
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 text-muted-foreground" asChild>
            <AppLink href="/tournaments">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> {s.allTournaments}
            </AppLink>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            {t.logoUrl ? (
              <img src={t.logoUrl} alt={s.logoAlt(t.name)} className="h-9 w-9 rounded-lg border object-cover" />
            ) : null}
            <span className="break-words">{t.name}</span>
            <TournamentStatusBadge status={t.status} />
            {staffRole ? (
              <Badge variant="outline" className="gap-1 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {s.staffRole[staffRole]}
              </Badge>
            ) : null}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{sportLabel(t.sport, lang, t.sportName)}</span>
            {t.tournamentType ? <span>{tournamentTypeLabel(t.tournamentType, lang)}</span> : null}
            {t.location ? <span>{t.location}</span> : null}
            <span>{s.starts(formatDate(t.startDate, false, lang))}</span>
            <span>{s.auctionAt(formatDate(t.auctionAt, true, lang))}</span>
            <Badge variant="secondary" className="text-xs">
              {t.auctionMode === 'CATEGORY' ? s.categoryMode : s.normalMode}
            </Badge>
          </div>
          {t.description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.description}</p> : null}
          {!can.manage ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{s.auctioneerNote}</p> : null}
        </div>

        {/* Phones: the next step gets its own full-width row, Edit and ⋯ share the next. */}
        <div className="flex shrink-0 flex-wrap gap-2 max-sm:[&>*:first-child]:w-full max-sm:[&>*:not(:first-child):not(:last-child)]:flex-1">
          {step ? (
            step.href ? (
              <Button className="min-h-10 font-semibold" asChild>
                <AppLink href={step.href}>
                  {step.live ? (
                    <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-amber-300 dark:bg-amber-600" aria-hidden />
                  ) : (
                    <step.icon className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  {step.label}
                </AppLink>
              </Button>
            ) : (
              <Button className="min-h-10 font-semibold" onClick={() => step.tab && openTab(step.tab)}>
                <step.icon className="mr-1.5 h-4 w-4" aria-hidden />
                {step.label}
              </Button>
            )
          ) : null}
          {can.manage ? (
            <Button variant="outline" className="min-h-10" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden /> {s.edit}
            </Button>
          ) : null}
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
                  {exportTypes.map((type) => (
                    <DropdownMenuItem key={type} onClick={() => void downloadExport(type)}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> {s.exportLabels[type]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <AppLink href={`/results/${tournamentId}`}>
                  <Trophy className="mr-2 h-4 w-4" /> {s.results}
                </AppLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <AppLink href={`/tournaments/${tournamentId}/history`}>
                  <History className="mr-2 h-4 w-4" /> {s.auctionHistory}
                </AppLink>
              </DropdownMenuItem>
              {can.owner ? (
                <>
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
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs id="tournament-tabs" value={activeTab} onValueChange={(v) => openTab(v as PageTab)} className="mt-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:flex-wrap sm:overflow-visible gap-0">
          <TabsTrigger value="overview" className="min-h-11">{s.tabOverview}</TabsTrigger>
          <TabsTrigger value="players" className="min-h-11">
            {s.tabPlayers} <span className="ml-1 text-xs text-muted-foreground">({players.length})</span>
          </TabsTrigger>
          {can.manage ? (
            <>
              <TabsTrigger value="teams" className="min-h-11">
                {s.tabTeams} <span className="ml-1 text-xs text-muted-foreground">({teams.length})</span>
              </TabsTrigger>
              <TabsTrigger value="registrations" className="min-h-11">{s.tabRegistrations}</TabsTrigger>
            </>
          ) : null}
          <TabsTrigger value="insights" className="min-h-11">{s.tabInsights}</TabsTrigger>
          {can.manage ? (
            <TabsTrigger value="auction" className="min-h-11">
              {s.tabAuction}
              {auction ? (
                <span className="ml-1.5 flex h-2 w-2">
                  <span className={`h-2 w-2 rounded-full ${auction.status === 'LIVE' ? 'bg-amber-500' : 'bg-teal-500'}`} />
                </span>
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="league" className="min-h-11">{s.tabLeague}</TabsTrigger>
          {can.manage ? <TabsTrigger value="branding" className="min-h-11">{s.tabBranding}</TabsTrigger> : null}
          <TabsTrigger value="staff" className="min-h-11">{s.tabStaff}</TabsTrigger>
        </TabsList>

        {/* ---------------- OVERVIEW ---------------- */}
        <TabsContent value="overview" className="mt-4">
          <TournamentOverview data={data} setTab={openTab} />
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
            readOnly={!can.manage}
            plan={t.plan}
            canUpgrade={can.owner}
          />
        </TabsContent>

        {can.manage ? (
          <>
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
                canEditPayout={myAccess === 'OWNER' || myAccess === 'ADMIN'}
                onPlayersChanged={load}
              />
            </TabsContent>
          </>
        ) : null}

        {/* ---------------- INSIGHTS ---------------- */}
        <TabsContent value="insights" className="mt-4">
          {activeTab === 'insights' ? <InsightsTab tournamentId={tournamentId} /> : null}
        </TabsContent>

        {/* ---------------- AUCTION SETUP ---------------- */}
        {can.manage ? (
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
              sms={{ plan: t.plan, smsEnabled: t.smsEnabled, smsLang: t.smsLang }}
            />
          </TabsContent>
        ) : null}

        {/* ---------------- LEAGUE ---------------- */}
        <TabsContent value="league" className="mt-4">
          {activeTab === 'league' ? <LeagueTab data={data} canEdit={can.manage} /> : null}
        </TabsContent>

        {/* ---------------- BRANDING & SPONSORS ---------------- */}
        {can.manage ? (
          <TabsContent value="branding" className="mt-4">
            {activeTab === 'branding' ? <BrandingPanel data={data} canEdit={can.manage} refetch={load} /> : null}
          </TabsContent>
        ) : null}

        {/* ---------------- STAFF ---------------- */}
        <TabsContent value="staff" className="mt-4">
          {activeTab === 'staff' ? <StaffPanel tournamentId={tournamentId} canEdit={can.owner} /> : null}
        </TabsContent>
      </Tabs>

      <Separator className="mt-8" />

      {/* Edit details — remounted per open so the form always starts from fresh data */}
      {editOpen && can.manage ? (
        <TournamentEditDialog
          tournament={t}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={load}
        />
      ) : null}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen && can.owner} onOpenChange={setDeleteOpen}>
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
