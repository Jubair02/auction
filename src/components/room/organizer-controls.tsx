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
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    title: 'Organizer controls',
    startAuction: 'Start Auction',
    endedNote: 'Auction ended — head to the results report for final squads.',
    reopenAuction: 'Reopen auction',
    nextAutoTitle: 'Auto Auction brings up the next player — turn it off to pick manually',
    alreadyOnBlock: 'A player is already on the block',
    bringRandom: 'Bring a random player to the block',
    nextAutomatic: 'Next player (automatic)',
    nextRandom: 'Next player (random)',
    skip: 'Skip',
    resume: 'Resume',
    pause: 'Pause',
    sellNow: 'Sell now',
    unsold: 'Unsold',
    pickHint: 'Pick a player from the pool below or bring a random one.',
    manualBid: 'Manual bid',
    endAuction: 'End auction',
    sellTitle: 'Sell to highest bidder?',
    thePlayer: 'the player',
    sellDesc: (team: string, player: string, amount: string) =>
      `${team} wins ${player} for ${amount}. This cannot be undone here — use Re-auction later if needed.`,
    noBidToSell: 'No bid to sell.',
    unsoldTitle: 'Mark player UNSOLD?',
    thisPlayer: 'this player',
    unsoldDesc: (player: string) =>
      `The timer stops and ${player} goes unpicked. You can re-auction them from the pool later.`,
    markUnsold: 'Mark unsold',
    endTitle: 'End this auction?',
    endDesc:
      'Any player currently on the block returns to the pool, and the tournament is marked completed. Sold players keep their teams. You can reopen the auction afterwards if you need to.',
    roundTitle: (round: number) => `Start round ${round}?`,
    roundDesc: (leftOver: number, auto: boolean) =>
      `The ${leftOver} unsold & skipped player${leftOver === 1 ? '' : 's'} go back into the pool and are auctioned again from their base price. Sold players, squads, budgets and all earlier bids stay as they are.${auto ? ' Auto Auction is on, so the first player comes up by itself.' : ' Use Next player to bring up each player.'}`,
    startReauction: 'Start re-auction round',
    reopenTitle: 'Reopen the auction?',
    reopenDesc:
      'The room goes live again so you can auction the remaining players. Sold players, squads and budgets stay exactly as they are.',
    cancel: 'Cancel',
    sellingOrder: 'Selling order — categories',
    catShort: (code: string) => `Cat ${code}`,
    catLine: (left: number, base: string) => `${left} left · base ${base}`,
    errNoPlayer: 'No player on the block',
    errChooseTeam: 'Choose a team',
    errInvalidAmount: 'Enter a valid amount',
    errAlreadyHighest: (team: string) => `${team} already holds the highest bid`,
    errBlocked: (team: string) => `${team} lost this player in the re-auction and is blocked from bidding again`,
    errMinBid: (min: string) => `Minimum bid is ${min}`,
    errOnlyLeft: (team: string, left: string) => `${team} only has ${left} left`,
    errMaxBid: (team: string, max: string) =>
      `${team} can bid at most ${max} — the rest is reserved for their minimum squad`,
    errSquadFull: (team: string) => `${team} squad is full`,
    manualDesc: (player: string) => `Record an offline bid for ${player} on behalf of a team.`,
    manualMin: (min: string) => ` Minimum ${min}.`,
    team: 'Team',
    selectTeam: 'Select team',
    teamOption: (team: string, max: string) => `${team} · max ${max}`,
    optSquadFull: ' (squad full)',
    optHighest: ' (highest bidder)',
    optBlocked: ' (blocked — previous owner)',
    amount: 'Amount (৳)',
    placeBid: 'Place bid',
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
    tileSold: 'Sold',
    tileUnsold: 'Unsold',
    tileSkipped: 'Skipped',
    finalSummary: 'Final summary',
    roundComplete: (round: number) => `Round ${round} complete`,
    roundsSoFar: (n: number) => `· ${n} round${n === 1 ? '' : 's'} so far`,
    unsoldSkipped: 'Unsold & skipped',
    reauctionTitle: 'Re-Auction Unsold & Skipped Players',
    reauctionButton: 'Re-auction unsold & skipped',
    allSold: 'Every player has been sold.',
    resumeToStart: 'Resume the auction to start the next round.',
    finalize: 'Finalize auction',
  },
  bn: {
    title: 'আয়োজকের নিয়ন্ত্রণ',
    startAuction: 'নিলাম শুরু করুন',
    endedNote: 'নিলাম শেষ — চূড়ান্ত স্কোয়াড দেখতে ফলাফলের রিপোর্টে যান।',
    reopenAuction: 'নিলাম আবার খুলুন',
    nextAutoTitle: 'অটো নিলাম নিজেই পরের খেলোয়াড় আনছে — হাতে বাছাই করতে এটি বন্ধ করুন',
    alreadyOnBlock: 'একজন খেলোয়াড় এখন নিলামে আছে',
    bringRandom: 'র‍্যান্ডম একজন খেলোয়াড়কে নিলামে আনুন',
    nextAutomatic: 'পরের খেলোয়াড় (অটো)',
    nextRandom: 'পরের খেলোয়াড় (র‍্যান্ডম)',
    skip: 'বাদ দিন',
    resume: 'আবার শুরু',
    pause: 'বিরতি',
    sellNow: 'এখনই বিক্রি',
    unsold: 'অবিক্রিত',
    pickHint: 'নিচের পুল থেকে একজন খেলোয়াড় বেছে নিন, অথবা র‍্যান্ডম একজনকে আনুন।',
    manualBid: 'ম্যানুয়াল বিড',
    endAuction: 'নিলাম শেষ করুন',
    sellTitle: 'সর্বোচ্চ বিডারের কাছে বিক্রি করবেন?',
    thePlayer: 'খেলোয়াড়টি',
    sellDesc: (team: string, player: string, amount: string) =>
      `${team} ${amount}-এ ${player} পাচ্ছে। এখান থেকে এটি ফেরানো যাবে না — দরকার হলে পরে পুনরায় নিলাম করুন।`,
    noBidToSell: 'বিক্রি করার মতো কোনো বিড নেই।',
    unsoldTitle: 'খেলোয়াড়কে অবিক্রিত ঘোষণা করবেন?',
    thisPlayer: 'এই খেলোয়াড়',
    unsoldDesc: (player: string) =>
      `টাইমার থেমে যাবে এবং ${player} কোনো দলে যাবে না। পরে পুল থেকে আবার নিলামে তুলতে পারবেন।`,
    markUnsold: 'অবিক্রিত ঘোষণা',
    endTitle: 'এই নিলাম শেষ করবেন?',
    endDesc:
      'এখন নিলামে থাকা খেলোয়াড় পুলে ফিরে যাবে এবং টুর্নামেন্টটি সম্পন্ন হিসেবে চিহ্নিত হবে। বিক্রি হওয়া খেলোয়াড়রা নিজ নিজ দলেই থাকবে। দরকার হলে পরে নিলাম আবার খুলতে পারবেন।',
    roundTitle: (round: number) => `রাউন্ড ${round} শুরু করবেন?`,
    roundDesc: (leftOver: number, auto: boolean) =>
      `অবিক্রিত ও বাদ পড়া ${leftOver} জন খেলোয়াড় পুলে ফিরে যাবে এবং বেস প্রাইস থেকে আবার নিলাম হবে। বিক্রি হওয়া খেলোয়াড়, স্কোয়াড, বাজেট ও আগের সব বিড যেমন আছে তেমনই থাকবে।${auto ? ' অটো নিলাম চালু আছে, তাই প্রথম খেলোয়াড় নিজে থেকেই আসবে।' : ' প্রতিটি খেলোয়াড়কে আনতে “পরের খেলোয়াড়” চাপুন।'}`,
    startReauction: 'পুনরায় নিলামের রাউন্ড শুরু করুন',
    reopenTitle: 'নিলাম আবার খুলবেন?',
    reopenDesc:
      'রুমটি আবার লাইভ হবে, যাতে বাকি খেলোয়াড়দের নিলাম করতে পারেন। বিক্রি হওয়া খেলোয়াড়, স্কোয়াড ও বাজেট ঠিক যেমন আছে তেমনই থাকবে।',
    cancel: 'বাতিল',
    sellingOrder: 'বিক্রির ক্রম — ক্যাটাগরি',
    catShort: (code: string) => `ক্যাট ${code}`,
    catLine: (left: number, base: string) => `${left} জন বাকি · বেস ${base}`,
    errNoPlayer: 'এখন কোনো খেলোয়াড় নিলামে নেই',
    errChooseTeam: 'একটি দল বেছে নিন',
    errInvalidAmount: 'সঠিক অঙ্ক লিখুন',
    errAlreadyHighest: (team: string) => `সর্বোচ্চ বিড এখন ${team}-এর`,
    errBlocked: (team: string) => `পুনরায় নিলামে ${team} এই খেলোয়াড়কে হারিয়েছে, তাই আবার বিড করতে পারবে না`,
    errMinBid: (min: string) => `সর্বনিম্ন বিড ${min}`,
    errOnlyLeft: (team: string, left: string) => `${team}-এর বাকি আছে মাত্র ${left}`,
    errMaxBid: (team: string, max: string) =>
      `${team} সর্বোচ্চ ${max} বিড করতে পারবে — বাকিটা সর্বনিম্ন স্কোয়াডের জন্য রাখা`,
    errSquadFull: (team: string) => `${team}-এর স্কোয়াড পূর্ণ`,
    manualDesc: (player: string) => `কোনো দলের হয়ে ${player}-এর জন্য অফলাইন বিড লিখে রাখুন।`,
    manualMin: (min: string) => ` সর্বনিম্ন ${min}।`,
    team: 'দল',
    selectTeam: 'দল বেছে নিন',
    teamOption: (team: string, max: string) => `${team} · সর্বোচ্চ ${max}`,
    optSquadFull: ' (স্কোয়াড পূর্ণ)',
    optHighest: ' (সর্বোচ্চ বিডার)',
    optBlocked: ' (বন্ধ — আগের মালিক)',
    amount: 'অঙ্ক (৳)',
    placeBid: 'বিড করুন',
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
    tileSold: 'বিক্রি',
    tileUnsold: 'অবিক্রিত',
    tileSkipped: 'বাদ',
    finalSummary: 'চূড়ান্ত সারসংক্ষেপ',
    roundComplete: (round: number) => `রাউন্ড ${round} শেষ`,
    roundsSoFar: (n: number) => `· এ পর্যন্ত ${n}টি রাউন্ড`,
    unsoldSkipped: 'অবিক্রিত ও বাদ',
    reauctionTitle: 'অবিক্রিত ও বাদ পড়া খেলোয়াড়দের পুনরায় নিলাম',
    reauctionButton: 'অবিক্রিত ও বাদ পড়াদের পুনরায় নিলাম',
    allSold: 'সব খেলোয়াড় বিক্রি হয়ে গেছে।',
    resumeToStart: 'পরের রাউন্ড শুরু করতে নিলাম আবার চালু করুন।',
    finalize: 'নিলাম চূড়ান্ত করুন',
  },
} satisfies Strings<{
  title: string
  startAuction: string
  endedNote: string
  reopenAuction: string
  nextAutoTitle: string
  alreadyOnBlock: string
  bringRandom: string
  nextAutomatic: string
  nextRandom: string
  skip: string
  resume: string
  pause: string
  sellNow: string
  unsold: string
  pickHint: string
  manualBid: string
  endAuction: string
  sellTitle: string
  thePlayer: string
  sellDesc: (team: string, player: string, amount: string) => string
  noBidToSell: string
  unsoldTitle: string
  thisPlayer: string
  unsoldDesc: (player: string) => string
  markUnsold: string
  endTitle: string
  endDesc: string
  roundTitle: (round: number) => string
  roundDesc: (leftOver: number, auto: boolean) => string
  startReauction: string
  reopenTitle: string
  reopenDesc: string
  cancel: string
  sellingOrder: string
  catShort: (code: string) => string
  catLine: (left: number, base: string) => string
  errNoPlayer: string
  errChooseTeam: string
  errInvalidAmount: string
  errAlreadyHighest: (team: string) => string
  errBlocked: (team: string) => string
  errMinBid: (min: string) => string
  errOnlyLeft: (team: string, left: string) => string
  errMaxBid: (team: string, max: string) => string
  errSquadFull: (team: string) => string
  manualDesc: (player: string) => string
  manualMin: (min: string) => string
  team: string
  selectTeam: string
  teamOption: (team: string, max: string) => string
  optSquadFull: string
  optHighest: string
  optBlocked: string
  amount: string
  placeBid: string
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
  tileSold: string
  tileUnsold: string
  tileSkipped: string
  finalSummary: string
  roundComplete: (round: number) => string
  roundsSoFar: (n: number) => string
  unsoldSkipped: string
  reauctionTitle: string
  reauctionButton: string
  allSold: string
  resumeToStart: string
  finalize: string
}>

