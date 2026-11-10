'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown, DoorOpen, History, Plus, Radio, Users } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { AppLink } from '@/components/shared/app-link'
import { useAuthState } from '@/lib/store'
import { formatAuctionWhen, formatBDT } from '@/lib/format'
import { plural } from '@/lib/tournament-status'
import { sportLabel, type AuctionStatus, type Sport, type TeamDTO, type TournamentDetail, type TournamentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { type Strings, useLang, useLangStore, useStrings } from '@/lib/i18n'
import { PlayerRole } from '@/components/shared/player-role'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Arena } from '@/components/shared/arena'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { PlayerAvatar, TeamAvatar } from '@/components/shared/avatars'

interface MyTeamRow extends TeamDTO {
  tournamentName: string
  tournamentStatus: TournamentStatus
  tournamentId: string
  roomCode?: string | null
  auctionStatus?: AuctionStatus | null
  /** Optional: absent until the API was updated. */
  sport?: Sport
  sportName?: string | null
  auctionAt?: string | null
}

type Phase = 'live' | 'open' | 'upcoming' | 'finished'

function phaseOf(t: MyTeamRow): Phase {
  if (t.auctionStatus === 'LIVE' || t.auctionStatus === 'PAUSED') return 'live'
  if (t.auctionStatus === 'ENDED' || t.tournamentStatus === 'COMPLETED') return 'finished'
  if (t.auctionStatus === 'READY' && t.roomCode) return 'open'
  return 'upcoming'
}
const STRINGS = {
  en: {
    phase: { live: 'Live now', open: 'Room open', upcoming: 'Upcoming', finished: 'Finished' },
    livePaused: 'Live · paused',
    liveNow: 'Live now',
    roomOpen: 'Room open',
    comingUp: 'Coming up',
    lineLive: 'Bidding is under way — players are going now.',
    lineOpenAt: (when) => `The room is open. Bidding starts ${when}.`,
    lineOpenNoTime: 'The room is open. Bidding starts when the organizer presses Start.',
    lineUpcomingAt: (when) => `Auction ${when}. The room opens on the day.`,
    lineNoTime: 'No auction time yet — your organizer will share it.',
    biddingAs: 'Bidding as ',
    enterLiveRoom: 'Enter live room',
    enterAuctionRoom: 'Enter auction room',
    purseLeft: 'Purse left',
    ofBudget: (budget) => `of ${budget}`,
    squadOf: (count, max) => `Squad ${count}/${max}`,
    moreToMin: (needed, min) => `${plural(needed, 'more player')} to reach the minimum of ${min}`,
    minReached: (min) => `Minimum of ${min} reached`,
    squadLoadFail: 'Couldn’t load the squad. Open the card again to retry.',
    noPlayersYet: 'No players yet. Players you win in the auction appear here straight away.',
    squadAria: (team) => `${team} squad`,
    cat: (c) => ` · Cat ${c}`,
    squadSummary: (n, avg) => `${plural(n, 'player')} · average ${avg}`,
    left: 'left',
    spentOf: (spent, budget) => `${spent} of ${budget}`,
    budgetUsedAria: (team) => `${team} budget used`,
    squad: 'Squad',
    squadMinReached: (min) => ` · minimum of ${min} reached`,
    squadFinishedShort: (needed, min) => ` · finished ${needed} short of the minimum of ${min}`,
    squadNeedMore: (needed, min) => ` · ${needed} more for the minimum of ${min}`,
    enterRoom: 'Enter room',
    results: 'Results',
    hideSquad: 'Hide squad',
    showSquad: (n) => `Show squad (${n})`,
    couldNotLoad: 'Could not load your teams',
    managerFallback: 'Manager',
    welcome: (name) => `Welcome back, ${name}`,
    summary: (teams, bought) => `${plural(teams, 'team')} · ${plural(bought, 'player')} bought`,
    joinWithCode: 'Join with a room code',
    teamsWhat: 'your teams',
    loadingTeams: 'Loading your teams',
    noTeamTitle: 'You don’t manage a team yet',
    noTeamDesc:
      "Ask your organizer for your team's invite link — opening it while logged in links the team to your account. (Some organizers instead let you pick a free team after joining with the room code, like BD26-XXXX.)",
    yourTeamsAria: 'Your teams',
    yourTeamsHeading: (n): string => (n === 1 ? 'Your team' : 'Your teams'),
  },
  bn: {
    phase: { live: 'এখন লাইভ', open: 'রুম খোলা', upcoming: 'আসছে', finished: 'শেষ' },
    livePaused: 'লাইভ · বিরতি',
    liveNow: 'এখন লাইভ',
    roomOpen: 'রুম খোলা',
    comingUp: 'সামনে আসছে',
    lineLive: 'বিডিং চলছে — খেলোয়াড়রা এখনই বিক্রি হচ্ছে।',
    lineOpenAt: (when) => `রুম খোলা। বিডিং শুরু ${when}।`,
    lineOpenNoTime: 'রুম খোলা। আয়োজক শুরু করলেই বিডিং শুরু হবে।',
    lineUpcomingAt: (when) => `নিলাম ${when}। রুম খুলবে সেদিনই।`,
    lineNoTime: 'নিলামের সময় এখনো ঠিক হয়নি — আয়োজক জানিয়ে দেবেন।',
    biddingAs: 'বিড করছেন: ',
    enterLiveRoom: 'লাইভ রুমে ঢুকুন',
    enterAuctionRoom: 'নিলাম রুমে ঢুকুন',
    purseLeft: 'বাকি বাজেট',
    ofBudget: (budget) => `মোট ${budget}`,
    squadOf: (count, max) => `স্কোয়াড ${count}/${max}`,
    moreToMin: (needed, min) => `ন্যূনতম ${min} জন পূরণে আরও ${needed} জন খেলোয়াড় লাগবে`,
    minReached: (min) => `ন্যূনতম ${min} জন পূর্ণ হয়েছে`,
    squadLoadFail: 'স্কোয়াড লোড করা যায়নি। আবার চেষ্টা করতে কার্ডটি আবার খুলুন।',
    noPlayersYet: 'এখনো কোনো খেলোয়াড় নেই। নিলামে যাদের কিনবেন, সাথে সাথেই এখানে দেখা যাবে।',
    squadAria: (team) => `${team} স্কোয়াড`,
    cat: (c) => ` · ক্যাটাগরি ${c}`,
    squadSummary: (n, avg) => `${n} জন খেলোয়াড় · গড় ${avg}`,
    left: 'বাকি',
    spentOf: (spent, budget) => `${budget}-এর মধ্যে ${spent} খরচ`,
    budgetUsedAria: (team) => `${team}-এর বাজেট খরচ`,
    squad: 'স্কোয়াড',
    squadMinReached: (min) => ` · ন্যূনতম ${min} জন পূর্ণ`,
    squadFinishedShort: (needed, min) => ` · ন্যূনতম ${min} জনের চেয়ে ${needed} জন কম নিয়ে শেষ`,
    squadNeedMore: (needed, min) => ` · ন্যূনতম ${min} জন পূরণে আরও ${needed} জন লাগবে`,
    enterRoom: 'রুমে ঢুকুন',
    results: 'ফলাফল',
    hideSquad: 'স্কোয়াড লুকান',
    showSquad: (n) => `স্কোয়াড দেখুন (${n})`,
    couldNotLoad: 'আপনার দলগুলো লোড করা যায়নি',
    managerFallback: 'ম্যানেজার',
    welcome: (name) => `আবার স্বাগতম, ${name}`,
    summary: (teams, bought) => `${teams}টি দল · ${bought} জন খেলোয়াড় কেনা হয়েছে`,
    joinWithCode: 'রুম কোড দিয়ে যোগ দিন',
    teamsWhat: 'আপনার দলগুলো',
    loadingTeams: 'আপনার দলগুলো লোড হচ্ছে',
    noTeamTitle: 'আপনি এখনো কোনো দলের ম্যানেজার নন',
    noTeamDesc:
      'আয়োজকের কাছে আপনার দলের ইনভাইট লিংক চেয়ে নিন — লগইন থাকা অবস্থায় লিংকটি খুললেই দলটি আপনার অ্যাকাউন্টে যুক্ত হয়ে যাবে। (কিছু আয়োজক আবার রুম কোড, যেমন BD26-XXXX, দিয়ে যোগ দেওয়ার পর খালি কোনো দল বেছে নিতে দেন।)',
    yourTeamsAria: 'আপনার দলগুলো',
    yourTeamsHeading: (n): string => (n === 1 ? 'আপনার দল' : 'আপনার দলগুলো'),
  },
} satisfies Strings<{
  phase: Record<Phase, string>
  livePaused: string
  liveNow: string
  roomOpen: string
  comingUp: string
  lineLive: string
  lineOpenAt: (when: string) => string
  lineOpenNoTime: string
  lineUpcomingAt: (when: string) => string
  lineNoTime: string
  biddingAs: string
  enterLiveRoom: string
  enterAuctionRoom: string
  purseLeft: string
  ofBudget: (budget: string) => string
  squadOf: (count: number, max: number) => string
  moreToMin: (needed: number, min: number) => string
  minReached: (min: number) => string
  squadLoadFail: string
  noPlayersYet: string
  squadAria: (team: string) => string
  cat: (category: string) => string
  squadSummary: (n: number, avg: string) => string
  left: string
  spentOf: (spent: string, budget: string) => string
  budgetUsedAria: (team: string) => string
  squad: string
  squadMinReached: (min: number) => string
  squadFinishedShort: (needed: number, min: number) => string
  squadNeedMore: (needed: number, min: number) => string
  enterRoom: string
  results: string
  hideSquad: string
  showSquad: (n: number) => string
  couldNotLoad: string
  managerFallback: string
  welcome: (name: string) => string
  summary: (teams: number, bought: number) => string
  joinWithCode: string
  teamsWhat: string
  loadingTeams: string
  noTeamTitle: string
  noTeamDesc: string
  yourTeamsAria: string
  yourTeamsHeading: (n: number) => string
}>

