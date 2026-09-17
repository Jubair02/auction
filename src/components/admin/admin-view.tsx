'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  LockKeyhole,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { api, apiGet, apiPatch, ApiError } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate } from '@/lib/format'
import type { AdminStats, SafeUser, TournamentSummary } from '@/lib/types'

type AdminUser = SafeUser & { tournamentCount: number }
type AdminTournament = TournamentSummary & { organizerName?: string }

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-teal-100 text-teal-900 border-teal-300',
  ORGANIZER: 'bg-amber-100 text-amber-900 border-amber-300',
  MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const FIXED_SETTING_KEYS = ['siteName', 'supportPhone', 'announcement'] as const

export default function AdminView() {
  const [tab, setTab] = useState('overview')

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> Admin console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Platform-wide users, tournaments and settings.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="overview" className="min-h-11">Overview</TabsTrigger>
          <TabsTrigger value="users" className="min-h-11">Users</TabsTrigger>
          <TabsTrigger value="tournaments" className="min-h-11">Tournaments</TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="tournaments" className="mt-4">
          <TournamentsTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [s, cfg] = await Promise.all([
        apiGet<AdminStats>('/api/admin/stats'),
        apiGet<{ settings: Record<string, string> }>('/api/admin/settings'),
      ])
      setStats(s)
      setSettings(cfg.settings)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load admin stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const announcement = settings.announcement?.trim()

  return (
    <div className="space-y-4">
      {announcement ? (
        <Card className="border-amber-300 bg-amber-50/70">
          <CardContent className="flex items-start gap-3 p-4">
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-amber-900">Announcement (shown to users)</p>
              <p className="text-sm text-amber-900/85">{announcement}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              No announcement is set. Add one under <span className="font-semibold text-foreground">Settings → announcement</span>.
            </p>
          </CardContent>
        </Card>
      )}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Users" value={stats.users} icon={Users} hint={`${stats.organizers} organizers · ${stats.managers} managers`} />
          <StatCard label="Organizers" value={stats.organizers} icon={Gavel} tone="warning" />
          <StatCard label="Managers" value={stats.managers} icon={Users} tone="success" />
          <StatCard label="Tournaments" value={stats.tournaments} icon={Trophy} />
          <StatCard label="Live auctions" value={stats.liveAuctions} icon={Gavel} tone={stats.liveAuctions > 0 ? 'warning' : 'default'} />
          <StatCard label="Players" value={stats.players} icon={Users} />
          <StatCard label="Total bids" value={stats.bids} icon={Gavel} />
          <StatCard label="Total auction value" value={formatBDT(stats.totalValue)} icon={Trophy} tone="primary" />
        </div>
      ) : (
        <EmptyState icon={Info} title="Stats unavailable" description="Try refreshing the page." />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [busy, setBusy] = useState(false)
  const me = useAppStore((s) => s.user)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ users: AdminUser[] }>('/api/admin/users')
      setUsers(res.users)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? '').toLowerCase().includes(q)
        )
      }),
    [users, query],
  )

  const toggleBlock = async () => {
    if (!target) return
    const next = target.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
    setBusy(true)
    try {
      await apiPatch('/api/admin/users', { userId: target.id, status: next })
      toast.success(
        next === 'BLOCKED' ? `${target.name} has been blocked` : `${target.name} has been unblocked`,
      )
      setTarget(null)
      await load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update user')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone…"
            aria-label="Search users"
            className="h-10 pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {users.length} users
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No users found" description="Try a different search term." />
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead className="hidden sm:table-cell">Tournaments</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = me?.id === u.id
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {u.name}
                          {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{u.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_BADGE[u.role] ?? ''}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.status === 'ACTIVE' ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-800">
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-800">
                          BLOCKED
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{u.tournamentCount}</TableCell>
                    <TableCell className="text-right">
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Admin accounts cannot be blocked">
                          <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Protected
                        </span>
                      ) : (
                        <Button
                          variant={u.status === 'ACTIVE' ? 'outline' : 'default'}
                          size="sm"
                          className={`h-9 ${u.status === 'ACTIVE' ? 'text-rose-600 hover:text-rose-700' : ''}`}
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
          </Table>
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.status === 'ACTIVE' ? 'Block user?' : 'Unblock user?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.status === 'ACTIVE'
                ? `${target?.name} will no longer be able to log in or use the platform until unblocked.`
                : `${target?.name} will regain full access to their account.`}
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

function TournamentsTab() {
  const [tournaments, setTournaments] = useState<AdminTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ tournaments: AdminTournament[] }>('/api/admin/tournaments')
      setTournaments(res.tournaments)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load tournaments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => tournaments.filter((t) => !query.trim() || t.name.toLowerCase().includes(query.trim().toLowerCase())),
    [tournaments, query],
  )

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tournaments…"
            aria-label="Search tournaments"
            className="h-10 pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {tournaments.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Trophy} title="No tournaments" description="No tournaments exist on the platform yet." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-96 overflow-y-auto rounded-lg border md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-52">
                      <p className="truncate font-semibold">{t.name}</p>
                      {t.tournamentType ? (
                        <p className="truncate text-xs text-muted-foreground">{t.tournamentType}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{t.organizerName ?? '—'}</TableCell>
                    <TableCell className="text-sm">{t.sport === 'FOOTBALL' ? 'Football' : 'Cricket'}</TableCell>
                    <TableCell>
                      <TournamentStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {t.soldCount}/{t.playerCount}
                    </TableCell>
                    <TableCell className="tabular-nums">{t.teamCount}</TableCell>
                    <TableCell className="font-mono text-xs">{t.roomCode ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="h-9" onClick={() => navigate(`/results/${t.id}`)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="max-h-96 space-y-2 overflow-y-auto pr-0.5 md:hidden">
            {filtered.map((t) => (
              <Card key={t.id} className="py-0">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.organizerName ?? '—'} · {t.sport === 'FOOTBALL' ? 'Football' : 'Cricket'}
                      </p>
                    </div>
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t.soldCount}/{t.playerCount} players
                    </span>
                    <span>{t.teamCount} teams</span>
                    {t.roomCode ? <span className="font-mono">{t.roomCode}</span> : null}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 h-9 w-full" onClick={() => navigate(`/results/${t.id}`)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> View results
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

interface SettingRow {
  key: string
  value: string
}

function SettingsTab() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ settings: Record<string, string> }>('/api/admin/settings')
      const existing = Object.entries(res.settings).map(([key, value]) => ({ key, value }))
      // Ensure the fixed keys are always present and ordered first.
      const ordered: SettingRow[] = []
      for (const k of FIXED_SETTING_KEYS) {
        ordered.push(existing.find((r) => r.key === k) ?? { key: k, value: '' })
      }
      for (const r of existing) {
        if (!(FIXED_SETTING_KEYS as readonly string[]).includes(r.key)) ordered.push(r)
      }
      setRows(ordered)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateRow = (key: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)))
  }

  const removeRow = (key: string) => {
    if ((FIXED_SETTING_KEYS as readonly string[]).includes(key)) return
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  const addRow = () => {
    const key = newKey.trim()
    if (!key) return toast.error('Key is required.')
    if (rows.some((r) => r.key === key)) return toast.error('That key already exists.')
    if (rows.length >= 20) return toast.error('Maximum of 20 settings reached.')
    setRows((prev) => [...prev, { key, value: newValue.trim() }])
    setNewKey('')
    setNewValue('')
  }

  const save = async () => {
    if (rows.length > 20) return toast.error('Maximum of 20 settings allowed.')
    for (const r of rows) {
      if (r.value.length > 500) return toast.error(`Value for "${r.key}" is over 500 characters.`)
    }
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      for (const r of rows) payload[r.key] = r.value
      await api('/api/admin/settings', { method: 'PUT', body: { settings: payload } })
      toast.success('Settings saved')
      await load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4.5 w-4.5 text-primary" aria-hidden /> Site settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.key} className="flex items-end gap-2">
                <div className="w-40 shrink-0 space-y-1">
                  <Label htmlFor={`set-${r.key}`} className="font-mono text-xs">
                    {r.key}
                  </Label>
                  {r.key === 'announcement' ? null : (
                    <p className="text-xs text-muted-foreground">{FIXED_HINTS[r.key] ?? ''}</p>
                  )}
                </div>
                <Input
                  id={`set-${r.key}`}
                  value={r.value}
                  onChange={(e) => updateRow(r.key, e.target.value)}
                  placeholder={FIXED_HINTS[r.key] ?? 'Value'}
                  className="h-10 flex-1"
                  maxLength={500}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-rose-600 hover:text-rose-700"
                  aria-label={`Remove setting ${r.key}`}
                  disabled={(FIXED_SETTING_KEYS as readonly string[]).includes(r.key)}
                  onClick={() => removeRow(r.key)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="rounded-lg border border-dashed p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Plus className="h-4 w-4 text-primary" aria-hidden /> Add a custom setting
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="key, e.g. contactEmail"
                aria-label="New setting key"
                className="h-10 sm:w-44"
              />
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                aria-label="New setting value"
                className="h-10 flex-1"
              />
              <Button variant="outline" className="h-10" onClick={addRow} disabled={rows.length >= 20}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Up to 20 keys, values up to 500 characters.</p>
          </div>

          <div className="flex justify-end">
            <Button className="min-h-11" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const FIXED_HINTS: Record<string, string> = {
  siteName: 'Shown in emails / invites',
  supportPhone: 'Contact number for help',
  announcement: 'Banner text for all users',
}
