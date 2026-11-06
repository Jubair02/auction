'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ClipboardList, Copy, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/clipboard'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { PlayerAvatar } from '@/components/shared/avatars'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { formatBDT, formatDate } from '@/lib/format'
import { CATEGORIES, DEFAULT_CATEGORY_BASE_PRICES, type AuctionMode } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    loadFailed: 'Could not load registrations',
    newLinkCreated: 'New link created — the old one no longer works',
    regOpen: 'Registration is open',
    regClosed: 'Registration closed',
    updateFailed: 'Could not update registration',
    approved: (n: number | undefined) => `${n} player(s) added to the pool`,
    rejected: (n: number | undefined) => `${n} registration(s) rejected`,
    updateManyFailed: 'Could not update registrations',
    linkCopied: 'Registration link copied',
    loadWhat: 'registrations',
    selfRegistration: 'Player self-registration',
    selfRegistrationHelp:
      'Share a link — players sign up from their phone with name, phone, role and a photo. Nothing reaches the auction pool until you approve it.',
    acceptAria: 'Accept player registrations',
    linkAria: 'Player registration link',
    copy: 'Copy',
    whatsappText: (tournament: string, link: string) => `Register for the ${tournament} player auction: ${link}`,
    shareWhatsapp: 'Share on WhatsApp',
    newLink: 'New link',
    closedBadge: 'Closed — the link shows a “registration closed” page',
    waitingReview: (n: number) => `Waiting for review (${n})`,
    reviewHelp: 'Select players, set their pricing, then approve.',
    clearSelection: 'Clear selection',
    selectAll: 'Select all',
    noPendingTitle: 'No pending registrations',
    noPendingOpen: 'New sign-ups will appear here.',
    noPendingClosed: 'Open registration and share the link to get sign-ups.',
    exTeam: (team: string) => ` · ex ${team}`,
    category: 'Category',
    categoryAria: 'Category for approved players',
    categoryN: (c: string) => `Category ${c}`,
    basePrice: 'Base price (৳)',
    reject: 'Reject',
    approveAt: (count: number, amount: string) => `Approve ${count > 0 ? count : ''} at ${amount}`,
    alreadyReviewed: (approved: number, rejected: number) =>
      `Already reviewed: ${approved} approved, ${rejected} rejected.`,
    rotateTitle: 'Replace the registration link?',
    rejectTitle: (n: number) => `Reject ${n} registration${n === 1 ? '' : 's'}?`,
    rotateDesc:
      'The link you already shared stops working straight away — anyone who opens it sees "not valid". Share the new link instead.',
    rejectDesc: 'Rejected players won’t join the auction pool. This can’t be undone; they would have to register again.',
    cancel: 'Cancel',
    createNewLink: 'Create new link',
  },
  bn: {
    loadFailed: 'নিবন্ধনগুলো লোড করা যায়নি',
    newLinkCreated: 'নতুন লিংক তৈরি হয়েছে — পুরোনো লিংক আর কাজ করবে না',
    regOpen: 'নিবন্ধন চালু হয়েছে',
    regClosed: 'নিবন্ধন বন্ধ হয়েছে',
    updateFailed: 'নিবন্ধন আপডেট করা যায়নি',
    approved: (n: number | undefined) => `${n} জন খেলোয়াড় পুলে যোগ হয়েছে`,
    rejected: (n: number | undefined) => `${n}টি নিবন্ধন বাতিল হয়েছে`,
    updateManyFailed: 'নিবন্ধনগুলো আপডেট করা যায়নি',
    linkCopied: 'নিবন্ধন লিংক কপি হয়েছে',
    loadWhat: 'নিবন্ধনগুলো',
    selfRegistration: 'খেলোয়াড়দের নিজে নিবন্ধন',
    selfRegistrationHelp:
      'একটি লিংক শেয়ার করুন — খেলোয়াড়রা ফোন থেকেই নাম, ফোন নম্বর, রোল ও ছবি দিয়ে নিবন্ধন করবে। আপনি অনুমোদন না করা পর্যন্ত কেউ নিলামের পুলে যাবে না।',
    acceptAria: 'খেলোয়াড়দের নিবন্ধন গ্রহণ',
    linkAria: 'খেলোয়াড় নিবন্ধনের লিংক',
    copy: 'কপি',
    whatsappText: (tournament: string, link: string) => `${tournament} খেলোয়াড় নিলামে নিবন্ধন করুন: ${link}`,
    shareWhatsapp: 'WhatsApp-এ শেয়ার করুন',
    newLink: 'নতুন লিংক',
    closedBadge: 'বন্ধ — লিংকটি খুললে “নিবন্ধন বন্ধ” পেজ দেখাবে',
    waitingReview: (n: number) => `যাচাইয়ের অপেক্ষায় (${n})`,
    reviewHelp: 'খেলোয়াড় বাছাই করুন, দাম ঠিক করুন, তারপর অনুমোদন দিন।',
    clearSelection: 'বাছাই মুছুন',
    selectAll: 'সব বাছাই করুন',
    noPendingTitle: 'অপেক্ষমাণ কোনো নিবন্ধন নেই',
    noPendingOpen: 'নতুন নিবন্ধন এখানে দেখা যাবে।',
    noPendingClosed: 'নিবন্ধন চালু করে লিংক শেয়ার করুন, তাহলে নিবন্ধন আসবে।',
    exTeam: (team: string) => ` · সাবেক ${team}`,
    category: 'ক্যাটাগরি',
    categoryAria: 'অনুমোদিত খেলোয়াড়দের ক্যাটাগরি',
    categoryN: (c: string) => `ক্যাটাগরি ${c}`,
    basePrice: 'বেস প্রাইস (৳)',
    reject: 'বাতিল',
    approveAt: (count: number, amount: string) => `${count > 0 ? `${count} জনকে ` : ''}${amount}-এ অনুমোদন`,
    alreadyReviewed: (approved: number, rejected: number) =>
      `যাচাই হয়ে গেছে: ${approved} জন অনুমোদিত, ${rejected} জন বাতিল।`,
    rotateTitle: 'নিবন্ধন লিংক বদলাবেন?',
    rejectTitle: (n: number) => `${n}টি নিবন্ধন বাতিল করবেন?`,
    rotateDesc:
      'যে লিংকটি আগে শেয়ার করেছেন সেটি সঙ্গে সঙ্গে বন্ধ হয়ে যাবে — কেউ খুললে "not valid" দেখবে। এর বদলে নতুন লিংকটি শেয়ার করুন।',
    rejectDesc: 'বাতিল করা খেলোয়াড়রা নিলামের পুলে যোগ হবে না। এটি আর ফেরানো যাবে না; তাদের আবার নিবন্ধন করতে হবে।',
    cancel: 'বাতিল',
    createNewLink: 'নতুন লিংক তৈরি করুন',
  },
} satisfies Strings<{
  loadFailed: string
  newLinkCreated: string
  regOpen: string
  regClosed: string
  updateFailed: string
  approved: (n: number | undefined) => string
  rejected: (n: number | undefined) => string
  updateManyFailed: string
  linkCopied: string
  loadWhat: string
  selfRegistration: string
  selfRegistrationHelp: string
  acceptAria: string
  linkAria: string
  copy: string
  whatsappText: (tournament: string, link: string) => string
  shareWhatsapp: string
  newLink: string
  closedBadge: string
  waitingReview: (n: number) => string
  reviewHelp: string
  clearSelection: string
  selectAll: string
  noPendingTitle: string
  noPendingOpen: string
  noPendingClosed: string
  exTeam: (team: string) => string
  category: string
  categoryAria: string
  categoryN: (c: string) => string
  basePrice: string
  reject: string
  approveAt: (count: number, amount: string) => string
  alreadyReviewed: (approved: number, rejected: number) => string
  rotateTitle: string
  rejectTitle: (n: number) => string
  rotateDesc: string
  rejectDesc: string
  cancel: string
  createNewLink: string
}>

