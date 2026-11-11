'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Download,
  Gavel,
  LayoutDashboard,
  Loader2,
  LogIn,
  Mail,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCog,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AppLink } from '@/components/shared/app-link'
import { ProfileActions } from '@/components/account/profile-dialogs'
import { Arena } from '@/components/shared/arena'
import { TeamAvatar } from '@/components/shared/avatars'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { api, apiDownload, ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { formatBDT, formatDate, formatNumber } from '@/lib/format'
import { navigate } from '@/lib/router'
import { useAppStore, useAuthState } from '@/lib/store'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import type { SafeUser } from '@/lib/types'
import { cn } from '@/lib/utils'

interface OwnedTournament {
  id: string
  name: string
  status: string
  sport: string
  plan: string
  logoUrl: string | null
  teams: number
  players: number
}

interface ManagedTeam {
  id: string
  name: string
  color: string | null
  logoUrl: string | null
  budget: number
  spent: number
  maxSquad: number
  squad: number
  tournament: { id: string; name: string; status: string }
}

interface StaffSeat {
  role: string
  id: string
  name: string
  status: string
}

interface AccountInfo {
  user: SafeUser
  activeTournaments: OwnedTournament[]
  teams: ManagedTeam[]
  managedTeams: number
  staffRoles: StaffSeat[]
  payments: number
  pendingPayments: number
  platform: { users: number; tournaments: number; live: number; pendingPayments: number } | null
  canDelete: boolean
}

type Role = 'ADMIN' | 'ORGANIZER' | 'MANAGER'

const STRINGS = {
  en: {
    eyebrow: 'My account',
    loginTitle: 'Log in to manage your account',
    loginDesc: 'You need to be logged in to download or delete your data.',
    login: 'Log in',
    what: 'your account',
    roles: { ADMIN: 'Admin', ORGANIZER: 'Organizer', MANAGER: 'Team manager' } as Record<string, string>,
    roleLine: {
      ADMIN: 'You look after the whole platform: people, tournaments and payments.',
      ORGANIZER: 'You run tournaments: players, teams and the live auction room.',
      MANAGER: 'You build a squad for your team and bid in the live room.',
    } as Record<string, string>,
    memberSince: (d: string) => `Member since ${d}`,
    // stat tiles
    statUsers: 'People',
    statTournaments: 'Tournaments',
    statLive: 'Live now',
    statPending: 'Payments to review',
    statActive: 'Active tournaments',
    statTeams: 'Teams in them',
    statPlayers: 'Players listed',
    statManaged: 'Teams managed',
    statSigned: 'Players signed',
    statPurse: 'Purse left',
    // actions
    adminConsole: 'Admin console',
    allTournaments: 'All tournaments',
    dashboard: 'Open dashboard',
    newTournament: 'New tournament',
    myTeams: 'My teams',
    joinRoom: 'Join a room',
    // workspace
    workspace: 'Your workspace',
    queueTitle: 'Needs your attention',
    queuePayments: (n: number) => (n === 0 ? 'No payments waiting for review' : `${n} payment${n === 1 ? '' : 's'} waiting for review`),
    queueLive: (n: number) => (n === 0 ? 'No auctions are live right now' : `${n} auction${n === 1 ? ' is' : 's are'} live right now`),
    queueOpen: 'Open',
    tournamentsTitle: 'Tournaments you run',
    tournamentsEmptyTitle: 'No tournaments yet',
    tournamentsEmptyDesc: 'Create one, add players and teams, then open the auction room.',
    tournamentMeta: (teams: number, players: number) => `${teams} team${teams === 1 ? '' : 's'} · ${players} player${players === 1 ? '' : 's'}`,
    sports: { CRICKET: 'Cricket', FOOTBALL: 'Football', OTHER: 'Other sport' } as Record<string, string>,
    pro: 'Pro',
    teamsTitle: 'Teams you manage',
    teamsEmptyTitle: 'No team yet',
    teamsEmptyDesc: 'Your organizer sends you an invite link. Open it to take charge of a team.',
    squad: (n: number, max: number) => `${n}/${max} players`,
    spentOf: (spent: string, budget: string) => `${spent} of ${budget} spent`,
    moreTeams: (n: number) => `+${n} more on your dashboard`,
    staffTitle: 'Helping run',
    staffRoles: { CO_ORGANIZER: 'Co-organizer', AUCTIONEER: 'Auctioneer' } as Record<string, string>,
    // profile
    profile: 'Profile',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    none: 'Not set',
    role: 'Role',
    joined: 'Joined',
    paymentsMade: 'Payments made',
    paymentsValue: (n: number, pending: number) => (pending > 0 ? `${n} · ${pending} pending` : `${n}`),
    // data
    dataTitle: 'Your data',
    exportTitle: 'Download my data',
    exportDesc:
      'A JSON file with your profile, the tournaments you own (with their teams and players), the teams you manage, your staff roles and your payments.',
    exportBtn: 'Download',
    exportFailed: 'Could not download your data',
    privacyLink: 'Privacy notice',
    // delete
    deleteTitle: 'Delete my account',
    deleteDesc:
      'Your name, email and phone are erased and you are signed out everywhere. Bids and payment records stay for the tournaments’ audit trail, but show “Deleted user”. This cannot be undone.',
    adminNote: 'Admin accounts cannot be deleted here. Ask another admin to remove your admin role first.',
    blocking: 'You still own these tournaments. Delete or archive them first:',
    deleteBtn: 'Delete my account',
    dialogTitle: 'Delete your account?',
    dialogDesc: 'Enter your password to confirm. This cannot be undone.',
    password: 'Password',
    cancel: 'Cancel',
    confirmDelete: 'Delete permanently',
    deleted: 'Your account has been deleted.',
    deleteFailed: 'Could not delete your account',
  },
  bn: {
    eyebrow: 'আমার অ্যাকাউন্ট',
    loginTitle: 'অ্যাকাউন্ট দেখতে লগইন করুন',
    loginDesc: 'আপনার তথ্য ডাউনলোড বা মুছে ফেলতে লগইন থাকতে হবে।',
    login: 'লগইন',
    what: 'আপনার অ্যাকাউন্ট',
    roles: { ADMIN: 'অ্যাডমিন', ORGANIZER: 'আয়োজক', MANAGER: 'টিম ম্যানেজার' } as Record<string, string>,
    roleLine: {
      ADMIN: 'পুরো প্ল্যাটফর্ম আপনার দায়িত্বে: ব্যবহারকারী, টুর্নামেন্ট আর পেমেন্ট।',
      ORGANIZER: 'আপনি টুর্নামেন্ট চালান: খেলোয়াড়, দল আর লাইভ নিলাম রুম।',
      MANAGER: 'আপনি দলের স্কোয়াড গড়েন আর লাইভ রুমে বিড করেন।',
    } as Record<string, string>,
    memberSince: (d: string) => `যোগ দিয়েছেন ${d}`,
    statUsers: 'ব্যবহারকারী',
    statTournaments: 'টুর্নামেন্ট',
    statLive: 'এখন লাইভ',
    statPending: 'যাচাই বাকি পেমেন্ট',
    statActive: 'সক্রিয় টুর্নামেন্ট',
    statTeams: 'মোট দল',
    statPlayers: 'তালিকাভুক্ত খেলোয়াড়',
    statManaged: 'পরিচালিত দল',
    statSigned: 'কেনা খেলোয়াড়',
    statPurse: 'বাকি বাজেট',
    adminConsole: 'অ্যাডমিন কনসোল',
    allTournaments: 'সব টুর্নামেন্ট',
    dashboard: 'ড্যাশবোর্ড খুলুন',
    newTournament: 'নতুন টুর্নামেন্ট',
    myTeams: 'আমার দল',
    joinRoom: 'রুমে যোগ দিন',
    workspace: 'আপনার কাজের জায়গা',
    queueTitle: 'আপনার মনোযোগ দরকার',
    queuePayments: (n: number) => (n === 0 ? 'যাচাইয়ের জন্য কোনো পেমেন্ট নেই' : `${n}টি পেমেন্ট যাচাইয়ের অপেক্ষায়`),
    queueLive: (n: number) => (n === 0 ? 'এখন কোনো নিলাম লাইভ নেই' : `এখন ${n}টি নিলাম লাইভ`),
    queueOpen: 'খুলুন',
    tournamentsTitle: 'আপনার টুর্নামেন্ট',
    tournamentsEmptyTitle: 'এখনো কোনো টুর্নামেন্ট নেই',
    tournamentsEmptyDesc: 'একটি তৈরি করুন, খেলোয়াড় ও দল যোগ করুন, তারপর নিলাম রুম খুলুন।',
    tournamentMeta: (teams: number, players: number) => `${teams}টি দল · ${players} জন খেলোয়াড়`,
    sports: { CRICKET: 'ক্রিকেট', FOOTBALL: 'ফুটবল', OTHER: 'অন্য খেলা' } as Record<string, string>,
    pro: 'প্রো',
    teamsTitle: 'আপনার দল',
    teamsEmptyTitle: 'এখনো কোনো দল নেই',
    teamsEmptyDesc: 'আয়োজক আপনাকে একটি আমন্ত্রণ লিংক পাঠাবেন। সেটি খুললেই দলের দায়িত্ব পাবেন।',
    squad: (n: number, max: number) => `${n}/${max} জন খেলোয়াড়`,
    spentOf: (spent: string, budget: string) => `${budget}-এর মধ্যে ${spent} খরচ`,
    moreTeams: (n: number) => `ড্যাশবোর্ডে আরও ${n}টি`,
    staffTitle: 'যেখানে সাহায্য করছেন',
    staffRoles: { CO_ORGANIZER: 'সহ-আয়োজক', AUCTIONEER: 'নিলামকারী' } as Record<string, string>,
    profile: 'প্রোফাইল',
    name: 'নাম',
    email: 'ইমেইল',
    phone: 'ফোন',
    none: 'দেওয়া নেই',
    role: 'ভূমিকা',
    joined: 'যোগদান',
    paymentsMade: 'পেমেন্ট',
    paymentsValue: (n: number, pending: number) => (pending > 0 ? `${n} · ${pending}টি বাকি` : `${n}`),
    dataTitle: 'আপনার তথ্য',
    exportTitle: 'আমার তথ্য ডাউনলোড',
    exportDesc:
      'একটি JSON ফাইল — আপনার প্রোফাইল, আপনার টুর্নামেন্ট (দল ও খেলোয়াড়সহ), আপনি যে দল পরিচালনা করেন, স্টাফ ভূমিকা ও পেমেন্টের তথ্য।',
    exportBtn: 'ডাউনলোড',
    exportFailed: 'আপনার তথ্য ডাউনলোড করা যায়নি',
    privacyLink: 'গোপনীয়তা নীতি',
    deleteTitle: 'অ্যাকাউন্ট মুছে ফেলুন',
    deleteDesc:
      'আপনার নাম, ইমেইল ও ফোন মুছে ফেলা হবে এবং সব ডিভাইস থেকে লগআউট হয়ে যাবেন। টুর্নামেন্টের হিসাবের জন্য বিড ও পেমেন্টের রেকর্ড থেকে যাবে, তবে সেখানে “Deleted user” দেখাবে। এটি আর ফেরানো যাবে না।',
    adminNote: 'অ্যাডমিন অ্যাকাউন্ট এখান থেকে মোছা যায় না। আগে অন্য একজন অ্যাডমিনকে আপনার অ্যাডমিন ভূমিকা সরাতে বলুন।',
    blocking: 'এই টুর্নামেন্টগুলো এখনো আপনার। আগে এগুলো মুছে ফেলুন বা আর্কাইভ করুন:',
    deleteBtn: 'অ্যাকাউন্ট মুছে ফেলুন',
    dialogTitle: 'অ্যাকাউন্ট মুছে ফেলবেন?',
    dialogDesc: 'নিশ্চিত করতে পাসওয়ার্ড দিন। এটি আর ফেরানো যাবে না।',
    password: 'পাসওয়ার্ড',
    cancel: 'বাতিল',
    confirmDelete: 'স্থায়ীভাবে মুছুন',
    deleted: 'আপনার অ্যাকাউন্ট মুছে ফেলা হয়েছে।',
    deleteFailed: 'অ্যাকাউন্ট মুছে ফেলা যায়নি',
  },
} satisfies Strings<{
  eyebrow: string
  loginTitle: string
  loginDesc: string
  login: string
  what: string
  roles: Record<string, string>
  roleLine: Record<string, string>
  memberSince: (d: string) => string
  statUsers: string
  statTournaments: string
  statLive: string
  statPending: string
  statActive: string
  statTeams: string
  statPlayers: string
  statManaged: string
  statSigned: string
  statPurse: string
  adminConsole: string
  allTournaments: string
  dashboard: string
  newTournament: string
  myTeams: string
  joinRoom: string
  workspace: string
  queueTitle: string
  queuePayments: (n: number) => string
  queueLive: (n: number) => string
  queueOpen: string
  tournamentsTitle: string
  tournamentsEmptyTitle: string
  tournamentsEmptyDesc: string
  tournamentMeta: (teams: number, players: number) => string
  sports: Record<string, string>
  pro: string
  teamsTitle: string
  teamsEmptyTitle: string
  teamsEmptyDesc: string
  squad: (n: number, max: number) => string
  spentOf: (spent: string, budget: string) => string
  moreTeams: (n: number) => string
  staffTitle: string
  staffRoles: Record<string, string>
  profile: string
  name: string
  email: string
  phone: string
  none: string
  role: string
  joined: string
  paymentsMade: string
  paymentsValue: (n: number, pending: number) => string
  dataTitle: string
  exportTitle: string
  exportDesc: string
  exportBtn: string
  exportFailed: string
  privacyLink: string
  deleteTitle: string
  deleteDesc: string
  adminNote: string
  blocking: string
  deleteBtn: string
  dialogTitle: string
  dialogDesc: string
  password: string
  cancel: string
  confirmDelete: string
  deleted: string
  deleteFailed: string
}>

type T = (typeof STRINGS)['en']

// Role identity: an icon and a tone for the badge/monogram. Teal is the brand
// accent; admin gets the amber the app already uses for "live" and attention.
const ROLE_META: Record<Role, { icon: ComponentType<{ className?: string }>; chip: string; mark: string }> = {
  ADMIN: {
    icon: ShieldCheck,
    chip: 'bg-amber-400/10 text-amber-200 ring-amber-300/30',
    mark: 'from-amber-300/90 to-amber-600/90 text-amber-950 shadow-amber-950/40',
  },
  ORGANIZER: {
    icon: Trophy,
    chip: 'bg-teal-400/10 text-teal-200 ring-teal-300/30',
    mark: 'from-teal-300/90 to-teal-700/90 text-teal-950 shadow-teal-950/50',
  },
  MANAGER: {
    icon: Users,
    chip: 'bg-teal-400/10 text-teal-200 ring-teal-300/30',
    mark: 'from-teal-200/90 to-cyan-700/90 text-teal-950 shadow-teal-950/50',
  },
}

const asRole = (role: string): Role => (role === 'ADMIN' || role === 'ORGANIZER' ? role : 'MANAGER')

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

export default function AccountView() {
  const { user, authChecked } = useAuthState()
  const t = useStrings(STRINGS)

  if (!authChecked) return <AccountSkeleton />
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState
          icon={LogIn}
          title={t.loginTitle}
          description={t.loginDesc}
          action={
            <Button className="min-h-10" onClick={() => navigate('/login')}>
              {t.login}
            </Button>
          }
        />
      </div>
    )
  }
  return <AccountDetails key={user.id} />
}

