'use client'

import { useState } from 'react'
import { Download, Loader2, LogIn, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { api, apiDownload, ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { formatDate } from '@/lib/format'
import { navigate } from '@/lib/router'
import { useAppStore, useAuthState } from '@/lib/store'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import type { SafeUser } from '@/lib/types'

interface AccountInfo {
  user: SafeUser
  activeTournaments: { id: string; name: string }[]
  managedTeams: number
  payments: number
  canDelete: boolean
}

const STRINGS = {
  en: {
    title: 'My account',
    subtitle: 'Your profile, your data, and how to leave.',
    loginTitle: 'Log in to manage your account',
    loginDesc: 'You need to be logged in to download or delete your data.',
    login: 'Log in',
    what: 'your account',
    profile: 'Profile',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    none: 'Not set',
    role: 'Role',
    roles: { ADMIN: 'Admin', ORGANIZER: 'Organizer', MANAGER: 'Team manager' } as Record<string, string>,
    memberSince: 'Member since',
    summary: (t: number, m: number, p: number) =>
      `${t} active tournament${t === 1 ? '' : 's'} · ${m} team${m === 1 ? '' : 's'} managed · ${p} payment${p === 1 ? '' : 's'}`,
    exportTitle: 'Download my data',
    exportDesc:
      'A JSON file with your profile, the tournaments you own (with their teams and players), the teams you manage, your staff roles and your payments.',
    exportBtn: 'Download my data',
    exportFailed: 'Could not download your data',
    privacyLink: 'Read the privacy notice',
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
    title: 'আমার অ্যাকাউন্ট',
    subtitle: 'আপনার প্রোফাইল, আপনার তথ্য, আর অ্যাকাউন্ট মুছে ফেলার উপায়।',
    loginTitle: 'অ্যাকাউন্ট দেখতে লগইন করুন',
    loginDesc: 'আপনার তথ্য ডাউনলোড বা মুছে ফেলতে লগইন থাকতে হবে।',
    login: 'লগইন',
    what: 'আপনার অ্যাকাউন্ট',
    profile: 'প্রোফাইল',
    name: 'নাম',
    email: 'ইমেইল',
    phone: 'ফোন',
    none: 'দেওয়া নেই',
    role: 'ভূমিকা',
    roles: { ADMIN: 'অ্যাডমিন', ORGANIZER: 'আয়োজক', MANAGER: 'টিম ম্যানেজার' } as Record<string, string>,
    memberSince: 'যোগ দিয়েছেন',
    summary: (t: number, m: number, p: number) => `${t}টি সক্রিয় টুর্নামেন্ট · ${m}টি দল পরিচালনা · ${p}টি পেমেন্ট`,
    exportTitle: 'আমার তথ্য ডাউনলোড',
    exportDesc:
      'একটি JSON ফাইল — আপনার প্রোফাইল, আপনার টুর্নামেন্ট (দল ও খেলোয়াড়সহ), আপনি যে দল পরিচালনা করেন, স্টাফ ভূমিকা ও পেমেন্টের তথ্য।',
    exportBtn: 'আমার তথ্য ডাউনলোড করুন',
    exportFailed: 'আপনার তথ্য ডাউনলোড করা যায়নি',
    privacyLink: 'গোপনীয়তা নীতি পড়ুন',
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
  title: string
  subtitle: string
  loginTitle: string
  loginDesc: string
  login: string
  what: string
  profile: string
  name: string
  email: string
  phone: string
  none: string
  role: string
  roles: Record<string, string>
  memberSince: string
  summary: (t: number, m: number, p: number) => string
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

export default function AccountView() {
  const { user, authChecked } = useAuthState()
  const t = useStrings(STRINGS)

  if (!authChecked) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    )
  }
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
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {error && !loading ? (
          <LoadError what={t.what} error={error} onRetry={refetch} />
        ) : (
          <>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </>
        )}
      </div>
    )
  }

  const { user } = data
  const blocked = data.activeTournaments.length > 0
  const row = (label: string, value: string) => (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <UserRound className="h-4 w-4 text-primary" aria-hidden /> {t.profile}
            <Badge variant="outline" className="ml-1">
              {t.roles[user.role] ?? user.role}
            </Badge>
          </h2>
          <dl className="divide-y">
            {row(t.name, user.name)}
            {row(t.email, user.email)}
            {row(t.phone, user.phone || t.none)}
            {row(t.memberSince, formatDate(user.createdAt, false, lang))}
          </dl>
          <p className="text-xs text-muted-foreground">{t.summary(data.activeTournaments.length, data.managedTeams, data.payments)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <Download className="h-4 w-4 text-primary" aria-hidden /> {t.exportTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.exportDesc}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="min-h-10" variant="outline" disabled={exporting} onClick={() => void download()}>
              {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-4 w-4" aria-hidden />}
              {t.exportBtn}
            </Button>
            <AppLink href="/privacy" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <ShieldCheck className="h-4 w-4" aria-hidden /> {t.privacyLink}
            </AppLink>
          </div>
        </CardContent>
      </Card>

      <Card className="border-rose-200 dark:border-rose-900/60">
        <CardContent className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
            <Trash2 className="h-4 w-4" aria-hidden /> {t.deleteTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.deleteDesc}</p>
          {!data.canDelete ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{t.adminNote}</p>
          ) : blocked ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p>{t.blocking}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.activeTournaments.map((tn) => (
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
            className="min-h-10"
            disabled={!data.canDelete || blocked}
            onClick={() => {
              setPassword('')
              setDeleteError(null)
              setDialogOpen(true)
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> {t.deleteBtn}
          </Button>
        </CardContent>
      </Card>

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
