'use client'

import { useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Award, CalendarRange, Copy, Lock, MapPin, MessageCircle, Rocket, Share2, Table2, Trophy } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { brandPalette } from '@/lib/brand-color'
import { formatDate } from '@/lib/format'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { useAuthState } from '@/lib/store'
import { sportLabel, type LeagueData, type MatchDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { SponsorStrip } from '@/components/shared/sponsor-strip'
import { FixturesList } from './fixtures-list'
import { Leaderboards } from './leaderboards'
import { PointsTables } from './points-table'
import { useLeagueLabels } from './labels'

const STRINGS = {
  en: {
    what: 'this league',
    unavailable: 'This league page isn’t available',
    unavailableDesc: 'It may be private, or the link may be wrong. Ask the organizer for the link.',
    home: 'NeelamGhor home',
    back: 'Back to tournament',
    backTeam: 'Back to my team',
    fixtures: 'Fixtures',
    results: 'Results',
    table: 'Points table',
    top: 'Top performers',
    noUpcoming: 'No upcoming matches',
    noUpcomingDesc: 'Every scheduled match has been played.',
    noResults: 'No results yet',
    noResultsDesc: 'Results appear here as soon as matches finish.',
    noFixtures: 'Fixtures coming soon',
    noFixturesDesc: 'The organizer has not published the fixtures yet.',
    noTable: 'No points table',
    noTableDesc: 'This is a knockout tournament — follow the bracket under Fixtures.',
    played: (done: number, total: number) => `${done}/${total} matches played`,
    share: 'Share',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    copy: 'Copy link',
    copied: 'Link copied',
    copyFailed: 'Could not copy — copy the address from your browser instead.',
    shareText: (name: string) => `${name} — fixtures, results and points table`,
    privateNote: 'Only staff and team managers can see this page. Turn on "Public results page" in Edit tournament to share it.',
    powered: 'Powered by NeelamGhor',
    ctaTitle: 'Running a tournament?',
    ctaSub: 'Live player auction, fixtures, points table and stats — free to start.',
    ctaButton: 'Start free',
  },
  bn: {
    what: 'এই লিগ',
    unavailable: 'এই লিগ পেজটি দেখা যাচ্ছে না',
    unavailableDesc: 'পেজটি প্রাইভেট হতে পারে, অথবা লিংক ভুল। আয়োজকের কাছ থেকে লিংক নিন।',
    home: 'NeelamGhor হোম',
    back: 'টুর্নামেন্টে ফিরে যান',
    backTeam: 'আমার দলে ফিরে যান',
    fixtures: 'ফিকচার',
    results: 'ফলাফল',
    table: 'পয়েন্ট টেবিল',
    top: 'সেরা পারফরমার',
    noUpcoming: 'সামনে কোনো ম্যাচ নেই',
    noUpcomingDesc: 'নির্ধারিত সব ম্যাচ খেলা হয়ে গেছে।',
    noResults: 'এখনো কোনো ফলাফল নেই',
    noResultsDesc: 'ম্যাচ শেষ হলেই ফলাফল এখানে দেখা যাবে।',
    noFixtures: 'ফিকচার শিগগিরই আসছে',
    noFixturesDesc: 'আয়োজক এখনো ফিকচার প্রকাশ করেননি।',
    noTable: 'পয়েন্ট টেবিল নেই',
    noTableDesc: 'এটি নকআউট টুর্নামেন্ট — ফিকচারে ব্র্যাকেট দেখুন।',
    played: (done: number, total: number) => `${done}/${total} ম্যাচ খেলা হয়েছে`,
    share: 'শেয়ার',
    whatsapp: 'হোয়াটসঅ্যাপ',
    facebook: 'ফেসবুক',
    copy: 'লিংক কপি',
    copied: 'লিংক কপি হয়েছে',
    copyFailed: 'কপি করা যায়নি — ব্রাউজারের ঠিকানা থেকে কপি করুন।',
    shareText: (name: string) => `${name} — ফিকচার, ফলাফল ও পয়েন্ট টেবিল`,
    privateNote: 'এই পেজ শুধু স্টাফ ও টিম ম্যানেজাররা দেখতে পারেন। শেয়ার করতে "টুর্নামেন্ট সম্পাদনা"-য় "ফলাফলের পাবলিক পেজ" চালু করুন।',
    powered: 'NeelamGhor দ্বারা পরিচালিত',
    ctaTitle: 'টুর্নামেন্ট চালাচ্ছেন?',
    ctaSub: 'লাইভ প্লেয়ার নিলাম, ফিকচার, পয়েন্ট টেবিল আর পরিসংখ্যান — শুরু করা ফ্রি।',
    ctaButton: 'ফ্রি শুরু করুন',
  },
} satisfies Strings<{
  what: string
  unavailable: string
  unavailableDesc: string
  home: string
  back: string
  backTeam: string
  fixtures: string
  results: string
  table: string
  top: string
  noUpcoming: string
  noUpcomingDesc: string
  noResults: string
  noResultsDesc: string
  noFixtures: string
  noFixturesDesc: string
  noTable: string
  noTableDesc: string
  played: (done: number, total: number) => string
  share: string
  whatsapp: string
  facebook: string
  copy: string
  copied: string
  copyFailed: string
  shareText: (name: string) => string
  privateNote: string
  powered: string
  ctaTitle: string
  ctaSub: string
  ctaButton: string
}>

type View = 'fixtures' | 'results' | 'table' | 'top'
const isPlayed = (m: MatchDTO) => m.status === 'COMPLETED' || m.status === 'ABANDONED'

/** Public league page (/league/:tournamentId): fixtures, results, points table, top performers. */
export default function LeaguePublicView({ tournamentId }: { tournamentId: string }) {
  const t = useStrings(STRINGS)
  // Signed out: the cacheable public view (shared links get busy).
  const signedOut = !useAuthState().user
  const { data, loading, error, refetch } = useCachedGet<LeagueData>(`/api/league/${tournamentId}${signedOut ? '?view=public' : ''}`)

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-10 w-full max-w-80" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (!data) {
    const missing = error instanceof ApiError && [401, 403, 404].includes(error.status)
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        {missing ? (
          <EmptyState
            icon={Lock}
            title={t.unavailable}
            description={t.unavailableDesc}
            action={
              <Button variant="outline" asChild>
                <AppLink href="/">{t.home}</AppLink>
              </Button>
            }
          />
        ) : (
          <LoadError what={t.what} error={error} onRetry={refetch} />
        )}
      </div>
    )
  }
  return <LeaguePage data={data} />
}