/** Mirrors the real layout so nothing jumps when the data lands. */
function AccountSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:py-8" aria-busy="true">
      <Skeleton className="h-64 rounded-2xl sm:h-56" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function AccountDetails() {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const logout = useAppStore((s) => s.logout)
  const { data, loading, error, refetch } = useCachedGet<AccountInfo>('/api/account')
  const [exporting, setExporting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const download = async () => {
    setExporting(true)
    try {
      await apiDownload('/api/account/export', `neelamghor-my-data-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await api('/api/account', { method: 'DELETE', body: { password } })
      setDialogOpen(false)
      toast.success(t.deleted)
      await logout() // clears local state, cached data and room seats, then navigates to '/'
    } catch (ex) {
      setDeleteError(ex instanceof ApiError ? ex.message : t.deleteFailed)
      // The blocking list may have changed (e.g. a tournament still active).
      if (ex instanceof ApiError && ex.status === 409) void refetch()
    } finally {
      setDeleting(false)
    }
  }

  if (!data) {
    if (error && !loading) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <LoadError what={t.what} error={error} onRetry={refetch} />
        </div>
      )
    }
    return <AccountSkeleton />
  }

  const { user } = data
  const role = asRole(user.role)
  // Older API responses (cached before a deploy) may lack the newer lists.
  const tournaments = data.activeTournaments ?? []
  const teams = data.teams ?? []
  const staff = data.staffRoles ?? []
  const blocked = tournaments.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <IdentityHero data={data} role={role} t={t} lang={lang} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Role workspace */}
        <section aria-labelledby="workspace-heading" className="min-w-0 space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <h2 id="workspace-heading" className="sr-only">
            {t.workspace}
          </h2>

          {role === 'ADMIN' && data.platform ? <AdminQueue platform={data.platform} t={t} /> : null}

          {role === 'ORGANIZER' || tournaments.length > 0 ? <TournamentList items={tournaments} t={t} /> : null}

          {role === 'MANAGER' || teams.length > 0 ? <TeamList items={teams} total={data.managedTeams} t={t} /> : null}

          {staff.length > 0 ? <StaffList items={staff} t={t} /> : null}
        </section>

        {/* Profile, data and leaving */}
        <aside className="min-w-0 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-delay:80ms] motion-safe:[animation-fill-mode:both]">
          <Panel title={t.profile} icon={UserCog}>
            <dl className="-my-1 divide-y divide-border/70">
              <Field icon={BadgeCheck} label={t.name} value={user.name} />
              <Field icon={Mail} label={t.email} value={user.email} />
              <Field icon={Phone} label={t.phone} value={user.phone || t.none} muted={!user.phone} mono={!!user.phone} />
              <Field icon={CalendarDays} label={t.joined} value={formatDate(user.createdAt, false, lang)} />
              <Field icon={Receipt} label={t.paymentsMade} value={t.paymentsValue(data.payments, data.pendingPayments ?? 0)} mono />
            </dl>
            <ProfileActions user={user} onSaved={() => void refetch()} />
          </Panel>

          <Panel title={t.dataTitle} icon={Download}>
            <p className="text-sm font-semibold">{t.exportTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{t.exportDesc}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                variant="outline"
                className="min-h-10 transition-transform active:scale-[0.98]"
                disabled={exporting}
                onClick={() => void download()}
              >
                {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
                {t.exportBtn}
              </Button>
              <AppLink
                href="/privacy"
                className="-my-1 inline-flex items-center gap-1 rounded-sm py-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden /> {t.privacyLink}
              </AppLink>
            </div>
          </Panel>

          <section
            aria-labelledby="delete-heading"
            className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-5 dark:border-rose-900/50 dark:bg-rose-950/15"
          >
            <h3 id="delete-heading" className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
              <Trash2 className="h-4 w-4" aria-hidden /> {t.deleteTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{t.deleteDesc}</p>
            {!data.canDelete ? (
              <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {t.adminNote}
              </p>
            ) : blocked ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p>{t.blocking}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {tournaments.map((tn) => (
                    <li key={tn.id}>
                      <AppLink href={`/tournaments/${tn.id}`} className="font-medium underline-offset-4 hover:underline">
                        {tn.name}
                      </AppLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              variant="destructive"
              className="mt-4 min-h-10 transition-transform active:scale-[0.98]"
              disabled={!data.canDelete || blocked}
              onClick={() => {
                setPassword('')
                setDeleteError(null)
                setDialogOpen(true)
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> {t.deleteBtn}
            </Button>
          </section>
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !deleting && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>{t.dialogDesc}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (password) void deleteAccount()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">{t.password}</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
                aria-invalid={!!deleteError}
                aria-describedby={deleteError ? 'delete-error' : undefined}
                autoFocus
              />
              {deleteError ? (
                <p id="delete-error" role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                  {deleteError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" variant="destructive" disabled={!password || deleting}>
                {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t.confirmDelete}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ hero */

function IdentityHero({ data, role, t, lang }: { data: AccountInfo; role: Role; t: T; lang: 'en' | 'bn' }) {
  const { user } = data
  const meta = ROLE_META[role]
  const RoleIcon = meta.icon
  const teams = data.teams ?? []
  const tournaments = data.activeTournaments ?? []

  const stats: { label: string; value: string; tone?: 'live' | 'warn' }[] =
    role === 'ADMIN' && data.platform
      ? [
          { label: t.statUsers, value: formatNumber(data.platform.users) },
          { label: t.statTournaments, value: formatNumber(data.platform.tournaments) },
          { label: t.statLive, value: formatNumber(data.platform.live), tone: data.platform.live > 0 ? 'live' : undefined },
          { label: t.statPending, value: formatNumber(data.platform.pendingPayments), tone: data.platform.pendingPayments > 0 ? 'warn' : undefined },
        ]
      : role === 'ORGANIZER'
        ? [
            { label: t.statActive, value: formatNumber(tournaments.length) },
            { label: t.statTeams, value: formatNumber(tournaments.reduce((n, tn) => n + tn.teams, 0)) },
            { label: t.statPlayers, value: formatNumber(tournaments.reduce((n, tn) => n + tn.players, 0)) },
          ]
        : [
            { label: t.statManaged, value: formatNumber(data.managedTeams) },
            { label: t.statSigned, value: formatNumber(teams.reduce((n, tm) => n + tm.squad, 0)) },
            { label: t.statPurse, value: formatBDT(teams.reduce((n, tm) => n + Math.max(0, tm.budget - tm.spent), 0)) },
          ]

  const actions: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] =
    role === 'ADMIN'
      ? [
          { href: '/dashboard', label: t.adminConsole, icon: ShieldCheck },
          { href: '/tournaments', label: t.allTournaments, icon: Trophy },
        ]
      : role === 'ORGANIZER'
        ? [
            { href: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
            { href: '/tournaments/new', label: t.newTournament, icon: Plus },
          ]
        : [
            { href: '/dashboard', label: t.myTeams, icon: Users },
            { href: '/join', label: t.joinRoom, icon: Gavel },
          ]

  return (
    <Arena className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      {/* faint court lines for texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_80%_at_0%_0%,black,transparent)]"
        aria-hidden
      />
      <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
        <div className="min-w-0">
          <div className="flex items-start gap-4 sm:gap-5">
            <span
              className={cn(
                'flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-[1.35rem] bg-gradient-to-br text-xl font-black tracking-tight shadow-lg ring-1 ring-white/20 sm:h-20 sm:w-20 sm:rounded-[1.6rem] sm:text-2xl',
                meta.mark,
              )}
              aria-hidden
            >
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t.eyebrow}</p>
              <h1 className="mt-1.5 break-words text-3xl font-black leading-[1.05] tracking-tight text-balance sm:text-4xl">{user.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider ring-1', meta.chip)}>
                  <RoleIcon className="h-3.5 w-3.5" aria-hidden />
                  {t.roles[role]}
                </span>
                <span className="min-w-0 truncate text-sm text-foreground/75">{user.email}</span>
              </div>
            </div>
          </div>
          <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-foreground/80 text-pretty sm:text-[15px]">{t.roleLine[role]}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{t.memberSince(formatDate(user.createdAt, false, lang))}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <Button
                key={a.href}
                asChild
                variant={i === 0 ? 'default' : 'ghost'}
                className={cn('h-11 px-5 font-bold transition-transform active:scale-[0.98]', i > 0 && 'text-foreground/90 hover:bg-white/10')}
              >
                <AppLink href={a.href}>
                  <a.icon className="mr-1.5 h-4 w-4" aria-hidden /> {a.label}
                </AppLink>
              </Button>
            ))}
          </div>
        </div>

        <dl
          className={cn(
            'grid gap-px overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10',
            stats.length === 4 ? 'grid-cols-2 lg:w-[22rem]' : 'grid-cols-2 sm:grid-cols-3 lg:w-[24rem] lg:grid-cols-1',
          )}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'flex min-w-0 flex-col justify-between gap-2 bg-[#0d1b1e]/90 p-4 lg:flex-row lg:items-center lg:gap-4',
                // Three tiles on a phone: the last (often a ৳ amount) gets the full width.
                stats.length === 3 && i === 2 && 'col-span-2 sm:col-span-1',
              )}
            >
              <dt className="text-[11px] font-semibold leading-tight text-muted-foreground lg:order-2 lg:text-right">{s.label}</dt>
              <dd
                className={cn(
                  'truncate text-xl font-black tabular-nums tracking-tight sm:text-[1.75rem]',
                  s.tone === 'live' ? 'text-amber-300' : s.tone === 'warn' ? 'text-amber-200' : 'text-foreground',
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Arena>
  )
}

/* ------------------------------------------------------------- workspace */

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-base font-bold tracking-tight">{title}</h3>
      {count !== undefined && count > 0 ? <span className="text-sm font-semibold tabular-nums text-muted-foreground">{count}</span> : null}
    </div>
  )
}

/** One tappable row: the whole row is the link, with a sliding arrow on hover. */
function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <AppLink
      href={href}
      className="group flex items-center gap-3 rounded-xl bg-card px-3.5 py-3 ring-1 ring-border/70 transition-[box-shadow,background-color,transform] duration-200 hover:bg-muted/40 hover:shadow-md hover:shadow-teal-950/5 hover:ring-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.995] sm:px-4"
    >
      {children}
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
        aria-hidden
      />
    </AppLink>
  )
}

function AdminQueue({ platform, t }: { platform: NonNullable<AccountInfo['platform']>; t: T }) {
  const rows = [
    { key: 'payments', text: t.queuePayments(platform.pendingPayments), hot: platform.pendingPayments > 0, href: '/dashboard', icon: Receipt },
    { key: 'live', text: t.queueLive(platform.live), hot: platform.live > 0, href: '/tournaments', icon: Gavel },
  ]
  return (
    <div>
      <SectionHeading title={t.queueTitle} />
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key}>
            <RowLink href={r.href}>
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  r.hot ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-muted text-muted-foreground',
                )}
                aria-hidden
              >
                <r.icon className="h-4 w-4" />
              </span>
              <span className={cn('min-w-0 flex-1 text-sm', r.hot ? 'font-semibold' : 'text-muted-foreground')}>{r.text}</span>
              <span className="hidden text-xs font-semibold text-primary sm:inline">{t.queueOpen}</span>
            </RowLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TournamentList({ items, t }: { items: OwnedTournament[]; t: T }) {
  return (
    <div>
      <SectionHeading title={t.tournamentsTitle} count={items.length} />
      {items.length === 0 ? (
        <EmptyWorkspace
          icon={Trophy}
          title={t.tournamentsEmptyTitle}
          description={t.tournamentsEmptyDesc}
          action={{ href: '/tournaments/new', label: t.newTournament, icon: Plus }}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((tn) => (
            <li key={tn.id}>
              <RowLink href={`/tournaments/${tn.id}`}>
                <TeamAvatar name={tn.name} logoUrl={tn.logoUrl} className="h-10 w-10 rounded-lg [&>*]:rounded-[inherit]" />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">{tn.name}</span>
                    {tn.plan === 'PRO' ? (
                      <span className="shrink-0 rounded-[4px] bg-primary/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-primary">{t.pro}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {t.sports[tn.sport] ?? tn.sport} · {t.tournamentMeta(tn.teams, tn.players)}
                  </span>
                </span>
                <TournamentStatusBadge status={tn.status} className="hidden shrink-0 min-[420px]:inline-flex" />
              </RowLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamList({ items, total, t }: { items: ManagedTeam[]; total: number; t: T }) {
  return (
    <div>
      <SectionHeading title={t.teamsTitle} count={total} />
      {items.length === 0 ? (
        <EmptyWorkspace icon={Users} title={t.teamsEmptyTitle} description={t.teamsEmptyDesc} action={{ href: '/join', label: t.joinRoom, icon: Gavel }} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((team) => {
            const pct = team.budget > 0 ? Math.min(100, Math.round((team.spent / team.budget) * 100)) : 0
            return (
              <li key={team.id}>
                <AppLink
                  href="/dashboard"
                  className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-card p-4 ring-1 ring-border/70 transition-[box-shadow,transform] duration-200 hover:shadow-md hover:shadow-teal-950/5 hover:ring-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.995]"
                >
                  {/* team colour edge */}
                  <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: team.color ?? 'var(--primary)' }} aria-hidden />
                  <span className="flex items-center gap-3">
                    <TeamAvatar name={team.name} color={team.color} logoUrl={team.logoUrl} className="h-10 w-10 rounded-lg [&>*]:rounded-[inherit]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{team.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{team.tournament.name}</span>
                    </span>
                    <TournamentStatusBadge status={team.tournament.status} className="shrink-0" />
                  </span>
                  <span className="mt-4 flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold tabular-nums">{t.squad(team.squad, team.maxSquad)}</span>
                    <span className="truncate tabular-nums text-muted-foreground">{t.spentOf(formatBDT(team.spent), formatBDT(team.budget))}</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                    <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </span>
                </AppLink>
              </li>
            )
          })}
        </ul>
      )}
      {total > items.length ? (
        <AppLink href="/dashboard" className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">
          {t.moreTeams(total - items.length)}
        </AppLink>
      ) : null}
    </div>
  )
}

function StaffList({ items, t }: { items: StaffSeat[]; t: T }) {
  return (
    <div>
      <SectionHeading title={t.staffTitle} count={items.length} />
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id}>
            <RowLink href={`/tournaments/${s.id}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                {s.role === 'AUCTIONEER' ? <Gavel className="h-4 w-4" /> : <UserCog className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.staffRoles[s.role] ?? s.role}</span>
              </span>
              <TournamentStatusBadge status={s.status} className="hidden shrink-0 min-[420px]:inline-flex" />
            </RowLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyWorkspace({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  action: { href: string; label: string; icon: ComponentType<{ className?: string }> }
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 sm:px-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base font-bold tracking-tight">{title}</p>
      <p className="mt-1 max-w-[46ch] text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      <Button asChild className="mt-5 h-10 font-semibold transition-transform active:scale-[0.98]">
        <AppLink href={action.href}>
          <action.icon className="mr-1.5 h-4 w-4" aria-hidden /> {action.label}
        </AppLink>
      </Button>
    </div>
  )
}

/* --------------------------------------------------------------- sidebar */

function Panel({ title, icon: Icon, children }: { title: string; icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-border/70">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
      </h3>
      {children}
    </section>
  )
}

function Field({
  icon: Icon,
  label,
  value,
  muted,
  mono,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  muted?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
      <div className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-3">
        <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
        <dd className={cn('min-w-0 break-words text-sm font-medium', muted && 'font-normal text-muted-foreground', mono && 'tabular-nums')}>{value}</dd>
      </div>
    </div>
  )
}
