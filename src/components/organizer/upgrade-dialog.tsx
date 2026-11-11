'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock, Copy, Crown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiPost, ApiError } from '@/lib/api'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { copyText } from '@/lib/clipboard'
import { formatBDT, formatDate } from '@/lib/format'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import type { PaymentDTO, PaymentMethod, PlanInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

export const PLANS_URL = '/api/plans'
export const paymentsUrl = (tournamentId: string) => `/api/tournaments/${tournamentId}/payments`

const STRINGS = {
  en: {
    title: 'Upgrade to Pro',
    desc: (price: string) => `A one-time payment of ${price} for this tournament. No subscription.`,
    unlocks: 'Pro unlocks',
    perks: [
      'Unlimited teams and players',
      'SMS updates to players and managers',
      'Sponsor logos on the room, stream overlay and share cards',
      'No “Powered by NeelamGhor” watermark on the stream overlay',
    ],
    refundPolicy: 'Refund policy',
    step1: 'Step 1 — Send the money',
    step2: 'Step 2 — Tell us the Transaction ID',
    defaultInstructions: 'Use “Send Money” to one of the numbers below, then keep the Transaction ID (TrxID) from the confirmation SMS.',
    amount: 'Amount',
    paid: 'I’ve paid — next',
    back: 'Back',
    method: 'Paid with',
    trxId: 'Transaction ID (TrxID)',
    trxPlaceholder: 'e.g. 9F7A6B5C4D',
    trxHelp: '6–20 letters and numbers, from the payment confirmation SMS.',
    sender: 'Number you paid from',
    senderPlaceholder: '01XXXXXXXXX',
    submit: 'Submit payment',
    submitted: 'Payment submitted — we’ll activate Pro after checking it, usually within a few hours',
    submitFailed: 'Could not submit the payment',
    trxInvalid: 'Enter the Transaction ID from your payment message (6–20 letters and numbers).',
    senderInvalid: 'Enter the mobile number you paid from, e.g. 01712345678.',
    pickMethod: 'Choose bKash or Nagad.',
    underReview: 'Payment under review',
    underReviewDesc: (method: string, trx: string, date: string) =>
      `${method} payment ${trx}, submitted ${date}. Pro turns on as soon as an admin verifies it.`,
    notSetUp: 'Online payment isn’t set up yet. Please contact NeelamGhor support to upgrade.',
    loadFailed: 'Could not load the Pro price',
    close: 'Close',
    copied: 'Copied',
    copyAria: (what: string) => `Copy ${what}`,
  },
  bn: {
    title: 'Pro-তে আপগ্রেড করুন',
    desc: (price: string) => `এই টুর্নামেন্টের জন্য এককালীন ${price}। কোনো মাসিক চার্জ নেই।`,
    unlocks: 'Pro-তে যা পাবেন',
    perks: [
      'সীমাহীন দল ও খেলোয়াড়',
      'খেলোয়াড় ও ম্যানেজারদের SMS আপডেট',
      'রুম, স্ট্রিম ওভারলে ও শেয়ার কার্ডে স্পনসরের লোগো',
      'স্ট্রিম ওভারলেতে “Powered by NeelamGhor” জলছাপ থাকবে না',
    ],
    refundPolicy: 'রিফান্ড নীতি',
    step1: 'ধাপ ১ — টাকা পাঠান',
    step2: 'ধাপ ২ — ট্রানজেকশন আইডি দিন',
    defaultInstructions: 'নিচের যেকোনো নম্বরে “Send Money” করুন, তারপর কনফার্মেশন SMS থেকে ট্রানজেকশন আইডি (TrxID) রেখে দিন।',
    amount: 'পরিমাণ',
    paid: 'টাকা পাঠিয়েছি — পরের ধাপ',
    back: 'পেছনে',
    method: 'যেভাবে পাঠিয়েছেন',
    trxId: 'ট্রানজেকশন আইডি (TrxID)',
    trxPlaceholder: 'যেমন: 9F7A6B5C4D',
    trxHelp: 'পেমেন্টের কনফার্মেশন SMS-এ থাকা 6–20 অক্ষর ও সংখ্যা।',
    sender: 'যে নম্বর থেকে পাঠিয়েছেন',
    senderPlaceholder: '01XXXXXXXXX',
    submit: 'পেমেন্ট জমা দিন',
    submitted: 'পেমেন্ট জমা হয়েছে — যাচাইয়ের পর Pro চালু হবে, সাধারণত কয়েক ঘণ্টার মধ্যে',
    submitFailed: 'পেমেন্ট জমা দেওয়া যায়নি',
    trxInvalid: 'পেমেন্ট মেসেজের ট্রানজেকশন আইডি দিন (6–20 অক্ষর ও সংখ্যা)।',
    senderInvalid: 'যে মোবাইল নম্বর থেকে পাঠিয়েছেন সেটি দিন, যেমন 01712345678।',
    pickMethod: 'bKash বা Nagad বেছে নিন।',
    underReview: 'পেমেন্ট যাচাই হচ্ছে',
    underReviewDesc: (method: string, trx: string, date: string) =>
      `${method} পেমেন্ট ${trx}, জমা ${date}। অ্যাডমিন যাচাই করলেই Pro চালু হবে।`,
    notSetUp: 'অনলাইন পেমেন্ট এখনো চালু হয়নি। আপগ্রেড করতে NeelamGhor সাপোর্টে যোগাযোগ করুন।',
    loadFailed: 'Pro-এর দাম লোড করা যায়নি',
    close: 'বন্ধ করুন',
    copied: 'কপি হয়েছে',
    copyAria: (what: string) => `${what} কপি করুন`,
  },
} satisfies Strings<{
  title: string
  desc: (price: string) => string
  unlocks: string
  perks: string[]
  refundPolicy: string
  step1: string
  step2: string
  defaultInstructions: string
  amount: string
  paid: string
  back: string
  method: string
  trxId: string
  trxPlaceholder: string
  trxHelp: string
  sender: string
  senderPlaceholder: string
  submit: string
  submitted: string
  submitFailed: string
  trxInvalid: string
  senderInvalid: string
  pickMethod: string
  underReview: string
  underReviewDesc: (method: string, trx: string, date: string) => string
  notSetUp: string
  loadFailed: string
  close: string
  copied: string
  copyAria: (what: string) => string
}>

export const METHOD_LABEL: Record<PaymentMethod, string> = { BKASH: 'bKash', NAGAD: 'Nagad' }
const METHOD_CLASS: Record<PaymentMethod, string> = {
  BKASH: 'border-pink-300 bg-pink-50 text-pink-900 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-200',
  NAGAD: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
}

/** Client-side mirror of the server's checks (the server re-validates). */
export const TRX_RE = /^[A-Z0-9]{6,20}$/
export const normalizeTrx = (s: string) => s.replace(/\s/g, '').toUpperCase()
export function looksLikeBdMobile(s: string): boolean {
  let d = s.replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('880')) d = '0' + d.slice(3)
  return /^01[3-9]\d{8}$/.test(d)
}

