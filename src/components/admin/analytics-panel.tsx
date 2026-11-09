'use client'

import { useState } from 'react'
import { BarChart3, Crown, Gavel, MessageSquare, Trophy, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { useCachedGet } from '@/lib/api-cache'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface DayPoint {
  day: string
  count: number
}
interface FunnelStep {
  step: 'signed_up' | 'created_tournament' | 'created_auction' | 'completed_auction' | 'went_pro'
  count: number
}
interface AnalyticsResponse {
  days: number
  since: string
  events: Record<string, number>
  series: { signup: DayPoint[]; tournament_created: DayPoint[]; auction_completed: DayPoint[] }
  funnel: FunnelStep[]
  tournamentFunnel: FunnelStep[]
  totals: {
    users: number
    organizers: number
    managers: number
    tournaments: number
    auctions: number
    completedAuctions: number
    proTournaments: number
    sms: Record<string, number>
  }
}

const RANGES = [7, 30, 90] as const

const STRINGS = {
  en: {
    title: 'Growth & funnel',
    desc: 'First-party, server-side events only — no cookies or third-party trackers.',
    lastDays: (n: number) => `${n} days`,
    what: 'analytics',
    users: 'Users',
    usersHint: (o: number, m: number) => `${o} organizers · ${m} managers`,
    tournaments: 'Tournaments',
    auctions: 'Auctions run',
    auctionsHint: (c: number) => `${c} completed`,
    pro: 'Pro tournaments',
    sms: 'SMS sent',
    smsHint: (f: number, p: number) => `${f} failed · ${p} queued (period)`,
    seriesSignup: 'Sign-ups',
    seriesTournament: 'New tournaments',
    seriesCompleted: 'Auctions completed',
    seriesNote: 'Sign-ups and new tournaments come from the accounts and tournaments tables; completed auctions from tracked events.',
    total: (n: number) => `${n} in period`,
    funnelTitle: 'Organizer funnel',
    funnelDesc: (n: number) => `Organizers who signed up in the last ${n} days, and how far they got.`,
    tFunnelTitle: 'Tournament funnel',
    tFunnelDesc: (n: number) => `Tournaments created in the last ${n} days.`,
    steps: {
      signed_up: 'Signed up',
      created_tournament: 'Created a tournament',
      created_auction: 'Created an auction',
      completed_auction: 'Completed an auction',
      went_pro: 'Went Pro',
    } as Record<FunnelStep['step'], string>,
    ofStart: (p: string) => `${p} of start`,
    fromPrev: (p: string) => `${p} from previous step`,
    eventsTitle: 'Events in period',
    noEvents: 'No events recorded in this period yet.',
  },
  bn: {
    title: 'প্রবৃদ্ধি ও ফানেল',
    desc: 'শুধু নিজস্ব সার্ভার-সাইড ইভেন্ট — কোনো কুকি বা তৃতীয় পক্ষের ট্র্যাকার নেই।',
    lastDays: (n: number) => `${n} দিন`,
    what: 'অ্যানালিটিক্স',
    users: 'ব্যবহারকারী',
    usersHint: (o: number, m: number) => `${o} আয়োজক · ${m} ম্যানেজার`,
    tournaments: 'টুর্নামেন্ট',
    auctions: 'নিলাম হয়েছে',
    auctionsHint: (c: number) => `${c}টি সম্পন্ন`,
    pro: 'Pro টুর্নামেন্ট',
    sms: 'SMS পাঠানো হয়েছে',
    smsHint: (f: number, p: number) => `${f}টি ব্যর্থ · ${p}টি অপেক্ষমাণ (এই সময়ে)`,
    seriesSignup: 'নতুন অ্যাকাউন্ট',
    seriesTournament: 'নতুন টুর্নামেন্ট',
    seriesCompleted: 'সম্পন্ন নিলাম',
    seriesNote: 'নতুন অ্যাকাউন্ট ও টুর্নামেন্টের হিসাব মূল টেবিল থেকে; সম্পন্ন নিলামের হিসাব ট্র্যাক করা ইভেন্ট থেকে।',
    total: (n: number) => `এই সময়ে ${n}`,
    funnelTitle: 'আয়োজকদের ফানেল',
    funnelDesc: (n: number) => `গত ${n} দিনে অ্যাকাউন্ট খোলা আয়োজকেরা কতদূর এগিয়েছেন।`,
    tFunnelTitle: 'টুর্নামেন্টের ফানেল',
    tFunnelDesc: (n: number) => `গত ${n} দিনে তৈরি হওয়া টুর্নামেন্ট।`,
    steps: {
      signed_up: 'অ্যাকাউন্ট খুলেছেন',
      created_tournament: 'টুর্নামেন্ট তৈরি করেছেন',
      created_auction: 'নিলাম তৈরি করেছেন',
      completed_auction: 'নিলাম শেষ করেছেন',
      went_pro: 'Pro নিয়েছেন',
    } as Record<FunnelStep['step'], string>,
    ofStart: (p: string) => `শুরুর ${p}`,
    fromPrev: (p: string) => `আগের ধাপের ${p}`,
    eventsTitle: 'এই সময়ের ইভেন্ট',
    noEvents: 'এই সময়ে এখনো কোনো ইভেন্ট রেকর্ড হয়নি।',
  },
} satisfies Strings<{
  title: string
  desc: string
  lastDays: (n: number) => string
  what: string
  users: string
  usersHint: (o: number, m: number) => string
  tournaments: string
  auctions: string
  auctionsHint: (c: number) => string
  pro: string
  sms: string
  smsHint: (f: number, p: number) => string
  seriesSignup: string
  seriesTournament: string
  seriesCompleted: string
  seriesNote: string
  total: (n: number) => string
  funnelTitle: string
  funnelDesc: (n: number) => string
  tFunnelTitle: string
  tFunnelDesc: (n: number) => string
  steps: Record<FunnelStep['step'], string>
  ofStart: (p: string) => string
  fromPrev: (p: string) => string
  eventsTitle: string
  noEvents: string
}>

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')

/** Plain-div daily bar chart; the tallest day fills the height. */
function DailyBars({ title, points, tone, totalLabel }: { title: string; points: DayPoint[]; tone: string; totalLabel: (n: number) => string }) {
  const lang = useLang()
  const max = Math.max(1, ...points.map((p) => p.count))
  const total = points.reduce((s, p) => s + p.count, 0)
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${day}T00:00:00Z`),
    )
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{totalLabel(total)}</p>
        </div>
        <div className="flex h-24 items-end gap-px" role="img" aria-label={`${title}: ${totalLabel(total)}`}>
          {points.map((p) => (
            <div
              key={p.day}
              title={`${dayLabel(p.day)}: ${p.count}`}
              className={cn('min-w-0 flex-1 rounded-t-sm', p.count > 0 ? tone : 'bg-muted')}
              style={{ height: p.count > 0 ? `${Math.max(6, (p.count / max) * 100)}%` : '3px' }}
            />
          ))}
        </div>
        {points.length > 0 ? (
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{dayLabel(points[0].day)}</span>
            <span>{dayLabel(points[points.length - 1].day)}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Funnel({ title, desc, steps }: { title: string; desc: string; steps: FunnelStep[] }) {
  const t = useStrings(STRINGS)
  const start = steps[0]?.count ?? 0
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const width = start > 0 ? Math.max(2, (s.count / start) * 100) : 0
            return (
              <li key={s.step} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{t.steps[s.step]}</span>
                  <span className="tabular-nums">
                    <strong>{s.count}</strong>
                    {i > 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.fromPrev(pct(s.count, steps[i - 1].count))} · {t.ofStart(pct(s.count, start))}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-teal-600 transition-[width]" style={{ width: `${width}%` }} />
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPanel() {
  const t = useStrings(STRINGS)
  const [days, setDays] = useState<number>(30)
  const { data, loading, error, refetch } = useCachedGet<AnalyticsResponse>(`/api/admin/analytics?days=${days}`)

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="h-5 w-5 text-teal-700 dark:text-teal-400" aria-hidden /> {t.title}
        </h2>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </div>
      <div className="flex gap-1" role="group" aria-label={t.title}>
        {RANGES.map((n) => (
          <Button
            key={n}
            size="sm"
            variant={days === n ? 'default' : 'outline'}
            aria-pressed={days === n}
            className="min-h-9"
            onClick={() => setDays(n)}
          >
            {t.lastDays(n)}
          </Button>
        ))}
      </div>
    </div>
  )

  if (!data) {
    return (
      <div className="space-y-4">
        {header}
        {error && !loading ? (
          <LoadError what={t.what} error={error} onRetry={refetch} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )}
      </div>
    )
  }

  const { totals } = data
  const events = Object.entries(data.events).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      {header}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t.users} value={totals.users} icon={Users} hint={t.usersHint(totals.organizers, totals.managers)} />
        <StatCard label={t.tournaments} value={totals.tournaments} icon={Trophy} />
        <StatCard label={t.auctions} value={totals.auctions} icon={Gavel} hint={t.auctionsHint(totals.completedAuctions)} />
        <StatCard label={t.pro} value={totals.proTournaments} icon={Crown} tone="primary" />
        <StatCard
          label={t.sms}
          value={totals.sms.SENT ?? 0}
          icon={MessageSquare}
          hint={t.smsHint(totals.sms.FAILED ?? 0, totals.sms.PENDING ?? 0)}
          tone={(totals.sms.FAILED ?? 0) > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DailyBars title={t.seriesSignup} points={data.series.signup} tone="bg-teal-600" totalLabel={t.total} />
        <DailyBars title={t.seriesTournament} points={data.series.tournament_created} tone="bg-sky-600" totalLabel={t.total} />
        <DailyBars title={t.seriesCompleted} points={data.series.auction_completed} tone="bg-amber-500" totalLabel={t.total} />
      </div>
      <p className="text-xs text-muted-foreground">{t.seriesNote}</p>

      <div className="grid gap-3 lg:grid-cols-2">
        <Funnel title={t.funnelTitle} desc={t.funnelDesc(data.days)} steps={data.funnel} />
        <Funnel title={t.tFunnelTitle} desc={t.tFunnelDesc(data.days)} steps={data.tournamentFunnel} />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <p className="font-semibold">{t.eventsTitle}</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noEvents}</p>
          ) : (
            <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {events.map(([name, count]) => (
                <li key={name} className="flex items-center justify-between gap-3 border-b border-dashed py-1">
                  <code className="text-xs">{name}</code>
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
