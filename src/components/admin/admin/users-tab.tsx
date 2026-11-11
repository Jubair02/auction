'use client'

import { useMemo, useState } from 'react'
import { Ban, CheckCircle2, Loader2, LockKeyhole, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { apiPatch, ApiError } from '@/lib/api'
import { useAuthState } from '@/lib/store'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedStrings } from './strings'
import { ADMIN_LIST_LIMIT, ListSkeleton, ROLE_BADGE, SearchBox, USERS_URL, useServerSearch, type AdminUser } from './shared'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    searchUsers: 'Search name, email or phone',
    newestOnly: (n: number) => `Showing the newest ${n}. Search to find older accounts.`,
    filterUsers: 'Filter users',
    organizers: 'Organizers',
    managers: 'Managers',
    admins: 'Admins',
    blocked: 'Blocked',
    noUsersMatch: 'No users match',
    colUser: 'User',
    colPhone: 'Phone',
    colRole: 'Role',
    colJoined: 'Joined',
    colTournaments: 'Tournaments',
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
    blockUser: 'Block user',
    unblockUser: 'Unblock user',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    searchUsers: 'নাম, ইমেইল বা ফোন দিয়ে খুঁজুন',
    newestOnly: (n: number) => `সর্বশেষ ${n}টি দেখানো হচ্ছে। পুরোনো অ্যাকাউন্ট খুঁজতে সার্চ করুন।`,
    filterUsers: 'ব্যবহারকারী ফিল্টার',
    organizers: 'আয়োজক',
    managers: 'ম্যানেজার',
    admins: 'অ্যাডমিন',
    blocked: 'ব্লকড',
    noUsersMatch: 'কোনো ব্যবহারকারী মেলেনি',
    colUser: 'ব্যবহারকারী',
    colPhone: 'ফোন',
    colRole: 'ভূমিকা',
    colJoined: 'যোগদান',
    colTournaments: 'টুর্নামেন্ট',
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
    blockUser: 'ব্যবহারকারী ব্লক করুন',
    unblockUser: 'ব্যবহারকারী আনব্লক করুন',
  },
} satisfies Strings<
  SharedStrings & {
    searchUsers: string
    newestOnly: (n: number) => string
    filterUsers: string
    organizers: string
    managers: string
    admins: string
    blocked: string
    noUsersMatch: string
    colUser: string
    colPhone: string
    colRole: string
    colJoined: string
    colTournaments: string
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
    blockUser: string
    unblockUser: string
  }
>

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

type RoleFilter = 'ALL' | 'ORGANIZER' | 'MANAGER' | 'ADMIN' | 'BLOCKED'

export function UsersTab({ users, refetch }: { users: AdminUser[] | undefined; refetch: () => Promise<void> }) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RoleFilter>('ALL')
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [busy, setBusy] = useState(false)
  const { user: me } = useAuthState()

  // The list holds the newest ADMIN_LIST_LIMIT accounts; a search then asks the server.
  const capped = (users?.length ?? 0) >= ADMIN_LIST_LIMIT
  const searched = useServerSearch<AdminUser>(USERS_URL, 'users', query, capped)
  const all = useMemo(() => searched ?? users ?? [], [searched, users])
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
        <div className="w-full space-y-1 sm:max-w-xs">
          <SearchBox value={query} onChange={setQuery} placeholder={t.searchUsers} />
          {capped && !searched ? <p className="text-xs text-muted-foreground">{t.newestOnly(ADMIN_LIST_LIMIT)}</p> : null}
        </div>
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
                  <TableRow key={u.id} className={cn(u.status === 'BLOCKED' && 'bg-rose-50/40 dark:bg-rose-950/20')}>
                    <TableCell className="max-w-56">
                      <p className="truncate font-semibold">
                        {u.name}
                        {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.you}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      {u.status === 'BLOCKED' ? <p className="text-xs font-semibold text-rose-700 sm:hidden dark:text-rose-400">{t.blocked}</p> : null}
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
                        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{t.blocked}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{formatDate(u.createdAt, false, lang)}</TableCell>
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
                          className={cn('h-9', u.status === 'ACTIVE' && 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300')}
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
