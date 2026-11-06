'use client'

import { useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  DoorOpen,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Megaphone,
  Radio,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { api, apiPatch, ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { LoadError } from '@/components/shared/load-error'
import { useAppStore } from '@/lib/store'
import { navigate } from '@/lib/router'
import { formatAuctionWhen, formatBDT, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isLive, plural, tournamentPhase, type TournamentPhase } from '@/lib/tournament-status'
import { sportLabel, type AdminStats, type SafeUser, type TournamentSummary, type UserRole } from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'

type AdminUser = SafeUser & { tournamentCount: number }
type AdminTournament = TournamentSummary & { organizerName?: string }

// One request per list, shared by every tab through the cache.
const STATS_URL = '/api/admin/stats'
const USERS_URL = '/api/admin/users'
const TOURNAMENTS_URL = '/api/admin/tournaments'
const SETTINGS_URL = '/api/admin/settings'

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-teal-100 text-teal-900 border-teal-300',
  ORGANIZER: 'bg-amber-100 text-amber-900 border-amber-300',
  MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const STRINGS = {
  en: {
    couldNotLoad: (what) => `Could not load ${what}`,
    whatUsers: 'users',
    whatTournaments: 'tournaments',
    whatStats: 'platform numbers',
    whatSettings: 'settings',
    title: 'Admin console',
    subtitle: 'Everyone and every auction on NeelamGhor.',
    tabOverview: 'Overview',
    tabUsers: 'Users',
    tabTournaments: 'Tournaments',
    tabSettings: 'Settings',
    statUsers: 'Users',
    statUsersHint: (organizers, managers) => `${plural(organizers, 'organizer')} · ${plural(managers, 'manager')}`,
    statTournaments: 'Tournaments',
    statTournamentsHint: (live) => plural(live, 'live auction'),
    statPlayers: 'Players',
    statPlayersHint: 'across all tournaments',
    statBids: 'Bids placed',
    statBidsHint: 'all time',
    statSold: 'Sold for',
    statSoldHint: 'total auction value',
    bannerShowing: 'Everyone sees this banner: ',
    noBanner: 'No announcement banner is showing.',
    editBanner: 'Edit banner',
    addBanner: 'Add a banner',
    liveNow: 'Live now',
    noLive: 'No auctions are running right now.',
    soldMeta: (sold, total, organizer) => `${sold}/${total} sold · ${organizer}`,
    comingUp: 'Coming up',
    noUpcoming: 'No rooms are open and no auctions are scheduled.',
    wasDue: (when) => `Was due ${when}`,
    roomOpenNoTime: 'Room open · no time set',
    recentSignups: 'Recent sign-ups',
    allUsers: 'All users',
    noSignups: 'Nobody has signed up yet.',
    blockedSuffix: ' · blocked',
    role: { ADMIN: 'admin', ORGANIZER: 'organizer', MANAGER: 'manager' },
    watch: 'Watch',
    room: 'Room',
    searchUsers: 'Search name, email or phone',
    filterUsers: 'Filter users',
    all: 'All',
    organizers: 'Organizers',
    managers: 'Managers',
    admins: 'Admins',
    blocked: 'Blocked',
    noUsersMatch: 'No users match',
    tryAnother: 'Try another search or filter.',
    colUser: 'User',
    colPhone: 'Phone',
    colRole: 'Role',
    colStatus: 'Status',
    colJoined: 'Joined',
    colTournaments: 'Tournaments',
    colActions: 'Actions',
    you: '(you)',
    active: 'Active',
    adminProtected: 'Admin accounts can’t be blocked',
    protectedLabel: 'Protected',
    block: 'Block',
    unblock: 'Unblock',
    userBlocked: (name) => `${name} is blocked`,
    userUnblocked: (name) => `${name} is unblocked`,
    couldNotUpdateUser: 'Could not update user',
    blockQuestion: (name) => `Block ${name}?`,
    unblockQuestion: (name) => `Unblock ${name}?`,
    blockDesc: 'They won’t be able to log in or use NeelamGhor until you unblock them.',
    unblockDesc: 'They get full access to their account again.',
    cancel: 'Cancel',
    blockUser: 'Block user',
    unblockUser: 'Unblock user',
    searchTournaments: 'Search name, organizer or room code',
    filterTournaments: 'Filter tournaments',
    live: 'Live',
    ready: 'Ready',
    draft: 'Draft',
    completed: 'Completed',
    noTournamentsYet: 'No tournaments yet',
    noTournamentsMatch: 'No tournaments match',
    tournamentsAppear: 'Tournaments appear here as soon as an organizer creates one.',
    colTournament: 'Tournament',
    colOrganizer: 'Organizer',
    colSport: 'Sport',
    colSold: 'Sold',
    colTeams: 'Teams',
    colRoom: 'Room',
    results: 'Results',
    soldOf: (sold, total) => `${sold}/${total} sold`,
    teamCount: (n) => plural(n, 'team'),
    settingsSaved: 'Settings saved',
    couldNotSave: 'Could not save settings',
    announcementBanner: 'Announcement banner',
    announcementHelp: 'Shown at the top of every page, to everyone. Leave it empty to hide the banner.',
    announcementText: 'Announcement text',
    announcementPlaceholder: 'e.g. The auction service is down for maintenance on Friday from 2–3 am.',
    preview: 'Preview',
    noBannerPreview: 'No banner — nothing shows above the pages.',
    platformDetails: 'Platform details',
    fieldLabel: { siteName: 'Platform name', supportPhone: 'Support phone' },
    discard: 'Discard changes',
    save: 'Save settings',
    allSaved: 'All changes saved',
  },
  bn: {
    couldNotLoad: (what) => `${what} লোড করা যায়নি`,
    whatUsers: 'ব্যবহারকারীর তালিকা',
    whatTournaments: 'টুর্নামেন্টের তালিকা',
    whatStats: 'প্ল্যাটফর্মের পরিসংখ্যান',
    whatSettings: 'সেটিংস',
    title: 'অ্যাডমিন কনসোল',
    subtitle: 'NeelamGhor-এর সব ব্যবহারকারী আর সব নিলাম, এক জায়গায়।',
    tabOverview: 'ওভারভিউ',
    tabUsers: 'ব্যবহারকারী',
    tabTournaments: 'টুর্নামেন্ট',
    tabSettings: 'সেটিংস',
    statUsers: 'ব্যবহারকারী',
    statUsersHint: (organizers, managers) => `${organizers} জন আয়োজক · ${managers} জন ম্যানেজার`,
    statTournaments: 'টুর্নামেন্ট',
    statTournamentsHint: (live) => `${live}টি লাইভ নিলাম`,
    statPlayers: 'খেলোয়াড়',
    statPlayersHint: 'সব টুর্নামেন্ট মিলিয়ে',
    statBids: 'মোট বিড',
    statBidsHint: 'শুরু থেকে এ পর্যন্ত',
    statSold: 'মোট বিক্রি',
    statSoldHint: 'নিলামের মোট মূল্য',
    bannerShowing: 'সবাই এই ব্যানারটি দেখছে: ',
    noBanner: 'এখন কোনো ঘোষণার ব্যানার দেখানো হচ্ছে না।',
    editBanner: 'ব্যানার এডিট করুন',
    addBanner: 'ব্যানার যোগ করুন',
    liveNow: 'এখন লাইভ',
    noLive: 'এই মুহূর্তে কোনো নিলাম চলছে না।',
    soldMeta: (sold, total, organizer) => `${sold}/${total} বিক্রি · ${organizer}`,
    comingUp: 'সামনে আসছে',
    noUpcoming: 'কোনো রুম খোলা নেই, কোনো নিলামের সময়ও ঠিক হয়নি।',
    wasDue: (when) => `হওয়ার কথা ছিল ${when}`,
    roomOpenNoTime: 'রুম খোলা · সময় ঠিক হয়নি',
    recentSignups: 'নতুন সাইন-আপ',
    allUsers: 'সব ব্যবহারকারী',
    noSignups: 'এখনো কেউ সাইন আপ করেনি।',
    blockedSuffix: ' · ব্লকড',
    role: { ADMIN: 'অ্যাডমিন', ORGANIZER: 'আয়োজক', MANAGER: 'ম্যানেজার' },
    watch: 'দেখুন',
    room: 'রুম',
    searchUsers: 'নাম, ইমেইল বা ফোন দিয়ে খুঁজুন',
    filterUsers: 'ব্যবহারকারী ফিল্টার',
    all: 'সব',
    organizers: 'আয়োজক',
    managers: 'ম্যানেজার',
    admins: 'অ্যাডমিন',
    blocked: 'ব্লকড',
    noUsersMatch: 'কোনো ব্যবহারকারী মেলেনি',
    tryAnother: 'অন্য কিছু লিখে বা অন্য ফিল্টার দিয়ে দেখুন।',
    colUser: 'ব্যবহারকারী',
    colPhone: 'ফোন',
    colRole: 'ভূমিকা',
    colStatus: 'স্ট্যাটাস',
    colJoined: 'যোগদান',
    colTournaments: 'টুর্নামেন্ট',
    colActions: 'অ্যাকশন',
    you: '(আপনি)',
    active: 'সক্রিয়',
    adminProtected: 'অ্যাডমিন অ্যাকাউন্ট ব্লক করা যায় না',
    protectedLabel: 'সুরক্ষিত',
    block: 'ব্লক',
    unblock: 'আনব্লক',
    userBlocked: (name) => `${name}-কে ব্লক করা হয়েছে`,
    userUnblocked: (name) => `${name}-কে আনব্লক করা হয়েছে`,
    couldNotUpdateUser: 'ব্যবহারকারী আপডেট করা যায়নি',
    blockQuestion: (name) => `${name}-কে ব্লক করবেন?`,
    unblockQuestion: (name) => `${name}-কে আনব্লক করবেন?`,
    blockDesc: 'আনব্লক না করা পর্যন্ত তিনি লগইন বা NeelamGhor ব্যবহার করতে পারবেন না।',
    unblockDesc: 'তিনি আবার নিজের অ্যাকাউন্টে পুরো অ্যাক্সেস পাবেন।',
    cancel: 'বাতিল',
    blockUser: 'ব্যবহারকারী ব্লক করুন',
    unblockUser: 'ব্যবহারকারী আনব্লক করুন',
    searchTournaments: 'নাম, আয়োজক বা রুম কোড দিয়ে খুঁজুন',
    filterTournaments: 'টুর্নামেন্ট ফিল্টার',
    live: 'লাইভ',
    ready: 'প্রস্তুত',
    draft: 'খসড়া',
    completed: 'সম্পন্ন',
    noTournamentsYet: 'এখনো কোনো টুর্নামেন্ট নেই',
    noTournamentsMatch: 'কোনো টুর্নামেন্ট মেলেনি',
    tournamentsAppear: 'কোনো আয়োজক টুর্নামেন্ট তৈরি করলেই এখানে দেখা যাবে।',
    colTournament: 'টুর্নামেন্ট',
    colOrganizer: 'আয়োজক',
    colSport: 'খেলা',
    colSold: 'বিক্রি',
    colTeams: 'দল',
    colRoom: 'রুম',
    results: 'ফলাফল',
    soldOf: (sold, total) => `${sold}/${total} বিক্রি`,
    teamCount: (n) => `${n}টি দল`,
    settingsSaved: 'সেটিংস সেভ হয়েছে',
    couldNotSave: 'সেটিংস সেভ করা যায়নি',
    announcementBanner: 'ঘোষণার ব্যানার',
    announcementHelp: 'প্রতিটি পেজের ওপরে সবাই দেখবে। ব্যানার লুকাতে ঘরটি খালি রাখুন।',
    announcementText: 'ঘোষণার লেখা',
    announcementPlaceholder: 'যেমন: রক্ষণাবেক্ষণের জন্য শুক্রবার রাত 2–3টা নিলাম সার্ভিস বন্ধ থাকবে।',
    preview: 'প্রিভিউ',
    noBannerPreview: 'কোনো ব্যানার নেই — পেজের ওপরে কিছুই দেখাবে না।',
    platformDetails: 'প্ল্যাটফর্মের তথ্য',
    fieldLabel: { siteName: 'প্ল্যাটফর্মের নাম', supportPhone: 'সাপোর্ট ফোন' },
    discard: 'পরিবর্তন বাদ দিন',
    save: 'সেটিংস সেভ করুন',
    allSaved: 'সব পরিবর্তন সেভ হয়েছে',
  },
} satisfies Strings<{
  couldNotLoad: (what: string) => string
  whatUsers: string
  whatTournaments: string
  whatStats: string
  whatSettings: string
  title: string
  subtitle: string
  tabOverview: string
  tabUsers: string
  tabTournaments: string
  tabSettings: string
  statUsers: string
  statUsersHint: (organizers: number, managers: number) => string
  statTournaments: string
  statTournamentsHint: (live: number) => string
  statPlayers: string
  statPlayersHint: string
  statBids: string
  statBidsHint: string
  statSold: string
  statSoldHint: string
  bannerShowing: string
  noBanner: string
  editBanner: string
  addBanner: string
  liveNow: string
  noLive: string
  soldMeta: (sold: number, total: number, organizer: string) => string
  comingUp: string
  noUpcoming: string
  wasDue: (when: string) => string
  roomOpenNoTime: string
  recentSignups: string
  allUsers: string
  noSignups: string
  blockedSuffix: string
  role: Record<UserRole, string>
  watch: string
  room: string
  searchUsers: string
  filterUsers: string
  all: string
  organizers: string
  managers: string
  admins: string
  blocked: string
  noUsersMatch: string
  tryAnother: string
  colUser: string
  colPhone: string
  colRole: string
  colStatus: string
  colJoined: string
  colTournaments: string
  colActions: string
  you: string
  active: string
  adminProtected: string
  protectedLabel: string
  block: string
  unblock: string
  userBlocked: (name: string) => string
  userUnblocked: (name: string) => string
  couldNotUpdateUser: string
  blockQuestion: (name?: string) => string
  unblockQuestion: (name?: string) => string
  blockDesc: string
  unblockDesc: string
  cancel: string
  blockUser: string
  unblockUser: string
  searchTournaments: string
  filterTournaments: string
  live: string
  ready: string
  draft: string
  completed: string
  noTournamentsYet: string
  noTournamentsMatch: string
  tournamentsAppear: string
  colTournament: string
  colOrganizer: string
  colSport: string
  colSold: string
  colTeams: string
  colRoom: string
  results: string
  soldOf: (sold: number, total: number) => string
  teamCount: (n: number) => string
  settingsSaved: string
  couldNotSave: string
  announcementBanner: string
  announcementHelp: string
  announcementText: string
  announcementPlaceholder: string
  preview: string
  noBannerPreview: string
  platformDetails: string
  fieldLabel: Record<'siteName' | 'supportPhone', string>
  discard: string
  save: string
  allSaved: string
}>

/** Toast for a failed list load; `fallback` is the translated "Could not load …" text. */
const loadError = (fallback: string) => (ex: unknown) =>
  toast.error(ex instanceof ApiError ? ex.message : fallback)

export default function AdminView() {
  const t = useStrings(STRINGS)
  const [tab, setTab] = useState('overview')
  const users = useCachedGet<{ users: AdminUser[] }>(USERS_URL, loadError(t.couldNotLoad(t.whatUsers)))
  const tournaments = useCachedGet<{ tournaments: AdminTournament[] }>(TOURNAMENTS_URL, loadError(t.couldNotLoad(t.whatTournaments)))

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> {t.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="overview" className="min-h-11">{t.tabOverview}</TabsTrigger>
          <TabsTrigger value="users" className="min-h-11">
            {t.tabUsers} {users.data ? <span className="ml-1 text-xs tabular-nums text-muted-foreground">{users.data.users.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="min-h-11">
            {t.tabTournaments}{' '}
            {tournaments.data ? <span className="ml-1 text-xs tabular-nums text-muted-foreground">{tournaments.data.tournaments.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11">{t.tabSettings}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab users={users.data?.users} tournaments={tournaments.data?.tournaments} onOpenTab={setTab} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          {!users.data && users.error ? (
            <LoadError what={t.whatUsers} error={users.error} onRetry={users.refetch} />
          ) : (
            <UsersTab users={users.data?.users} refetch={users.refetch} />
          )}
        </TabsContent>
        <TabsContent value="tournaments" className="mt-4">
          {!tournaments.data && tournaments.error ? (
            <LoadError what={t.whatTournaments} error={tournaments.error} onRetry={tournaments.refetch} />
          ) : (
            <TournamentsTab tournaments={tournaments.data?.tournaments} />
          )}
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          {tab === 'settings' ? <SettingsTab /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** Filter pills with live counts — the same pattern the player pool uses. */
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 pl-9" />
    </div>
  )
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewTab({
  users,
  tournaments,
  onOpenTab,
}: {
  users: AdminUser[] | undefined
  tournaments: AdminTournament[] | undefined
  onOpenTab: (tab: string) => void
}) {
  const t = useStrings(STRINGS)
  const { data: stats } = useCachedGet<AdminStats>(STATS_URL, loadError(t.couldNotLoad(t.whatStats)))
  const { data: settings } = useCachedGet<{ settings: Record<string, string> }>(SETTINGS_URL)
  const announcement = settings?.settings.announcement?.trim()

  const live = (tournaments ?? []).filter(isLive)
  // Ready rooms and scheduled auctions, soonest first.
  const upcoming = (tournaments ?? [])
    .filter((tour) => !isLive(tour) && tour.auctionStatus !== 'ENDED' && tour.status !== 'COMPLETED' && (tour.roomCode || tour.auctionAt))
    .sort((a, b) => (a.auctionAt ?? '9999').localeCompare(b.auctionAt ?? '9999'))
    .slice(0, 5)
  const recent = (users ?? []).slice(0, 6)

  return (
    <div className="space-y-4">
      {/* platform numbers — one strip, no overlapping cards */}
      {stats ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-3 lg:grid-cols-5 [&>div]:border-b [&>div]:border-r">
          {[
            { id: 'users', k: t.statUsers, v: stats.users, hint: t.statUsersHint(stats.organizers, stats.managers) },
            { id: 'tournaments', k: t.statTournaments, v: stats.tournaments, hint: t.statTournamentsHint(stats.liveAuctions) },
            { id: 'players', k: t.statPlayers, v: stats.players, hint: t.statPlayersHint },
            { id: 'bids', k: t.statBids, v: stats.bids, hint: t.statBidsHint },
            { id: 'sold', k: t.statSold, v: formatBDT(stats.totalValue), hint: t.statSoldHint },
          ].map((s) => (
            <div key={s.id} className="-mb-px -mr-px px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">{s.k}</dt>
              <dd className="mt-0.5 truncate text-xl font-bold tabular-nums">{s.v}</dd>
              <dd className="truncate text-xs text-muted-foreground">{s.hint}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton className="h-20 rounded-xl" />
      )}

      {/* announcement status, with the way to change it */}
      {settings ? (
        <div
          className={cn(
            'flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
            announcement ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-dashed text-muted-foreground'
          )}
        >
          <p className="flex min-w-0 items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              {announcement ? (
                <>
                  <span className="font-semibold">{t.bannerShowing}</span>
                  {announcement}
                </>
              ) : (
                t.noBanner
              )}
            </span>
          </p>
          <Button variant="outline" size="sm" className="h-8 shrink-0 bg-background" onClick={() => onOpenTab('settings')}>
            {announcement ? t.editBanner : t.addBanner}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="h-4 w-4 text-amber-600" aria-hidden /> {t.liveNow}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!tournaments ? (
                <ListSkeleton rows={1} />
              ) : live.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t.noLive}</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {live.map((tour) => (
                    <TournamentRow key={tour.id} t={tour} meta={t.soldMeta(tour.soldCount, tour.playerCount, tour.organizerName ?? '—')} live />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{t.comingUp}</CardTitle>
            </CardHeader>
            <CardContent>
              {!tournaments ? (
                <ListSkeleton rows={2} />
              ) : upcoming.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t.noUpcoming}</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {upcoming.map((tour) => {
                    const when = formatAuctionWhen(tour.auctionAt)
                    return (
                      <TournamentRow
                        key={tour.id}
                        t={tour}
                        meta={`${when ? (when.past ? t.wasDue(when.text) : when.text) : t.roomOpenNoTime} · ${tour.organizerName ?? '—'}`}
                      />
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-2">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between text-base">
              {t.recentSignups}
              <Button variant="ghost" size="sm" className="-mr-2 h-8" onClick={() => onOpenTab('users')}>
                {t.allUsers}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!users ? (
              <ListSkeleton rows={4} />
            ) : recent.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t.noSignups}</p>
            ) : (
              <ul className="divide-y">
                {recent.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                        {u.status === 'BLOCKED' ? t.blockedSuffix : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', ROLE_BADGE[u.role])}>
                      {t.role[u.role] ?? u.role.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TournamentRow({ t: tour, meta, live = false }: { t: AdminTournament; meta: string; live?: boolean }) {
  const t = useStrings(STRINGS)
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {live ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" aria-hidden /> : null}
          <span className="truncate">{tour.name}</span>
          {tour.roomCode ? <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">{tour.roomCode}</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {tour.roomCode ? (
        <Button size="sm" variant={live ? 'default' : 'ghost'} className="h-8 shrink-0" onClick={() => navigate(`/room/${tour.roomCode}`)}>
          <DoorOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {live ? t.watch : t.room}
        </Button>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

type RoleFilter = 'ALL' | 'ORGANIZER' | 'MANAGER' | 'ADMIN' | 'BLOCKED'

function UsersTab({ users, refetch }: { users: AdminUser[] | undefined; refetch: () => Promise<void> }) {
  const t = useStrings(STRINGS)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RoleFilter>('ALL')
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [busy, setBusy] = useState(false)
  const me = useAppStore((s) => s.user)

  const all = useMemo(() => users ?? [], [users])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((u) => {
      if (filter === 'BLOCKED' ? u.status !== 'BLOCKED' : filter !== 'ALL' && u.role !== filter) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone ?? '').toLowerCase().includes(q)
    })
  }, [all, query, filter])

  const toggleBlock = async () => {
    if (!target) return
    const next = target.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
    setBusy(true)
    try {
      await apiPatch('/api/admin/users', { userId: target.id, status: next })
      toast.success(next === 'BLOCKED' ? t.userBlocked(target.name) : t.userUnblocked(target.name))
      setTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotUpdateUser)
    } finally {
      setBusy(false)
    }
  }

  if (!users) return <ListSkeleton rows={6} />

  const count = (f: RoleFilter) =>
    f === 'ALL' ? all.length : f === 'BLOCKED' ? all.filter((u) => u.status === 'BLOCKED').length : all.filter((u) => u.role === f).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder={t.searchUsers} />
        <FilterChips
          label={t.filterUsers}
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'ALL', label: t.all, count: count('ALL') },
            { key: 'ORGANIZER', label: t.organizers, count: count('ORGANIZER') },
            { key: 'MANAGER', label: t.managers, count: count('MANAGER') },
            { key: 'ADMIN', label: t.admins, count: count('ADMIN') },
            { key: 'BLOCKED', label: t.blocked, count: count('BLOCKED') },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title={t.noUsersMatch} description={t.tryAnother} />
      ) : (
        // Scrolls with the page; the header sticks under the site header. A plain <table>,
        // because the shared Table's overflow wrapper would stop the header sticking.
        <div className="overflow-x-auto rounded-lg border md:overflow-visible">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
              <TableRow>
                <TableHead>{t.colUser}</TableHead>
                <TableHead className="hidden md:table-cell">{t.colPhone}</TableHead>
                <TableHead>{t.colRole}</TableHead>
                <TableHead className="hidden sm:table-cell">{t.colStatus}</TableHead>
                <TableHead className="hidden lg:table-cell">{t.colJoined}</TableHead>
                <TableHead className="hidden sm:table-cell">{t.colTournaments}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t.colActions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = me?.id === u.id
                return (
                  <TableRow key={u.id} className={cn(u.status === 'BLOCKED' && 'bg-rose-50/40')}>
                    <TableCell className="max-w-56">
                      <p className="truncate font-semibold">
                        {u.name}
                        {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.you}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      {u.status === 'BLOCKED' ? <p className="text-xs font-semibold text-rose-700 sm:hidden">{t.blocked}</p> : null}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{u.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ''}>
                        {t.role[u.role] ?? u.role.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {u.status === 'ACTIVE' ? (
                        <span className="text-sm text-muted-foreground">{t.active}</span>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-800">{t.blocked}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{u.tournamentCount}</TableCell>
                    <TableCell className="text-right">
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={t.adminProtected}>
                          <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> {t.protectedLabel}
                        </span>
                      ) : (
                        <Button
                          variant={u.status === 'ACTIVE' ? 'ghost' : 'outline'}
                          size="sm"
                          className={cn('h-9', u.status === 'ACTIVE' && 'text-rose-600 hover:bg-rose-50 hover:text-rose-700')}
                          disabled={isSelf}
                          onClick={() => setTarget(u)}
                        >
                          {u.status === 'ACTIVE' ? (
                            <>
                              <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.block}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.unblock}
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.status === 'ACTIVE' ? t.blockQuestion(target?.name) : t.unblockQuestion(target?.name)}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.status === 'ACTIVE'
                ? t.blockDesc
                : t.unblockDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className={target?.status === 'ACTIVE' ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void toggleBlock()
              }}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {target?.status === 'ACTIVE' ? t.blockUser : t.unblockUser}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

type TournamentFilter = 'ALL' | TournamentPhase

function TournamentsTab({ tournaments }: { tournaments: AdminTournament[] | undefined }) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TournamentFilter>('ALL')

  const all = useMemo(() => tournaments ?? [], [tournaments])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (tour) =>
        (filter === 'ALL' || tournamentPhase(tour) === filter) &&
        (!q || tour.name.toLowerCase().includes(q) || (tour.organizerName ?? '').toLowerCase().includes(q) || (tour.roomCode ?? '').toLowerCase().includes(q))
    )
  }, [all, query, filter])

  if (!tournaments) return <ListSkeleton rows={5} />

  const count = (f: TournamentFilter) => (f === 'ALL' ? all.length : all.filter((tour) => tournamentPhase(tour) === f).length)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder={t.searchTournaments} />
        <FilterChips
          label={t.filterTournaments}
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'ALL', label: t.all, count: count('ALL') },
            { key: 'LIVE', label: t.live, count: count('LIVE') },
            { key: 'READY', label: t.ready, count: count('READY') },
            { key: 'DRAFT', label: t.draft, count: count('DRAFT') },
            { key: 'COMPLETED', label: t.completed, count: count('COMPLETED') },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={all.length === 0 ? t.noTournamentsYet : t.noTournamentsMatch}
          description={all.length === 0 ? t.tournamentsAppear : t.tryAnother}
        />
      ) : (
        <>
          {/* Desktop table — page scroll, sticky header */}
          <div className="hidden rounded-lg border lg:block">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead>{t.colTournament}</TableHead>
                  <TableHead>{t.colOrganizer}</TableHead>
                  <TableHead>{t.colSport}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead>{t.colSold}</TableHead>
                  <TableHead>{t.colTeams}</TableHead>
                  <TableHead>{t.colRoom}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">{t.colActions}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tour) => (
                  <TableRow key={tour.id}>
                    <TableCell className="max-w-60">
                      <p className="truncate font-semibold">{tour.name}</p>
                      {tour.tournamentType ? <p className="truncate text-xs text-muted-foreground">{tour.tournamentType}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm">{tour.organizerName ?? '—'}</TableCell>
                    <TableCell className="text-sm">{sportLabel(tour.sport, lang, tour.sportName)}</TableCell>
                    <TableCell>
                      <TournamentStatusBadge status={isLive(tour) ? 'LIVE' : tour.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {tour.soldCount}/{tour.playerCount}
                    </TableCell>
                    <TableCell className="tabular-nums">{tour.teamCount}</TableCell>
                    <TableCell className="font-mono text-xs">{tour.roomCode ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => navigate(`/results/${tour.id}`)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.results}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>

          {/* Phone & tablet cards */}
          <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
            {filtered.map((tour) => (
              <Card key={tour.id} className="py-0">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{tour.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tour.organizerName ?? '—'} · {sportLabel(tour.sport, lang, tour.sportName)}
                      </p>
                    </div>
                    <TournamentStatusBadge status={isLive(tour) ? 'LIVE' : tour.status} className="shrink-0" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                    <span>
                      {t.soldOf(tour.soldCount, tour.playerCount)}
                    </span>
                    <span>{t.teamCount(tour.teamCount)}</span>
                    {tour.roomCode ? <span className="font-mono">{tour.roomCode}</span> : null}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 h-9 w-full" onClick={() => navigate(`/results/${tour.id}`)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.results}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const FIELDS = [
  { key: 'siteName', placeholder: 'NeelamGhor', max: 80 },
  { key: 'supportPhone', placeholder: '01XXXXXXXXX', max: 30 },
] as const
const ANNOUNCEMENT_MAX = 300
const FORM_KEYS: readonly string[] = [...FIELDS.map((f) => f.key), 'announcement']

function SettingsTab() {
  const t = useStrings(STRINGS)
  const { data, loading, error, refetch } = useCachedGet<{ settings: Record<string, string> }>(SETTINGS_URL, loadError(t.couldNotLoad(t.whatSettings)))
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)

  if (!data && error) return <LoadError what={t.whatSettings} error={error} onRetry={refetch} />
  if (loading || !data) return <ListSkeleton rows={3} />

  const saved = data.settings
  const values = draft ?? saved
  const set = (key: string, value: string) => setDraft({ ...values, [key]: value })
  const dirty = FORM_KEYS.some((k) => (values[k] ?? '') !== (saved[k] ?? ''))
  // Keys saved by an older version of this page. Nothing reads them, but the
  // API replaces the whole set on save — so send them back untouched.
  const extraKeys = Object.keys(saved).filter((k) => !FORM_KEYS.includes(k))
  const announcement = (values.announcement ?? '').trim()

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      for (const k of extraKeys) payload[k] = saved[k]
      for (const k of FORM_KEYS) {
        const v = (values[k] ?? '').trim()
        if (v) payload[k] = v
      }
      await api(SETTINGS_URL, { method: 'PUT', body: { settings: payload } })
      await refetch()
      setDraft(null)
      toast.success(t.settingsSaved)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotSave)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && !saving) void save()
      }}
    >
      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-amber-600" aria-hidden /> {t.announcementBanner}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.announcementHelp}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-announcement" className="sr-only">
              {t.announcementText}
            </Label>
            <Textarea
              id="set-announcement"
              value={values.announcement ?? ''}
              onChange={(e) => set('announcement', e.target.value)}
              maxLength={ANNOUNCEMENT_MAX}
              rows={2}
              placeholder={t.announcementPlaceholder}
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {(values.announcement ?? '').length}/{ANNOUNCEMENT_MAX}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.preview}</p>
            {announcement ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="flex items-start gap-2">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{announcement}</span>
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">{t.noBannerPreview}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t.platformDetails}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`set-${f.key}`}>{t.fieldLabel[f.key]}</Label>
              <Input
                id={`set-${f.key}`}
                value={values[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                maxLength={f.max}
                placeholder={f.placeholder}
                inputMode={f.key === 'supportPhone' ? 'tel' : undefined}
                className="h-10"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {dirty ? (
          <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={() => setDraft(null)}>
            {t.discard}
          </Button>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
          {dirty ? t.save : t.allSaved}
        </Button>
      </div>
    </form>
  )
}
