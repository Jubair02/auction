'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleDollarSign, Clock, Flag, Gavel, PartyPopper, Trophy, Users } from 'lucide-react'
import { useCountdown } from '@/lib/use-auction-socket'
import { formatBDT } from '@/lib/format'
import type { RoomState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PlayerAvatar, TeamAvatar } from '@/components/shared/avatars'
import { CountdownRing } from './countdown-ring'
import { ResultOverlay } from './result-overlay'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    auctionComplete: 'Auction complete',
    completeBody: 'The gavel has fallen for the last time. See the final squads and spending in the results report.',
    viewResults: 'View results',
    waitingNext: 'Waiting for the organizer to bring the next player to the block…',
    lastSold: (player: string, team: string | null | undefined, price: string) => `Last: ${player} sold to ${team} for ${price}`,
    lastUnsold: (player: string) => `Last: ${player} went unsold`,
    paused: 'Paused',
    onTheBlock: 'On the block',
    playerNo: (n: string) => `PLAYER #${n}`,
    cat: (c: string) => `Cat ${c}`,
    base: (price: string) => `Base ${price}`,
    ex: (team: string) => `ex ${team}`,
    timerFrozen: 'Timer frozen by the organizer',
    stage1: 'Going once — final call for new bids',
    stage2: 'Going twice — last chance',
    biddingOpen: 'Bidding open',
    goingOnce: 'Going once',
    goingTwice: 'Going twice',
    currentBid: 'Current bid',
    highestBidder: 'highest bidder',
    awaitingFirst: 'Awaiting first bid',
    firstBidAt: (price: string) => `First bid at ${price} or more`,
    roomOpen: 'Auction room is open',
    waitingOrganizer: (name: string) => `${name} — waiting for the organizer to open the bidding.`,
    sellingCategory: (c: string) => `Selling category ${c} first.`,
    allInPool: 'All available players are in the pool.',
    readyStats: (online: number, teams: number, players: number) =>
      `${online} online · ${teams} teams · ${players} players`,
    categoryMode: 'Category mode',
    normalMode: 'Normal mode',
    minIncrement: (amount: string) => `min increment ${amount}`,
  },
  bn: {
    auctionComplete: 'নিলাম শেষ',
    completeBody: 'শেষবারের মতো হাতুড়ি পড়েছে। ফলাফল রিপোর্টে চূড়ান্ত স্কোয়াড আর খরচ দেখুন।',
    viewResults: 'ফলাফল দেখুন',
    waitingNext: 'আয়োজক পরের খেলোয়াড়কে নিলামে তুলবেন, অপেক্ষা করুন…',
    lastSold: (player: string, team: string | null | undefined, price: string) => `শেষ: ${player}, ${price}-এ ${team}-এর কাছে বিক্রি`,
    lastUnsold: (player: string) => `শেষ: ${player} অবিক্রিত`,
    paused: 'বিরতি',
    onTheBlock: 'নিলামে উঠেছে',
    playerNo: (n: string) => `খেলোয়াড় #${n}`,
    cat: (c: string) => `ক্যাটাগরি ${c}`,
    base: (price: string) => `বেস ${price}`,
    ex: (team: string) => `সাবেক ${team}`,
    timerFrozen: 'আয়োজক টাইমার থামিয়ে রেখেছেন',
    stage1: 'এক বার… — নতুন বিডের শেষ ডাক',
    stage2: 'দুই বার… — শেষ সুযোগ',
    biddingOpen: 'বিড চলছে',
    goingOnce: 'এক বার…',
    goingTwice: 'দুই বার…',
    currentBid: 'বর্তমান বিড',
    highestBidder: 'সর্বোচ্চ বিডার',
    awaitingFirst: 'প্রথম বিডের অপেক্ষায়',
    firstBidAt: (price: string) => `প্রথম বিড ${price} বা তার বেশি`,
    roomOpen: 'নিলাম রুম খোলা হয়েছে',
    waitingOrganizer: (name: string) => `${name} — আয়োজক বিড শুরু করার অপেক্ষায়।`,
    sellingCategory: (c: string) => `প্রথমে ক্যাটাগরি ${c}-এর খেলোয়াড়দের নিলাম হবে।`,
    allInPool: 'সব খেলোয়াড় পুলে আছেন।',
    readyStats: (online: number, teams: number, players: number) =>
      `${online} জন অনলাইন · ${teams}টি দল · ${players} জন খেলোয়াড়`,
    categoryMode: 'ক্যাটাগরি মোড',
    normalMode: 'সাধারণ মোড',
    minIncrement: (amount: string) => `প্রতি বিডে কমপক্ষে ${amount} বাড়াতে হবে`,
  },
} satisfies Strings<{
  auctionComplete: string
  completeBody: string
  viewResults: string
  waitingNext: string
  lastSold: (player: string, team: string | null | undefined, price: string) => string
  lastUnsold: (player: string) => string
  paused: string
  onTheBlock: string
  playerNo: (n: string) => string
  cat: (c: string) => string
  base: (price: string) => string
  ex: (team: string) => string
  timerFrozen: string
  stage1: string
  stage2: string
  biddingOpen: string
  goingOnce: string
  goingTwice: string
  currentBid: string
  highestBidder: string
  awaitingFirst: string
  firstBidAt: (price: string) => string
  roomOpen: string
  waitingOrganizer: (name: string) => string
  sellingCategory: (c: string) => string
  allInPool: string
  readyStats: (online: number, teams: number, players: number) => string
  categoryMode: string
  normalMode: string
  minIncrement: (amount: string) => string
}>

