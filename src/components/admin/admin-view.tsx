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
import { useAppStore } from '@/lib/store'
import { navigate } from '@/lib/router'
import { formatAuctionWhen, formatBDT, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isLive, plural, tournamentPhase, type TournamentPhase } from '@/lib/tournament-status'
import { sportLabel, type AdminStats, type SafeUser, type TournamentSummary } from '@/lib/types'

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


const loadError = (what: string) => (ex: unknown) =>
  toast.error(ex instanceof ApiError ? ex.message : `Could not load ${what}`)

export default function AdminView() {
  const [tab, setTab] = useState('overview')
  const users = useCachedGet<{ users: AdminUser[] }>(USERS_URL, loadError('users'))
  const tournaments = useCachedGet<{ tournaments: AdminTournament[] }>(TOURNAMENTS_URL, loadError('tournaments'))

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> Admin console
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Everyone and every auction on NeelamGhor.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="overview" className="min-h-11">Overview</TabsTrigger>
          <TabsTrigger value="users" className="min-h-11">
            Users {users.data ? <span className="ml-1 text-xs tabular-nums text-muted-foreground">{users.data.users.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="min-h-11">
            Tournaments{' '}
            {tournaments.data ? <span className="ml-1 text-xs tabular-nums text-muted-foreground">{tournaments.data.tournaments.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab users={users.data?.users} tournaments={tournaments.data?.tournaments} onOpenTab={setTab} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab users={users.data?.users} refetch={users.refetch} />
        </TabsContent>
        <TabsContent value="tournaments" className="mt-4">
          <TournamentsTab tournaments={tournaments.data?.tournaments} />
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
  const { data: stats } = useCachedGet<AdminStats>(STATS_URL, loadError('platform numbers'))
  const { data: settings } = useCachedGet<{ settings: Record<string, string> }>(SETTINGS_URL)
  const announcement = settings?.settings.announcement?.trim()

  const live = (tournaments ?? []).filter(isLive)
  // Ready rooms and scheduled auctions, soonest first.
  const upcoming = (tournaments ?? [])
    .filter((t) => !isLive(t) && t.auctionStatus !== 'ENDED' && t.status !== 'COMPLETED' && (t.roomCode || t.auctionAt))
    .sort((a, b) => (a.auctionAt ?? '9999').localeCompare(b.auctionAt ?? '9999'))
    .slice(0, 5)
  const recent = (users ?? []).slice(0, 6)

  return (
    <div className="space-y-4">
      {/* platform numbers — one strip, no overlapping cards */}
      {stats ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-3 lg:grid-cols-5 [&>div]:border-b [&>div]:border-r">
          {[
            { k: 'Users', v: stats.users, hint: `${plural(stats.organizers, 'organizer')} · ${plural(stats.managers, 'manager')}` },
            { k: 'Tournaments', v: stats.tournaments, hint: plural(stats.liveAuctions, 'live auction') },
            { k: 'Players', v: stats.players, hint: 'across all tournaments' },
            { k: 'Bids placed', v: stats.bids, hint: 'all time' },
            { k: 'Sold for', v: formatBDT(stats.totalValue), hint: 'total auction value' },
          ].map((s) => (
            <div key={s.k} className="-mb-px -mr-px px-4 py-3">
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
                  <span className="font-semibold">Everyone sees this banner: </span>
                  {announcement}
                </>
              ) : (
                'No announcement banner is showing.'
              )}
            </span>
          </p>
          <Button variant="outline" size="sm" className="h-8 shrink-0 bg-background" onClick={() => onOpenTab('settings')}>
            {announcement ? 'Edit banner' : 'Add a banner'}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="h-4 w-4 text-amber-600" aria-hidden /> Live now
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!tournaments ? (
                <ListSkeleton rows={1} />
              ) : live.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No auctions are running right now.</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {live.map((t) => (
                    <TournamentRow key={t.id} t={t} meta={`${t.soldCount}/${t.playerCount} sold · ${t.organizerName ?? '—'}`} live />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Coming up</CardTitle>
            </CardHeader>
            <CardContent>
              {!tournaments ? (
                <ListSkeleton rows={2} />
              ) : upcoming.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No rooms are open and no auctions are scheduled.</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {upcoming.map((t) => {
                    const when = formatAuctionWhen(t.auctionAt)
                    return (
                      <TournamentRow
                        key={t.id}
                        t={t}
                        meta={`${when ? (when.past ? `Was due ${when.text}` : when.text) : 'Room open · no time set'} · ${t.organizerName ?? '—'}`}
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
              Recent sign-ups
              <Button variant="ghost" size="sm" className="-mr-2 h-8" onClick={() => onOpenTab('users')}>
                All users
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!users ? (
              <ListSkeleton rows={4} />
            ) : recent.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Nobody has signed up yet.</p>
            ) : (
              <ul className="divide-y">
                {recent.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                        {u.status === 'BLOCKED' ? ' · blocked' : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', ROLE_BADGE[u.role])}>
                      {u.role.toLowerCase()}
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

function TournamentRow({ t, meta, live = false }: { t: AdminTournament; meta: string; live?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {live ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" aria-hidden /> : null}
          <span className="truncate">{t.name}</span>
          {t.roomCode ? <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">{t.roomCode}</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {t.roomCode ? (
        <Button size="sm" variant={live ? 'default' : 'ghost'} className="h-8 shrink-0" onClick={() => navigate(`/room/${t.roomCode}`)}>
          <DoorOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {live ? 'Watch' : 'Room'}
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
      toast.success(next === 'BLOCKED' ? `${target.name} is blocked` : `${target.name} is unblocked`)
      setTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update user')
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
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, email or phone" />
        <FilterChips
          label="Filter users"
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'ALL', label: 'All', count: count('ALL') },
            { key: 'ORGANIZER', label: 'Organizers', count: count('ORGANIZER') },
            { key: 'MANAGER', label: 'Managers', count: count('MANAGER') },
            { key: 'ADMIN', label: 'Admins', count: count('ADMIN') },
            { key: 'BLOCKED', label: 'Blocked', count: count('BLOCKED') },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No users match" description="Try another search or filter." />
      ) : (
        // Scrolls with the page; the header sticks under the site header. A plain <table>,
        // because the shared Table's overflow wrapper would stop the header sticking.
        <div className="overflow-x-auto rounded-lg border md:overflow-visible">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="hidden sm:table-cell">Tournaments</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
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
                        {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      {u.status === 'BLOCKED' ? <p className="text-xs font-semibold text-rose-700 sm:hidden">Blocked</p> : null}
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{u.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ''}>
                        {u.role.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {u.status === 'ACTIVE' ? (
                        <span className="text-sm text-muted-foreground">Active</span>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-800">Blocked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{u.tournamentCount}</TableCell>
                    <TableCell className="text-right">
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Admin accounts can’t be blocked">
                          <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Protected
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
                              <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Block
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Unblock
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
            <AlertDialogTitle>{target?.status === 'ACTIVE' ? `Block ${target?.name}?` : `Unblock ${target?.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.status === 'ACTIVE'
                ? 'They won’t be able to log in or use NeelamGhor until you unblock them.'
                : 'They get full access to their account again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={target?.status === 'ACTIVE' ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void toggleBlock()
              }}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {target?.status === 'ACTIVE' ? 'Block user' : 'Unblock user'}
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
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TournamentFilter>('ALL')

  const all = useMemo(() => tournaments ?? [], [tournaments])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (t) =>
        (filter === 'ALL' || tournamentPhase(t) === filter) &&
        (!q || t.name.toLowerCase().includes(q) || (t.organizerName ?? '').toLowerCase().includes(q) || (t.roomCode ?? '').toLowerCase().includes(q))
    )
  }, [all, query, filter])

  if (!tournaments) return <ListSkeleton rows={5} />

  const count = (f: TournamentFilter) => (f === 'ALL' ? all.length : all.filter((t) => tournamentPhase(t) === f).length)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, organizer or room code" />
        <FilterChips
          label="Filter tournaments"
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'ALL', label: 'All', count: count('ALL') },
            { key: 'LIVE', label: 'Live', count: count('LIVE') },
            { key: 'READY', label: 'Ready', count: count('READY') },
            { key: 'DRAFT', label: 'Draft', count: count('DRAFT') },
            { key: 'COMPLETED', label: 'Completed', count: count('COMPLETED') },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={all.length === 0 ? 'No tournaments yet' : 'No tournaments match'}
          description={all.length === 0 ? 'Tournaments appear here as soon as an organizer creates one.' : 'Try another search or filter.'}
        />
      ) : (
        <>
          {/* Desktop table — page scroll, sticky header */}
          <div className="hidden rounded-lg border lg:block">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-60">
                      <p className="truncate font-semibold">{t.name}</p>
                      {t.tournamentType ? <p className="truncate text-xs text-muted-foreground">{t.tournamentType}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm">{t.organizerName ?? '—'}</TableCell>
                    <TableCell className="text-sm">{sportLabel(t.sport, 'en', t.sportName)}</TableCell>
                    <TableCell>
                      <TournamentStatusBadge status={isLive(t) ? 'LIVE' : t.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {t.soldCount}/{t.playerCount}
                    </TableCell>
                    <TableCell className="tabular-nums">{t.teamCount}</TableCell>
                    <TableCell className="font-mono text-xs">{t.roomCode ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => navigate(`/results/${t.id}`)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Results
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>

          {/* Phone & tablet cards */}
          <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
            {filtered.map((t) => (
              <Card key={t.id} className="py-0">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.organizerName ?? '—'} · {sportLabel(t.sport, 'en', t.sportName)}
                      </p>
                    </div>
                    <TournamentStatusBadge status={isLive(t) ? 'LIVE' : t.status} className="shrink-0" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                    <span>
                      {t.soldCount}/{t.playerCount} sold
                    </span>
                    <span>{plural(t.teamCount, 'team')}</span>
                    {t.roomCode ? <span className="font-mono">{t.roomCode}</span> : null}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 h-9 w-full" onClick={() => navigate(`/results/${t.id}`)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Results
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
  { key: 'siteName', label: 'Platform name', placeholder: 'NeelamGhor', max: 80 },
  { key: 'supportPhone', label: 'Support phone', placeholder: '01XXXXXXXXX', max: 30 },
] as const
const ANNOUNCEMENT_MAX = 300
const FORM_KEYS: readonly string[] = [...FIELDS.map((f) => f.key), 'announcement']

function SettingsTab() {
  const { data, loading, refetch } = useCachedGet<{ settings: Record<string, string> }>(SETTINGS_URL, loadError('settings'))
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)

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
      toast.success('Settings saved')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not save settings')
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
            <Megaphone className="h-4 w-4 text-amber-600" aria-hidden /> Announcement banner
          </CardTitle>
          <p className="text-sm text-muted-foreground">Shown at the top of every page, to everyone. Leave it empty to hide the banner.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-announcement" className="sr-only">
              Announcement text
            </Label>
            <Textarea
              id="set-announcement"
              value={values.announcement ?? ''}
              onChange={(e) => set('announcement', e.target.value)}
              maxLength={ANNOUNCEMENT_MAX}
              rows={2}
              placeholder="e.g. The auction service is down for maintenance on Friday from 2–3 am."
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {(values.announcement ?? '').length}/{ANNOUNCEMENT_MAX}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preview</p>
            {announcement ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="flex items-start gap-2">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{announcement}</span>
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">No banner — nothing shows above the pages.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Platform details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`set-${f.key}`}>{f.label}</Label>
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
            Discard changes
          </Button>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
          {dirty ? 'Save settings' : 'All changes saved'}
        </Button>
      </div>
    </form>
  )
}