const PHASE_ORDER: Record<Phase, number> = { live: 0, open: 1, upcoming: 2, finished: 3 }
const PHASE_CHIP: Record<Phase, { className: string }> = {
  live: { className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200' },
  open: { className: 'bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200' },
  upcoming: { className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300' },
  finished: { className: 'bg-muted text-muted-foreground' },
}

const auctionTime = (t: MyTeamRow) => (t.auctionAt ? new Date(t.auctionAt).getTime() : Number.POSITIVE_INFINITY)
function byPhase(a: MyTeamRow, b: MyTeamRow) {
  return PHASE_ORDER[phaseOf(a)] - PHASE_ORDER[phaseOf(b)] || auctionTime(a) - auctionTime(b) || a.name.localeCompare(b.name)
}
/** Players still needed to reach the minimum squad, or 0. */
const shortBy = (t: MyTeamRow) => Math.max(0, t.minSquad - t.squadCount)

/** The auction the manager should be thinking about right now, staged like the room itself. */
function AuctionBanner({ team }: { team: MyTeamRow }) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const phase = phaseOf(team)
  const when = formatAuctionWhen(team.auctionAt ?? null, lang)
  const needed = shortBy(team)
  const enterable = (phase === 'live' || phase === 'open') && !!team.roomCode

  const eyebrow =
    phase === 'live'
      ? { text: team.auctionStatus === 'PAUSED' ? t.livePaused : t.liveNow, className: 'bg-amber-400/15 text-amber-300 ring-amber-300/30' }
      : phase === 'open'
        ? { text: t.roomOpen, className: 'bg-teal-400/15 text-teal-200 ring-teal-300/30' }
        : { text: t.comingUp, className: 'bg-white/10 text-slate-200 ring-white/15' }

  const line =
    phase === 'live'
      ? t.lineLive
      : phase === 'open'
        ? when && !when.past
          ? t.lineOpenAt(when.text)
          : t.lineOpenNoTime
        : when && !when.past
          ? t.lineUpcomingAt(when.text)
          : t.lineNoTime

  return (
    <Arena>
      <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_17rem] md:items-stretch">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ring-1', eyebrow.className)}>
              {phase === 'live' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" aria-hidden /> : null}
              {eyebrow.text}
            </span>
            {team.sport ? <span className="text-xs font-medium text-muted-foreground">{sportLabel(team.sport, lang, team.sportName)}</span> : null}
          </div>

          <h2 className="mt-3 line-clamp-2 break-words text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">{team.tournamentName}</h2>

          <p className="mt-3 flex items-start gap-1.5 text-sm text-foreground/80">
            {phase === 'live' ? <Radio className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {line}
          </p>

          <div className="mt-4 flex items-center gap-2.5">
            <TeamAvatar name={team.name} color={team.color} logoUrl={team.logoUrl} className="h-9 w-9 ring-2 ring-white/15" />
            <p className="min-w-0 text-sm">
              <span className="text-muted-foreground">{t.biddingAs}</span>
              <span className="font-bold">{team.name}</span>
            </p>
          </div>

          {enterable ? (
            <div className="mt-6 md:mt-auto md:pt-6">
              <Button asChild className="h-11 px-5 font-bold">
                <AppLink href={`/room/${team.roomCode}`}>
                  <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden /> {phase === 'live' ? t.enterLiveRoom : t.enterAuctionRoom}
                </AppLink>
              </Button>
            </div>
          ) : null}
        </div>

        {/* the purse — what this manager can actually spend */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t.purseLeft}</p>
            <p className="mt-1 text-3xl font-black leading-none tracking-tight tabular-nums text-teal-200">{formatBDT(team.remaining)}</p>
            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">{t.ofBudget(formatBDT(team.budget))}</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {t.squadOf(team.squadCount, team.maxSquad)}
            </p>
            <p className={cn('mt-0.5 text-xs', needed > 0 ? 'text-amber-300' : 'text-muted-foreground')}>
              {needed > 0 ? t.moreToMin(needed, team.minSquad) : t.minReached(team.minSquad)}
            </p>
          </div>
        </div>
      </div>
    </Arena>
  )
}

/** Bought players for one team — fetched the first time its card is opened, then cached. */
function SquadList({ team }: { team: MyTeamRow }) {
  const t = useStrings(STRINGS)
  const { data, loading } = useCachedGet<TournamentDetail>(tournamentDetailUrl(team.tournamentId))
  if (loading && !data) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: Math.min(3, Math.max(1, team.squadCount)) }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    )
  }
  if (!data) {
    return <p className="p-4 text-sm text-muted-foreground">{t.squadLoadFail}</p>
  }
  const squad = data.players
    .filter((p) => p.status === 'SOLD' && p.soldToTeamId === team.id)
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
  if (squad.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t.noPlayersYet}
      </p>
    )
  }
  return (
    <div>
      <ul className="divide-y" aria-label={t.squadAria(team.name)}>
        {squad.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                #{String(p.playerNumber).padStart(3, '0')} · <PlayerRole role={p.role} />
                {p.category ? t.cat(p.category) : ''}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700 dark:text-teal-300">{formatBDT(p.soldPrice ?? p.basePrice)}</span>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
        {t.squadSummary(squad.length, formatBDT(team.spent / squad.length))}
      </p>
    </div>
  )
}