type StageStrings = (typeof STRINGS)['en']

interface StageProps {
  state: RoomState
  clockOffset: number
  onViewResults: () => void
}

/** The auction stage — current player, countdown ring, live bid. Shared by every role. */
export function AuctionStage({ state, clockOffset, onViewResults }: StageProps) {
  const t = useStrings(STRINGS)
  const hasPlayer = !!state.currentPlayer
  const active = state.status === 'LIVE' && hasPlayer
  const remaining = useCountdown(state.timerEndsAt, clockOffset, active)
  // The ring must be scaled to whichever timer is actually running: the bid timer
  // during stage 0, the (shorter) going-once/twice interval after that.
  const totalMs = (state.stage > 0 ? state.goingIntervalSeconds : state.bidTimerSeconds) * 1000
  const paused = state.status === 'PAUSED' && hasPlayer
  const shownRemaining = paused ? (state.pausedRemainingMs ?? 0) : remaining

  // Parent-controlled SOLD/UNSOLD moment: show the takeover for ~5s, then a
  // compact "between players" panel so the stage is never blank mid-auction.
  const betweenPlayers = !hasPlayer && state.status !== 'READY' && state.status !== 'ENDED'
  const [resultDismissed, setResultDismissed] = useState(true)
  const resultKey = state.lastResult?.at ?? null
  useEffect(() => {
    if (!betweenPlayers || !resultKey) {
      const t1 = setTimeout(() => setResultDismissed(true), 0)
      return () => clearTimeout(t1)
    }
    const t0 = setTimeout(() => setResultDismissed(false), 0)
    const t1 = setTimeout(() => setResultDismissed(true), 5000)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
    }
  }, [betweenPlayers, resultKey])

  return (
    <Card className="relative overflow-hidden border-2 shadow-md">
      {/* subtle live edge */}
      {active ? (
        <motion.div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          aria-hidden
        />
      ) : null}

      <CardContent className="p-4 sm:p-6">
        {/* ---- READY: room open, waiting for organizer ---- */}
        {state.status === 'READY' && !hasPlayer ? (
          <ReadyHero state={state} />
        ) : null}

        {/* ---- ENDED ---- */}
        {state.status === 'ENDED' ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-teal-100 p-5" aria-hidden>
              <Trophy className="h-10 w-10 text-teal-700" />
            </div>
            <div>
              <h2 className="text-2xl font-black">{t.auctionComplete}</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t.completeBody}
              </p>
            </div>
            <Button onClick={onViewResults} className="h-11">
              <Flag className="mr-2 h-4 w-4" /> {t.viewResults}
            </Button>
          </div>
        ) : null}

        {/* ---- SOLD / UNSOLD moment + between-players panel ---- */}
        {betweenPlayers ? (
          <div className="py-2">
            {resultKey && !resultDismissed ? (
              <ResultOverlay lastResult={state.lastResult} currentPlayerOnBlock={hasPlayer} forceVisible />
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 text-center text-muted-foreground">
                <Loader />
                <p className="text-sm font-medium">{t.waitingNext}</p>
                {state.lastResult ? (
                  <p className="text-xs">
                    {state.lastResult.type === 'SOLD'
                      ? t.lastSold(state.lastResult.playerName, state.lastResult.teamName, formatBDT(state.lastResult.price ?? 0))
                      : t.lastUnsold(state.lastResult.playerName)}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* ---- LIVE/PAUSED with a player on the block ---- */}
        <AnimatePresence mode="wait">
          {hasPlayer && state.currentPlayer ? (
            <motion.div
              key={state.currentPlayer.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                {/* player identity */}
                <div>
                  <div className="flex items-center gap-2">
                    <motion.span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-widest',
                        state.status === 'PAUSED' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-900'
                      )}
                      animate={active ? { opacity: [1, 0.55, 1] } : undefined}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          state.status === 'PAUSED' ? 'bg-slate-500' : 'bg-amber-600'
                        )}
                        aria-hidden
                      />
                      {state.status === 'PAUSED' ? t.paused : t.onTheBlock}
                    </motion.span>
                    <span className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
                      {t.playerNo(String(state.currentPlayer.playerNumber).padStart(3, '0'))}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <PlayerAvatar
                      name={state.currentPlayer.name}
                      photoUrl={state.currentPlayer.photoUrl}
                      className="h-16 w-16 shrink-0 border-2 border-primary/20 sm:h-20 sm:w-20"
                      fallbackClassName="text-xl font-black"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-black tracking-tight sm:text-3xl">
                        {state.currentPlayer.name}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="font-semibold">{state.currentPlayer.role}</Badge>
                        {state.currentPlayer.category ? (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 font-bold text-amber-900">
                            {t.cat(state.currentPlayer.category)}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="tabular-nums">
                          {t.base(formatBDT(state.currentPlayer.basePrice))}
                        </Badge>
                        {state.currentPlayer.previousTeam ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t.ex(state.currentPlayer.previousTeam)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* countdown */}
                <div className="flex flex-col items-center gap-2">
                  <CountdownRing
                    remainingMs={shownRemaining}
                    totalMs={totalMs}
                    paused={paused}
                    className={cn(!paused && shownRemaining <= 5000 && active && 'animate-pulse')}
                  />
                  <p className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
                    <Clock className="h-3 w-3" />
                    {state.status === 'PAUSED'
                      ? t.timerFrozen
                      : stageLabel(state.stage, t)}
                  </p>
                </div>
              </div>

              {/* GOING ONCE / TWICE banner */}
              <AnimatePresence>
                {active && state.stage > 0 && !paused ? (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                    aria-live="assertive"
                  >
                    <div
                      className={cn(
                        'mt-4 flex items-center justify-center gap-3 rounded-lg py-3 text-center',
                        state.stage === 2 ? 'bg-rose-100' : 'bg-amber-100'
                      )}
                    >
                      <motion.span
                        className={cn(
                          'text-xl font-black uppercase tracking-[0.2em] sm:text-2xl',
                          state.stage === 2 ? 'text-rose-700' : 'text-amber-800'
                        )}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: state.stage === 2 ? 0.55 : 0.9, repeat: Infinity }}
                      >
                        {state.stage === 2 ? t.goingTwice : t.goingOnce}
                      </motion.span>
                      <Gavel
                        className={cn('h-5 w-5', state.stage === 2 ? 'text-rose-700' : 'text-amber-700')}
                        aria-hidden
                      />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* current bid */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/40 p-4">
                {state.currentBid ? (
                  <>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t.currentBid}
                      </p>
                      <p className="text-3xl font-black tabular-nums text-primary sm:text-4xl">
                        {formatBDT(state.currentBid.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <TeamAvatar
                        name={state.currentBid.teamName}
                        color={state.currentBid.teamColor}
                        className="h-11 w-11"
                      />
                      <div>
                        <p className="text-sm font-bold leading-tight">{state.currentBid.teamName}</p>
                        <p className="text-xs text-muted-foreground">{t.highestBidder}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t.awaitingFirst}
                      </p>
                      <p className="text-2xl font-black tabular-nums text-muted-foreground sm:text-3xl">
                        {t.base(formatBDT(state.currentPlayer.basePrice))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <CircleDollarSign className="h-4 w-4" aria-hidden />
                      {t.firstBidAt(formatBDT(state.currentPlayer.basePrice))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

function Loader() {
  return (
    <span className="flex h-10 w-10 items-center justify-center">
      <motion.span
        className="block h-8 w-8 rounded-full border-[3px] border-muted-foreground/30 border-t-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />
    </span>
  )
}

function stageLabel(stage: 0 | 1 | 2, t: StageStrings): string {
  if (stage === 1) return t.stage1
  if (stage === 2) return t.stage2
  return t.biddingOpen
}

function ReadyHero({ state }: { state: RoomState }) {
  const t = useStrings(STRINGS)
  const online = state.participants.filter((p) => p.online).length + state.viewersOnline
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="rounded-full bg-amber-100 p-5" aria-hidden>
        <PartyPopper className="h-10 w-10 text-amber-700" />
      </div>
      <div>
        <h2 className="text-2xl font-black">{t.roomOpen}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {t.waitingOrganizer(state.tournamentName)}{' '}
          {state.mode === 'CATEGORY' && state.currentCategory
            ? t.sellingCategory(state.currentCategory)
            : t.allInPool}
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden />
        {t.readyStats(online, state.teams.length, state.pool.total)}
      </p>
      <p className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
        <Gavel className="h-3 w-3" aria-hidden />
        {state.mode === 'CATEGORY' ? t.categoryMode : t.normalMode} · {t.minIncrement(formatBDT(state.minIncrement))}
      </p>
    </div>
  )
}
