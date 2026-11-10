'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Check, ClipboardList, Copy, Loader2, MessageCircle, RefreshCw, Save, Wallet, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterChips } from '@/components/shared/filter-chips'
import { LoadError } from '@/components/shared/load-error'
import { PlayerAvatar } from '@/components/shared/avatars'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { invalidateCached } from '@/lib/api-cache'
import { formatBDT, formatDate } from '@/lib/format'
import { tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { CATEGORIES, DEFAULT_CATEGORY_BASE_PRICES, type AuctionMode, type RegistrationDTO } from '@/lib/types'
import { type Strings, useStrings, useLang } from '@/lib/i18n'
import { PlayerRole } from '@/components/shared/player-role'
import { cn } from '@/lib/utils'

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
    noMatchTitle: 'Nothing in this filter',
    noMatchDesc: 'Pick another filter above to see the rest.',
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
    // Registration fee
    feeTitle: 'Registration fee',
    feeHelp:
      'Optional. Players pay you directly on bKash or Nagad and enter the Transaction ID when they sign up; you check it in your app and verify it here. NeelamGhor takes no commission.',
    feeAmount: 'Fee (৳)',
    feePlaceholder: 'Blank = free',
    feeBkash: 'Your bKash number',
    feeNagad: 'Your Nagad number',
    feeInstructions: 'Payment instructions (optional)',
    feeInstructionsPlaceholder: 'e.g. Use Send Money and write your name in the reference.',
    feeSave: 'Save fee settings',
    feeOwnerOnly: 'Only the tournament owner can change the payment numbers and instructions.',
    feeSaved: 'Registration fee saved',
    feeSaveFailed: 'Could not save the fee settings',
    feeNeedsNumber: 'Add a bKash or Nagad number so players know where to pay.',
    feeInvalid: 'Fee must be a whole amount from ৳1 to ৳100,000.',
    feeActive: (amount: string) => `Players pay ${amount} to register`,
    feeOff: 'Registration is free',
    // Payment review
    payNone: 'No fee',
    payUnpaid: 'Not paid',
    payClaimed: 'Paid — verify?',
    payVerified: 'Verified',
    payRejected: 'Payment rejected',
    payDetail: (method: string, trx: string, sender: string, amount: string) => `${method} ${amount} · TrxID ${trx} · from ${sender}`,
    verify: 'Verify',
    rejectPayment: 'Reject payment',
    verifyAria: (name: string) => `Verify ${name}'s payment`,
    rejectPaymentAria: (name: string) => `Reject ${name}'s payment`,
    verifySelected: (n: number) => `Verify ${n} payment${n === 1 ? '' : 's'}`,
    rejectSelectedPayments: 'Reject payments',
    paymentsVerified: (n: number) => `${n} payment${n === 1 ? '' : 's'} verified`,
    paymentsRejected: (n: number) => `${n} payment${n === 1 ? '' : 's'} marked as rejected`,
    filterLabel: 'Filter by payment',
    filterAll: 'All',
    filterToVerify: 'To verify',
    filterVerified: 'Verified',
    filterRejected: 'Rejected',
    filterNoPayment: 'No payment',
    approvedToVerify: (n: number) => `Approved players with a payment still to verify (${n})`,
    unpaidTitle: (n: number) => `${n} selected player${n === 1 ? ' has' : 's have'} no verified payment`,
    unpaidDesc:
      'You can approve them anyway — for example if they paid in cash — and verify the payment later. Approve now?',
    approveAnyway: 'Approve anyway',
    smsConsent: 'SMS ok',
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
    noMatchTitle: 'এই ফিল্টারে কিছু নেই',
    noMatchDesc: 'বাকিগুলো দেখতে ওপরে অন্য ফিল্টার বেছে নিন।',
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
    feeTitle: 'নিবন্ধন ফি',
    feeHelp:
      'ঐচ্ছিক। খেলোয়াড়রা সরাসরি আপনার bKash বা Nagad-এ টাকা পাঠিয়ে নিবন্ধনের সময় ট্রানজেকশন আইডি দেবে; আপনি নিজের অ্যাপে মিলিয়ে এখানে যাচাই করবেন। NeelamGhor কোনো কমিশন নেয় না।',
    feeAmount: 'ফি (৳)',
    feePlaceholder: 'খালি = ফ্রি',
    feeBkash: 'আপনার bKash নম্বর',
    feeNagad: 'আপনার Nagad নম্বর',
    feeInstructions: 'পেমেন্টের নির্দেশনা (ঐচ্ছিক)',
    feeInstructionsPlaceholder: 'যেমন: Send Money করুন এবং রেফারেন্সে আপনার নাম লিখুন।',
    feeSave: 'ফি সেটিংস সংরক্ষণ',
    feeOwnerOnly: 'পেমেন্ট নম্বর ও নির্দেশনা শুধু টুর্নামেন্টের মালিক বদলাতে পারেন।',
    feeSaved: 'নিবন্ধন ফি সংরক্ষণ হয়েছে',
    feeSaveFailed: 'ফি সেটিংস সংরক্ষণ করা যায়নি',
    feeNeedsNumber: 'খেলোয়াড়রা কোথায় টাকা পাঠাবে তা জানাতে একটি bKash বা Nagad নম্বর দিন।',
    feeInvalid: 'ফি ৳1 থেকে ৳100,000-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।',
    feeActive: (amount: string) => `নিবন্ধন করতে খেলোয়াড়রা ${amount} দেবে`,
    feeOff: 'নিবন্ধন ফ্রি',
    payNone: 'ফি নেই',
    payUnpaid: 'পেমেন্ট নেই',
    payClaimed: 'পেমেন্ট দিয়েছে — যাচাই করুন',
    payVerified: 'যাচাই হয়েছে',
    payRejected: 'পেমেন্ট বাতিল',
    payDetail: (method: string, trx: string, sender: string, amount: string) => `${method} ${amount} · TrxID ${trx} · ${sender} থেকে`,
    verify: 'যাচাই',
    rejectPayment: 'পেমেন্ট বাতিল',
    verifyAria: (name: string) => `${name}-এর পেমেন্ট যাচাই করুন`,
    rejectPaymentAria: (name: string) => `${name}-এর পেমেন্ট বাতিল করুন`,
    verifySelected: (n: number) => `${n}টি পেমেন্ট যাচাই`,
    rejectSelectedPayments: 'পেমেন্ট বাতিল',
    paymentsVerified: (n: number) => `${n}টি পেমেন্ট যাচাই হয়েছে`,
    paymentsRejected: (n: number) => `${n}টি পেমেন্ট বাতিল চিহ্নিত হয়েছে`,
    filterLabel: 'পেমেন্ট অনুযায়ী ফিল্টার',
    filterAll: 'সব',
    filterToVerify: 'যাচাই বাকি',
    filterVerified: 'যাচাই হয়েছে',
    filterRejected: 'বাতিল',
    filterNoPayment: 'পেমেন্ট নেই',
    approvedToVerify: (n: number) => `অনুমোদিত খেলোয়াড়, পেমেন্ট যাচাই বাকি (${n})`,
    unpaidTitle: (n: number) => `বাছাই করা ${n} জনের পেমেন্ট যাচাই হয়নি`,
    unpaidDesc: 'চাইলে তবুও অনুমোদন দিতে পারেন — যেমন কেউ নগদ টাকা দিয়ে থাকলে — আর পেমেন্ট পরে যাচাই করুন। এখন অনুমোদন দেবেন?',
    approveAnyway: 'তবুও অনুমোদন',
    smsConsent: 'SMS সম্মতি',
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
  noMatchTitle: string
  noMatchDesc: string
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
  feeTitle: string
  feeHelp: string
  feeAmount: string
  feePlaceholder: string
  feeBkash: string
  feeNagad: string
  feeInstructions: string
  feeInstructionsPlaceholder: string
  feeSave: string
  feeOwnerOnly: string
  feeSaved: string
  feeSaveFailed: string
  feeNeedsNumber: string
  feeInvalid: string
  feeActive: (amount: string) => string
  feeOff: string
  payNone: string
  payUnpaid: string
  payClaimed: string
  payVerified: string
  payRejected: string
  payDetail: (method: string, trx: string, sender: string, amount: string) => string
  verify: string
  rejectPayment: string
  verifyAria: (name: string) => string
  rejectPaymentAria: (name: string) => string
  verifySelected: (n: number) => string
  rejectSelectedPayments: string
  paymentsVerified: (n: number) => string
  paymentsRejected: (n: number) => string
  filterLabel: string
  filterAll: string
  filterToVerify: string
  filterVerified: string
  filterRejected: string
  filterNoPayment: string
  approvedToVerify: (n: number) => string
  unpaidTitle: (n: number) => string
  unpaidDesc: string
  approveAnyway: string
  smsConsent: string
}>

