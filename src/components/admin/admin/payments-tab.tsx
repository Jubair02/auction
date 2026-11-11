'use client'

import { useState } from 'react'
import { CheckCircle2, Copy, Loader2, Wallet, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { LoadError } from '@/components/shared/load-error'
import { formatBDT, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type PaymentStatus } from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { copyText } from '@/lib/clipboard'
import { SHARED_STRINGS, type SharedStrings } from './strings'
import { ListSkeleton, loadError, paymentsUrl, type AdminPayment, type PaymentFilter } from './shared'
import type { PaymentCounts } from '@/lib/types'

const METHOD_LABEL: Record<string, string> = { BKASH: 'bKash', NAGAD: 'Nagad' }

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    whatPayments: 'payments',
    filterPayments: 'Filter payments',
    payStatus: { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' },
    noPaymentsTitle: 'No payments here',
    noPaymentsDesc: 'Pro payments that organizers submit appear here for you to check and approve.',
    paidBy: (name) => `Paid by ${name}`,
    fromNumber: (n) => `from ${n}`,
    tournamentGone: 'Tournament deleted',
    alreadyPro: 'Already Pro',
    reviewedOn: (d) => `Reviewed ${d}`,
    copyTrx: 'Copy Transaction ID',
    copied: 'Copied',
    approve: 'Approve',
    reject: 'Reject',
    approveQuestion: (name) => `Approve and make "${name}" Pro?`,
    approveDesc: (method, trx, amount) =>
      `Approve only after you find ${method} transaction ${trx} for ${amount} in the platform account.`,
    rejectQuestion: 'Reject this payment?',
    rejectDesc: 'The organizer sees it as rejected and can submit a new Transaction ID.',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. Transaction ID not found',
    paymentApproved: (name) => `"${name}" is now Pro`,
    paymentRejected: 'Payment rejected',
    couldNotReview: 'Could not review the payment',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    whatPayments: 'পেমেন্টের তালিকা',
    filterPayments: 'পেমেন্ট ফিল্টার',
    payStatus: { PENDING: 'অপেক্ষমাণ', APPROVED: 'অনুমোদিত', REJECTED: 'বাতিল' },
    noPaymentsTitle: 'এখানে কোনো পেমেন্ট নেই',
    noPaymentsDesc: 'আয়োজকেরা Pro-এর পেমেন্ট জমা দিলে যাচাই ও অনুমোদনের জন্য এখানে দেখা যাবে।',
    paidBy: (name) => `পাঠিয়েছেন ${name}`,
    fromNumber: (n) => `${n} থেকে`,
    tournamentGone: 'টুর্নামেন্ট মুছে ফেলা হয়েছে',
    alreadyPro: 'আগে থেকেই Pro',
    reviewedOn: (d) => `যাচাই ${d}`,
    copyTrx: 'ট্রানজেকশন আইডি কপি করুন',
    copied: 'কপি হয়েছে',
    approve: 'অনুমোদন',
    reject: 'বাতিল',
    approveQuestion: (name) => `অনুমোদন দিয়ে "${name}" Pro করবেন?`,
    approveDesc: (method, trx, amount) =>
      `প্ল্যাটফর্মের অ্যাকাউন্টে ${amount}-এর ${method} ট্রানজেকশন ${trx} খুঁজে পেলে তবেই অনুমোদন দিন।`,
    rejectQuestion: 'এই পেমেন্ট বাতিল করবেন?',
    rejectDesc: 'আয়োজক এটি বাতিল হিসেবে দেখবেন এবং নতুন ট্রানজেকশন আইডি জমা দিতে পারবেন।',
    noteLabel: 'নোট (ঐচ্ছিক)',
    notePlaceholder: 'যেমন: ট্রানজেকশন আইডি পাওয়া যায়নি',
    paymentApproved: (name) => `"${name}" এখন Pro`,
    paymentRejected: 'পেমেন্ট বাতিল হয়েছে',
    couldNotReview: 'পেমেন্ট যাচাই করা যায়নি',
  },
} satisfies Strings<
  SharedStrings & {
    whatPayments: string
    filterPayments: string
    payStatus: Record<PaymentStatus, string>
    noPaymentsTitle: string
    noPaymentsDesc: string
    paidBy: (name: string) => string
    fromNumber: (n: string) => string
    tournamentGone: string
    alreadyPro: string
    reviewedOn: (d: string) => string
    copyTrx: string
    copied: string
    approve: string
    reject: string
    approveQuestion: (name: string) => string
    approveDesc: (method: string, trx: string, amount: string) => string
    rejectQuestion: string
    rejectDesc: string
    noteLabel: string
    notePlaceholder: string
    paymentApproved: (name: string) => string
    paymentRejected: string
    couldNotReview: string
  }
