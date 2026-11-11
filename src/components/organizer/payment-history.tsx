'use client'

// The organizer's side of a Pro payment review: a notice when an admin has
// approved or rejected a payment (with the admin's note), and the tournament's
// payment history. Data: GET /api/tournaments/:id/payments (owner / ADMIN only),
// which carries each payment's status, reviewNote and reviewedAt.
import { useState } from 'react'
import { CheckCircle2, Clock, Crown, Receipt, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { METHOD_LABEL, paymentsUrl, UpgradeDialog } from '@/components/organizer/upgrade-dialog'
import { useCachedGet } from '@/lib/api-cache'
import { formatBDT, formatDate } from '@/lib/format'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import type { PaymentDTO, PaymentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

/** How long a decision stays announced on the tournament page (unless dismissed). */
const NOTICE_DAYS = 30
const DISMISSED_KEY = (id: string) => `ng:payment-notice-dismissed:${id}`

interface PaymentStrings {
  status: Record<PaymentStatus, string>
  approvedTitle: string
  approvedBody: string
  rejectedTitle: string
  rejectedBody: string
  adminNote: string
  payAgain: string
  dismiss: string
  historyTitle: string
  submitted: (date: string) => string
  reviewed: (status: string, date: string) => string
  waiting: string
  trx: string
}

const STRINGS = {
  en: {
    status: { PENDING: 'Under review', APPROVED: 'Approved', REJECTED: 'Rejected' },
    approvedTitle: 'Your Pro payment was approved',
    approvedBody: 'Pro is now on for this tournament.',
    rejectedTitle: 'Your Pro payment was not approved',
    rejectedBody: 'The tournament stays on Free. Check the note below, then pay again if needed.',
    adminNote: 'Note from NeelamGhor',
    payAgain: 'Pay again',
    dismiss: 'Dismiss',
    historyTitle: 'Payment history',
    submitted: (d) => `Submitted ${d}`,
    reviewed: (s, d) => `${s} ${d}`,
    waiting: 'An admin is checking this payment — usually within a few hours.',
    trx: 'TrxID',
  },
  bn: {
    status: { PENDING: 'যাচাই হচ্ছে', APPROVED: 'অনুমোদিত', REJECTED: 'বাতিল' },
    approvedTitle: 'আপনার Pro পেমেন্ট অনুমোদিত হয়েছে',
    approvedBody: 'এই টুর্নামেন্টে এখন Pro চালু।',
    rejectedTitle: 'আপনার Pro পেমেন্ট অনুমোদিত হয়নি',
    rejectedBody: 'টুর্নামেন্টটি ফ্রি প্ল্যানে থাকছে। নিচের নোট দেখুন, দরকার হলে আবার পেমেন্ট করুন।',
    adminNote: 'NeelamGhor-এর নোট',
    payAgain: 'আবার পেমেন্ট করুন',
    dismiss: 'বন্ধ করুন',
    historyTitle: 'পেমেন্টের ইতিহাস',
    submitted: (d) => `জমা ${d}`,
    reviewed: (s, d) => `${s} ${d}`,
    waiting: 'একজন অ্যাডমিন পেমেন্টটি যাচাই করছেন — সাধারণত কয়েক ঘণ্টার মধ্যে।',
    trx: 'TrxID',
  },
} satisfies Strings<PaymentStrings>

const STATUS_TONE: Record<PaymentStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  APPROVED: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  REJECTED: 'border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
}
const STATUS_ICON = { PENDING: Clock, APPROVED: CheckCircle2, REJECTED: XCircle } as const

function StatusBadge({ status, t }: { status: PaymentStatus; t: PaymentStrings }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold', STATUS_TONE[status])}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {t.status[status]}
    </span>
  )
}

function AdminNote({ note, t }: { note: string; t: PaymentStrings }) {
  return (
    <figure className="rounded-lg border-l-4 border-primary/60 bg-background/70 px-3 py-2">
      <figcaption className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t.adminNote}</figcaption>
      <blockquote className="mt-0.5 whitespace-pre-line break-words text-sm">{note}</blockquote>
    </figure>
  )
}

