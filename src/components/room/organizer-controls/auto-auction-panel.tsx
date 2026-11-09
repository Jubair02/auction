'use client'

import { useState } from 'react'
import { Bot, Pencil, Timer } from 'lucide-react'
import { formatClock } from '@/lib/format'
import { useCountdown } from '@/lib/use-auction-socket'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { type Strings, useStrings } from '@/lib/i18n'
import type { OrganizerControlsProps } from './types'

const STRINGS = {
  en: {
    cancel: 'Cancel',
    paused: 'Paused',
    goingTwice: 'Going twice',
    goingOnce: 'Going once',
    biddingOpen: 'Bidding open',
    nextPlayerIn: 'Next player in',
    notStarted: 'Not started',
    noPlayerOnBlock: 'No player on the block',
    hintDefault: 'Each new bid restarts the countdown, then “going once / twice” follows.',
    hintRange: (min: number, max: number) => `Enter ${min}–${max} seconds.`,
    hintSession: (current: number, next: number) =>
      `This player runs on ${current}s; ${next}s starts with the next player.`,
    autoAuction: 'Auto Auction',
    autoOn: 'On — when a player is sold or goes unsold, the next random player comes up by itself.',
    autoOff: 'Off — you bring up each player with Next player.',
    autoAfterCurrent: ' Changes apply after the current player.',
    biddingDuration: 'Bidding duration',
    seconds: 'seconds',
    save: 'Save',
    secShort: (n: number) => `${n}s`,
    currentDurationAria: 'Current bidding duration',
    secondsValue: (n: number) => `${n} seconds`,
    edit: 'Edit',
    currentSession: (label: string) => `Current session · ${label}`,
  },
  bn: {
    cancel: 'বাতিল',
    paused: 'বিরতি',
    goingTwice: 'দুই বার…',
    goingOnce: 'এক বার…',
    biddingOpen: 'বিড চলছে',
    nextPlayerIn: 'পরের খেলোয়াড় আসছে',
    notStarted: 'শুরু হয়নি',
    noPlayerOnBlock: 'নিলামে কোনো খেলোয়াড় নেই',
    hintDefault: 'প্রতিটি নতুন বিডে কাউন্টডাউন আবার শুরু হয়, তারপর “এক বার / দুই বার” ডাক চলে।',
    hintRange: (min: number, max: number) => `${min}–${max} সেকেন্ড লিখুন।`,
    hintSession: (current: number, next: number) =>
      `এই খেলোয়াড়ের জন্য ${current} সেকেন্ড চলছে; পরের খেলোয়াড় থেকে ${next} সেকেন্ড হবে।`,
    autoAuction: 'অটো নিলাম',
    autoOn: 'চালু — কোনো খেলোয়াড় বিক্রি বা অবিক্রিত হলে পরের র‍্যান্ডম খেলোয়াড় নিজে থেকেই আসবে।',
    autoOff: 'বন্ধ — “পরের খেলোয়াড়” চেপে প্রতিটি খেলোয়াড়কে আপনি আনবেন।',
    autoAfterCurrent: ' পরিবর্তন বর্তমান খেলোয়াড়ের পরে কার্যকর হবে।',
    biddingDuration: 'বিডিংয়ের সময়',
    seconds: 'সেকেন্ড',
    save: 'সংরক্ষণ',
    secShort: (n: number) => `${n} সে.`,
    currentDurationAria: 'বর্তমান বিডিংয়ের সময়',
    secondsValue: (n: number) => `${n} সেকেন্ড`,
    edit: 'সম্পাদনা',
    currentSession: (label: string) => `বর্তমান সেশন · ${label}`,
  },
} satisfies Strings<{
  cancel: string
  paused: string
  goingTwice: string
  goingOnce: string
  biddingOpen: string
  nextPlayerIn: string
  notStarted: string
  noPlayerOnBlock: string
  hintDefault: string
  hintRange: (min: number, max: number) => string
  hintSession: (current: number, next: number) => string
  autoAuction: string
  autoOn: string
  autoOff: string
  autoAfterCurrent: string
  biddingDuration: string
  seconds: string
  save: string
  secShort: (n: number) => string
  currentDurationAria: string
  secondsValue: (n: number) => string
  edit: string
  currentSession: (label: string) => string
}>

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90]
const DURATION_MIN = 5
const DURATION_MAX = 600

/**
 * Auto Auction switch, bidding duration and the live session countdown.
 * Everything is server-driven: the switch and duration are organizer actions,
 * and the countdown reads the server's timer — so every screen agrees and a
 * refresh changes nothing.
 */
export function AutoAuctionPanel({ state, onAction, clockOffset }: OrganizerControlsProps & { clockOffset: number }) {
  const tx = useStrings(STRINGS)
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
    session = { label: tx.paused, value: formatClock(state.pausedRemainingMs ?? 0), tone: 'text-slate-600 dark:text-slate-300' }
  } else if (live && hasPlayer) {
    const secs = Math.ceil(lotRemaining / 1000)
    session = {
      label: state.stage === 2 ? tx.goingTwice : state.stage === 1 ? tx.goingOnce : tx.biddingOpen,
      value: formatClock(lotRemaining),
      tone: secs <= 5 ? 'text-rose-600 dark:text-rose-400' : secs <= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400',
    }
  } else if (live && state.autoAdvance && state.nextPlayerAt) {
    session = { label: tx.nextPlayerIn, value: formatClock(nextIn), tone: 'text-primary' }
  } else {
    session = {
      label: state.status === 'READY' ? tx.notStarted : tx.noPlayerOnBlock,
      value: '—',
      tone: 'text-muted-foreground',
    }
  }

  let hint = tx.hintDefault
  if (editing && !draftValid) hint = tx.hintRange(DURATION_MIN, DURATION_MAX)
  else if (hasPlayer && state.sessionTimerSeconds !== state.bidTimerSeconds) {
    hint = tx.hintSession(state.sessionTimerSeconds, state.bidTimerSeconds)
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor="auto-auction" className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" aria-hidden /> {tx.autoAuction}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {state.autoAdvance
              ? tx.autoOn
              : tx.autoOff}
            {hasPlayer ? tx.autoAfterCurrent : ''}
          </p>
        </div>
        <Switch
          id="auto-auction"
          checked={state.autoAdvance}
          onCheckedChange={(enabled) => onAction('set_auto_advance', { enabled })}
          aria-label={tx.autoAuction}
          className="cursor-pointer"
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor={editing ? 'bid-duration' : undefined}
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <Timer className="h-4 w-4 text-primary" aria-hidden /> {tx.biddingDuration}
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
                  {tx.seconds}
                </span>
              </div>
              <Button type="button" className="h-10" disabled={!draftValid} onClick={saveEdit}>
                {tx.save}
              </Button>
              <Button type="button" variant="outline" className="h-10" onClick={cancelEdit}>
                {tx.cancel}
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
                  {tx.secShort(sec)}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
            <span className="text-sm font-semibold tabular-nums" aria-label={tx.currentDurationAria}>
              {tx.secondsValue(state.bidTimerSeconds)}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={startEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {tx.edit}
            </Button>
          </div>
        )}
        <p id="bid-duration-hint" className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>

      {/* No live region: a clock that ticks every second would flood screen readers. */}
      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{tx.currentSession(session.label)}</span>
        <span className={cn('font-mono text-lg font-bold tabular-nums', session.tone)}>{session.value}</span>
      </div>
    </div>
  )
}
