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
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    notStarted: 'Auction has not started yet',
    pausedByOrganizer: 'Auction paused by the organizer',
    ended: 'Auction has ended',
    waitingNext: 'Waiting for the next player',
    squadFull: 'Your squad is full',
    lockedOutReason: 'You lost this player in the re-auction — the organizer has blocked previous owners',
    alreadyHighest: 'You already hold the highest bid',
    outOfReach: (max: string) => `Out of reach — your maximum is ${max}`,
    teamNotFound: 'Team not found',
    noPlayer: 'No player on the block right now',
    isPaused: 'Auction is paused',
    notOpen: 'Bidding is not open',
    squadFullCount: (count: number, max: number) => `Squad full (${count}/${max})`,
    lockedOut: 'You are blocked from bidding for this player in this round',
    minBidIs: (min: string) => `Minimum bid is ${min}`,
    overBudgetLeft: (left: string) => `Over budget — only ${left} left`,
    maxBidIs: (max: string, reserved: string) =>
      `Maximum bid is ${max} — ${reserved} is reserved for your minimum squad`,
    invalidAmount: 'Enter a valid amount',
    base: 'Base',
    title: 'Bid console',
    teamLine: (count: number, max: number, min: number, spent: string) =>
      `Squad ${count}/${max} · min ${min} · spent ${spent}`,
    budgetUsed: 'Budget used',
    left: 'Left',
    noTeam: 'No team attached to your seat',
    minimumBid: 'Minimum bid',
    yourMaximum: 'Your maximum',
    heldBack: (amount: string, minSquad: number | undefined) =>
      `${amount} held back so you can still reach your minimum squad of ${minSquad}`,
    quickBids: 'Quick bid buttons',
    bidAmount: (amount: string) => `Bid ${amount}`,
    overBudget: 'over budget',
    customAmount: 'Custom amount',
    customAria: 'Custom bid amount',
    bid: 'Bid',
    biddingAs: 'Bidding as',
    disabledSuffix: '— bidding is disabled.',
  },
  bn: {
    notStarted: 'নিলাম এখনো শুরু হয়নি',
    pausedByOrganizer: 'আয়োজক নিলামে বিরতি দিয়েছেন',
    ended: 'নিলাম শেষ হয়েছে',
    waitingNext: 'পরের খেলোয়াড়ের অপেক্ষায়',
    squadFull: 'আপনার স্কোয়াড পূর্ণ',
    lockedOutReason: 'রি-অকশনে এই খেলোয়াড়কে আপনি হারিয়েছেন — আয়োজক আগের দলের বিড বন্ধ রেখেছেন',
    alreadyHighest: 'সর্বোচ্চ বিড এখন আপনারই',
    outOfReach: (max: string) => `নাগালের বাইরে — আপনার সর্বোচ্চ ${max}`,
    teamNotFound: 'দল পাওয়া যায়নি',
    noPlayer: 'এই মুহূর্তে কোনো খেলোয়াড় নিলামে নেই',
    isPaused: 'নিলামে বিরতি চলছে',
    notOpen: 'বিড এখন বন্ধ',
    squadFullCount: (count: number, max: number) => `স্কোয়াড পূর্ণ (${count}/${max})`,
    lockedOut: 'এই রাউন্ডে এই খেলোয়াড়ের জন্য আপনি বিড করতে পারবেন না',
    minBidIs: (min: string) => `সর্বনিম্ন বিড ${min}`,
    overBudgetLeft: (left: string) => `বাজেটের বাইরে — বাকি আছে মাত্র ${left}`,
    maxBidIs: (max: string, reserved: string) =>
      `সর্বোচ্চ বিড ${max} — সর্বনিম্ন স্কোয়াডের জন্য ${reserved} রেখে দেওয়া হয়েছে`,
    invalidAmount: 'সঠিক অঙ্ক লিখুন',
    base: 'বেস',
    title: 'বিড কনসোল',
    teamLine: (count: number, max: number, min: number, spent: string) =>
      `স্কোয়াড ${count}/${max} · সর্বনিম্ন ${min} · খরচ ${spent}`,
    budgetUsed: 'বাজেট খরচ',
    left: 'বাকি',
    noTeam: 'আপনার আসনের সাথে কোনো দল যুক্ত নেই',
    minimumBid: 'সর্বনিম্ন বিড',
    yourMaximum: 'আপনার সর্বোচ্চ',
    heldBack: (amount: string, minSquad: number | undefined) =>
      `সর্বনিম্ন ${minSquad} জনের স্কোয়াড পূরণের জন্য ${amount} রেখে দেওয়া হয়েছে`,
    quickBids: 'দ্রুত বিডের বাটন',
    bidAmount: (amount: string) => `${amount} বিড করুন`,
    overBudget: 'বাজেটের বাইরে',
    customAmount: 'নিজের অঙ্ক',
    customAria: 'নিজের বিডের অঙ্ক',
    bid: 'বিড',
    biddingAs: 'যে দলের হয়ে বিড করছেন:',
    disabledSuffix: '— বিড বন্ধ আছে।',
  },
} satisfies Strings<{
  notStarted: string
  pausedByOrganizer: string
  ended: string
  waitingNext: string
  squadFull: string
  lockedOutReason: string
  alreadyHighest: string
  outOfReach: (max: string) => string
  teamNotFound: string
  noPlayer: string
  isPaused: string
  notOpen: string
  squadFullCount: (count: number, max: number) => string
  lockedOut: string
  minBidIs: (min: string) => string
  overBudgetLeft: (left: string) => string
  maxBidIs: (max: string, reserved: string) => string
  invalidAmount: string
  base: string
  title: string
  teamLine: (count: number, max: number, min: number, spent: string) => string
  budgetUsed: string
  left: string
  noTeam: string
  minimumBid: string
  yourMaximum: string
  heldBack: (amount: string, minSquad: number | undefined) => string
  quickBids: string
  bidAmount: (amount: string) => string
  overBudget: string
  customAmount: string
  customAria: string
  bid: string
  biddingAs: string
  disabledSuffix: string
}>

