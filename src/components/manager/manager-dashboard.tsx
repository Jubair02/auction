'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown, DoorOpen, History, Plus, Radio, Users } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { formatAuctionWhen, formatBDT } from '@/lib/format'
import { sportLabel, type AuctionStatus, type Sport, type TeamDTO, type TournamentDetail, type TournamentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Arena } from '@/components/shared/arena'
import { EmptyState } from '@/components/shared/empty-state'
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
const PHASE_ORDER: Record<Phase, number> = { live: 0, open: 1, upcoming: 2, finished: 3 }
const PHASE_CHIP: Record<Phase, { label: string; className: string }> = {
  live: { label: 'Live now', className: 'bg-amber-100 text-amber-900' },
  open: { label: 'Room open', className: 'bg-teal-50 text-teal-800' },
  upcoming: { label: 'Upcoming', className: 'bg-slate-100 text-slate-700' },
  finished: { label: 'Finished', className: 'bg-muted text-muted-foreground' },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const auctionTime = (t: MyTeamRow) => (t.auctionAt ? new Date(t.auctionAt).getTime() : Number.POSITIVE_INFINITY)
function byPhase(a: MyTeamRow, b: MyTeamRow) {
  return PHASE_ORDER[phaseOf(a)] - PHASE_ORDER[phaseOf(b)] || auctionTime(a) - auctionTime(b) || a.name.localeCompare(b.name)
}
/** Players still needed to reach the minimum squad, or 0. */
const shortBy = (t: MyTeamRow) => Math.max(0, t.minSquad - t.squadCount)

/** The auction the manager should be thinking about right now, staged like the room itself. */
function AuctionBanner({ team }: { team: MyTeamRow }) {
  const phase = phaseOf(team)
  const when = formatAuctionWhen(team.auctionAt ?? null)
  const needed = shortBy(team)
  const enterable = (phase === 'live' || phase === 'open') && !!team.roomCode

  const eyebrow =
    phase === 'live'
      ? { text: team.auctionStatus === 'PAUSED' ? 'Live · paused' : 'Live now', className: 'bg-amber-400/15 text-amber-300 ring-amber-300/30' }
      : phase === 'open'
        ? { text: 'Room open', className: 'bg-teal-400/15 text-teal-200 ring-teal-300/30' }
        : { text: 'Coming up', className: 'bg-white/10 text-slate-200 ring-white/15' }

  const line =
    phase === 'live'
      ? 'Bidding is under way — players are going now.'
      : phase === 'open'
        ? when && !when.past
          ? `The room is open. Bidding starts ${when.text}.`
          : 'The room is open. Bidding starts when the organizer presses Start.'
        : when && !when.past
          ? `Auction ${when.text}. The room opens on the day.`
          : 'No auction time yet — your organizer will share it.'

  return (
    <Arena>
      <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_17rem] md:items-stretch">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ring-1', eyebrow.className)}>
              {phase === 'live' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" aria-hidden /> : null}
              {eyebrow.text}
            </span>
            {team.sport ? <span className="text-xs font-medium text-muted-foreground">{sportLabel(team.sport, 'en', team.sportName)}</span> : null}
          </div>

          <h2 className="mt-3 line-clamp-2 break-words text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">{team.tournamentName}</h2>

          <p className="mt-3 flex items-start gap-1.5 text-sm text-foreground/80">
            {phase === 'live' ? <Radio className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {line}
          </p>

          <div className="mt-4 flex items-center gap-2.5">
            <TeamAvatar name={team.name} color={team.color} logoUrl={team.logoUrl} className="h-9 w-9 ring-2 ring-white/15" />
            <p className="min-w-0 text-sm">
              <span className="text-muted-foreground">Bidding as </span>
              <span className="font-bold">{team.name}</span>
            </p>
          </div>

          {enterable ? (
            <div className="mt-6 md:mt-auto md:pt-6">
              <Button className="h-11 px-5 font-bold" onClick={() => navigate(`/room/${team.roomCode}`)}>
                <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden /> {phase === 'live' ? 'Enter live room' : 'Enter auction room'}
              </Button>
            </div>
          ) : null}
        </div>

        {/* the purse — what this manager can actually spend */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Purse left</p>
            <p className="mt-1 text-3xl font-black leading-none tracking-tight tabular-nums text-teal-200">{formatBDT(team.remaining)}</p>
            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">of {formatBDT(team.budget)}</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">
              Squad {team.squadCount}/{team.maxSquad}
            </p>
            <p className={cn('mt-0.5 text-xs', needed > 0 ? 'text-amber-300' : 'text-muted-foreground')}>
              {needed > 0 ? `${plural(needed, 'more player')} to reach the minimum of ${team.minSquad}` : `Minimum of ${team.minSquad} reached`}
            </p>
          </div>
        </div>
      </div>
    </Arena>
  )
}

/** Bought players for one team — fetched the first time its card is opened, then cached. */
function SquadList({ team }: { team: MyTeamRow }) {
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
    return <p className="p-4 text-sm text-muted-foreground">Couldn’t load the squad. Open the card again to retry.</p>
  }
  const squad = data.players
    .filter((p) => p.status === 'SOLD' && p.soldToTeamId === team.id)
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
  if (squad.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No players yet. Players you win in the auction appear here straight away.
      </p>
    )
  }
  return (
    <div>
      <ul className="divide-y" aria-label={`${team.name} squad`}>
        {squad.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                #{String(p.playerNumber).padStart(3, '0')} · {p.role}
                {p.category ? ` · Cat ${p.category}` : ''}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">{formatBDT(p.soldPrice ?? p.basePrice)}</span>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
        {plural(squad.length, 'player')} · average {formatBDT(team.spent / squad.length)}
      </p>
    </div>
  )
}

function TeamCard({ team, defaultOpen }: { team: MyTeamRow; defaultOpen: boolean }) {
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
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', chip.className)}>{chip.label}</span>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xl font-black tabular-nums text-emerald-700">
                {formatBDT(team.remaining)} <span className="text-xs font-medium text-muted-foreground">left</span>
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatBDT(team.spent)} of {formatBDT(team.budget)}
              </p>
            </div>
            <Progress value={spendPct} className="mt-2 h-1.5" aria-label={`${team.name} budget used`} />
            <p className={cn('mt-2 flex items-center gap-1 text-xs', needed > 0 && phase !== 'finished' ? 'text-amber-700' : 'text-muted-foreground')}>
              {needed > 0 && phase !== 'finished' ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden /> : null}
              Squad <span className="font-semibold tabular-nums text-foreground">{team.squadCount}/{team.maxSquad}</span>
              {needed === 0
                ? ` · minimum of ${team.minSquad} reached`
                : phase === 'finished'
                  ? ` · finished ${needed} short of the minimum of ${team.minSquad}`
                  : ` · ${needed} more for the minimum of ${team.minSquad}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {enterable ? (
              <Button size="sm" className="h-9 font-semibold" onClick={() => navigate(`/room/${team.roomCode}`)}>
                <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden /> Enter room
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" className="h-9" onClick={() => navigate(`/results/${team.tournamentId}`)}>
              <History className="mr-1.5 h-4 w-4" aria-hidden /> Results
            </Button>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline" className="ml-auto h-9">
                {open ? 'Hide squad' : `Show squad (${team.squadCount})`}
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
  const user = useAppStore((s) => s.user)
  const [teams, setTeams] = useState<MyTeamRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ teams: MyTeamRow[] }>('/api/my/teams')
      .then((res) => {
        if (!cancelled) setTeams([...res.teams].sort(byPhase))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your teams')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = user?.name.split(/\s+/)[0] ?? 'Manager'
  const featured = teams?.find((t) => phaseOf(t) !== 'finished')
  const bought = teams?.reduce((n, t) => n + t.squadCount, 0) ?? 0

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Welcome back, {firstName}</h1>
          {teams && teams.length > 0 ? (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {plural(teams.length, 'team')} · {plural(bought, 'player')} bought
            </p>
          ) : null}
        </div>
        <Button size="lg" variant={featured && phaseOf(featured) !== 'upcoming' ? 'outline' : 'default'} className="min-h-11 font-semibold" onClick={() => navigate('/join')}>
          <DoorOpen className="mr-2 h-4 w-4" aria-hidden /> Join with a room code
        </Button>
      </header>

      {error ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Your teams didn’t load</p>
            <p>{error} Refresh the page to try again.</p>
          </div>
        </div>
      ) : null}

      {!teams && !error ? (
        <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading your teams">
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
            title="You don’t manage a team yet"
            description="Join a room with the code your organizer sent — it looks like BD26-XXXX — and pick an unclaimed team. Your organizer can also attach a team to your account."
            action={
              <Button onClick={() => navigate('/join')}>
                <Plus className="mr-2 h-4 w-4" aria-hidden /> Join with a room code
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

          <section className="mt-8" aria-label="Your teams">
            <h2 className="text-lg font-bold">{teams.length === 1 ? 'Your team' : 'Your teams'}</h2>
            <div className="mt-3 grid items-start gap-4 md:grid-cols-2">
              {teams.map((t) => (
                <TeamCard key={t.id} team={t} defaultOpen={teams.length === 1} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
