'use client'

// Tournament staff: co-organizers (manage everything except billing, staff and
// deletion) and auctioneers (view + run the live room). The owner/ADMIN adds
// existing organizer accounts by email; a staff member can leave on their own.
import { useState } from 'react'
import { Crown, Loader2, LogOut, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { LoadError } from '@/components/shared/load-error'
import { EmptyState } from '@/components/shared/empty-state'
import { apiDelete, apiPatch, apiPost, ApiError } from '@/lib/api'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { TOURNAMENTS_URL, tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { useAuthState } from '@/lib/store'
import { formatDate } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'

type StaffRole = 'CO_ORGANIZER' | 'AUCTIONEER'

interface StaffMember {
  userId: string
  name: string
  email: string
  role: StaffRole
  addedAt: string
}

interface StaffResponse {
  owner: { userId: string; name: string; email: string } | null
  staff: StaffMember[]
}

const STRINGS = {
  en: {
    title: 'Staff',
    desc: 'People who help you run this tournament from their own organizer accounts.',
    roleLabel: { CO_ORGANIZER: 'Co-organizer', AUCTIONEER: 'Auctioneer' } as Record<StaffRole, string>,
    roleHelp: {
      CO_ORGANIZER: 'Manages players, teams, registrations and settings — not billing, staff or deleting the tournament.',
      AUCTIONEER: 'Sees the tournament (read-only) and runs the live auction room.',
    } as Record<StaffRole, string>,
    owner: 'Owner',
    you: 'you',
    what: 'the staff list',
    noStaff: 'No staff yet',
    noStaffDesc: 'Add a co-organizer or an auctioneer by the email of their organizer account.',
    addTitle: 'Add staff',
    email: 'Email',
    emailPlaceholder: 'their organizer login email',
    role: 'Role',
    roleAria: (name: string) => `Role of ${name}`,
    add: 'Add',
    adding: 'Adding…',
    added: (name: string) => `${name} added to the staff`,
    addFailed: 'Could not add staff member',
    badEmail: 'Enter the email of their organizer account.',
    roleChangedTo: (name: string, role: string) => `${name} is now ${role}`,
    changeFailed: 'Could not change the role',
    remove: 'Remove',
    removeAria: (name: string) => `Remove ${name}`,
    removeTitle: 'Remove from staff?',
    removeDesc: (name: string) => `${name} will lose access to this tournament and its live room straight away.`,
    removed: (name: string) => `${name} removed from the staff`,
    removeFailed: 'Could not remove staff member',
    leave: 'Leave tournament',
    leaveTitle: 'Leave this tournament?',
    leaveDesc: 'You will lose access to it and its live room. The owner can add you again.',
    left: 'You left the tournament',
    cancel: 'Cancel',
    addedOn: (date: string) => `Added ${date}`,
  },
  bn: {
    title: 'স্টাফ',
    desc: 'যাঁরা নিজেদের আয়োজক অ্যাকাউন্ট থেকে আপনার সাথে টুর্নামেন্টটি চালান।',
    roleLabel: { CO_ORGANIZER: 'সহ-আয়োজক', AUCTIONEER: 'নিলামকারী' } as Record<StaffRole, string>,
    roleHelp: {
      CO_ORGANIZER: 'খেলোয়াড়, দল, নিবন্ধন ও সেটিংস সামলান — পেমেন্ট, স্টাফ বা টুর্নামেন্ট মোছা নয়।',
      AUCTIONEER: 'টুর্নামেন্ট দেখতে পারেন (শুধু দেখা) আর লাইভ নিলাম রুম চালান।',
    } as Record<StaffRole, string>,
    owner: 'মালিক',
    you: 'আপনি',
    what: 'স্টাফের তালিকা',
    noStaff: 'এখনো কোনো স্টাফ নেই',
    noStaffDesc: 'আয়োজক অ্যাকাউন্টের ইমেইল দিয়ে একজন সহ-আয়োজক বা নিলামকারী যোগ করুন।',
    addTitle: 'স্টাফ যোগ করুন',
    email: 'ইমেইল',
    emailPlaceholder: 'তাঁর আয়োজক অ্যাকাউন্টের ইমেইল',
    role: 'ভূমিকা',
    roleAria: (name: string) => `${name}-এর ভূমিকা`,
    add: 'যোগ করুন',
    adding: 'যোগ হচ্ছে…',
    added: (name: string) => `${name} স্টাফে যোগ হয়েছেন`,
    addFailed: 'স্টাফ যোগ করা যায়নি',
    badEmail: 'তাঁর আয়োজক অ্যাকাউন্টের ইমেইল লিখুন।',
    roleChangedTo: (name: string, role: string) => `${name} এখন ${role}`,
    changeFailed: 'ভূমিকা বদলানো যায়নি',
    remove: 'বাদ দিন',
    removeAria: (name: string) => `${name}-কে বাদ দিন`,
    removeTitle: 'স্টাফ থেকে বাদ দেবেন?',
    removeDesc: (name: string) => `${name} সাথে সাথে এই টুর্নামেন্ট ও এর লাইভ রুমে আর ঢুকতে পারবেন না।`,
    removed: (name: string) => `${name}-কে স্টাফ থেকে বাদ দেওয়া হয়েছে`,
    removeFailed: 'স্টাফ বাদ দেওয়া যায়নি',
    leave: 'টুর্নামেন্ট ছেড়ে দিন',
    leaveTitle: 'এই টুর্নামেন্ট ছেড়ে দেবেন?',
    leaveDesc: 'আপনি এটি ও এর লাইভ রুমে আর ঢুকতে পারবেন না। মালিক আবার আপনাকে যোগ করতে পারবেন।',
    left: 'আপনি টুর্নামেন্টটি ছেড়ে দিয়েছেন',
    cancel: 'বাতিল',
    addedOn: (date: string) => `যোগ হয়েছেন ${date}`,
  },
} satisfies Strings<{
  title: string
  desc: string
  roleLabel: Record<StaffRole, string>
  roleHelp: Record<StaffRole, string>
  owner: string
  you: string
  what: string
  noStaff: string
  noStaffDesc: string
  addTitle: string
  email: string
  emailPlaceholder: string
  role: string
  roleAria: (name: string) => string
  add: string
  adding: string
  added: (name: string) => string
  addFailed: string
  badEmail: string
  roleChangedTo: (name: string, role: string) => string
  changeFailed: string
  remove: string
  removeAria: (name: string) => string
  removeTitle: string
  removeDesc: (name: string) => string
  removed: (name: string) => string
  removeFailed: string
  leave: string
  leaveTitle: string
  leaveDesc: string
  left: string
  cancel: string
  addedOn: (date: string) => string
}>

const ROLES: StaffRole[] = ['CO_ORGANIZER', 'AUCTIONEER']

export default function StaffPanel({ tournamentId, canEdit }: { tournamentId: string; canEdit: boolean }) {
  const s = useStrings(STRINGS)
  const url = `/api/tournaments/${tournamentId}/staff`
  const { data, loading, error, refetch } = useCachedGet<StaffResponse>(url)
  const myId = useAuthState().user?.id ?? null

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('CO_ORGANIZER')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const add = async () => {
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return toast.error(s.badEmail)
    setAdding(true)
    try {
      const res = await apiPost<{ member: StaffMember }>(url, { email: value, role })
      toast.success(s.added(res.member.name))
      setEmail('')
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.addFailed)
    } finally {
      setAdding(false)
    }
  }

  const changeRole = async (m: StaffMember, next: StaffRole) => {
    if (next === m.role) return
    setBusyId(m.userId)
    try {
      await apiPatch(`${url}/${m.userId}`, { role: next })
      toast.success(s.roleChangedTo(m.name, s.roleLabel[next]))
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.changeFailed)
    } finally {
      setBusyId(null)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    const leaving = removeTarget.userId === myId
    setRemoving(true)
    try {
      await apiDelete(`${url}/${removeTarget.userId}`)
      setRemoveTarget(null)
      if (leaving) {
        toast.success(s.left)
        invalidateCached(TOURNAMENTS_URL, tournamentDetailUrl(tournamentId), url)
        navigate('/tournaments')
        return
      }
      toast.success(s.removed(removeTarget.name))
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.removeFailed)
    } finally {
      setRemoving(false)
    }
  }

  const leavingSelf = removeTarget !== null && removeTarget.userId === myId

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" aria-hidden /> {s.title}
        </CardTitle>
        <CardDescription>{s.desc}</CardDescription>
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {ROLES.map((r) => (
            <li key={r}>
              <span className="font-semibold text-foreground">{s.roleLabel[r]}:</span> {s.roleHelp[r]}
            </li>
          ))}
        </ul>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <form
            className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">{s.email}</Label>
              <Input
                id="staff-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={s.emailPlaceholder}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">{s.role}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger id="staff-role" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {s.roleLabel[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="min-h-10" disabled={adding}>
              {adding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              {adding ? s.adding : s.add}
            </Button>
          </form>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : !data && error ? (
          <LoadError what={s.what} error={error} onRetry={refetch} />
        ) : data ? (
          <ul className="divide-y rounded-lg border">
            {data.owner ? (
              <li className="flex flex-wrap items-center gap-3 p-3">
                <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {data.owner.name}
                    {data.owner.userId === myId ? <span className="font-normal text-muted-foreground"> ({s.you})</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{data.owner.email}</p>
                </div>
                <Badge variant="secondary">{s.owner}</Badge>
              </li>
            ) : null}
            {data.staff.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {m.name}
                    {m.userId === myId ? <span className="font-normal text-muted-foreground"> ({s.you})</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email} · {s.addedOn(formatDate(m.addedAt))}
                  </p>
                </div>
                {canEdit ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => void changeRole(m, v as StaffRole)}
                    disabled={busyId === m.userId}
                  >
                    <SelectTrigger size="sm" className="h-9 w-40" aria-label={s.roleAria(m.name)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {s.roleLabel[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={m.role === 'CO_ORGANIZER' ? 'default' : 'outline'}>{s.roleLabel[m.role]}</Badge>
                )}
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                    aria-label={s.removeAria(m.name)}
                    onClick={() => setRemoveTarget(m)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : m.userId === myId ? (
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setRemoveTarget(m)}>
                    <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {s.leave}
                  </Button>
                ) : null}
              </li>
            ))}
            {data.staff.length === 0 ? (
              <li className="p-3">
                <EmptyState icon={Users} title={s.noStaff} description={canEdit ? s.noStaffDesc : undefined} className="border-0 shadow-none" />
              </li>
            ) : null}
          </ul>
        ) : null}
      </CardContent>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{leavingSelf ? s.leaveTitle : s.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {leavingSelf ? s.leaveDesc : s.removeDesc(removeTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>{s.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault()
                void confirmRemove()
              }}
            >
              {removing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {leavingSelf ? s.leave : s.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