type Registration = RegistrationDTO

interface RegistrationsData {
  registrationOpen: boolean
  registrationCode: string | null
  registrationFee: number | null
  feeBkashNumber: string | null
  feeNagadNumber: string | null
  feeInstructions: string | null
  registrations: Registration[]
}

type PayFilter = 'all' | 'toVerify' | 'verified' | 'rejected' | 'none'

const METHOD_LABEL: Record<string, string> = { BKASH: 'bKash', NAGAD: 'Nagad' }

/** No payment on a tournament that charges a fee, or a claim nobody has verified yet. */
const needsPaymentCheck = (r: Registration, feeActive: boolean) =>
  r.payStatus === 'CLAIMED' || r.payStatus === 'REJECTED' || (feeActive && r.payStatus === 'NONE')

/** Public sign-up link + organizer review queue. Approved sign-ups join the player pool. */
export function RegistrationsTab({
  tournamentId,
  tournamentName,
  auctionMode,
  basePrice,
  canEditPayout,
  onPlayersChanged,
}: {
  tournamentId: string
  tournamentName: string
  auctionMode: AuctionMode
  basePrice: number
  /** Owner / ADMIN: may change where registration fees are paid. */
  canEditPayout: boolean
  onPlayersChanged: () => Promise<void>
}) {
  const t = useStrings(STRINGS)
  const [data, setData] = useState<RegistrationsData | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState('C')
  const [price, setPrice] = useState('')
  const [filter, setFilter] = useState<PayFilter>('all')

  const [loadError, setLoadError] = useState<Error | null>(null)
  const [confirm, setConfirm] = useState<'rotate' | 'reject' | 'approveUnpaid' | null>(null)
  const load = useCallback(async () => {
    try {
      setData(await apiGet<RegistrationsData>(`/api/tournaments/${tournamentId}/registrations`))
      setLoadError(null)
    } catch (ex) {
      setLoadError(ex as Error)
      toast.error(ex instanceof ApiError ? ex.message : t.loadFailed)
    }
  }, [tournamentId, t.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  const feeActive = !!data?.registrationFee
  const pending = useMemo(() => data?.registrations.filter((r) => r.status === 'PENDING') ?? [], [data])
  const handled = useMemo(() => data?.registrations.filter((r) => r.status !== 'PENDING') ?? [], [data])
  const approvedToVerify = useMemo(
    () => handled.filter((r) => r.status === 'APPROVED' && r.payStatus === 'CLAIMED'),
    [handled],
  )
  // Show payment tools once there is a fee, or anyone has ever paid one.
  const showPayments = feeActive || (data?.registrations.some((r) => r.payStatus !== 'NONE') ?? false)
  const matches = useCallback(
    (r: Registration) =>
      filter === 'all' ||
      (filter === 'toVerify' && r.payStatus === 'CLAIMED') ||
      (filter === 'verified' && r.payStatus === 'VERIFIED') ||
      (filter === 'rejected' && r.payStatus === 'REJECTED') ||
      (filter === 'none' && r.payStatus === 'NONE'),
    [filter],
  )
  const visible = useMemo(() => pending.filter(matches), [pending, matches])
  const link = data?.registrationCode ? `${window.location.origin}/register-player/${data.registrationCode}` : ''
  const defaultPrice = auctionMode === 'CATEGORY' ? DEFAULT_CATEGORY_BASE_PRICES[category] : basePrice
  const selectedRegs = pending.filter((r) => selected.has(r.id))
  const selectedWithPayment = selectedRegs.filter((r) => r.payStatus !== 'NONE')
  const selectedUnverified = selectedRegs.filter((r) => needsPaymentCheck(r, feeActive))

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

  async function reviewPayment(ids: string[], action: 'verify_payment' | 'reject_payment') {
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res = await apiPatch<{ updated: number }>(`/api/tournaments/${tournamentId}/registrations`, { ids, action })
      toast.success(action === 'verify_payment' ? t.paymentsVerified(res.updated) : t.paymentsRejected(res.updated))
      await load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.updateManyFailed)
    } finally {
      setBusy(false)
    }
  }

  const approve = () => {
    // Approving is allowed whatever the payment says (cash, a late payment…), but never by accident.
    if (selectedUnverified.length > 0) setConfirm('approveUnpaid')
    else void review('approve')
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

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id))

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

      <FeeSettings
        key={`${data.registrationFee}|${data.feeBkashNumber}|${data.feeNagadNumber}|${data.feeInstructions}`}
        tournamentId={tournamentId}
        data={data}
        canEditPayout={canEditPayout}
        onSaved={load}
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold">{t.waitingReview(pending.length)}</h3>
              <p className="text-sm text-muted-foreground">{t.reviewHelp}</p>
            </div>
            {visible.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)))}
              >
                {allVisibleSelected ? t.clearSelection : t.selectAll}
              </Button>
            ) : null}
          </div>

          {showPayments && pending.length > 0 ? (
            <FilterChips<PayFilter>
              label={t.filterLabel}
              value={filter}
              onChange={(f) => {
                setFilter(f)
                setSelected(new Set())
              }}
              options={[
                { key: 'all', label: t.filterAll, count: pending.length },
                { key: 'toVerify', label: t.filterToVerify, count: pending.filter((r) => r.payStatus === 'CLAIMED').length },
                { key: 'verified', label: t.filterVerified, count: pending.filter((r) => r.payStatus === 'VERIFIED').length },
                { key: 'rejected', label: t.filterRejected, count: pending.filter((r) => r.payStatus === 'REJECTED').length },
                { key: 'none', label: t.filterNoPayment, count: pending.filter((r) => r.payStatus === 'NONE').length },
              ]}
            />
          ) : null}

          {pending.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t.noPendingTitle}
              description={data.registrationOpen ? t.noPendingOpen : t.noPendingClosed}
            />
          ) : (
            <>
              {visible.length === 0 ? (
                <EmptyState icon={ClipboardList} title={t.noMatchTitle} description={t.noMatchDesc} />
              ) : (
                <ul className="divide-y rounded-lg border">
                  {visible.map((r) => (
                    <RegistrationRow
                      key={r.id}
                      r={r}
                      feeActive={feeActive}
                      showPayments={showPayments}
                      selectable
                      checked={selected.has(r.id)}
                      onToggle={() => toggle(r.id)}
                      busy={busy}
                      onPayment={(action) => void reviewPayment([r.id], action)}
                    />
                  ))}
                </ul>
              )}

              {showPayments && selectedWithPayment.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={busy}
                    onClick={() => void reviewPayment(selectedWithPayment.map((r) => r.id), 'verify_payment')}
                  >
                    <BadgeCheck className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.verifySelected(selectedWithPayment.length)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-rose-700 dark:text-rose-400"
                    disabled={busy}
                    onClick={() => void reviewPayment(selectedWithPayment.map((r) => r.id), 'reject_payment')}
                  >
                    <X className="mr-1.5 h-4 w-4" aria-hidden /> {t.rejectSelectedPayments}
                  </Button>
                </div>
              ) : null}

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
                  <Button className="h-10" disabled={busy || selected.size === 0} onClick={approve}>
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

      {approvedToVerify.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h3 className="font-bold">{t.approvedToVerify(approvedToVerify.length)}</h3>
            <ul className="divide-y rounded-lg border">
              {approvedToVerify.map((r) => (
                <RegistrationRow
                  key={r.id}
                  r={r}
                  feeActive={feeActive}
                  showPayments
                  busy={busy}
                  onPayment={(action) => void reviewPayment([r.id], action)}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Permanent or easy-to-regret actions — confirm first. */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'rotate'
                ? t.rotateTitle
                : confirm === 'approveUnpaid'
                  ? t.unpaidTitle(selectedUnverified.length)
                  : t.rejectTitle(selected.size)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'rotate' ? t.rotateDesc : confirm === 'approveUnpaid' ? t.unpaidDesc : t.rejectDesc}
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
                else if (action === 'approveUnpaid') void review('approve')
              }}
            >
              {confirm === 'rotate' ? t.createNewLink : confirm === 'approveUnpaid' ? t.approveAnyway : t.reject}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PaymentBadge({ r, feeActive }: { r: Registration; feeActive: boolean }) {
  const t = useStrings(STRINGS)
  const map = {
    NONE: feeActive
      ? { label: t.payUnpaid, className: 'border-border bg-muted text-muted-foreground' }
      : { label: t.payNone, className: 'border-border bg-background text-muted-foreground' },
    CLAIMED: { label: t.payClaimed, className: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200' },
    VERIFIED: { label: t.payVerified, className: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' },
    REJECTED: { label: t.payRejected, className: 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300' },
  }[r.payStatus]
  return (
    <Badge variant="outline" className={cn('text-[11px]', map.className)}>
      {map.label}
    </Badge>
  )
}

function RegistrationRow({
  r,
  feeActive,
  showPayments,
  selectable,
  checked,
  onToggle,
  busy,
  onPayment,
}: {
  r: Registration
  feeActive: boolean
  showPayments: boolean
  selectable?: boolean
  checked?: boolean
  onToggle?: () => void
  busy: boolean
  onPayment: (action: 'verify_payment' | 'reject_payment') => void
}) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const info = (
    <>
      <PlayerAvatar name={r.name} photoUrl={r.photoUrl} className="h-10 w-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{r.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          <PlayerRole role={r.role} /> · {r.phone}
          {r.previousTeam ? t.exTeam(r.previousTeam) : ''}
          {r.smsConsent ? ` · ${t.smsConsent}` : ''}
        </span>
        {r.payStatus !== 'NONE' && r.payTrxId ? (
          <span className="block truncate font-mono text-[11px] text-muted-foreground">
            {t.payDetail(METHOD_LABEL[r.payMethod ?? ''] ?? r.payMethod ?? '', r.payTrxId, r.paySender ?? '—', formatBDT(r.feeAmount))}
          </span>
        ) : null}
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{formatDate(r.createdAt, true, lang)}</span>
    </>
  )
  return (
    <li className="flex flex-col gap-2 p-3 hover:bg-muted/40 sm:flex-row sm:items-center">
      {selectable ? (
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={checked} onChange={onToggle} />
          {info}
        </label>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{info}</div>
      )}
      {showPayments ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-7 sm:pl-0">
          <PaymentBadge r={r} feeActive={feeActive} />
          {r.payStatus !== 'NONE' && r.payStatus !== 'VERIFIED' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={busy}
              aria-label={t.verifyAria(r.name)}
              onClick={() => onPayment('verify_payment')}
            >
              <BadgeCheck className="mr-1 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.verify}
            </Button>
          ) : null}
          {r.payStatus !== 'NONE' && r.payStatus !== 'REJECTED' ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-rose-700 dark:text-rose-400"
              disabled={busy}
              aria-label={t.rejectPaymentAria(r.name)}
              onClick={() => onPayment('reject_payment')}
            >
              <X className="mr-1 h-3.5 w-3.5" aria-hidden /> {t.rejectPayment}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ */

/** The optional player registration fee, paid to the organizer's own bKash / Nagad. */
function FeeSettings({
  tournamentId,
  data,
  canEditPayout,
  onSaved,
}: {
  tournamentId: string
  data: RegistrationsData
  canEditPayout: boolean
  onSaved: () => Promise<void>
}) {
  const t = useStrings(STRINGS)
  const [fee, setFee] = useState(data.registrationFee ? String(data.registrationFee) : '')
  const [bkash, setBkash] = useState(data.feeBkashNumber ?? '')
  const [nagad, setNagad] = useState(data.feeNagadNumber ?? '')
  const [instructions, setInstructions] = useState(data.feeInstructions ?? '')
  const [saving, setSaving] = useState(false)

  const dirty =
    fee !== (data.registrationFee ? String(data.registrationFee) : '') ||
    bkash !== (data.feeBkashNumber ?? '') ||
    nagad !== (data.feeNagadNumber ?? '') ||
    instructions !== (data.feeInstructions ?? '')

  async function save() {
    const feeValue = fee.trim() === '' || fee.trim() === '0' ? null : Number(fee)
    if (feeValue !== null && (!Number.isInteger(feeValue) || feeValue < 1 || feeValue > 100_000)) {
      toast.error(t.feeInvalid)
      return
    }
    if (feeValue !== null && !bkash.trim() && !nagad.trim()) {
      toast.error(t.feeNeedsNumber)
      return
    }
    setSaving(true)
    try {
      await apiPatch(`/api/tournaments/${tournamentId}`, {
        registrationFee: feeValue,
        feeBkashNumber: bkash.trim() || null,
        feeNagadNumber: nagad.trim() || null,
        feeInstructions: instructions.trim() || null,
      })
      invalidateCached(tournamentDetailUrl(tournamentId))
      toast.success(t.feeSaved)
      await onSaved()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.feeSaveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-bold">
              <Wallet className="h-4 w-4 text-primary" aria-hidden /> {t.feeTitle}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.feeHelp}</p>
          </div>
          <Badge variant={data.registrationFee ? 'default' : 'secondary'} className="shrink-0">
            {data.registrationFee ? t.feeActive(formatBDT(data.registrationFee)) : t.feeOff}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="reg-fee">{t.feeAmount}</Label>
            <Input
              id="reg-fee"
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder={t.feePlaceholder}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-fee-bkash">{t.feeBkash}</Label>
            <Input
              id="reg-fee-bkash"
              disabled={!canEditPayout}
              type="tel"
              inputMode="tel"
              value={bkash}
              onChange={(e) => setBkash(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-fee-nagad">{t.feeNagad}</Label>
            <Input
              id="reg-fee-nagad"
              disabled={!canEditPayout}
              type="tel"
              inputMode="tel"
              value={nagad}
              onChange={(e) => setNagad(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="h-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-fee-instructions">{t.feeInstructions}</Label>
          <Textarea
            id="reg-fee-instructions"
            disabled={!canEditPayout}
            value={instructions}
            maxLength={300}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t.feeInstructionsPlaceholder}
            rows={2}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!canEditPayout ? <p className="mr-auto text-xs text-muted-foreground">{t.feeOwnerOnly}</p> : null}
          <Button className="h-10" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1.5 h-4 w-4" aria-hidden />}
            {t.feeSave}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