interface OrganizerControlsProps {
  state: RoomState
  onAction: (action: OrganizerAction, payload?: Record<string, unknown>) => void
  /** serverTime − clientTime, so the session countdown matches the server. */
  clockOffset?: number
}

type ConfirmKind = 'sell' | 'unsold' | 'end' | 'reopen' | 'rounds' | null

/** Organizer cockpit — start/pause/sell controls, manual bid, category chips. */
export function OrganizerControls({ state, onAction, clockOffset = 0 }: OrganizerControlsProps) {
  const tx = useStrings(STRINGS)
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
            {tx.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ready ? (
            <Button
              size="lg"
              className="h-14 w-full text-base font-black"
              onClick={() => onAction('start')}
            >
              <Play className="mr-2 h-5 w-5" /> {tx.startAuction}
            </Button>
          ) : null}

          {ended ? (
            <div className="space-y-3">
              <RoundSummary state={state} final />
              <p className="rounded-lg bg-muted px-3 py-3 text-center text-sm font-medium text-muted-foreground">
                {tx.endedNote}
              </p>
              <Button variant="outline" className="h-11 w-full" onClick={() => setConfirm('reopen')}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> {tx.reopenAuction}
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

          {(live || paused) ? (
            <>
              <Button
                size="lg"
                className="h-12 w-full text-sm font-bold"
                disabled={hasPlayer || state.autoAdvance || roundComplete}
                onClick={() => onAction('next_player')}
                title={
                  state.autoAdvance
                    ? tx.nextAutoTitle
                    : hasPlayer
                      ? tx.alreadyOnBlock
                      : tx.bringRandom
                }
              >
                <Shuffle className="mr-2 h-4.5 w-4.5" />
                {state.autoAdvance ? tx.nextAutomatic : tx.nextRandom}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" disabled={!hasPlayer || !live} onClick={() => onAction('skip')}>
                  <FastForward className="mr-1.5 h-4 w-4" /> {tx.skip}
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={!live && !paused}
                  onClick={() => onAction(paused ? 'resume' : 'pause')}
                >
                  {paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}
                  {paused ? tx.resume : tx.pause}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-teal-300 text-teal-800 hover:bg-teal-50 hover:text-teal-900"
                  disabled={!hasBid || !live}
                  onClick={() => setConfirm('sell')}
                >
                  <Tag className="mr-1.5 h-4 w-4" /> {tx.sellNow}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={!hasPlayer || !live}
                  onClick={() => setConfirm('unsold')}
                >
                  <Ban className="mr-1.5 h-4 w-4" /> {tx.unsold}
                </Button>
              </div>

              {!hasPlayer && live && !state.autoAdvance ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden />
                  {tx.pickHint}
                </p>
              ) : null}
            </>
          ) : null}

          {/* Manual bid + End stay reachable in every non-ended state, so a room
              that was opened but never started can still be closed. */}
          {!ended ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11" disabled={!live} onClick={() => setManualOpen(true)}>
                <Hand className="mr-1.5 h-4 w-4" /> {tx.manualBid}
              </Button>
              <Button variant="destructive" className="h-11" onClick={() => setConfirm('end')}>
                <Square className="mr-1.5 h-4 w-4" /> {tx.endAuction}
              </Button>
            </div>
          ) : null}

          {!ended ? <CategoryChips state={state} onAction={onAction} /> : null}

          {!ended ? <AutoAuctionPanel state={state} onAction={onAction} clockOffset={clockOffset} /> : null}
        </CardContent>
      </Card>

      {/* confirms */}
      <AlertDialog open={confirm === 'sell'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title={tx.sellTitle}
          description={
            state.currentBid
              ? tx.sellDesc(state.currentBid.teamName, state.currentPlayer?.name ?? tx.thePlayer, formatBDT(state.currentBid.amount))
              : tx.noBidToSell
          }
          actionLabel={tx.sellNow}
          onAction={() => {
            setConfirm(null)
            onAction('force_sell')
          }}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'unsold'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title={tx.unsoldTitle}
          description={tx.unsoldDesc(state.currentPlayer?.name ?? tx.thisPlayer)}
          actionLabel={tx.markUnsold}
          destructive
          onAction={() => {
            setConfirm(null)
            onAction('force_unsold')
          }}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'end'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title={tx.endTitle}
          description={tx.endDesc}
          actionLabel={tx.endAuction}
          destructive
          onAction={() => {
            setConfirm(null)
            onAction('end')
          }}
        />
      </AlertDialog>

      <AlertDialog open={confirm === 'rounds'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title={tx.roundTitle(state.round + 1)}
          description={tx.roundDesc(leftOver, state.autoAdvance)}
          actionLabel={tx.startReauction}
          onAction={() => {
            setConfirm(null)
            onAction('reauction_unsold')
          }}
        />
      </AlertDialog>

      <AlertDialog open={confirm === 'reopen'} onOpenChange={(o) => !o && setConfirm(null)}>
        <ConfirmShell
          title={tx.reopenTitle}
          description={tx.reopenDesc}
          actionLabel={tx.reopenAuction}
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
  const tx = useStrings(STRINGS)
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{tx.cancel}</AlertDialogCancel>
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

/** Category A–E chips with live available counts (category mode only) — a section of the controls card. */
export function CategoryChips({ state, onAction }: OrganizerControlsProps) {
  const tx = useStrings(STRINGS)
  if (state.mode !== 'CATEGORY' || state.categories.length === 0) return null
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tx.sellingOrder}</p>
      <div className="flex flex-wrap gap-2">
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
              <span className="text-sm font-black">{tx.catShort(c.code)}</span>
              <span className={cn('text-[10px] font-semibold tabular-nums', activeCat ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {tx.catLine(c.available, formatBDT(c.basePrice))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
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
  const tx = useStrings(STRINGS)
  const [teamId, setTeamId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const player = state.currentPlayer
  const minBid = player ? (state.currentBid ? state.currentBid.amount + state.minIncrement : player.basePrice) : 0
  const team: RoomTeam | undefined = state.teams.find((t) => t.id === teamId)
  const teamMax = team ? (team.maxBid ?? team.remaining) : 0

  function submit() {
    if (!player) {
      setError(tx.errNoPlayer)
      return
    }
    if (!team) {
      setError(tx.errChooseTeam)
      return
    }
    const n = Number(amount.replace(/[^0-9]/g, ''))
    if (!amount.trim() || Number.isNaN(n) || n <= 0) {
      setError(tx.errInvalidAmount)
      return
    }
    if (state.currentBid?.teamId === team.id) {
      setError(tx.errAlreadyHighest(team.name))
      return
    }
    if (state.allowPreviousOwnerRebid === false && state.previousOwnerTeamId === team.id) {
      setError(tx.errBlocked(team.name))
      return
    }
    if (n < minBid) {
      setError(tx.errMinBid(formatBDT(minBid)))
      return
    }
    if (n > team.remaining) {
      setError(tx.errOnlyLeft(team.name, formatBDT(team.remaining)))
      return
    }
    if (n > teamMax) {
      setError(tx.errMaxBid(team.name, formatBDT(teamMax)))
      return
    }
    if (team.squadCount >= team.maxSquad) {
      setError(tx.errSquadFull(team.name))
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
          <DialogTitle>{tx.manualBid}</DialogTitle>
          <DialogDescription>
            {tx.manualDesc(player ? player.name : '—')}
            {player ? tx.manualMin(formatBDT(minBid)) : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="manual-team">{tx.team}</Label>
            <Select value={teamId} onValueChange={(v) => { setTeamId(v); setError(null) }}>
              <SelectTrigger id="manual-team" className="h-11 w-full">
                <SelectValue placeholder={tx.selectTeam} />
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
                      {tx.teamOption(t.name, formatBDT(cap))}
                      {full
                        ? tx.optSquadFull
                        : leading
                          ? tx.optHighest
                          : blocked
                            ? tx.optBlocked
                            : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">{tx.amount}</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx.cancel}</Button>
          <Button onClick={submit} disabled={!player || state.status !== 'LIVE'}>
            <Send className="mr-1.5 h-4 w-4" /> {tx.placeBid}
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
    session = { label: tx.paused, value: formatClock(state.pausedRemainingMs ?? 0), tone: 'text-slate-600' }
  } else if (live && hasPlayer) {
    const secs = Math.ceil(lotRemaining / 1000)
    session = {
      label: state.stage === 2 ? tx.goingTwice : state.stage === 1 ? tx.goingOnce : tx.biddingOpen,
      value: formatClock(lotRemaining),
      tone: secs <= 5 ? 'text-rose-600' : secs <= 10 ? 'text-amber-600' : 'text-emerald-700',
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

      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2" aria-live="polite">
        <span className="text-xs font-medium text-muted-foreground">{tx.currentSession(session.label)}</span>
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
  const tx = useStrings(STRINGS)
  const sold = state.players.filter((p) => p.status === 'SOLD')
  const totalValue = sold.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0)
  const leftOver = state.players.filter((p) => p.status === 'UNSOLD' || p.status === 'SKIPPED')
  const tiles = [
    { label: tx.tileSold, value: state.pool.sold, sub: formatBDT(totalValue), tone: 'text-emerald-700' },
    { label: tx.tileUnsold, value: state.pool.unsold, sub: null, tone: 'text-rose-700' },
    { label: tx.tileSkipped, value: state.pool.skipped, sub: null, tone: 'text-slate-700' },
  ]

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="h-4 w-4 text-primary" aria-hidden />
        {final ? tx.finalSummary : tx.roundComplete(state.round)}
        {state.round > 1 ? (
          <span className="text-xs font-normal text-muted-foreground">
            {tx.roundsSoFar(state.round)}
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
          <p className="text-xs font-medium text-muted-foreground">{tx.unsoldSkipped}</p>
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
              title={tx.reauctionTitle}
            >
              <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{tx.reauctionButton}</span>
              <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-xs font-bold tabular-nums">
                {leftOver.length}
              </span>
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">{tx.allSold}</p>
          )}
          {reauctionDisabled && leftOver.length > 0 ? (
            <p className="text-center text-xs text-muted-foreground">{tx.resumeToStart}</p>
          ) : null}
          <Button
            variant="outline"
            className="h-9 w-full gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={onFinalize}
          >
            <CircleCheck className="h-3.5 w-3.5" aria-hidden /> {tx.finalize}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
