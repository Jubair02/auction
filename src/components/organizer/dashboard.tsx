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
import { TOURNAMENTS_URL, prefetchTournamentProps } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { formatAuctionWhen } from '@/lib/format'
import { byUrgency, isDone, isLive, plural, urgency } from '@/lib/tournament-status'
import { cn } from '@/lib/utils'
import { sportLabel, type TournamentSummary } from '@/lib/types'

/** The order a first auction is actually built in — shown only to organizers with none yet. */
const GUIDE_STEPS = [
  { icon: ClipboardList, text: 'Create a tournament — sport, format and venue' },
  { icon: Users, text: 'Add players by hand or from a CSV' },
  { icon: Wallet, text: 'Create teams with budgets and squad limits' },
  { icon: Gavel, text: 'Set up the auction to get a room code' },
  { icon: Share2, text: 'Share the room code with team managers' },
  { icon: Radio, text: 'Run the live auction, then export the results' },
]

function setupSteps(t: TournamentSummary) {
  return [
    { label: 'Players', done: t.playerCount > 0 },
    { label: 'Teams', done: t.teamCount > 0 },
    { label: 'Auction', done: !!t.roomCode },
  ]
}

const SPOTLIGHT: Record<number, { eyebrow: string; tone: string }> = {
  0: { eyebrow: 'Live now', tone: 'bg-amber-400/15 text-amber-300 ring-amber-300/30' },
  1: { eyebrow: 'Room ready', tone: 'bg-teal-400/15 text-teal-200 ring-teal-300/30' },
  2: { eyebrow: 'Being set up', tone: 'bg-white/10 text-slate-200 ring-white/15' },
  3: { eyebrow: 'Last auction', tone: 'bg-white/10 text-slate-200 ring-white/15' },
}

/** The one tournament that needs the organizer most, staged like the auction room itself. */
function Spotlight({ t }: { t: TournamentSummary }) {
  const level = urgency(t)
  const meta = SPOTLIGHT[level]
  const when = formatAuctionWhen(t.auctionAt)
  const steps = setupSteps(t)

  const primary: { label: string; icon: LucideIcon; href: string } =
    level === 0
      ? { label: 'Enter live room', icon: Radio, href: `/room/${t.roomCode}` }
      : level === 1
        ? { label: 'Open auction room', icon: DoorOpen, href: `/room/${t.roomCode}` }
        : level === 2
          ? { label: 'Continue setup', icon: ArrowRight, href: `/tournaments/${t.id}` }
          : { label: 'View results', icon: Trophy, href: `/results/${t.id}` }

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
              {sportLabel(t.sport, 'en', t.sportName)}
              {t.tournamentType ? ` · ${t.tournamentType}` : ''}
              {t.location ? ` · ${t.location}` : ''}
            </span>
          </div>

          <h2 className="mt-3 line-clamp-2 break-words text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">{t.name}</h2>

          <p className={cn('mt-3 flex items-center gap-1.5 text-sm', when?.past && level > 0 && level < 3 ? 'text-amber-300' : 'text-foreground/80')}>
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            {level === 0
              ? 'Bidding is under way'
              : when
                ? level === 3
                  ? `Held ${when.text}`
                  : when.past
                    ? `Was set for ${when.text} — start it or change the date`
                    : `Auction ${when.text}`
                : 'No auction time set yet'}
          </p>

          <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
            {plural(t.playerCount, 'player')} · {plural(t.teamCount, 'team')}
            {t.soldCount > 0 ? ` · ${t.soldCount} sold` : ''}
          </p>

          <div className="mt-6 flex flex-wrap gap-2 md:mt-auto md:pt-6">
            <Button className="h-11 px-5 font-bold" onClick={() => navigate(primary.href)} {...(level === 2 ? prefetchTournamentProps(t.id) : {})}>
              <primary.icon className="mr-1.5 h-4 w-4" aria-hidden /> {primary.label}
            </Button>
            {level !== 2 ? (
              <Button variant="ghost" className="h-11" onClick={() => navigate(`/tournaments/${t.id}`)} {...prefetchTournamentProps(t.id)}>
                Manage
              </Button>
            ) : null}
          </div>
        </div>

        {/* right: the room code as a ticket — or, before there is one, how far setup has got */}
        <div className="shrink-0 md:w-64">
          {t.roomCode ? (
            <button
              type="button"
              onClick={() => copyRoomCode(t.roomCode as string)}
              className="group flex h-full w-full flex-col justify-between gap-4 rounded-xl border-2 border-dashed border-white/20 bg-white/[0.04] p-4 text-left transition-colors hover:border-teal-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
              aria-label={`Copy room code ${t.roomCode}`}
            >
              <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Room code
                <ClipboardCopy className="h-4 w-4 transition-colors group-hover:text-teal-200" aria-hidden />
              </span>
              <span className="font-mono text-3xl font-black tracking-[0.12em] text-teal-200 sm:text-[2rem]">{t.roomCode}</span>
              <span className="text-xs text-muted-foreground">Managers join with this code · tap to copy</span>
            </button>
          ) : (
            <div className="flex h-full flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Before the room opens</span>
              <ul className="space-y-2.5">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border',
                        s.done ? 'border-teal-300 bg-teal-300 text-[#0a1517]' : 'border-white/25'
                      )}
                      aria-hidden
                    >
                      {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <span className={s.done ? 'text-muted-foreground line-through decoration-white/30' : ''}>{s.label}</span>
                    <span className="sr-only">{s.done ? 'done' : 'to do'}</span>
                  </li>
                ))}
              </ul>
              <span className="text-xs text-muted-foreground">
                {steps.filter((s) => s.done).length} of {steps.length} done
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
function actionItems(tournaments: TournamentSummary[], spotlightId: string): ActionItem[] {
  const items: ActionItem[] = []
  for (const t of [...tournaments].sort(byUrgency)) {
    if (isDone(t)) continue
    const base = { tournament: t.name, id: t.id }
    const when = formatAuctionWhen(t.auctionAt)
    if (isLive(t)) {
      // The spotlight already puts a live room front and centre.
      if (t.id !== spotlightId) items.push({ ...base, key: `${t.id}-live`, text: t.auctionStatus === 'PAUSED' ? 'Auction is paused' : 'Auction is live', action: 'Enter room', href: `/room/${t.roomCode}` })
      continue
    }
    if (t.playerCount === 0) {
      items.push({ ...base, key: `${t.id}-players`, text: 'No players yet', action: 'Add players', href: `/tournaments/${t.id}` })
    }
    if (t.teamCount === 0) {
      items.push({ ...base, key: `${t.id}-teams`, text: 'No teams yet', action: 'Create teams', href: `/tournaments/${t.id}` })
    }
    if (!t.roomCode && t.playerCount > 0 && t.teamCount > 0) {
      items.push({ ...base, key: `${t.id}-auction`, text: 'Players and teams are in — set up the auction', action: 'Set up', href: `/tournaments/${t.id}` })
    }
    if (t.roomCode && when?.past) {
      items.push({ ...base, key: `${t.id}-overdue`, text: `Was due ${when.text}`, action: 'Open room', href: `/room/${t.roomCode}` })
    }
  }
  return items
}

