'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Ban, BellRing, Gavel, Loader2, ShieldAlert, Volume2, VolumeX, Wallet, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { formatBDT, formatNumber } from '@/lib/format'
import type { ActionResult } from '@/lib/use-auction-socket'
import { type OutbidAlert, useOutbidAlert, useOutbidSound } from '@/lib/use-outbid-alert'
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
    maxShort: (amount: string) => `Max ${amount}`,
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
    offline: 'Reconnecting to the room',
    placing: 'Placing…',
    placingBid: (amount: string) => `Placing your bid of ${amount}…`,
    bidOffline: 'You are offline — your bid was not sent.',
    bidUnconfirmed: 'Bid not confirmed — check the bid ladder before bidding again.',
    bidRejected: 'Your bid was not accepted.',
    outbidTitle: 'Outbid!',
    outbidBy: (team: string, amount: string) => `${team} bid ${amount}`,
    outbidAction: (min: string) => `Bid ${min} to take the lead back`,
    outbidTab: (team: string) => `Outbid by ${team}`,
    soundOff: 'Mute the outbid beep',
    soundOn: 'Beep when I’m outbid',
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
    maxShort: (amount: string) => `সর্বোচ্চ ${amount}`,
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
    offline: 'রুমের সাথে আবার সংযোগ করা হচ্ছে',
    placing: 'পাঠানো হচ্ছে…',
    placingBid: (amount: string) => `আপনার ${amount}-এর বিড পাঠানো হচ্ছে…`,
    bidOffline: 'আপনি অফলাইনে আছেন — বিডটি পাঠানো হয়নি।',
    bidUnconfirmed: 'বিড নিশ্চিত হয়নি — আবার বিড করার আগে বিডের তালিকা দেখে নিন।',
    bidRejected: 'আপনার বিডটি গ্রহণ করা হয়নি।',
    outbidTitle: 'আপনার বিড ছাড়িয়ে গেছে!',
    outbidBy: (team: string, amount: string) => `${team} বিড করেছে ${amount}`,
    outbidAction: (min: string) => `আবার এগিয়ে যেতে ${min} বিড করুন`,
    outbidTab: (team: string) => `${team} আপনার বিড ছাড়িয়ে গেছে`,
    soundOff: 'আউটবিডের শব্দ বন্ধ করুন',
    soundOn: 'আউটবিড হলে শব্দ করুক',
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
  maxShort: (amount: string) => string
  heldBack: (amount: string, minSquad: number | undefined) => string
  quickBids: string
  bidAmount: (amount: string) => string
  overBudget: string
  customAmount: string
  customAria: string
  bid: string
  biddingAs: string
  disabledSuffix: string
  offline: string
  placing: string
  placingBid: (amount: string) => string
  bidOffline: string
  bidUnconfirmed: string
  bidRejected: string
  outbidTitle: string
  outbidBy: (team: string, amount: string) => string
  outbidAction: (min: string) => string
  outbidTab: (team: string) => string
  soundOff: string
  soundOn: string
}>

interface BidPanelProps {
  state: RoomState
  myTeam: RoomTeam | undefined
  /** Connected to the live service and seated — bids are refused otherwise. */
  online: boolean
  /** The bid awaiting the server's confirmation, if any (blocks further bids). */
  pendingAmount: number | null
  /** Sends a bid for `playerId`; resolves true once the server accepted it. */
  onBid: (amount: number, playerId: string) => Promise<boolean>
  /** Another team just bid over this manager's lead (see useManagerOutbid). */
  outbid?: OutbidAlert | null
}

/**
 * The manager's outbid alert for the whole room page. Call it once (not in
 * both the console and the phone bar) so the alarm sounds once.
 */
export function useManagerOutbid(state: RoomState, myTeamId: string | undefined): OutbidAlert | null {
  const t = useStrings(STRINGS)
  const leader = state.currentBid?.teamName ?? ''
  return useOutbidAlert(state, myTeamId, t.outbidTab(leader))
}

/**
 * One bid in flight at a time for the whole room page, shared by the full
 * console and the phone bid bar: a second tap while the first bid awaits the
 * server is ignored, and a refused or unconfirmed bid is explained in a toast.
 */
export function useBidSubmitter(placeBid: (amount: number, playerId: string) => Promise<ActionResult>) {
  const t = useStrings(STRINGS)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)
  const inFlight = useRef(false)
  const submit = useCallback(
    async (amount: number, playerId: string): Promise<boolean> => {
      if (inFlight.current) return false
      inFlight.current = true
      setPendingAmount(amount)
      try {
        const res = await placeBid(amount, playerId)
        if (res.ok) return true
        if (res.reason === 'offline') toast.error(t.bidOffline)
        else if (res.reason === 'timeout') toast.warning(t.bidUnconfirmed)
        else toast.error(res.error || t.bidRejected)
        return false
      } finally {
        inFlight.current = false
        setPendingAmount(null)
      }
    },
    [placeBid, t],
  )
  return { pendingAmount, submit }
}