interface Registration {
  id: string
  name: string
  phone: string
  role: string
  previousTeam: string | null
  photoUrl: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

interface RegistrationsData {
  registrationOpen: boolean
  registrationCode: string | null
  registrations: Registration[]
}

/** Public sign-up link + organizer review queue. Approved sign-ups join the player pool. */
export function RegistrationsTab({
  tournamentId,
  tournamentName,
  auctionMode,
  basePrice,
  onPlayersChanged,
}: {
  tournamentId: string
  tournamentName: string
  auctionMode: AuctionMode
  basePrice: number
  onPlayersChanged: () => Promise<void>
}) {
  const t = useStrings(STRINGS)
  const [data, setData] = useState<RegistrationsData | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState('C')
  const [price, setPrice] = useState('')

  const [loadError, setLoadError] = useState<Error | null>(null)
  const [confirm, setConfirm] = useState<'rotate' | 'reject' | null>(null)
  const load = useCallback(async () => {
    try {
      setData(await apiGet<RegistrationsData>(`/api/tournaments/${tournamentId}/registrations`))
      setLoadError(null)
    } catch (ex) {
      setLoadError(ex as Error)
      toast.error(ex instanceof ApiError ? ex.message : t.loadFailed)
    }
  }, [tournamentId])

  useEffect(() => {
    void load()
  }, [load])

  const pending = useMemo(() => data?.registrations.filter((r) => r.status === 'PENDING') ?? [], [data])
  const handled = useMemo(() => data?.registrations.filter((r) => r.status !== 'PENDING') ?? [], [data])
  const link = data?.registrationCode ? `${window.location.origin}/register-player/${data.registrationCode}` : ''
  const defaultPrice = auctionMode === 'CATEGORY' ? DEFAULT_CATEGORY_BASE_PRICES[category] : basePrice

  async function setOpen(open: boolean, rotate = false) {
    setBusy(true)
    try {
      await apiPost(`/api/tournaments/${tournamentId}/registrations`, { open, rotate })
      toast.success(rotate ? t.newLinkCreated : open ? t.regOpen : t.regClosed)
      await load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.updateFailed)
    } finally {
      setBusy(false)
    }
  }

