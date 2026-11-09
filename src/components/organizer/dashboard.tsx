'use client'

import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCopy,
  ClipboardList,
  DoorOpen,
  Gavel,
  History,
  LayoutList,
  Plus,
  Radio,
  Share2,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Arena } from '@/components/shared/arena'
import { TournamentCard, copyRoomCode } from '@/components/organizer/tournament-card'
import { useCachedGet } from '@/lib/api-cache'
import { LoadError } from '@/components/shared/load-error'
import { TOURNAMENTS_URL, prefetchTournamentProps } from '@/lib/tournament-prefetch'
import { AppLink } from '@/components/shared/app-link'
import { useAuthState } from '@/lib/store'
import { formatAuctionWhen } from '@/lib/format'
import { byUrgency, isDone, isLive, urgency } from '@/lib/tournament-status'
import { cn } from '@/lib/utils'
import { sportLabel, type TournamentSummary } from '@/lib/types'
import { type Lang, type Strings, useLang, useStrings } from '@/lib/i18n'
import { tournamentTypeLabel } from '@/lib/tournament-types'

type DashboardStrings = {
  guideSteps: string[]
  players: string
  teams: string
  auction: string
  eyebrows: string[]
  enterLive: string
  openAuctionRoom: string
  continueSetup: string
  viewResults: string
  biddingUnderWay: string
  heldAt: (when: string) => string
  wasSetFor: (when: string) => string
  auctionAt: (when: string) => string
  noTimeYet: string
  playerCount: (n: number) => string
  teamCount: (n: number) => string
  tournamentCount: (n: number) => string
  soldCount: (n: number) => string
  manage: string
  copyCode: (code: string) => string
  roomCode: string
  managersJoin: string
  beforeRoomOpens: string
  done: string
  toDo: string
  doneOf: (done: number, total: number) => string
  auctionPaused: string
  auctionLive: string
  enterRoom: string
  noPlayers: string
  addPlayers: string
  noTeams: string
  createTeams: string
  readyForAuction: string
  setUp: string
  wasDue: (when: string) => string
  openRoom: string
  needsAttention: string
  allClear: string
  moreBelow: (n: number) => string
  firstAuction: string
  firstTitle: string
  firstBody: string
  createFirst: string
  organizer: string
  greeting: (name: string) => string
  letsSetUp: string
  newTournament: string
  loadWhat: string
  yourTournaments: string
  all: (n: number) => string
  results: string
}