/** The bKash / Nagad numbers to pay, each with a copy button (also used on the player sign-up page). */
export function PayNumbers({
  bkash,
  nagad,
  amount,
}: {
  bkash: string | null
  nagad: string | null
  amount: number
}) {
  const t = useStrings(STRINGS)
  const rows = [
    ...(bkash ? [{ method: 'BKASH' as const, number: bkash }] : []),
    ...(nagad ? [{ method: 'NAGAD' as const, number: nagad }] : []),
  ]
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
        <span className="text-sm text-muted-foreground">{t.amount}</span>
        <span className="flex items-center gap-1">
          <span className="text-lg font-black tabular-nums">{formatBDT(amount)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={t.copyAria(formatBDT(amount))}
            onClick={() => copyText(String(amount), t.copied)}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.method} className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2', METHOD_CLASS[r.method])}>
          <span className="text-sm font-bold">{METHOD_LABEL[r.method]}</span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-base font-bold tracking-wide">{r.number}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t.copyAria(`${METHOD_LABEL[r.method]} ${r.number}`)}
              onClick={() => copyText(r.number, t.copied)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </span>
        </div>
      ))}
    </div>
  )
}

export interface PaymentFieldsValue {
  method: PaymentMethod | null
  trxId: string
  sender: string
}

/** Method / Transaction ID / sender number fields (also used on the player sign-up page). */
export function PaymentFields({
  methods,
  value,
  onChange,
  idPrefix,
  disabled,
}: {
  methods: PaymentMethod[]
  value: PaymentFieldsValue
  onChange: (v: PaymentFieldsValue) => void
  idPrefix: string
  disabled?: boolean
}) {
  const t = useStrings(STRINGS)
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t.method}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {methods.map((m) => {
            const active = value.method === m
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange({ ...value, method: m })}
                className={cn(
                  'flex h-11 items-center justify-center gap-1.5 rounded-lg border-2 text-sm font-bold transition-colors',
                  active ? METHOD_CLASS[m] + ' border-current' : 'border-border hover:bg-muted/50',
                )}
              >
                {active ? <Check className="h-4 w-4" aria-hidden /> : null}
                {METHOD_LABEL[m]}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-trx`}>{t.trxId}</Label>
        <Input
          id={`${idPrefix}-trx`}
          value={value.trxId}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          onChange={(e) => onChange({ ...value, trxId: e.target.value.toUpperCase() })}
          placeholder={t.trxPlaceholder}
          className="h-11 font-mono uppercase tracking-wider"
        />
        <p className="text-xs text-muted-foreground">{t.trxHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-sender`}>{t.sender}</Label>
        <Input
          id={`${idPrefix}-sender`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value.sender}
          disabled={disabled}
          maxLength={20}
          onChange={(e) => onChange({ ...value, sender: e.target.value })}
          placeholder={t.senderPlaceholder}
          className="h-11"
        />
      </div>
    </div>
  )
}

