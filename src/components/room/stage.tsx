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

interface StageProps {
  state: RoomState
  clockOffset: number
  onViewResults: () => void
}

/** The auction stage — current player, countdown ring, live bid. Shared by every role. */
export function AuctionStage({ state, clockOffset, onViewResults }: StageProps) {
  const hasPlayer = !!state.currentPlayer
  const active = state.status === 'LIVE' && hasPlayer
  const remaining = useCountdown(state.timerEndsAt, clockOffset, active)
  const totalMs = state.bidTimerSeconds * 1000
  const paused = state.status === 'PAUSED' && hasPlayer
  const shownRemaining = paused ? (state.pausedRemainingMs ?? 0) : remaining

  // Parent-controlled SOLD/UNSOLD moment: show the takeover for ~5s, then a
  // compact "between players" panel so the stage is never blank mid-auction.
  const betweenPlayers = !hasPlayer && state.status !== 'READY' && state.status !== 'ENDED'
  const [resultDismissed, setResultDismissed] = useState(true)
  const resultKey = state.lastResult?.at ?? null
  useEffect(() => {
    if (!betweenPlayers || !resultKey) {
      const t = setTimeout(() => setResultDismissed(true), 0)
      return () => clearTimeout(t)
    }
    const t0 = setTimeout(() => setResultDismissed(false), 0)
    const t = setTimeout(() => setResultDismissed(true), 5000)
    return () => {
      clearTimeout(t0)
      clearTimeout(t)
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
              <h2 className="text-2xl font-black">Auction complete</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                The gavel has fallen for the last time. See the final squads and spending in the results report.
              </p>
            </div>
            <Button onClick={onViewResults} className="h-11">
              <Flag className="mr-2 h-4 w-4" /> View results
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
                <p className="text-sm font-medium">Waiting for the organizer to bring the next player to the block…</p>
                {state.lastResult ? (
                  <p className="text-xs">
                    Last: {state.lastResult.type === 'SOLD'
                      ? `${state.lastResult.playerName} sold to ${state.lastResult.teamName} for ${formatBDT(state.lastResult.price ?? 0)}`
                      : `${state.lastResult.playerName} went unsold`}
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
                      {state.status === 'PAUSED' ? 'Paused' : 'On the block'}
                    </motion.span>
                    <span className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
                      PLAYER #{String(state.currentPlayer.playerNumber).padStart(3, '0')}
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
                            Cat {state.currentPlayer.category}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="tabular-nums">
                          Base {formatBDT(state.currentPlayer.basePrice)}
                        </Badge>
                        {state.currentPlayer.previousTeam ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            ex {state.currentPlayer.previousTeam}
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
                      ? 'Timer frozen by the organizer'
                      : stageLabel(state.stage)}
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
                        {state.stage === 2 ? 'Going twice' : 'Going once'}
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
                        Current bid
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
                        <p className="text-xs text-muted-foreground">highest bidder</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Awaiting first bid
                      </p>
                      <p className="text-2xl font-black tabular-nums text-muted-foreground sm:text-3xl">
                        Base {formatBDT(state.currentPlayer.basePrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <CircleDollarSign className="h-4 w-4" aria-hidden />
                      First bid at {formatBDT(state.currentPlayer.basePrice)} or more
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

function stageLabel(stage: 0 | 1 | 2): string {
  if (stage === 1) return 'Going once — final call for new bids'
  if (stage === 2) return 'Going twice — last chance'
  return 'Bidding open'
}

function ReadyHero({ state }: { state: RoomState }) {
  const online = state.participants.filter((p) => p.online).length
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="rounded-full bg-amber-100 p-5" aria-hidden>
        <PartyPopper className="h-10 w-10 text-amber-700" />
      </div>
      <div>
        <h2 className="text-2xl font-black">Auction room is open</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {state.tournamentName} — waiting for the organizer to open the bidding.{' '}
          {state.mode === 'CATEGORY' && state.currentCategory
            ? `Selling category ${state.currentCategory} first.`
            : 'All available players are in the pool.'}
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden />
        {online} online · {state.teams.length} teams · {state.pool.total} players
      </p>
      <p className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
        <Gavel className="h-3 w-3" aria-hidden />
        {state.mode === 'CATEGORY' ? 'Category mode' : 'Normal mode'} · min increment {formatBDT(state.minIncrement)}
      </p>
    </div>
  )
}