>

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  APPROVED: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  REJECTED: 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
}

export function PaymentsTab({ onChanged }: { onChanged: () => Promise<void> }) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const [filter, setFilter] = useState<PaymentFilter>('PENDING')
  const { data, loading, error, refetch } = useCachedGet<{ payments: AdminPayment[]; pendingCount: number; counts?: PaymentCounts }>(
    paymentsUrl(filter),
    loadError(t.couldNotLoad(t.whatPayments)),
  )
  // Every response carries all four counts from the database. Keep the latest
  // ones while another tab's list loads, so the chips never blank out or jump.
  const [counts, setCounts] = useState<PaymentCounts | null>(data?.counts ?? null)
  if (data?.counts && data.counts !== counts) setCounts(data.counts)
  const [review, setReview] = useState<{ payment: AdminPayment; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submitReview = async () => {
    if (!review) return
    setBusy(true)
    try {
      await apiPatch(`/api/admin/payments/${review.payment.id}`, { action: review.action, note: note.trim() || undefined })
      toast.success(review.action === 'approve' ? t.paymentApproved(review.payment.tournamentName) : t.paymentRejected)
      setReview(null)
      setNote('')
      // Every filter's cached list is now stale.
      invalidateCached(...(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(paymentsUrl))
      await Promise.all([refetch(), onChanged()])
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotReview)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <FilterChips<PaymentFilter>
        label={t.filterPayments}
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'PENDING', label: t.payStatus.PENDING, count: counts?.PENDING },
          { key: 'APPROVED', label: t.payStatus.APPROVED, count: counts?.APPROVED },
          { key: 'REJECTED', label: t.payStatus.REJECTED, count: counts?.REJECTED },
          { key: 'ALL', label: t.all, count: counts?.ALL },
        ]}
      />

      {!data && error ? (
        <LoadError what={t.whatPayments} error={error} onRetry={refetch} />
      ) : loading || !data ? (
        <ListSkeleton rows={3} />
      ) : data.payments.length === 0 ? (
        <EmptyState icon={Wallet} title={t.noPaymentsTitle} description={t.noPaymentsDesc} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.payments.map((p) => (
            <li key={p.id}>
              <Card className="h-full py-0">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{p.tournamentName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.paidBy(p.payerName)} · {formatDate(p.createdAt, true, lang)}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', PAYMENT_STATUS_CLASS[p.status])}>
                      {t.payStatus[p.status]}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">{METHOD_LABEL[p.method] ?? p.method}</dt>
                      <dd className="text-lg font-black tabular-nums">{formatBDT(p.amount)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">TrxID</dt>
                      <dd className="flex items-center gap-1">
                        <span className="truncate font-mono font-bold tracking-wide">{p.trxId}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={t.copyTrx}
                          onClick={() => copyText(p.trxId, t.copied)}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </dd>
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">{t.fromNumber(p.senderNumber)}</div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {p.tournamentPlan === null ? <span>{t.tournamentGone}</span> : null}
                    {p.status === 'PENDING' && p.tournamentPlan === 'PRO' ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300">
                        {t.alreadyPro}
                      </Badge>
                    ) : null}
                    {p.reviewedAt ? <span>{t.reviewedOn(formatDate(p.reviewedAt, true, lang))}</span> : null}
                    {p.reviewNote ? <span className="italic">“{p.reviewNote}”</span> : null}
                  </div>
                  {p.status === 'PENDING' ? (
                    <div className="mt-auto flex gap-2">
                      <Button
                        variant="outline"
                        className="h-10 flex-1 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        onClick={() => {
                          setNote('')
                          setReview({ payment: p, action: 'reject' })
                        }}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" aria-hidden /> {t.reject}
                      </Button>
                      <Button
                        className="h-10 flex-1"
                        onClick={() => {
                          setNote('')
                          setReview({ payment: p, action: 'approve' })
                        }}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> {t.approve}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!review} onOpenChange={(open) => !open && !busy && setReview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {review?.action === 'approve' ? t.approveQuestion(review.payment.tournamentName) : t.rejectQuestion}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {review?.action === 'approve'
                ? t.approveDesc(METHOD_LABEL[review.payment.method] ?? review.payment.method, review.payment.trxId, formatBDT(review.payment.amount))
                : t.rejectDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="payment-note">{t.noteLabel}</Label>
            <Input
              id="payment-note"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              className="h-10"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={review?.action === 'reject' ? 'bg-rose-600 text-white hover:bg-rose-700' : undefined}
              onClick={(e) => {
                e.preventDefault()
                void submitReview()
              }}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {review?.action === 'approve' ? t.approve : t.reject}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
