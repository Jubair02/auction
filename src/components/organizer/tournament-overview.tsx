'use client'

import {
  ArrowRight,
  Check,
  ClipboardCopy,
  DoorOpen,
  Gavel,
  Info,
  KeyRound,
  Radio,
  Share2,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatCard } from '@/components/shared/empty-state'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TournamentDetail } from '@/lib/types'

/** Tabs of the tournament page a checklist step can send the organizer to. */
export type DetailTab = 'overview' | 'players' | 'teams' | 'registrations' | 'insights' | 'auction'

export interface NextStep {
  label: string
  icon: LucideIcon
  /** Switch to a tab of this page… */
  tab?: DetailTab
  /** …or leave for another page. */
  href?: string
  /** The room is live right now — the button should draw the eye. */
  live?: boolean
}

/**
 * The one thing the organizer should do next, from what the page already knows.
 * Drives both the header's primary button and the checklist highlight.
 */
export function nextStep({ tournament: t, players, teams, auction }: TournamentDetail): NextStep {
  if (t.status === 'COMPLETED' || auction?.status === 'ENDED') {
    return { label: 'View results', icon: Trophy, href: `/results/${t.id}` }
  }
  if (players.length === 0) return { label: 'Add players', icon: Users, tab: 'players' }
  if (teams.length === 0) return { label: 'Create teams', icon: Wallet, tab: 'teams' }
  if (!auction) return { label: 'Set up auction', icon: Gavel, tab: 'auction' }
  if (auction.status === 'LIVE' || auction.status === 'PAUSED') {
    return { label: 'Enter live room', icon: Radio, href: `/room/${auction.roomCode}`, live: true }
  }
  return { label: 'Open auction room', icon: DoorOpen, href: `/room/${auction.roomCode}` }
}

export function goTo(step: Pick<NextStep, 'tab' | 'href'>, setTab: (tab: DetailTab) => void) {
  if (step.href) navigate(step.href)
  else if (step.tab) setTab(step.tab)
}

interface ChecklistItem {
  key: string
  title: string
  detail: string
  done: boolean
  /** Shown as a "Recommended" step: not needed to go live. */
  optional?: boolean
  action?: { label: string; tab?: DetailTab; href?: string }
}

function checklist({ tournament: t, players, teams, auction }: TournamentDetail): ChecklistItem[] {
  const uncategorized = t.auctionMode === 'CATEGORY' ? players.filter((p) => !p.category).length : 0
  const managed = teams.filter((tm) => tm.managerUserId).length
  const started = !!auction && auction.status !== 'READY'
  const items: ChecklistItem[] = [
    {
      key: 'players',
      title: 'Add players',
      detail:
        players.length === 0
          ? 'Type them in or import a CSV with names, roles and base prices.'
          : `${players.length} player${players.length === 1 ? '' : 's'} in the pool`,
      done: players.length > 0,
      action: { label: players.length === 0 ? 'Add players' : 'Manage', tab: 'players' },
    },
  ]
  if (t.auctionMode === 'CATEGORY') {
    items.push({
      key: 'categories',
      title: 'Give every player a category',
      detail:
        players.length === 0
          ? 'Category mode sells A–E in order, each with its own base price.'
          : uncategorized === 0
            ? 'Every player has a category'
            : `${uncategorized} player${uncategorized === 1 ? '' : 's'} without a category — random picks skip them`,
      done: players.length > 0 && uncategorized === 0,
      optional: true,
      action: uncategorized > 0 ? { label: 'Fix', tab: 'players' } : undefined,
    })
  }
  items.push(
    {
      key: 'teams',
      title: 'Create teams',
      detail:
        teams.length === 0
          ? 'Names, colours, budgets and squad limits.'
          : `${teams.length} team${teams.length === 1 ? '' : 's'} · ${formatBDT(teams.reduce((n, tm) => n + tm.budget, 0))} in total budgets`,
      done: teams.length > 0,
      action: { label: teams.length === 0 ? 'Create teams' : 'Manage', tab: 'teams' },
    },
    {
      key: 'managers',
      title: 'Give each team a manager',
      detail:
        teams.length === 0
          ? 'Invite managers so they can bid from their own phones.'
          : auction?.allowOpenClaim && managed < teams.length
            ? `${managed} of ${teams.length} assigned — the rest can claim a team in the room`
            : `${managed} of ${teams.length} teams have a manager`,
      done: teams.length > 0 && (managed === teams.length || !!auction?.allowOpenClaim),
      optional: true,
      action: teams.length > 0 && managed < teams.length ? { label: 'Invite', tab: 'teams' } : undefined,
    },
    {
      key: 'auction',
      title: 'Set up the auction',
      detail: auction ? `Room ${auction.roomCode} · ${auction.bidTimerSeconds}s per bid` : 'Pick the timer and increments to get your room code.',
      done: !!auction,
      action: { label: auction ? 'Settings' : 'Set up', tab: 'auction' },
    },
    {
      key: 'live',
      title: 'Run the live auction',
      detail:
        auction?.status === 'ENDED'
          ? 'Finished — the final squads are in the results report.'
          : started
            ? 'The auction is under way.'
            : 'Share the room code, open the room and press Start.',
      done: auction?.status === 'ENDED' || t.status === 'COMPLETED',
      action: auction
        ? auction.status === 'ENDED'
          ? { label: 'Results', href: `/results/${t.id}` }
          : { label: started ? 'Enter room' : 'Open room', href: `/room/${auction.roomCode}` }
        : undefined,
    },
  )
  return items
}

