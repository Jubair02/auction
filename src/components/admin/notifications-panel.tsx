'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterChips } from '@/components/shared/filter-chips'
import { LoadError } from '@/components/shared/load-error'
import { apiPatch, ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { formatDate } from '@/lib/format'
import { type Strings, useLang, useStrings } from '@/lib/i18n'

type Status = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'
type Filter = 'ALL' | Status

interface OutboxRow {
  id: string
  to: string
  body: string
  kind: string
  tournamentId: string | null
  tournamentName: string | null
  status: Status
  attempts: number
  lastError: string | null
  sendAfter: string
  sentAt: string | null
  createdAt: string
}
interface OutboxResponse {
  counts: Record<Status, number>
  notifications: OutboxRow[]
}

const STATUS_TONES: Record<Status, string> = {
  PENDING: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60',
  SENT: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60',
  FAILED: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60',
  SKIPPED: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
}

const STRINGS = {
  en: {
    title: 'SMS outbox',
    desc: 'Messages queued by the site and delivered by the auction service. Numbers show only their last 3 digits.',
    what: 'the SMS outbox',
    all: 'All',
    status: { PENDING: 'Queued', SENT: 'Sent', FAILED: 'Failed', SKIPPED: 'Skipped' } as Record<Status, string>,
    kinds: {
      REG_APPROVED: 'Registration approved',
      REG_REJECTED: 'Registration not accepted',
      AUCTION_REMINDER: 'Auction reminder',
      PLAYER_SOLD: 'Player sold',
    } as Record<string, string>,
    retryFailed: (n: number) => `Retry failed (${n})`,
    retried: (n: number) => `${n} message${n === 1 ? '' : 's'} queued again`,
    retryError: 'Could not retry the failed messages',
    emptyTitle: 'No messages here',
    emptyDesc: 'Messages appear once a Pro tournament with SMS turned on sends something.',
    attempts: (n: number) => `${n} attempt${n === 1 ? '' : 's'}`,
    sentAt: (d: string) => `sent ${d}`,
    nextTry: (d: string) => `next try ${d}`,
  },
  bn: {
    title: 'SMS আউটবক্স',
    desc: 'সাইট যে বার্তাগুলো সারিতে রাখে, নিলাম সার্ভিস সেগুলো পাঠায়। নম্বরের শুধু শেষ ৩টি সংখ্যা দেখানো হয়।',
    what: 'SMS আউটবক্স',
    all: 'সব',
    status: { PENDING: 'অপেক্ষমাণ', SENT: 'পাঠানো হয়েছে', FAILED: 'ব্যর্থ', SKIPPED: 'বাদ দেওয়া' } as Record<Status, string>,
    kinds: {
      REG_APPROVED: 'নিবন্ধন অনুমোদিত',
      REG_REJECTED: 'নিবন্ধন গৃহীত হয়নি',
      AUCTION_REMINDER: 'নিলামের রিমাইন্ডার',
      PLAYER_SOLD: 'খেলোয়াড় বিক্রি',
    } as Record<string, string>,
    retryFailed: (n: number) => `ব্যর্থগুলো আবার পাঠান (${n})`,
    retried: (n: number) => `${n}টি বার্তা আবার সারিতে রাখা হয়েছে`,
    retryError: 'ব্যর্থ বার্তাগুলো আবার পাঠানো যায়নি',
    emptyTitle: 'এখানে কোনো বার্তা নেই',
    emptyDesc: 'SMS চালু থাকা কোনো Pro টুর্নামেন্ট বার্তা পাঠালে এখানে দেখা যাবে।',
    attempts: (n: number) => `${n} বার চেষ্টা`,
    sentAt: (d: string) => `পাঠানো ${d}`,
    nextTry: (d: string) => `পরের চেষ্টা ${d}`,
  },
} satisfies Strings<{
  title: string
  desc: string
  what: string
  all: string
  status: Record<Status, string>
  kinds: Record<string, string>
  retryFailed: (n: number) => string
  retried: (n: number) => string
  retryError: string
  emptyTitle: string
  emptyDesc: string
  attempts: (n: number) => string
  sentAt: (d: string) => string
  nextTry: (d: string) => string
}>

const FILTERS: Filter[] = ['ALL', 'PENDING', 'SENT', 'FAILED', 'SKIPPED']

export default function NotificationsPanel() {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [retrying, setRetrying] = useState(false)
  const url = `/api/admin/notifications?limit=100${filter === 'ALL' ? '' : `&status=${filter}`}`
  const { data, loading, error, refetch } = useCachedGet<OutboxResponse>(url)

  const failed = data?.counts.FAILED ?? 0
  const total = data ? Object.values(data.counts).reduce((s, n) => s + n, 0) : 0

  const retryFailed = async () => {
    setRetrying(true)
    try {
      const res = await apiPatch<{ reset: number }>('/api/admin/notifications', { action: 'retry_failed' })
      toast.success(t.retried(res.reset))
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.retryError)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <MessageSquare className="h-5 w-5 text-teal-700 dark:text-teal-400" aria-hidden /> {t.title}
          </h2>
          <p className="text-sm text-muted-foreground">{t.desc}</p>
        </div>
        <Button variant="outline" className="min-h-10" disabled={failed === 0 || retrying} onClick={() => void retryFailed()}>
          {retrying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />}
          {t.retryFailed(failed)}
        </Button>
      </div>

      <FilterChips
        label={t.title}
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({
          key: f,
          label: f === 'ALL' ? t.all : t.status[f],
          count: data ? (f === 'ALL' ? total : (data.counts[f] ?? 0)) : 0,
        }))}
      />

      {!data ? (
        error && !loading ? (
          <LoadError what={t.what} error={error} onRetry={refetch} />
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        )
      ) : data.notifications.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t.emptyTitle} description={t.emptyDesc} />
      ) : (
        <ul className="space-y-2">
          {data.notifications.map((n) => (
            <li key={n.id}>
              <Card className="py-0">
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className={STATUS_TONES[n.status]}>
                      {t.status[n.status] ?? n.status}
                    </Badge>
                    <span className="font-medium">{t.kinds[n.kind] ?? n.kind}</span>
                    <span className="font-mono text-xs text-muted-foreground">{n.to}</span>
                    {n.tournamentName ? <span className="truncate text-muted-foreground">· {n.tournamentName}</span> : null}
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(n.createdAt, true, lang)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{n.body}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{t.attempts(n.attempts)}</span>
                    {n.sentAt ? <span>{t.sentAt(formatDate(n.sentAt, true, lang))}</span> : null}
                    {n.status === 'PENDING' && n.attempts > 0 ? <span>{t.nextTry(formatDate(n.sendAfter, true, lang))}</span> : null}
                    {n.lastError ? <span className="break-all text-rose-700 dark:text-rose-400">{n.lastError}</span> : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