interface BidPanelProps {
  state: RoomState
  myTeam: RoomTeam | undefined
  onBid: (amount: number) => void
}

/** THE conversion element — manager's bidding console. */
export function BidPanel({ state, myTeam, onBid }: BidPanelProps) {
  const t = useStrings(STRINGS)
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
  // Organizer policy: the team that lost this player to a re-auction may be
  // locked out of the round.
  const lockedOut =
    !!myTeam && state.allowPreviousOwnerRebid === false && state.previousOwnerTeamId === myTeam.id
  const biddingOpen =
    state.status === 'LIVE' && !!player && !!myTeam && !squadFull && !leadingBid && !pricedOut && !lockedOut

  function reason(): string | null {
    if (state.status === 'READY') return t.notStarted
    if (state.status === 'PAUSED') return t.pausedByOrganizer
    if (state.status === 'ENDED') return t.ended
    if (!player) return t.waitingNext
    if (squadFull) return t.squadFull
    if (lockedOut) return t.lockedOutReason
    if (leadingBid) return t.alreadyHighest
    if (pricedOut) return t.outOfReach(formatBDT(maxBid))
    return null
  }

  function validate(amount: number): string | null {
    if (!myTeam) return t.teamNotFound
    if (!player) return t.noPlayer
    if (state.status === 'PAUSED') return t.isPaused
    if (state.status !== 'LIVE') return t.notOpen
    if (squadFull) return t.squadFullCount(myTeam.squadCount, myTeam.maxSquad)
    if (lockedOut) return t.lockedOut
    if (leadingBid) return t.alreadyHighest
    if (amount < minBid) return t.minBidIs(formatBDT(minBid))
    if (amount > myTeam.remaining) return t.overBudgetLeft(formatBDT(myTeam.remaining))
    if (amount > maxBid) {
      return t.maxBidIs(formatBDT(maxBid), formatBDT(reserved))
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
      setError(t.invalidAmount)
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
    : [t.base, `+${formatNumber(steps[1])}`, `+${formatNumber(steps[2])}`]

  return (
    <Card className="border-primary/25 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4.5 w-4.5 text-primary" aria-hidden />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {myTeam ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <TeamAvatar name={myTeam.name} color={myTeam.color} logoUrl={myTeam.logoUrl} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{myTeam.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {t.teamLine(myTeam.squadCount, myTeam.maxSquad, myTeam.minSquad, formatBDT(myTeam.spent))}
              </p>
              <Progress value={myTeam.budget > 0 ? (myTeam.spent / myTeam.budget) * 100 : 0} className="mt-1.5 h-1.5" aria-label={t.budgetUsed} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.left}</p>
              <p className="text-lg font-black tabular-nums text-emerald-700">{formatBDT(myTeam.remaining)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4" aria-hidden /> {t.noTeam}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t.minimumBid}</p>
            <p className="text-2xl font-black tabular-nums text-primary">{player ? formatBDT(minBid) : '—'}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t.yourMaximum}</p>
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
            {t.heldBack(formatBDT(reserved), myTeam?.minSquad)}
          </p>
        ) : null}

        {/* quick increment buttons */}
        <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.quickBids}>
          {quickAmounts.map((amount, i) => {
            const overBudget = myTeam ? amount > maxBid : true
            const btnDisabled = disabled || overBudget || squadFull
            return (
              <button
                key={i}
                type="button"
                disabled={btnDisabled}
                onClick={() => submit(amount)}
                aria-label={t.bidAmount(formatBDT(amount))}
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
                  <span className="text-[9px] font-semibold uppercase text-rose-600 no-underline">{t.overBudget}</span>
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
              placeholder={t.customAmount}
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
              aria-label={t.customAria}
            />
            <Button className="h-11 w-20 shrink-0 font-bold" disabled={disabled} onClick={submitCustom}>
              {t.bid}
            </Button>
          </div>
          {error ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600" role="alert">
              <Ban className="h-3 w-3" aria-hidden /> {error}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t.biddingAs} <span className="font-semibold text-foreground">{myTeam?.name ?? '—'}</span>
            </p>
          )}
        </div>

        {disableReason ? (
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden /> {disableReason} {t.disabledSuffix}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