const STRINGS = {
  en: {
    guideSteps: [
      'Create a tournament — sport, format and venue',
      'Add players by hand or from a CSV',
      'Create teams with budgets and squad limits',
      'Set up the auction to get a room code',
      'Share the room code with team managers',
      'Run the live auction, then export the results',
    ],
    players: 'Players',
    teams: 'Teams',
    auction: 'Auction',
    eyebrows: ['Live now', 'Room ready', 'Being set up', 'Last auction'],
    enterLive: 'Enter live room',
    openAuctionRoom: 'Open auction room',
    continueSetup: 'Continue setup',
    viewResults: 'View results',
    biddingUnderWay: 'Bidding is under way',
    heldAt: (when) => `Held ${when}`,
    wasSetFor: (when) => `Was set for ${when} — start it or change the date`,
    auctionAt: (when) => `Auction ${when}`,
    noTimeYet: 'No auction time set yet',
    playerCount: (n) => `${n} player${n === 1 ? '' : 's'}`,
    teamCount: (n) => `${n} team${n === 1 ? '' : 's'}`,
    tournamentCount: (n) => `${n} tournament${n === 1 ? '' : 's'}`,
    soldCount: (n) => `${n} sold`,
    manage: 'Manage',
    copyCode: (code) => `Copy room code ${code}`,
    roomCode: 'Room code',
    managersJoin: 'Managers join with this code · tap to copy',
    beforeRoomOpens: 'Before the room opens',
    done: 'done',
    toDo: 'to do',
    doneOf: (done, total) => `${done} of ${total} done`,
    auctionPaused: 'Auction is paused',
    auctionLive: 'Auction is live',
    enterRoom: 'Enter room',
    noPlayers: 'No players yet',
    addPlayers: 'Add players',
    noTeams: 'No teams yet',
    createTeams: 'Create teams',
    readyForAuction: 'Players and teams are in — set up the auction',
    setUp: 'Set up',
    wasDue: (when) => `Was due ${when}`,
    openRoom: 'Open room',
    needsAttention: 'Needs your attention',
    allClear: 'Nothing is waiting on you. Every tournament is set up or finished.',
    moreBelow: (n) => `+${n} more in your tournaments below`,
    firstAuction: 'Your first auction',
    firstTitle: 'From a list of names to a live room',
    firstBody:
      'Start with the tournament. Players, teams and the room code all hang off it, and you can come back to any step later.',
    createFirst: 'Create your first tournament',
    organizer: 'Organizer',
    greeting: (name) => `Assalamu alaikum, ${name}`,
    letsSetUp: 'Let’s set up your first auction.',
    newTournament: 'New tournament',
    loadWhat: 'your tournaments',
    yourTournaments: 'Your tournaments',
    all: (n) => `All ${n}`,
    results: 'Results',
  },
  bn: {
    guideSteps: [
      'টুর্নামেন্ট তৈরি করুন — খেলা, ফরম্যাট আর ভেন্যু',
      'হাতে লিখে বা CSV থেকে খেলোয়াড় যোগ করুন',
      'বাজেট আর স্কোয়াড লিমিট দিয়ে দল তৈরি করুন',
      'নিলাম সেট আপ করে রুম কোড নিন',
      'টিম ম্যানেজারদের সাথে রুম কোড শেয়ার করুন',
      'লাইভ নিলাম চালান, তারপর ফলাফল এক্সপোর্ট করুন',
    ],
    players: 'খেলোয়াড়',
    teams: 'দল',
    auction: 'নিলাম',
    eyebrows: ['এখন লাইভ', 'রুম প্রস্তুত', 'সেট আপ চলছে', 'শেষ নিলাম'],
    enterLive: 'লাইভ রুমে ঢুকুন',
    openAuctionRoom: 'নিলাম রুম খুলুন',
    continueSetup: 'সেট আপ চালিয়ে যান',
    viewResults: 'ফলাফল দেখুন',
    biddingUnderWay: 'বিড চলছে',
    heldAt: (when) => `অনুষ্ঠিত: ${when}`,
    wasSetFor: (when) => `নির্ধারিত ছিল ${when} — শুরু করুন বা তারিখ বদলান`,
    auctionAt: (when) => `নিলাম: ${when}`,
    noTimeYet: 'নিলামের সময় এখনো ঠিক হয়নি',
    playerCount: (n) => `${n} জন খেলোয়াড়`,
    teamCount: (n) => `${n}টি দল`,
    tournamentCount: (n) => `${n}টি টুর্নামেন্ট`,
    soldCount: (n) => `${n} জন বিক্রি`,
    manage: 'ম্যানেজ করুন',
    copyCode: (code) => `রুম কোড ${code} কপি করুন`,
    roomCode: 'রুম কোড',
    managersJoin: 'ম্যানেজাররা এই কোড দিয়ে যোগ দেবেন · কপি করতে ট্যাপ করুন',
    beforeRoomOpens: 'রুম খোলার আগে',
    done: 'হয়ে গেছে',
    toDo: 'বাকি',
    doneOf: (done, total) => `${total}টির মধ্যে ${done}টি হয়েছে`,
    auctionPaused: 'নিলামে বিরতি চলছে',
    auctionLive: 'নিলাম লাইভ চলছে',
    enterRoom: 'রুমে ঢুকুন',
    noPlayers: 'এখনো কোনো খেলোয়াড় নেই',
    addPlayers: 'খেলোয়াড় যোগ করুন',
    noTeams: 'এখনো কোনো দল নেই',
    createTeams: 'দল তৈরি করুন',
    readyForAuction: 'খেলোয়াড় আর দল তৈরি — এবার নিলাম সেট আপ করুন',
    setUp: 'সেট আপ',
    wasDue: (when) => `নির্ধারিত ছিল: ${when}`,
    openRoom: 'রুম খুলুন',
    needsAttention: 'আপনার মনোযোগ দরকার',
    allClear: 'আপনার জন্য কিছু অপেক্ষায় নেই। সব টুর্নামেন্ট সেট আপ করা বা শেষ।',
    moreBelow: (n) => `নিচে আপনার টুর্নামেন্টে আরও ${n}টি`,
    firstAuction: 'আপনার প্রথম নিলাম',
    firstTitle: 'নামের তালিকা থেকে লাইভ রুম',
    firstBody:
      'টুর্নামেন্ট দিয়ে শুরু করুন। খেলোয়াড়, দল আর রুম কোড সবই এর সাথে যুক্ত, আর যেকোনো ধাপে পরে ফিরে আসতে পারবেন।',
    createFirst: 'প্রথম টুর্নামেন্ট তৈরি করুন',
    organizer: 'আয়োজক',
    greeting: (name) => `আসসালামু আলাইকুম, ${name}`,
    letsSetUp: 'চলুন আপনার প্রথম নিলাম সেট আপ করি।',
    newTournament: 'নতুন টুর্নামেন্ট',
    loadWhat: 'আপনার টুর্নামেন্ট',
    yourTournaments: 'আপনার টুর্নামেন্ট',
    all: (n) => `সব ${n}টি`,
    results: 'ফলাফল',
  },
} satisfies Strings<DashboardStrings>

