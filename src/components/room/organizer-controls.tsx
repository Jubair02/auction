'use client'

import { useState } from 'react'
import {
  Ban,
  FastForward,
  Gavel,
  Hand,
  ListChecks,
  Pause,
  Play,
  Send,
  Shuffle,
  Square,
  Tag,
} from 'lucide-react'
import { formatBDT } from '@/lib/format'
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
}

type ConfirmKind = 'sell' | 'unsold' | 'end' | null

/** Organizer cockpit — start/pause/sell controls, manual bid, category chips. */
export function OrganizerControls({ state, onAction }: OrganizerControlsProps) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const live = state.status === 'LIVE'
  const paused = state.status === 'PAUSED'
  const ready = state.status === 'READY'
  const ended = state.status === 'ENDED'
  const hasPlayer = !!state.currentPlayer
  const hasBid = !!state.currentBid

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
            <p className="rounded-lg bg-muted px-3 py-3 text-center text-sm font-medium text-muted-foreground">
              Auction ended — head to the results report for final squads.
            </p>
          ) : null}

          {(live || paused) ? (
            <>
              <Button
                size="lg"
                className="h-12 w-full text-sm font-bold"
                disabled={hasPlayer}
                onClick={() => onAction('next_player')}
                title={hasPlayer ? 'A player is already on the block' : 'Bring a random player to the block'}
              >
                <Shuffle className="mr-2 h-4.5 w-4.5" />
                Next player (random)
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

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-11" disabled={!live} onClick={() => setManualOpen(true)}>
                  <Hand className="mr-1.5 h-4 w-4" /> Manual bid
                </Button>
                <Button
                  variant="destructive"
                  className="h-11"
                  disabled={ended}
                  onClick={() => setConfirm('end')}
                >
                  <Square className="mr-1.5 h-4 w-4" /> End auction
                </Button>
              </div>

              {!hasPlayer && live ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  Pick a player from the pool below or bring a random one.
                </p>
              ) : null}
            </>
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
          title="End this auction permanently?"
          description="This ends the auction permanently. Any player currently on the block returns to the pool, and the tournament is marked completed."
          actionLabel="End auction"
          destructive
          onAction={() => {
            setConfirm(null)
            onAction('end')
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
    if (n < minBid) {
      setError(`Minimum bid is ${formatBDT(minBid)}`)
      return
    }
    if (n > team.remaining) {
      setError(`${team.name} only has ${formatBDT(team.remaining)} left`)
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
                {state.teams.map((t) => (
                  <SelectItem key={t.id} value={t.id} disabled={t.squadCount >= t.maxSquad}>
                    {t.name} · left {formatBDT(t.remaining)}
                    {t.squadCount >= t.maxSquad ? ' (squad full)' : ''}
                  </SelectItem>
                ))}
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