function NeedsAttention({ tournaments, spotlightId }: { tournaments: TournamentSummary[]; spotlightId: string }) {
  const items = actionItems(tournaments, spotlightId)
  return (
    <Card className="gap-3">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center justify-between text-base">
          Needs your attention
          {items.length > 0 ? <span className="text-sm font-semibold tabular-nums text-muted-foreground">{items.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-4 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
              <Check className="h-4 w-4" />
            </span>
            <span className="text-muted-foreground">Nothing is waiting on you. Every tournament is set up or finished.</span>
          </div>
        ) : (
          <ul className="-mx-2 divide-y">
            {items.slice(0, 5).map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => navigate(item.href)}
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
                </button>
              </li>
            ))}
          </ul>
        )}
        {items.length > 5 ? (
          <p className="mt-2 text-xs text-muted-foreground">+{items.length - 5} more in your tournaments below</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** First visit: the empty dashboard becomes the guide, in the order the work is actually done. */
function FirstAuction() {
  return (
    <Arena>
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">Your first auction</p>
          <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">From a list of names to a live room</h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Start with the tournament. Players, teams and the room code all hang off it, and you can come back to any step later.
          </p>
          <Button className="mt-6 h-11 px-5 font-bold" onClick={() => navigate('/tournaments/new')}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Create your first tournament
          </Button>
        </div>
        <ol className="space-y-2">
          {GUIDE_STEPS.map((step, i) => (
            <li key={step.text} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <span className="w-5 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <step.icon className="h-4 w-4 shrink-0 text-teal-200" aria-hidden />
              <span className="text-sm">{step.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </Arena>
  )
}

export default function OrganizerDashboard() {
  const user = useAppStore((s) => s.user)
  // Shares its cache with the tournaments page — opening either after the other is instant.
  const { data, loading } = useCachedGet<{ tournaments: TournamentSummary[] }>(TOURNAMENTS_URL)
  const tournaments = [...(data?.tournaments ?? [])].sort(byUrgency)

  const firstName = (user?.name ?? 'Organizer').split(/\s+/)[0]
  const totalPlayers = tournaments.reduce((n, t) => n + t.playerCount, 0)
  const totalTeams = tournaments.reduce((n, t) => n + t.teamCount, 0)
  const spotlight = tournaments[0]

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Assalamu alaikum, {firstName}</h1>
          {loading ? (
            <Skeleton className="mt-2 h-4 w-56" />
          ) : (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {tournaments.length === 0
                ? 'Let’s set up your first auction.'
                : `${plural(tournaments.length, 'tournament')} · ${plural(totalPlayers, 'player')} · ${plural(totalTeams, 'team')}`}
            </p>
          )}
        </div>
        {!loading && tournaments.length > 0 ? (
          <Button size="lg" className="min-h-11" onClick={() => navigate('/tournaments/new')}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tournament
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
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

          <section className="mt-10" aria-label="Your tournaments">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Your tournaments</h2>
              {tournaments.length > 6 ? (
                <Button variant="ghost" size="sm" onClick={() => navigate('/tournaments')}>
                  All {tournaments.length} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
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
                      <Button className="min-h-10 flex-1" {...prefetchTournamentProps(t.id)} onClick={() => navigate(`/tournaments/${t.id}`)}>
                        <LayoutList className="mr-1.5 h-4 w-4" aria-hidden /> Manage
                      </Button>
                      <Button variant="outline" className="min-h-10 flex-1" onClick={() => navigate(`/results/${t.id}`)}>
                        <History className="mr-1.5 h-4 w-4" aria-hidden /> Results
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