  async function review(action: 'approve' | 'reject') {
    const ids = [...selected]
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res = await apiPatch<{ approved?: number; rejected?: number }>(`/api/tournaments/${tournamentId}/registrations`, {
        ids,
        action,
        ...(action === 'approve'
          ? { category: auctionMode === 'CATEGORY' ? category : undefined, basePrice: price.trim() || undefined }
          : {}),
      })
      toast.success(action === 'approve' ? t.approved(res.approved) : t.rejected(res.rejected))
      setSelected(new Set())
      await load()
      if (action === 'approve') await onPlayersChanged()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.updateManyFailed)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const copy = () =>
    copyText(link, t.linkCopied)

  if (!data && loadError) return <LoadError what={t.loadWhat} error={loadError} onRetry={load} />
  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="registration-open" className="text-base font-bold">
                {t.selfRegistration}
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.selfRegistrationHelp}
              </p>
            </div>
            <Switch
              id="registration-open"
              checked={data.registrationOpen}
              disabled={busy}
              onCheckedChange={(v) => void setOpen(v)}
              aria-label={t.acceptAria}
            />
          </div>

          {data.registrationCode ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly aria-label={t.linkAria} value={link} onFocus={(e) => e.currentTarget.select()} className="h-10 font-mono text-xs" />
                <Button variant="outline" className="h-10 shrink-0" onClick={copy}>
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden /> {t.copy}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(t.whatsappText(tournamentName, link))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> {t.shareWhatsapp}
                  </a>
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm('rotate')}>
                  <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden /> {t.newLink}
                </Button>
                {!data.registrationOpen ? (
                  <Badge variant="secondary" className="self-center">{t.closedBadge}</Badge>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold">{t.waitingReview(pending.length)}</h3>
              <p className="text-sm text-muted-foreground">{t.reviewHelp}</p>
            </div>
            {pending.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((r) => r.id)))}
              >
                {selected.size === pending.length ? t.clearSelection : t.selectAll}
              </Button>
            ) : null}
          </div>

          {pending.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t.noPendingTitle}
              description={data.registrationOpen ? t.noPendingOpen : t.noPendingClosed}
            />
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {pending.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--primary)]"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                      <PlayerAvatar name={r.name} photoUrl={r.photoUrl} className="h-10 w-10 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.role} · {r.phone}
                          {r.previousTeam ? t.exTeam(r.previousTeam) : ''}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{formatDate(r.createdAt, true)}</span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end">
                {auctionMode === 'CATEGORY' ? (
                  <div className="space-y-1.5">
                    <Label>{t.category}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10 w-full sm:w-36" aria-label={t.categoryAria}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t.categoryN(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="approve-price">{t.basePrice}</Label>
                  <Input
                    id="approve-price"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={String(defaultPrice)}
                    className="h-10 sm:w-40"
                  />
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  <Button variant="outline" className="h-10" disabled={busy || selected.size === 0} onClick={() => setConfirm('reject')}>
                    <X className="mr-1.5 h-4 w-4" aria-hidden /> {t.reject}
                  </Button>
                  <Button className="h-10" disabled={busy || selected.size === 0} onClick={() => void review('approve')}>
                    {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-1.5 h-4 w-4" aria-hidden />}
                    {t.approveAt(selected.size, formatBDT(price.trim() ? parseInt(price, 10) || 0 : defaultPrice))}
                  </Button>
                </div>
              </div>
            </>
          )}

          {handled.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t.alreadyReviewed(
                handled.filter((r) => r.status === 'APPROVED').length,
                handled.filter((r) => r.status === 'REJECTED').length,
              )}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Both actions are permanent — confirm first. */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'rotate' ? t.rotateTitle : t.rejectTitle(selected.size)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'rotate'
                ? t.rotateDesc
                : t.rejectDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className={confirm === 'reject' ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
              onClick={() => {
                const action = confirm
                setConfirm(null)
                if (action === 'rotate') void setOpen(data.registrationOpen, true)
                else if (action === 'reject') void review('reject')
              }}
            >
              {confirm === 'rotate' ? t.createNewLink : t.reject}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