function TeamCard({ team, defaultOpen }: { team: MyTeamRow; defaultOpen: boolean }) {
  const t = useStrings(STRINGS)
  const [open, setOpen] = useState(defaultOpen)
  const phase = phaseOf(team)
  const chip = PHASE_CHIP[phase]
  const spendPct = team.budget > 0 ? Math.min(100, (team.spent / team.budget) * 100) : 0
  const needed = shortBy(team)
  const enterable = (phase === 'live' || phase === 'open') && !!team.roomCode

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <TeamAvatar name={team.name} color={team.color} logoUrl={team.logoUrl} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{team.name}</p>
              <p className="truncate text-xs text-muted-foreground">{team.tournamentName}</p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', chip.className)}>{t.phase[phase]}</span>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBDT(team.remaining)} <span className="text-xs font-medium text-muted-foreground">{t.left}</span>
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t.spentOf(formatBDT(team.spent), formatBDT(team.budget))}
              </p>
            </div>
            <Progress value={spendPct} className="mt-2 h-1.5" aria-label={t.budgetUsedAria(team.name)} />
            <p className={cn('mt-2 flex items-center gap-1 text-xs', needed > 0 && phase !== 'finished' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
              {needed > 0 && phase !== 'finished' ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden /> : null}
              {t.squad} <span className="font-semibold tabular-nums text-foreground">{team.squadCount}/{team.maxSquad}</span>
              {needed === 0
                ? t.squadMinReached(team.minSquad)
                : phase === 'finished'
                  ? t.squadFinishedShort(needed, team.minSquad)
                  : t.squadNeedMore(needed, team.minSquad)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {enterable ? (
              <Button asChild size="sm" className="h-9 font-semibold">
                <AppLink href={`/room/${team.roomCode}`}>
                  <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden /> {t.enterRoom}
                </AppLink>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost" className="h-9">
              <AppLink href={`/results/${team.tournamentId}`}>
                <History className="mr-1.5 h-4 w-4" aria-hidden /> {t.results}
              </AppLink>
            </Button>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline" className="ml-auto h-9">
                {open ? t.hideSquad : t.showSquad(team.squadCount)}
                <ChevronDown className={cn('ml-1 h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent className="border-t bg-muted/20">
          <SquadList team={team} />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

/** The manager's home: their next auction first, then every team with its squad one tap away. */
export default function ManagerDashboard() {
  const { user } = useAuthState()
  const t = useStrings(STRINGS)
  const [teams, setTeams] = useState<MyTeamRow[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef(true)
  const hasTeams = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ teams: MyTeamRow[] }>('/api/my/teams')
      if (!mounted.current) return
      hasTeams.current = true
      setTeams([...res.teams].sort(byPhase))
      setError(null)
    } catch (e: unknown) {
      // A failed background refresh keeps the teams already on screen.
      if (!mounted.current || hasTeams.current) return
      setError(e instanceof Error ? e : new Error(STRINGS[useLangStore.getState().lang].couldNotLoad))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  // Coming back to the tab refreshes the cards, so "Enter live room" shows up
  // without a manual page refresh once the organizer opens the auction.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // While an auction is still ahead (none live yet), check every 30s while the page is visible.
  const waitingForAuction =
    !!teams && !teams.some((team) => phaseOf(team) === 'live') && teams.some((team) => phaseOf(team) !== 'finished')
  useEffect(() => {
    if (!waitingForAuction) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 30_000)
    return () => clearInterval(id)
  }, [waitingForAuction, load])

  const firstName = user?.name.split(/\s+/)[0] ?? t.managerFallback
  const featured = teams?.find((team) => phaseOf(team) !== 'finished')
  const bought = teams?.reduce((n, team) => n + team.squadCount, 0) ?? 0

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.welcome(firstName)}</h1>
          {teams && teams.length > 0 ? (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {t.summary(teams.length, bought)}
            </p>
          ) : null}
        </div>
        <Button asChild size="lg" variant={featured && phaseOf(featured) !== 'upcoming' ? 'outline' : 'default'} className="min-h-11 font-semibold">
          <AppLink href="/join">
            <DoorOpen className="mr-2 h-4 w-4" aria-hidden /> {t.joinWithCode}
          </AppLink>
        </Button>
      </header>

      {error ? <LoadError className="mt-6" what={t.teamsWhat} error={error} onRetry={load} /> : null}

      {!teams && !error ? (
        <div className="mt-6 space-y-4" aria-busy="true" aria-label={t.loadingTeams}>
          <Skeleton className="h-64 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </div>
        </div>
      ) : null}

      {teams && teams.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Users}
            title={t.noTeamTitle}
            description={t.noTeamDesc}
            action={
              <Button asChild>
                <AppLink href="/join">
                  <Plus className="mr-2 h-4 w-4" aria-hidden /> {t.joinWithCode}
                </AppLink>
              </Button>
            }
          />
        </div>
      ) : null}

      {teams && teams.length > 0 ? (
        <>
          {featured ? (
            <div className="mt-6">
              <AuctionBanner team={featured} />
            </div>
          ) : null}

          <section className="mt-8" aria-label={t.yourTeamsAria}>
            <h2 className="text-lg font-bold">{t.yourTeamsHeading(teams.length)}</h2>
            <div className="mt-3 grid items-start gap-4 md:grid-cols-2">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} defaultOpen={teams.length === 1} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
