'use client'

import { useMemo, useState } from 'react'
import { Ban, Gavel, ShieldAlert, Wallet } from 'lucide-react'
import { formatBDT, formatNumber } from '@/lib/format'
import type { RoomState, RoomTeam } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { TeamAvatar } from '@/components/shared/avatars'

interface BidPanelProps {
  state: RoomState
  myTeam: RoomTeam | undefined
  onBid: (amount: number) => void
}

/** THE conversion element — manager's bidding console. */
export function BidPanel({ state, myTeam, onBid }: BidPanelProps) {
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)

  const player = state.currentPlayer
  const minBid = useMemo(() => {
    if (!player) return 0
    return state.currentBid ? state.currentBid.amount + state.minIncrement : player.basePrice
  }, [player, state.currentBid, state.minIncrement])

  const squadFull = myTeam ? myTeam.squadCount >= myTeam.maxSquad : false
  // The engine caps bids so a team can still afford its minimum squad.
  // `maxBid` is absent only while an older socket service is running.
  const maxBid = myTeam ? (myTeam.maxBid ?? myTeam.remaining) : 0
  const reserved = myTeam ? Math.max(0, myTeam.remaining - maxBid) : 0
  const leadingBid = !!myTeam && state.currentBid?.teamId === myTeam.id
  const pricedOut = !!myTeam && !!player && maxBid < minBid
  const biddingOpen =
    state.status === 'LIVE' && !!player && !!myTeam && !squadFull && !leadingBid && !pricedOut

  function reason(): string | null {
    if (state.status === 'READY') return 'Auction has not started yet'
    if (state.status === 'PAUSED') return 'Auction paused by the organizer'
    if (state.status === 'ENDED') return 'Auction has ended'
    if (!player) return 'Waiting for the next player'
    if (squadFull) return 'Your squad is full'
    if (leadingBid) return 'You already hold the highest bid'
    if (pricedOut) return `Out of reach — your maximum is ${formatBDT(maxBid)}`
    return null
  }

  function validate(amount: number): string | null {
    if (!myTeam) return 'Team not found'
    if (!player) return 'No player on the block right now'
    if (state.status === 'PAUSED') return 'Auction is paused'
    if (state.status !== 'LIVE') return 'Bidding is not open'
    if (squadFull) return `Squad full (${myTeam.squadCount}/${myTeam.maxSquad})`
    if (leadingBid) return 'You already hold the highest bid'
    if (amount < minBid) return `Minimum bid is ${formatBDT(minBid)}`
    if (amount > myTeam.remaining) return `Over budget — only ${formatBDT(myTeam.remaining)} left`
    if (amount > maxBid) {
      return `Maximum bid is ${formatBDT(maxBid)} — ${formatBDT(reserved)} is reserved for your minimum squad`
    }
    return null
  }

  function submit(amount: number) {
    const err = validate(amount)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setCustom('')
    onBid(amount)
  }

  function submitCustom() {
    const n = Number(custom.replace(/[^0-9]/g, ''))
    if (!custom.trim() || Number.isNaN(n) || n <= 0) {
      setError('Enter a valid amount')
      return
    }
    submit(Math.round(n))
  }

  const disabled = !biddingOpen
  const disableReason = reason()

  // Quick increments always start from the minimum legal next bid, so no quick
  // button can produce an amount the server would reject.
  const steps = [0, 10000, 20000].map((extra) => Math.max(state.minIncrement, extra))
  const quickAmounts = [minBid, minBid + steps[1], minBid + steps[2]]
  const quickLabels = state.currentBid
    ? quickAmounts.map((a) => `+${formatNumber(a - state.currentBid!.amount)}`)
    : ['Base', `+${formatNumber(steps[1])}`, `+${formatNumber(steps[2])}`]

  return (
    <Card className="border-primary/25 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4.5 w-4.5 text-primary" aria-hidden />
          Bid console
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {myTeam ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <TeamAvatar name={myTeam.name} color={myTeam.color} logoUrl={myTeam.logoUrl} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{myTeam.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Squad {myTeam.squadCount}/{myTeam.maxSquad} · min {myTeam.minSquad} · spent {formatBDT(myTeam.spent)}
              </p>
              <Progress value={myTeam.budget > 0 ? (myTeam.spent / myTeam.budget) * 100 : 0} className="mt-1.5 h-1.5" aria-label="Budget used" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Left</p>
              <p className="text-lg font-black tabular-nums text-emerald-700">{formatBDT(myTeam.remaining)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4" aria-hidden /> No team attached to your seat
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Minimum bid</p>
            <p className="text-2xl font-black tabular-nums text-primary">{player ? formatBDT(minBid) : '—'}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your maximum</p>
            <p
              className={cn(
                'text-2xl font-black tabular-nums',
                pricedOut ? 'text-rose-600' : 'text-foreground',
              )}
            >
              {myTeam ? formatBDT(maxBid) : '—'}
            </p>
          </div>
        </div>
        {reserved > 0 ? (
          <p className="-mt-2 text-center text-[11px] text-muted-foreground">
            {formatBDT(reserved)} held back so you can still reach your minimum squad of {myTeam?.minSquad}
          </p>
        ) : null}

        {/* quick increment buttons */}
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Quick bid buttons">
          {quickAmounts.map((amount, i) => {
            const overBudget = myTeam ? amount > maxBid : true
            const btnDisabled = disabled || overBudget || squadFull
            return (
              <button
                key={i}
                type="button"
                disabled={btnDisabled}
                onClick={() => submit(amount)}
                aria-label={`Bid ${formatBDT(amount)}`}
                className={cn(
                  'flex h-14 min-w-11 flex-col items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/5 text-primary transition-all',
                  'hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'disabled:pointer-events-none disabled:opacity-45',
                  btnDisabled && overBudget && 'line-through decoration-rose-500'
                )}
              >
                <span className="text-sm font-black leading-none">{quickLabels[i]}</span>
                <span className="mt-0.5 text-[10px] font-semibold tabular-nums opacity-80">{formatNumber(amount)}</span>
                {!btnDisabled || !overBudget ? null : (
                  <span className="text-[9px] font-semibold uppercase text-rose-600 no-underline">over budget</span>
                )}
              </button>
            )
          })}
        </div>

        {/* custom amount */}
        <div>
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="Custom amount"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCustom()
              }}
              disabled={disabled}
              className="h-11 tabular-nums"
              aria-label="Custom bid amount"
            />
            <Button className="h-11 w-20 shrink-0 font-bold" disabled={disabled} onClick={submitCustom}>
              Bid
            </Button>
          </div>
          {error ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600" role="alert">
              <Ban className="h-3 w-3" aria-hidden /> {error}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Bidding as <span className="font-semibold text-foreground">{myTeam?.name ?? '—'}</span>
            </p>
          )}
        </div>

        {disableReason ? (
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden /> {disableReason} — bidding is disabled.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