function LeaguePage({ data }: { data: LeagueData }) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const lang = useLang()
  const signedIn = !!useAuthState().user
  const branding = data.branding
  const palette = brandPalette(branding?.brandColor)
  const hidePlatform = branding?.hidePlatform ?? false
  const { tournament } = data

  const upcoming = data.matches.filter((m) => !isPlayed(m))
  const results = [...data.matches.filter(isPlayed)].reverse()
  const hasTable = data.standings.length > 0
  const [view, setView] = useState<View>(upcoming.length > 0 || results.length === 0 ? 'fixtures' : 'results')

  const back =
    data.viewer === 'staff'
      ? { href: `/tournaments/${tournament.id}`, label: t.back }
      : data.viewer === 'manager'
        ? { href: '/dashboard', label: t.backTeam }
        : null

  const views: Array<{ key: View; label: string; icon: typeof Trophy }> = [
    { key: 'fixtures', label: t.fixtures, icon: CalendarRange },
    { key: 'results', label: t.results, icon: Trophy },
    { key: 'table', label: t.table, icon: Table2 },
    { key: 'top', label: t.top, icon: Award },
  ]

  return (
    <div
      className="mx-auto max-w-5xl px-4 py-6 sm:py-8 [--brand-text:var(--brand-on-light)] dark:[--brand-text:var(--brand-on-dark)]"
      style={{ '--brand-on-light': palette.onLight, '--brand-on-dark': palette.onDark } as CSSProperties}
    >
      {back ? (
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" asChild>
          <AppLink href={back.href}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> {back.label}
          </AppLink>
        </Button>
      ) : null}

      <header className="overflow-hidden rounded-2xl border shadow-sm">
        <div className="h-2" style={{ backgroundColor: palette.bg }} aria-hidden />
        <div className="flex flex-col gap-4 bg-card p-4 sm:flex-row sm:items-center sm:p-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {branding?.logoUrl || tournament.logoUrl ? (
              <img
                src={branding?.logoUrl ?? tournament.logoUrl ?? ''}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl border bg-white object-contain p-1"
              />
            ) : (
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: palette.bg, color: palette.fg }}
              >
                <Trophy className="h-8 w-8" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{branding?.name ?? tournament.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-semibold" style={{ color: 'var(--brand-text)' }}>
                  {sportLabel(tournament.sport, lang, tournament.sportName)}
                  {data.settings.format ? ` · ${l.format[data.settings.format]}` : ''}
                </span>
                {tournament.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {tournament.location}
                  </span>
                ) : null}
                {tournament.startDate ? <span>{formatDate(tournament.startDate, false, lang)}</span> : null}
                {data.matches.length > 0 ? <span>{t.played(data.matches.filter(isPlayed).length, data.matches.length)}</span> : null}
              </p>
            </div>
          </div>
          {data.settings.resultsPublic ? <ShareButtons tournamentId={tournament.id} name={tournament.name} /> : null}
        </div>
      </header>

      {!data.settings.resultsPublic && data.viewer !== 'public' ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {t.privateNote}
        </p>
      ) : null}

      {branding && branding.sponsors.length > 0 ? (
        <SponsorStrip sponsors={branding.sponsors} variant="page" brandColor={branding.brandColor} className="mt-6" />
      ) : null}

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b" aria-label={tournament.name}>
        {views.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-current={view === key ? 'page' : undefined}
            onClick={() => setView(key)}
            className={cn(
              '-mb-px flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition-colors',
              view === key ? 'text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            style={view === key ? { borderColor: palette.bg } : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {view === 'fixtures' ? (
          data.matches.length === 0 ? (
            <EmptyState icon={CalendarRange} title={t.noFixtures} description={t.noFixturesDesc} />
          ) : upcoming.length === 0 ? (
            <EmptyState icon={CalendarRange} title={t.noUpcoming} description={t.noUpcomingDesc} />
          ) : (
            <FixturesList data={data} matches={upcoming} accent="var(--brand-text)" />
          )
        ) : null}
        {view === 'results' ? (
          results.length === 0 ? (
            <EmptyState icon={Trophy} title={t.noResults} description={t.noResultsDesc} />
          ) : (
            <FixturesList data={data} matches={results} accent="var(--brand-text)" />
          )
        ) : null}
        {view === 'table' ? (
          hasTable ? (
            <PointsTables data={data} accent={palette.bg} />
          ) : (
            <EmptyState icon={Table2} title={t.noTable} description={data.matches.length ? t.noTableDesc : t.noFixturesDesc} />
          )
        ) : null}
        {view === 'top' ? <Leaderboards data={data} accent={palette.bg} /> : null}
      </div>

      {!hidePlatform ? (
        <footer className="mt-10 space-y-6">
          {!signedIn ? (
            <section className="rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-6 py-8 text-center text-white shadow-lg">
              <h2 className="text-xl font-extrabold tracking-tight">{t.ctaTitle}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-teal-100">{t.ctaSub}</p>
              <Button size="lg" variant="secondary" className="mt-5 min-h-11 bg-white text-teal-900 hover:bg-teal-50" asChild>
                <AppLink href="/register">
                  <Rocket className="mr-1.5 h-4 w-4" aria-hidden /> {t.ctaButton}
                </AppLink>
              </Button>
            </section>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            <AppLink href="/" className="hover:underline">
              {t.powered}
            </AppLink>
          </p>
        </footer>
      ) : null}
    </div>
  )
}

function ShareButtons({ tournamentId, name }: { tournamentId: string; name: string }) {
  const t = useStrings(STRINGS)
  const url = typeof window === 'undefined' ? `/league/${tournamentId}` : `${window.location.origin}/league/${tournamentId}`
  const text = t.shareText(name)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t.copied)
    } catch {
      toast.error(t.copyFailed)
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2" role="group" aria-label={t.share}>
      <Button size="sm" className="bg-[#1f9d55] text-white hover:bg-[#1a8a4a]" asChild>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> {t.whatsapp}
        </a>
      </Button>
      <Button size="sm" className="bg-[#1877f2] text-white hover:bg-[#1468d8]" asChild>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
          <Share2 className="mr-1.5 h-4 w-4" aria-hidden /> {t.facebook}
        </a>
      </Button>
      <Button size="sm" variant="outline" onClick={() => void copy()}>
        <Copy className="mr-1.5 h-4 w-4" aria-hidden /> {t.copy}
      </Button>
    </div>
  )
}