const readDismissed = (id: string) => {
  try {
    return localStorage.getItem(DISMISSED_KEY(id)) === '1'
  } catch {
    return false
  }
}

/**
 * The latest decision on this tournament's Pro payment, until the organizer
 * dismisses it (or for NOTICE_DAYS). Rejected: the note and a way to pay again.
 */
export function PaymentDecisionNotice({ tournamentId, isFree }: { tournamentId: string; isFree: boolean }) {
  const t = useStrings<PaymentStrings>(STRINGS)
  const { data, refetch } = useCachedGet<{ payments: PaymentDTO[] }>(paymentsUrl(tournamentId))
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const payments = data?.payments ?? []
  // Newest first from the API. A newer submission (still pending) replaces the old news.
  const latest = payments[0]
  if (!latest || latest.status === 'PENDING' || !latest.reviewedAt) return null
  if (Date.now() - new Date(latest.reviewedAt).getTime() > NOTICE_DAYS * 24 * 60 * 60 * 1000) return null
  if (dismissed[latest.id] ?? readDismissed(latest.id)) return null

  const approved = latest.status === 'APPROVED'
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY(latest.id), '1')
    } catch {
      // private mode: it just shows again next visit
    }
    setDismissed((d) => ({ ...d, [latest.id]: true }))
  }

  return (
    <section
      role="status"
      data-payment-notice=""
      className={cn(
        'relative rounded-xl border p-4 pr-12 sm:p-5 sm:pr-14',
        approved
          ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
          : 'border-rose-300 bg-rose-50/80 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.dismiss}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg opacity-70 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex items-start gap-3">
        {approved ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-bold">{approved ? t.approvedTitle : t.rejectedTitle}</p>
            <p className="text-sm opacity-90">
              {approved ? t.approvedBody : t.rejectedBody}{' '}
              <span className="whitespace-nowrap opacity-80">
                · {METHOD_LABEL[latest.method]} {formatBDT(latest.amount)} · {t.trx} {latest.trxId}
              </span>
            </p>
          </div>
          {latest.reviewNote ? <AdminNote note={latest.reviewNote} t={t} /> : null}
          {!approved && isFree ? (
            <>
              <Button size="sm" className="min-h-9 bg-amber-500 text-white hover:bg-amber-600" onClick={() => setUpgradeOpen(true)}>
                <Crown className="mr-1.5 h-4 w-4" aria-hidden /> {t.payAgain}
              </Button>
              <UpgradeDialog tournamentId={tournamentId} open={upgradeOpen} onOpenChange={setUpgradeOpen} onSubmitted={() => void refetch()} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** Every Pro payment for this tournament: status, dates and the admin's note. */
export function PaymentHistory({ tournamentId }: { tournamentId: string }) {
  const t = useStrings<PaymentStrings>(STRINGS)
  const lang = useLang()
  const { data } = useCachedGet<{ payments: PaymentDTO[] }>(paymentsUrl(tournamentId))
  const payments = data?.payments ?? []
  if (payments.length === 0) return null

  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-primary" aria-hidden /> {t.historyTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {payments.map((p) => (
            <li key={p.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold tabular-nums">
                    {METHOD_LABEL[p.method]} · {formatBDT(p.amount)}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {t.trx} {p.trxId}
                  </p>
                </div>
                <StatusBadge status={p.status} t={t} />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.submitted(formatDate(p.createdAt, true, lang))}
                {p.reviewedAt ? ` · ${t.reviewed(t.status[p.status], formatDate(p.reviewedAt, true, lang))}` : ''}
              </p>
              {p.status === 'PENDING' ? <p className="text-xs text-muted-foreground">{t.waiting}</p> : null}
              {p.reviewNote ? <AdminNote note={p.reviewNote} t={t} /> : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