/**
 * Bidding rules shared by the full console and the mobile bid bar, so both
 * enable, label and validate bids exactly the same way.
 */
function useBidConsole({ state, myTeam, online, pendingAmount, onBid }: BidPanelProps) {
  const t = useStrings(STRINGS)
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
    online && state.status === 'LIVE' && !!player && !!myTeam && !squadFull && !leadingBid && !pricedOut && !lockedOut

  function reason(): string | null {
    if (!online) return t.offline
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

  /** Validates, then bids. Resolves whether the server accepted the bid. */
  async function submit(amount: number): Promise<boolean> {
    if (pendingAmount !== null) return false
    const err = validate(amount)
    if (err || !player) {
      setError(err ?? t.noPlayer)
      return false
    }
    setError(null)
    return onBid(amount, player.id)
  }

  // Quick increments always start from the minimum legal next bid, so no quick
  // button can produce an amount the server would reject. The bigger jumps
  // scale with the league's own increment (2× and 4×), so a ৳500-increment
  // league gets +৳1,000 / +৳2,000 rather than a fixed +৳10,000 / +৳20,000.
  const quickAmounts = [minBid, minBid + 2 * state.minIncrement, minBid + 4 * state.minIncrement]
  const quickLabels = state.currentBid
    ? quickAmounts.map((a) => `+${formatNumber(a - state.currentBid!.amount)}`)
    : [t.base, `+${formatNumber(2 * state.minIncrement)}`, `+${formatNumber(4 * state.minIncrement)}`]

  return {
    t,
    player,
    minBid,
    maxBid,
    reserved,
    squadFull,
    pricedOut,
    disabled: !biddingOpen,
    pending: pendingAmount !== null,
    pendingAmount,
    online,
    disableReason: reason(),
    quickAmounts,
    quickLabels,
    error,
    setError,
    submit,
  }
}

/** THE conversion element — manager's bidding console. */
export function BidPanel(props: BidPanelProps) {
  const { myTeam, outbid } = props
  const {
    t,
    player,
    minBid,
    maxBid,
    reserved,
    squadFull,
    pricedOut,
    disabled,
    pending,
    pendingAmount,
    online,
    disableReason,
    quickAmounts,
    quickLabels,
    error,
    setError,
    submit,
  } = useBidConsole(props)
  const [custom, setCustom] = useState('')
  const [customSending, setCustomSending] = useState(false)

  function submitCustom() {
    if (pending) return
    const n = Number(custom.replace(/[^0-9]/g, ''))
    if (!custom.trim() || Number.isNaN(n) || n <= 0) {
      setError(t.invalidAmount)
      return
    }
    setCustomSending(true)
    void submit(Math.round(n)).then((ok) => {
      setCustomSending(false)
      if (ok) setCustom('')
    })
  }

  return (
    <Card className="border-primary/25 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gavel className="h-4.5 w-4.5 text-primary" aria-hidden />
          {t.title}
          <OutbidSoundToggle on={t.soundOn} off={t.soundOff} />
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
              <p className="text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-400">{formatBDT(myTeam.remaining)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4" aria-hidden /> {t.noTeam}
          </div>
        )}

        {outbid ? (
          <div
            key={outbid.amount}
            role="alert"
            className="flex items-start gap-3 rounded-xl border-2 border-rose-400 bg-rose-50 p-3 text-rose-950 motion-safe:animate-[pulse_0.6s_ease-in-out_3] dark:border-rose-500/60 dark:bg-rose-950/40 dark:text-rose-100"
          >
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
            <div className="min-w-0">
              <p className="font-black">{t.outbidTitle}</p>
              <p className="text-sm">{t.outbidBy(outbid.byTeam, formatBDT(outbid.amount))}</p>
              {!disabled ? <p className="mt-0.5 text-xs font-semibold">{t.outbidAction(formatBDT(minBid))}</p> : null}
            </div>
          </div>
        ) : null}

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
                pricedOut ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
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
            const sending = pending && !customSending && pendingAmount === amount
            return (
              <button
                key={i}
                type="button"
                disabled={btnDisabled || pending}
                onClick={() => void submit(amount)}
                aria-label={t.bidAmount(formatBDT(amount))}
                aria-busy={sending || undefined}
                className={cn(
                  'flex h-14 min-w-11 flex-col items-center justify-center rounded-lg border-2 border-primary/30 bg-primary/5 text-primary transition-all',
                  'hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'disabled:pointer-events-none disabled:opacity-45',
                  btnDisabled && overBudget && 'line-through decoration-rose-500'
                )}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    <span className="mt-0.5 text-[10px] font-semibold">{t.placing}</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-black leading-none">{quickLabels[i]}</span>
                    <span className="mt-0.5 text-[10px] font-semibold tabular-nums opacity-80">{formatNumber(amount)}</span>
                  </>
                )}
                {!btnDisabled || !overBudget ? null : (
                  <span className="text-[9px] font-semibold uppercase text-rose-600 dark:text-rose-400 no-underline">{t.overBudget}</span>
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
            <Button
              className="h-11 w-20 shrink-0 font-bold"
              disabled={disabled || pending}
              onClick={submitCustom}
              aria-busy={customSending || undefined}
            >
              {customSending ? <Loader2 className="h-4 w-4 animate-spin" aria-label={t.placing} /> : t.bid}
            </Button>
          </div>
          {error ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              <Ban className="h-3 w-3" aria-hidden /> {error}
            </p>
          ) : pendingAmount !== null ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {t.placingBid(formatBDT(pendingAmount))}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t.biddingAs} <span className="font-semibold text-foreground">{myTeam?.name ?? '—'}</span>
            </p>
          )}
        </div>

        {disableReason ? (
          <p className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground">
            {online ? (
              <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}{' '}
            {disableReason} {t.disabledSuffix}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Phone-only bid bar pinned to the bottom of the screen, so a manager can bid
 * without scrolling away from the stage while the clock runs. The full console
 * (custom amounts, budget detail) stays in the page below.
 */
export function MobileBidBar(props: BidPanelProps) {
  const { state, myTeam, outbid } = props
  const { t, player, maxBid, disabled, pending, pendingAmount, disableReason, quickAmounts, quickLabels, error, submit } =
    useBidConsole(props)
  if (!myTeam || state.status === 'ENDED') return null

  const [first, second] = quickAmounts
  const outbidLine = outbid && pendingAmount === null && !error ? `${t.outbidTitle} ${t.outbidBy(outbid.byTeam, formatBDT(outbid.amount))}` : null
  const message =
    error ??
    outbidLine ??
    (pendingAmount !== null
      ? t.placingBid(formatBDT(pendingAmount))
      : disableReason
        ? `${disableReason} ${t.disabledSuffix}`
        : null)

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 pt-2 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden',
        outbid && 'border-t-2 border-t-rose-500 bg-rose-50/95 supports-[backdrop-filter]:bg-rose-50/90 dark:bg-rose-950/90 dark:supports-[backdrop-filter]:bg-rose-950/85',
      )}
      role="region"
      aria-label={t.title}
    >
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.left}</p>
          <p className="truncate text-base font-black tabular-nums text-emerald-700 dark:text-emerald-400">{formatBDT(myTeam.remaining)}</p>
          <p className="truncate text-[10px] text-muted-foreground tabular-nums">
            {t.maxShort(formatBDT(maxBid))}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-12 shrink-0 flex-col gap-0 border-2 border-primary/30 px-3 text-primary"
          disabled={disabled || pending || !player || second > maxBid}
          onClick={() => void submit(second)}
          aria-label={t.bidAmount(formatBDT(second))}
          aria-busy={(pending && pendingAmount === second) || undefined}
        >
          {pending && pendingAmount === second ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              <span className="text-sm font-black leading-none">{quickLabels[1]}</span>
              <span className="text-[10px] font-semibold tabular-nums opacity-80">{formatNumber(second)}</span>
            </>
          )}
        </Button>
        <Button
          className="h-12 min-w-[9.5rem] shrink-0 text-base font-black"
          disabled={disabled || pending || !player || first > maxBid}
          onClick={() => void submit(first)}
          aria-busy={(pending && pendingAmount !== second) || undefined}
        >
          {pending && pendingAmount !== second ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Gavel className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          {pending && pendingAmount !== second ? t.placing : player ? t.bidAmount(formatBDT(first)) : t.bid}
        </Button>
      </div>
      {message ? (
        <p
          className={cn(
            'mx-auto mt-1 max-w-xl truncate text-center text-[11px] font-medium',
            error || outbidLine ? 'text-rose-600 dark:text-rose-400' : pendingAmount !== null ? 'text-primary' : 'text-muted-foreground',
            outbidLine && 'font-black',
          )}
          role={error || outbidLine ? 'alert' : pendingAmount !== null ? 'status' : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}

/** Mute / unmute the outbid beep (remembered on this device). */
function OutbidSoundToggle({ on, off }: { on: string; off: string }) {
  const [soundOn, setSoundOn] = useOutbidSound()
  const label = soundOn ? off : on
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="ml-auto h-8 w-8 text-muted-foreground"
      onClick={() => setSoundOn(!soundOn)}
      aria-label={label}
      aria-pressed={soundOn}
      title={label}
    >
      {soundOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
    </Button>
  )
}
