'use client'

import { useState } from 'react'
import {
  Ban,
  Bot,
  CircleCheck,
  Timer,
  FastForward,
  Gavel,
  Hand,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Repeat,
  Trophy,
  RotateCcw,
  Send,
  Shuffle,
  Square,
  Tag,
} from 'lucide-react'
import { formatBDT, formatClock } from '@/lib/format'
import { useCountdown } from '@/lib/use-auction-socket'
import type { OrganizerAction, RoomState, RoomTeam } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OrganizerControlsProps {
  state: RoomState
  onAction: (action: OrganizerAction, payload?: Record<string, unknown>) => void
  /** serverTime − clientTime, so the session countdown matches the server. */
  clockOffset?: number
}

type ConfirmKind = 'sell' | 'unsold' | 'end' | 'reopen' | 'rounds' | null

/** Organizer cockpit — start/pause/sell controls, manual bid, category chips. */
export function OrganizerControls({ state, onAction, clockOffset = 0 }: OrganizerControlsProps) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const live = state.status === 'LIVE'
  const paused = state.status === 'PAUSED'
  const ready = state.status === 'READY'
  const ended = state.status === 'ENDED'
  const hasPlayer = !!state.currentPlayer
  const hasBid = !!state.currentBid
  // Round over: nothing on the block and nobody left to bring up this round.
  const roundComplete = (live || paused) && !hasPlayer && state.pool.available === 0
  const leftOver = state.pool.unsold + state.pool.skipped

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="h-4.5 w-4.5 text-primary" aria-hidden />
            Organizer controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ready ? (
            <Button
              size="lg"
              className="h-14 w-full text-base font-black"
              onClick={() => onAction('start')}
            >
              <Play className="mr-2 h-5 w-5" /> Start Auction
            </Button>
          ) : null}

          {ended ? (
            <div className="space-y-3">
              <RoundSummary state={state} final />
              <p className="rounded-lg bg-muted px-3 py-3 text-center text-sm font-medium text-muted-foreground">
                Auction ended — head to the results report for final squads.
              </p>
              <Button variant="outline" className="h-11 w-full" onClick={() => setConfirm('reopen')}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reopen auction
              </Button>
            </div>
          ) : null}

          {roundComplete ? (
            <RoundSummary
              state={state}
              onReauction={() => setConfirm('rounds')}
              onFinalize={() => setConfirm('end')}
              reauctionDisabled={!live}
            />
          ) : null}

          {!ended ? <AutoAuctionPanel state={state} onAction={onAction} clockOffset={clockOffset} /> : null}

          {(live || paused) ? (
            <>
              <Button
                size="lg"
                className="h-12 w-full text-sm font-bold"
                disabled={hasPlayer || state.autoAdvance || roundComplete}
                onClick={() => onAction('next_player')}
                title={
                  state.autoAdvance
                    ? 'Auto Auction brings up the next player — turn it off to pick manually'
                    : hasPlayer
                      ? 'A player is already on the block'
                      : 'Bring a random player to the block'
                }
              >
                <Shuffle className="mr-2 h-4.5 w-4.5" />
                {state.autoAdvance ? 'Next player (automatic)' : 'Next player (random)'}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" disabled={!hasPlayer || !live} onClick={() => onAction('skip')}>
                  <FastForward className="mr-1.5 h-4 w-4" /> Skip
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={!live && !paused}
                  onClick={() => onAction(paused ? 'resume' : 'pause')}
                >
                  {paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}
                  {paused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-teal-300 text-teal-800 hover:bg-teal-50 hover:text-teal-900"
                  disabled={!hasBid || !live}
                  onClick={() => setConfirm('sell')}
                >
                  <Tag className="mr-1.5 h-4 w-4" /> Sell now
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={!hasPlayer || !live}
                  onClick={() => setConfirm('unsold')}
                >
                  <Ban className="mr-1.5 h-4 w-4" /> Unsold
                </Button>
              </div>

              {!hasPlayer && live && !state.autoAdvance ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  Pick a player from the pool below or bring a random one.
                </p>
              ) : null}
            </>
          ) : null}

          {/* Manual bid + End stay reachable in every non-ended state, so a room
              that was opened but never started can still be closed. */}
          {!ended ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11" disabled={!live} onClick={() => setManualOpen(true)}>
                <Hand className="mr-1.5 h-4 w-4" /> Manual bid
              </Button>
              <Button variant="destructive" className="h-11" onClick={() => setConfirm('end')}>
                <Square className="mr-1.5 h-4 w-4" /> End auction
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CategoryChips state={state} onAction={onAction} />

      {/* confirms */}
      <AlertDialog open={confirm === 'sell'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title="Sell to highest bidder?"
          description={
            state.currentBid
              ? `${state.currentBid.teamName} wins ${state.currentPlayer?.name ?? 'the player'} for ${formatBDT(state.currentBid.amount)}. This cannot be undone here — use Re-auction later if needed.`
              : 'No bid to sell.'
          }
          actionLabel="Sell now"
          onAction={() => {
            setConfirm(null)
            onAction('force_sell')
          }}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'unsold'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title="Mark player UNSOLD?"
          description={`The timer stops and ${state.currentPlayer?.name ?? 'this player'} goes unpicked. You can re-auction them from the pool later.`}
          actionLabel="Mark unsold"
          destructive
          onAction={() => {
            setConfirm(null)
            onAction('force_unsold')
          }}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'end'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title="End this auction?"
          description="Any player currently on the block returns to the pool, and the tournament is marked completed. Sold players keep their teams. You can reopen the auction afterwards if you need to."
          actionLabel="End auction"
          destructive
          onAction={() => {
            setConfirm(null)
            onAction('end')
          }}
        />
      </AlertDialog>

      <AlertDialog open={confirm === 'rounds'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title={`Start round ${state.round + 1}?`}
          description={`The ${leftOver} unsold & skipped player${leftOver === 1 ? '' : 's'} go back into the pool and are auctioned again from their base price. Sold players, squads, budgets and all earlier bids stay as they are.${state.autoAdvance ? ' Auto Auction is on, so the first player comes up by itself.' : ' Use Next player to bring up each player.'}`}
          actionLabel="Start re-auction round"
          onAction={() => {
            setConfirm(null)
            onAction('reauction_unsold')
          }}
        />
      </AlertDialog>

      <AlertDialog open={confirm === 'reopen'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title="Reopen the auction?"
          description="The room goes live again so you can auction the remaining players. Sold players, squads and budgets stay exactly as they are."
          actionLabel="Reopen auction"
          onAction={() => {
            setConfirm(null)
            onAction('reopen')
          }}
        />
      </AlertDialog>

      <ManualBidDialog
        state={state}
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSubmit={(teamId, amount) => {
          setManualOpen(false)
          onAction('manual_bid', { teamId, amount })
        }}
      />
    </>
  )
}

function ConfirmShell({
  title,
  description,
  actionLabel,
  onAction,
  destructive = false,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  destructive?: boolean
}) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className={cn(destructive && 'bg-rose-600 text-white hover:bg-rose-700')}
          onClick={onAction}
        >
          {actionLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}

/** Category A–E chips with live available counts (category mode only). */
export function CategoryChips({ state, onAction }: OrganizerControlsProps) {
  if (state.mode !== 'CATEGORY' || state.categories.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Selling order — categories
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {state.categories.map((c) => {
          const activeCat = state.currentCategory === c.code
          const depleted = c.available === 0
          return (
            <button
              key={c.code}
              type="button"
              disabled={depleted}
              onClick={() => onAction('set_category', { category: c.code })}
              aria-pressed={activeCat}
              className={cn(
                'flex min-h-11 flex-col items-center rounded-lg border-2 px-3 py-1.5 transition-colors',
                activeCat
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-primary/5',
                depleted && 'pointer-events-none opacity-40'
              )}
            >
              <span className="text-sm font-black">Cat {c.code}</span>
              <span className={cn('text-[10px] font-semibold tabular-nums', activeCat ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {c.available} left · base {formatBDT(c.basePrice)}
              </span>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ManualBidDialog({
  state,
  open,
  onOpenChange,
  onSubmit,
}: {
  state: RoomState
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (teamId: string, amount: number) => void
}) {
  const [teamId, setTeamId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const player = state.currentPlayer
  const minBid = player ? (state.currentBid ? state.currentBid.amount + state.minIncrement : player.basePrice) : 0
  const team: RoomTeam | undefined = state.teams.find((t) => t.id === teamId)
  const teamMax = team ? (team.maxBid ?? team.remaining) : 0

  function submit() {
    if (!player) {
      setError('No player on the block')
      return
    }
    if (!team) {
      setError('Choose a team')
      return
    }
    const n = Number(amount.replace(/[^0-9]/g, ''))
    if (!amount.trim() || Number.isNaN(n) || n <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (state.currentBid?.teamId === team.id) {
      setError(`${team.name} already holds the highest bid`)
      return
    }
    if (state.allowPreviousOwnerRebid === false && state.previousOwnerTeamId === team.id) {
      setError(`${team.name} lost this player in the re-auction and is blocked from bidding again`)
      return
    }
    if (n < minBid) {
      setError(`Minimum bid is ${formatBDT(minBid)}`)
      return
    }
    if (n > team.remaining) {
      setError(`${team.name} only has ${formatBDT(team.remaining)} left`)
      return
    }
    if (n > teamMax) {
      setError(`${team.name} can bid at most ${formatBDT(teamMax)} — the rest is reserved for their minimum squad`)
      return
    }
    if (team.squadCount >= team.maxSquad) {
      setError(`${team.name} squad is full`)
      return
    }
    setError(null)
    setAmount('')
    onSubmit(team.id, Math.round(n))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manual bid</DialogTitle>
          <DialogDescription>
            Record an offline bid for {player ? player.name : '—'} on behalf of a team.
            {player ? ` Minimum ${formatBDT(minBid)}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="manual-team">Team</Label>
            <Select value={teamId} onValueChange={(v) => { setTeamId(v); setError(null) }}>
              <SelectTrigger id="manual-team" className="h-11 w-full">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {state.teams.map((t) => {
                  const cap = t.maxBid ?? t.remaining
                  const full = t.squadCount >= t.maxSquad
                  const leading = state.currentBid?.teamId === t.id
                  const blocked =
                    state.allowPreviousOwnerRebid === false && state.previousOwnerTeamId === t.id
                  return (
                    <SelectItem key={t.id} value={t.id} disabled={full || leading || blocked}>
                      {t.name} · max {formatBDT(cap)}
                      {full
                        ? ' (squad full)'
                        : leading
                          ? ' (highest bidder)'
                          : blocked
                            ? ' (blocked — previous owner)'
                            : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">Amount (৳)</Label>
            <Input
              id="manual-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null) }}
              className="h-11 tabular-nums"
              placeholder={minBid ? String(minBid) : '0'}
            />
          </div>
          {error ? (
            <p className="text-xs font-medium text-rose-600" role="alert">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!player || state.status !== 'LIVE'}>
            <Send className="mr-1.5 h-4 w-4" /> Place bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90]
const DURATION_MIN = 5
const DURATION_MAX = 600

/**
 * Auto Auction switch, bidding duration and the live session countdown.
 * Everything is server-driven: the switch and duration are organizer actions,
 * and the countdown reads the server's timer — so every screen agrees and a
 * refresh changes nothing.
 */
function AutoAuctionPanel({ state, onAction, clockOffset }: OrganizerControlsProps & { clockOffset: number }) {
  const live = state.status === 'LIVE'
  const paused = state.status === 'PAUSED'
  const hasPlayer = !!state.currentPlayer
  // The duration is read-only until the organizer clicks Edit; the draft only
  // exists while editing and is discarded by Cancel.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const draftSeconds = Number(draft)
  const draftValid = Number.isInteger(draftSeconds) && draftSeconds >= DURATION_MIN && draftSeconds <= DURATION_MAX
  const startEdit = () => {
    setDraft(String(state.bidTimerSeconds))
    setEditing(true)
  }
  const cancelEdit = () => {
    setDraft('')
    setEditing(false)
  }
  const saveEdit = () => {
    if (!draftValid) return
    if (draftSeconds !== state.bidTimerSeconds) onAction('set_bid_timer', { seconds: draftSeconds })
    setEditing(false)
  }

  const lotRemaining = useCountdown(state.timerEndsAt, clockOffset, live && hasPlayer)
  const nextIn = useCountdown(state.nextPlayerAt, clockOffset, live && !hasPlayer && state.autoAdvance)

  let session: { label: string; value: string; tone: string }
  if (paused && hasPlayer) {
    session = { label: 'Paused', value: formatClock(state.pausedRemainingMs ?? 0), tone: 'text-slate-600' }
  } else if (live && hasPlayer) {
    const secs = Math.ceil(lotRemaining / 1000)
    session = {
      label: state.stage === 2 ? 'Going twice' : state.stage === 1 ? 'Going once' : 'Bidding open',
      value: formatClock(lotRemaining),
      tone: secs <= 5 ? 'text-rose-600' : secs <= 10 ? 'text-amber-600' : 'text-emerald-700',
    }
  } else if (live && state.autoAdvance && state.nextPlayerAt) {
    session = { label: 'Next player in', value: formatClock(nextIn), tone: 'text-primary' }
  } else {
    session = {
      label: state.status === 'READY' ? 'Not started' : 'No player on the block',
      value: '—',
      tone: 'text-muted-foreground',
    }
  }

  let hint = 'Each new bid restarts the countdown, then “going once / twice” follows.'
  if (editing && !draftValid) hint = `Enter ${DURATION_MIN}–${DURATION_MAX} seconds.`
  else if (hasPlayer && state.sessionTimerSeconds !== state.bidTimerSeconds) {
    hint = `This player runs on ${state.sessionTimerSeconds}s; ${state.bidTimerSeconds}s starts with the next player.`
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor="auto-auction" className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" aria-hidden /> Auto Auction
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {state.autoAdvance
              ? 'On — when a player is sold or goes unsold, the next random player comes up by itself.'
              : 'Off — you bring up each player with Next player.'}
            {hasPlayer ? ' Changes apply after the current player.' : ''}
          </p>
        </div>
        <Switch
          id="auto-auction"
          checked={state.autoAdvance}
          onCheckedChange={(enabled) => onAction('set_auto_advance', { enabled })}
          aria-label="Auto Auction"
          className="cursor-pointer"
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor={editing ? 'bid-duration' : undefined}
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <Timer className="h-4 w-4 text-primary" aria-hidden /> Bidding duration
        </Label>
        {editing ? (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="bid-duration"
                  type="number"
                  inputMode="numeric"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  className="h-10 pr-16 tabular-nums"
                  aria-describedby="bid-duration-hint"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  seconds
                </span>
              </div>
              <Button type="button" className="h-10" disabled={!draftValid} onClick={saveEdit}>
                Save
              </Button>
              <Button type="button" variant="outline" className="h-10" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((sec) => (
                <Button
                  key={sec}
                  type="button"
                  variant={String(sec) === draft ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-xs tabular-nums"
                  onClick={() => setDraft(String(sec))}
                >
                  {sec}s
                </Button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
            <span className="text-sm font-semibold tabular-nums" aria-label="Current bidding duration">
              {state.bidTimerSeconds} seconds
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={startEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
          </div>
        )}
        <p id="bid-duration-hint" className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2" aria-live="polite">
        <span className="text-xs font-medium text-muted-foreground">Current session · {session.label}</span>
        <span className={cn('font-mono text-lg font-bold tabular-nums', session.tone)}>{session.value}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Sold / Unsold / Skipped summary shown when a round runs out of players
 * (with the next-round and finalize actions), and read-only once finalized.
 */
function RoundSummary({
  state,
  final = false,
  onReauction,
  onFinalize,
  reauctionDisabled = false,
}: {
  state: RoomState
  final?: boolean
  onReauction?: () => void
  onFinalize?: () => void
  reauctionDisabled?: boolean
}) {
  const sold = state.players.filter((p) => p.status === 'SOLD')
  const totalValue = sold.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0)
  const leftOver = state.players.filter((p) => p.status === 'UNSOLD' || p.status === 'SKIPPED')
  const tiles = [
    { label: 'Sold', value: state.pool.sold, sub: formatBDT(totalValue), tone: 'text-emerald-700' },
    { label: 'Unsold', value: state.pool.unsold, sub: null, tone: 'text-rose-700' },
    { label: 'Skipped', value: state.pool.skipped, sub: null, tone: 'text-slate-700' },
  ]

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="h-4 w-4 text-primary" aria-hidden />
        {final ? 'Final summary' : `Round ${state.round} complete`}
        {state.round > 1 ? (
          <span className="text-xs font-normal text-muted-foreground">
            · {state.round} round{state.round === 1 ? '' : 's'} so far
          </span>
        ) : null}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-background px-2 py-2 text-center">
            <p className={cn('text-xl font-black tabular-nums', tile.tone)}>{tile.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
            {tile.sub ? <p className="truncate text-[11px] tabular-nums text-muted-foreground">{tile.sub}</p> : null}
          </div>
        ))}
      </div>

      {leftOver.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Unsold & skipped</p>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {leftOver.map((p) => (
              <span
                key={p.id}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs',
                  p.status === 'UNSOLD' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-background text-slate-700',
                )}
              >
                #{p.playerNumber} {p.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!final ? (
        <div className="space-y-2">
          {leftOver.length > 0 ? (
            <Button
              className="h-10 w-full gap-1.5 px-3 text-sm font-semibold"
              disabled={reauctionDisabled}
              onClick={onReauction}
              title="Re-Auction Unsold & Skipped Players"
            >
              <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Re-auction unsold &amp; skipped</span>
              <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-xs font-bold tabular-nums">
                {leftOver.length}
              </span>
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Every player has been sold.</p>
          )}
          {reauctionDisabled && leftOver.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">Resume the auction to start the next round.</p>
          ) : null}
          <Button
            variant="outline"
            className="h-9 w-full gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={onFinalize}
          >
            <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Finalize auction
          </Button>
        </div>
      ) : null}
    </div>
  )
}