function SetupChecklist({ data, setTab }: { data: TournamentDetail; setTab: (tab: DetailTab) => void }) {
  const items = checklist(data)
  const required = items.filter((i) => !i.optional)
  const doneCount = required.filter((i) => i.done).length
  // The first unfinished required step is the one to do now.
  const currentKey = required.find((i) => !i.done)?.key
  const allDone = doneCount === required.length

  return (
    <Card className="gap-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{allDone ? 'Auction complete' : 'Get ready to go live'}</CardTitle>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {doneCount}/{required.length}
          </span>
        </div>
        <Progress value={(doneCount / required.length) * 100} className="mt-2 h-1.5" aria-label="Setup progress" />
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {items.map((item) => {
            const current = item.key === currentKey
            return (
              <li key={item.key} className={cn('flex items-center gap-3 py-3', current && '-mx-3 rounded-lg bg-primary/5 px-3')}>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                    item.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : current
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground'
                  )}
                  aria-hidden
                >
                  {item.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : items.indexOf(item) + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold', item.done && !current && 'text-muted-foreground')}>
                    {item.title}
                    {item.optional ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">Recommended</span>
                    ) : null}
                    <span className="sr-only">{item.done ? ' — done' : ' — to do'}</span>
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground sm:truncate">{item.detail}</p>
                </div>
                {item.action ? (
                  <Button
                    size="sm"
                    variant={current ? 'default' : 'ghost'}
                    className="h-8 shrink-0"
                    onClick={() => goTo(item.action!, setTab)}
                  >
                    {item.action.label}
                    {current ? <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden /> : null}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

const ROOM_STATUS: Record<string, { label: string; className: string }> = {
  READY: { label: 'Ready to start', className: 'bg-slate-100 text-slate-700' },
  LIVE: { label: 'Live now', className: 'bg-amber-100 text-amber-900' },
  PAUSED: { label: 'Paused', className: 'bg-slate-100 text-slate-700' },
  ENDED: { label: 'Ended', className: 'bg-teal-100 text-teal-900' },
}

function copy(text: string, done: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(done))
    .catch(() => toast.error('Could not copy — please copy manually'))
}

function RoomCard({ data, setTab }: { data: TournamentDetail; setTab: (tab: DetailTab) => void }) {
  const { tournament: t, auction } = data
  if (!auction) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <KeyRound className="h-7 w-7 text-muted-foreground" aria-hidden />
          <p className="font-semibold">No room code yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">Set up the auction to get a code managers join with.</p>
          <Button variant="outline" size="sm" className="mt-1" onClick={() => setTab('auction')}>
            Set up auction
          </Button>
        </CardContent>
      </Card>
    )
  }
  const status = ROOM_STATUS[auction.status] ?? ROOM_STATUS.READY
  const joinUrl = () => `${window.location.origin}/room/${auction.roomCode}`
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Room code</p>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', status.className)}>{status.label}</span>
        </div>
        <button
          type="button"
          onClick={() => copy(auction.roomCode, 'Room code copied')}
          className="group flex w-full items-center justify-between gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/60"
          aria-label={`Copy room code ${auction.roomCode}`}
        >
          <span className="font-mono text-2xl font-black tracking-[0.18em] text-primary">{auction.roomCode}</span>
          <ClipboardCopy className="h-4 w-4 text-primary/60 group-hover:text-primary" aria-hidden />
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-10"
            onClick={() =>
              copy(`NeelamGhor Live Auction — ${t.name}. Room Code: ${auction.roomCode}. Join: ${joinUrl()}`, 'Invite message copied')
            }
          >
            <Share2 className="mr-1.5 h-4 w-4" aria-hidden /> Copy invite
          </Button>
          <Button className="h-10" onClick={() => navigate(`/room/${auction.roomCode}`)}>
            <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden /> {auction.status === 'ENDED' ? 'View room' : 'Open room'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {auction.bidTimerSeconds}s bid timer · min increment {formatBDT(auction.minIncrement)}
          {auction.bidCount > 0 ? ` · ${auction.bidCount} bids so far` : ''}
        </p>
      </CardContent>
    </Card>
  )
}

export function TournamentOverview({ data, setTab }: { data: TournamentDetail; setTab: (tab: DetailTab) => void }) {
  const { tournament: t, players, teams } = data
  const sold = players.filter((p) => p.status === 'SOLD').length
  const unsold = players.filter((p) => p.status === 'UNSOLD').length
  const totalBudget = teams.reduce((n, tm) => n + tm.budget, 0)
  const spent = teams.reduce((n, tm) => n + tm.spent, 0)
  const managed = teams.filter((tm) => tm.managerUserId).length

  const details = [
    { k: 'Type', v: t.tournamentType ?? '—' },
    { k: 'Location', v: t.location ?? '—' },
    { k: 'Start date', v: formatDate(t.startDate) },
    { k: 'Auction at', v: formatDate(t.auctionAt, true) },
    { k: 'Auction mode', v: t.auctionMode === 'CATEGORY' ? 'Category-Based (A–E)' : 'Normal' },
    { k: 'Base price', v: t.auctionMode === 'NORMAL' ? formatBDT(t.basePrice) : 'Set per category' },
    { k: 'Created', v: formatDate(t.createdAt, true) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Players" value={players.length} hint={`${sold} sold · ${unsold} unsold`} />
        <StatCard label="Teams" value={teams.length} hint={`${managed} with a manager`} />
        <StatCard label="Total budget" value={formatBDT(totalBudget)} hint="Across all teams" />
        <StatCard label="Spent so far" value={formatBDT(spent)} tone={spent > 0 ? 'success' : 'default'} hint={`${formatBDT(totalBudget - spent)} left`} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SetupChecklist data={data} setTab={setTab} />

        <div className="space-y-4">
          <RoomCard data={data} setTab={setTab} />
          <Card className="gap-3">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" aria-hidden /> Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {details.map((row) => (
                  <div key={row.k} className="flex items-start justify-between gap-4 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                    <dt className="shrink-0 text-muted-foreground">{row.k}</dt>
                    <dd className="text-right font-medium">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