/** The order a first auction is actually built in — shown only to organizers with none yet. */
const GUIDE_ICONS: LucideIcon[] = [ClipboardList, Users, Wallet, Gavel, Share2, Radio]

function setupSteps(t: TournamentSummary, s: DashboardStrings) {
  return [
    { label: s.players, done: t.playerCount > 0 },
    { label: s.teams, done: t.teamCount > 0 },
    { label: s.auction, done: !!t.roomCode },
  ]
}

const SPOTLIGHT_TONE: Record<number, string> = {
  0: 'bg-amber-400/15 text-amber-300 ring-amber-300/30',
  1: 'bg-teal-400/15 text-teal-200 ring-teal-300/30',
  2: 'bg-white/10 text-slate-200 ring-white/15',
  3: 'bg-white/10 text-slate-200 ring-white/15',
}

/** The one tournament that needs the organizer most, staged like the auction room itself. */
function Spotlight({ t }: { t: TournamentSummary }) {
  const lang = useLang()
  const s = useStrings(STRINGS)
  const level = urgency(t)
  const meta = { eyebrow: s.eyebrows[level], tone: SPOTLIGHT_TONE[level] }
  const when = formatAuctionWhen(t.auctionAt, lang)
  const steps = setupSteps(t, s)

  const primary: { label: string; icon: LucideIcon; href: string } =
    level === 0
      ? { label: s.enterLive, icon: Radio, href: `/room/${t.roomCode}` }
      : level === 1
        ? { label: s.openAuctionRoom, icon: DoorOpen, href: `/room/${t.roomCode}` }
        : level === 2
          ? { label: s.continueSetup, icon: ArrowRight, href: `/tournaments/${t.id}` }
          : { label: s.viewResults, icon: Trophy, href: `/results/${t.id}` }

  return (
    <Arena>
      <div className="flex h-full flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-stretch md:justify-between">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ring-1', meta.tone)}>
              {level === 0 ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" aria-hidden /> : null}
              {meta.eyebrow}
            </span>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {sportLabel(t.sport, lang, t.sportName)}
              {t.tournamentType ? ` · ${tournamentTypeLabel(t.tournamentType, lang)}` : ''}
              {t.location ? ` · ${t.location}` : ''}
            </span>
          </div>

          <h2 className="mt-3 line-clamp-2 break-words text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">{t.name}</h2>

          <p className={cn('mt-3 flex items-center gap-1.5 text-sm', when?.past && level > 0 && level < 3 ? 'text-amber-300' : 'text-foreground/80')}>
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            {level === 0
              ? s.biddingUnderWay
              : when
                ? level === 3
                  ? s.heldAt(when.text)
                  : when.past
                    ? s.wasSetFor(when.text)
                    : s.auctionAt(when.text)
                : s.noTimeYet}
          </p>

          <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
            {s.playerCount(t.playerCount)} · {s.teamCount(t.teamCount)}
            {t.soldCount > 0 ? ` · ${s.soldCount(t.soldCount)}` : ''}
          </p>

          <div className="mt-6 flex flex-wrap gap-2 md:mt-auto md:pt-6">
            <Button asChild className="h-11 px-5 font-bold">
              <AppLink href={primary.href} {...(level === 2 ? prefetchTournamentProps(t.id) : {})}>
                <primary.icon className="mr-1.5 h-4 w-4" aria-hidden /> {primary.label}
              </AppLink>
            </Button>
            {level !== 2 ? (
              <Button asChild variant="ghost" className="h-11">
                <AppLink href={`/tournaments/${t.id}`} {...prefetchTournamentProps(t.id)}>
                  {s.manage}
                </AppLink>
              </Button>
            ) : null}
          </div>
        </div>

        {/* right: the room code as a ticket — or, before there is one, how far setup has got */}
        <div className="shrink-0 md:w-64">
          {t.roomCode ? (
            <button
              type="button"
              onClick={() => copyRoomCode(t.roomCode as string, lang)}
              className="group flex h-full w-full flex-col justify-between gap-4 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.04] p-4 text-left transition-colors hover:border-teal-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
              aria-label={s.copyCode(t.roomCode)}
            >
              <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.roomCode}
                <ClipboardCopy className="h-4 w-4 transition-colors group-hover:text-teal-200" aria-hidden />
              </span>
              <span className="font-mono text-3xl font-black tracking-[0.12em] text-teal-200 sm:text-[2rem]">{t.roomCode}</span>
              <span className="text-xs text-muted-foreground">{s.managersJoin}</span>
            </button>
          ) : (
            <div className="flex h-full flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{s.beforeRoomOpens}</span>
              <ul className="space-y-2.5">
                {steps.map((step) => (
                  <li key={step.label} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border',
                        step.done ? 'border-teal-300 bg-teal-300 text-[#0a1517]' : 'border-white/25'
                      )}
                      aria-hidden
                    >
                      {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <span className={step.done ? 'text-muted-foreground line-through decoration-white/30' : ''}>{step.label}</span>
                    <span className="sr-only">{step.done ? s.done : s.toDo}</span>
                  </li>
                ))}
              </ul>
              <span className="text-xs text-muted-foreground">
                {s.doneOf(steps.filter((step) => step.done).length, steps.length)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Arena>
  )
}

interface ActionItem {
  key: string
  text: string
  tournament: string
  action: string
  href: string
  id: string
}

/** Concrete to-dos across every unfinished tournament, most urgent first. */
function actionItems(tournaments: TournamentSummary[], spotlightId: string, s: DashboardStrings, lang: Lang): ActionItem[] {
  const items: ActionItem[] = []
  for (const t of [...tournaments].sort(byUrgency)) {
    if (isDone(t)) continue
    const base = { tournament: t.name, id: t.id }
    const when = formatAuctionWhen(t.auctionAt, lang)
    if (isLive(t)) {
      // The spotlight already puts a live room front and centre.
      if (t.id !== spotlightId) items.push({ ...base, key: `${t.id}-live`, text: t.auctionStatus === 'PAUSED' ? s.auctionPaused : s.auctionLive, action: s.enterRoom, href: `/room/${t.roomCode}` })
      continue
    }
    if (t.playerCount === 0) {
      items.push({ ...base, key: `${t.id}-players`, text: s.noPlayers, action: s.addPlayers, href: `/tournaments/${t.id}` })
    }
    if (t.teamCount === 0) {
      items.push({ ...base, key: `${t.id}-teams`, text: s.noTeams, action: s.createTeams, href: `/tournaments/${t.id}` })
    }
    if (!t.roomCode && t.playerCount > 0 && t.teamCount > 0) {
      items.push({ ...base, key: `${t.id}-auction`, text: s.readyForAuction, action: s.setUp, href: `/tournaments/${t.id}` })
    }
    if (t.roomCode && when?.past) {
      items.push({ ...base, key: `${t.id}-overdue`, text: s.wasDue(when.text), action: s.openRoom, href: `/room/${t.roomCode}` })
    }
  }
  return items
}

function NeedsAttention({ tournaments, spotlightId }: { tournaments: TournamentSummary[]; spotlightId: string }) {
  const s = useStrings(STRINGS)
  const lang = useLang()
  const items = actionItems(tournaments, spotlightId, s, lang)
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center justify-between text-base">
          {s.needsAttention}
          {items.length > 0 ? <span className="text-sm font-semibold tabular-nums text-muted-foreground">{items.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-4 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
              <Check className="h-4 w-4" />
            </span>
            <span className="text-muted-foreground">{s.allClear}</span>
          </div>
        ) : (
          <ul className="-mx-2 divide-y">
            {items.slice(0, 5).map((item) => (
              <li key={item.key}>
                <AppLink
                  href={item.href}
                  {...prefetchTournamentProps(item.id)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.tournament}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.text}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
                    {item.action}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        )}
        {items.length > 5 ? (
          <p className="mt-2 text-xs text-muted-foreground">{s.moreBelow(items.length - 5)}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** First visit: the empty dashboard becomes the guide, in the order the work is actually done. */
function FirstAuction() {
  const s = useStrings(STRINGS)
  return (
    <Arena>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">{s.firstAuction}</p>
          <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">{s.firstTitle}</h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            {s.firstBody}
          </p>
          <Button asChild className="mt-6 h-11 px-5 font-bold">
            <AppLink href="/tournaments/new">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {s.createFirst}
            </AppLink>
          </Button>
        </div>
        <ol className="space-y-2">
          {GUIDE_ICONS.map((Icon, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <span className="w-5 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <Icon className="h-4 w-4 shrink-0 text-teal-200" aria-hidden />
              <span className="text-sm">{s.guideSteps[i]}</span>
            </li>
          ))}
        </ol>
      </div>
    </Arena>
  )
}

export default function OrganizerDashboard() {
  const { user } = useAuthState()
  const s = useStrings(STRINGS)
  // Shares its cache with the tournaments page — opening either after the other is instant.
  const { data, loading, error, refetch } = useCachedGet<{ tournaments: TournamentSummary[] }>(TOURNAMENTS_URL)
  // A failed load must not look like "you have no tournaments yet".
  const failed = !data && !!error
  const tournaments = [...(data?.tournaments ?? [])].sort(byUrgency)

  const firstName = (user?.name ?? s.organizer).split(/\s+/)[0]
  const totalPlayers = tournaments.reduce((n, t) => n + t.playerCount, 0)
  const totalTeams = tournaments.reduce((n, t) => n + t.teamCount, 0)
  const spotlight = tournaments[0]

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{s.greeting(firstName)}</h1>
          {loading ? (
            <Skeleton className="mt-2 h-4 w-56" />
          ) : failed ? null : (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {tournaments.length === 0
                ? s.letsSetUp
                : `${s.tournamentCount(tournaments.length)} · ${s.playerCount(totalPlayers)} · ${s.teamCount(totalTeams)}`}
            </p>
          )}
        </div>
        {!loading && tournaments.length > 0 ? (
          <Button asChild size="lg" className="min-h-11">
            <AppLink href="/tournaments/new">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {s.newTournament}
            </AppLink>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : failed ? (
        <LoadError className="mt-6" what={s.loadWhat} error={error} onRetry={refetch} />
      ) : !spotlight ? (
        <div className="mt-6">
          <FirstAuction />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <Spotlight t={spotlight} />
            <NeedsAttention tournaments={tournaments} spotlightId={spotlight.id} />
          </div>

          <section className="mt-10" aria-label={s.yourTournaments}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{s.yourTournaments}</h2>
              {tournaments.length > 6 ? (
                <Button asChild variant="ghost" size="sm">
                  <AppLink href="/tournaments">
                    {s.all(tournaments.length)} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </AppLink>
                </Button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.slice(0, 6).map((t) => (
                <TournamentCard
                  key={t.id}
                  t={t}
                  actions={
                    <>
                      <Button asChild className="min-h-10 flex-1">
                        <AppLink href={`/tournaments/${t.id}`} {...prefetchTournamentProps(t.id)}>
                          <LayoutList className="mr-1.5 h-4 w-4" aria-hidden /> {s.manage}
                        </AppLink>
                      </Button>
                      <Button asChild variant="outline" className="min-h-10 flex-1">
                        <AppLink href={`/results/${t.id}`}>
                          <History className="mr-1.5 h-4 w-4" aria-hidden /> {s.results}
                        </AppLink>
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