/** Error message for the payment fields, or null when they look right. */
export function usePaymentFieldsError(): (v: PaymentFieldsValue) => string | null {
  const t = useStrings(STRINGS)
  return (v) => {
    if (!v.method) return t.pickMethod
    if (!TRX_RE.test(normalizeTrx(v.trxId))) return t.trxInvalid
    if (!looksLikeBdMobile(v.sender)) return t.senderInvalid
    return null
  }
}

/**
 * Pay for this tournament's Pro plan: step 1 shows where to send the money,
 * step 2 takes the Transaction ID; an admin then verifies it.
 * Only the tournament owner (or an ADMIN) may open it.
 */
export function UpgradeDialog({
  tournamentId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  tournamentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {/* Mounted only while open, so it fetches fresh and starts at step 1. */}
        {open ? <UpgradeBody tournamentId={tournamentId} onClose={() => onOpenChange(false)} onSubmitted={onSubmitted} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function UpgradeBody({
  tournamentId,
  onClose,
  onSubmitted,
}: {
  tournamentId: string
  onClose: () => void
  onSubmitted?: () => void
}) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const plans = useCachedGet<PlanInfo>(PLANS_URL)
  const payments = useCachedGet<{ payments: PaymentDTO[] }>(paymentsUrl(tournamentId))
  const [step, setStep] = useState<1 | 2>(1)
  const [busy, setBusy] = useState(false)
  const methods: PaymentMethod[] = [
    ...(plans.data?.bkashNumber ? (['BKASH'] as const) : []),
    ...(plans.data?.nagadNumber ? (['NAGAD'] as const) : []),
  ]
  const [fields, setFields] = useState<PaymentFieldsValue>({ method: null, trxId: '', sender: '' })
  const fieldsError = usePaymentFieldsError()
  const method = fields.method ?? (methods.length === 1 ? methods[0] : null)
  const pending = payments.data?.payments.find((p) => p.status === 'PENDING')

  const price = plans.data ? formatBDT(plans.data.proPrice) : '…'

  async function submit() {
    const value = { ...fields, method }
    const err = fieldsError(value)
    if (err) {
      toast.error(err)
      return
    }
    setBusy(true)
    try {
      await apiPost(paymentsUrl(tournamentId), { method, trxId: normalizeTrx(fields.trxId), senderNumber: fields.sender.trim() })
      invalidateCached(paymentsUrl(tournamentId))
      toast.success(t.submitted)
      onSubmitted?.()
      onClose()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.submitFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" aria-hidden /> {t.title}
        </DialogTitle>
        <DialogDescription>
          {t.desc(price)}{' '}
          {/* New tab: the dialog (and a half-entered payment) stays as it is. */}
          <a href="/terms#refunds" target="_blank" rel="noopener" className="font-medium text-foreground underline underline-offset-2">
            {t.refundPolicy}
          </a>
        </DialogDescription>
      </DialogHeader>

      {plans.loading || payments.loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !plans.data ? (
        <p className="text-sm text-rose-700 dark:text-rose-400">{t.loadFailed}</p>
      ) : pending ? (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{t.underReview}</p>
            <p className="text-sm">{t.underReviewDesc(METHOD_LABEL[pending.method], pending.trxId, formatDate(pending.createdAt, true, lang))}</p>
          </div>
        </div>
      ) : methods.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t.notSetUp}</p>
      ) : step === 1 ? (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.unlocks}</p>
            <ul className="space-y-1">
              {t.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden /> {perk}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t.step1}</p>
            <p className="text-sm text-muted-foreground">{plans.data.instructions || t.defaultInstructions}</p>
            <PayNumbers bkash={plans.data.bkashNumber} nagad={plans.data.nagadNumber} amount={plans.data.proPrice} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{t.step2}</p>
          <PaymentFields
            methods={methods}
            value={{ ...fields, method }}
            onChange={setFields}
            idPrefix="pro-pay"
            disabled={busy}
          />
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        {!plans.data || pending || methods.length === 0 ? (
          <Button variant="outline" onClick={onClose}>
            {t.close}
          </Button>
        ) : step === 1 ? (
          <Button className="min-h-10 w-full sm:w-auto" onClick={() => setStep(2)}>
            {t.paid} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> {t.back}
            </Button>
            <Button className="min-h-10" onClick={() => void submit()} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-1.5 h-4 w-4" aria-hidden />}
              {t.submit}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}
