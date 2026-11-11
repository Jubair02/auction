'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Ban,
  FastForward,
  Gavel,
  Hand,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Square,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatBDT } from '@/lib/format'
import type { OrganizerAction } from '@/lib/types'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useStrings } from '@/lib/i18n'
import { AutoAuctionPanel } from './organizer-controls/auto-auction-panel'
import { CategoryChips } from './organizer-controls/category-chips'
import { ConfirmShell } from './organizer-controls/confirm-shell'
import { ManualBidDialog } from './organizer-controls/manual-bid-dialog'
import { RoundSummary } from './organizer-controls/round-summary'
import { CONTROLS_STRINGS as STRINGS } from './organizer-controls/strings'
import type { OrganizerControlsProps } from './organizer-controls/types'
import { useOrganizerAction } from './organizer-controls/use-organizer-action'

export { CategoryChips } from './organizer-controls/category-chips'
export { useOrganizerAction } from './organizer-controls/use-organizer-action'

type ConfirmKind = 'sell' | 'unsold' | 'skip' | 'end' | 'reopen' | 'rounds' | null
const LOT_CONFIRMS: ConfirmKind[] = ['sell', 'unsold', 'skip']

/**
 * The lot exactly as the organizer saw it when opening a sell / unsold / skip
 * confirmation. Sent with the action so the server refuses it if the player
 * or the bid changed in the meantime.
 */
interface LotSnapshot {
  playerId: string
  playerName: string
  bidAmount: number | null
  teamName: string | null
}

/** Organizer cockpit — start/pause/sell controls, manual bid, category chips. */
export function OrganizerControls({ state, onAction, clockOffset = 0, online = true, canReopen = true }: OrganizerControlsProps) {
  const tx = useStrings(STRINGS)
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [lot, setLot] = useState<LotSnapshot | null>(null)
  // A confirmed action awaiting the server's ack: its dialog stays open until then.
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const offline = !online

  const run = useOrganizerAction(onAction)

  /** Runs a confirmed action; its dialog closes only once the server accepted it. */
  async function confirmAndRun(action: OrganizerAction, payload?: Record<string, unknown>) {
    if (busyRef.current) return // a double click lands before the re-render disables the button
    busyRef.current = true
    setBusy(true)
    try {
      const res = await run(action, payload)
      if (res.ok) setConfirm(null)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function openLotConfirm(kind: 'sell' | 'unsold' | 'skip') {
    const player = state.currentPlayer
    if (!player) return
    setLot({
      playerId: player.id,
      playerName: player.name,
      bidAmount: state.currentBid?.amount ?? null,
      teamName: state.currentBid?.teamName ?? null,
    })
    setConfirm(kind)
  }

  const lotPayload = () => (lot ? { playerId: lot.playerId, bidAmount: lot.bidAmount } : {})

  function skip() {
    const player = state.currentPlayer
    if (!player) return
    // A skip that would throw away a live bid needs a confirmation.
    if (state.currentBid) openLotConfirm('skip')
    else void run('skip', { playerId: player.id, bidAmount: null })
  }

  // The lot moved on (sold by the clock, another organizer tab…) while a
  // sell / unsold / skip confirmation was open: it no longer applies.
  const currentPlayerId = state.currentPlayer?.id ?? null
  useEffect(() => {
    if (busy || !lot || !LOT_CONFIRMS.includes(confirm)) return
    if (currentPlayerId === lot.playerId) return
    setConfirm(null)
    toast(tx.playerChanged)
  }, [currentPlayerId, confirm, lot, busy, tx])

  const bidChanged =
    !!lot && !busy && LOT_CONFIRMS.includes(confirm) && (state.currentBid?.amount ?? null) !== lot.bidAmount
  const changedNote = bidChanged ? tx.bidChanged : ''
  const closeUnlessBusy = (open: boolean) => {
    if (!open && !busy) setConfirm(null)
  }

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
              disabled={offline}
              onClick={() => void run('start')}
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
              {canReopen ? (
                <Button variant="outline" className="h-11 w-full" onClick={() => setConfirm('reopen')}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> {tx.reopenAuction}
                </Button>
              ) : null}
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
                disabled={offline || !live || hasPlayer || state.autoAdvance || roundComplete}
                onClick={() => void run('next_player')}
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
                <Button variant="outline" className="h-11" disabled={offline || !hasPlayer || !live} onClick={skip}>
                  <FastForward className="mr-1.5 h-4 w-4" /> {tx.skip}
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={offline || (!live && !paused)}
                  onClick={() => void run(paused ? 'resume' : 'pause')}
                >
                  {paused ? <Play className="mr-1.5 h-4 w-4" /> : <Pause className="mr-1.5 h-4 w-4" />}
                  {paused ? tx.resume : tx.pause}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-teal-300 text-teal-800 hover:bg-teal-50 hover:text-teal-900 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
                  disabled={offline || !hasBid || !live}
                  onClick={() => openLotConfirm('sell')}
                >
                  <Tag className="mr-1.5 h-4 w-4" /> {tx.sellNow}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                  disabled={offline || !hasPlayer || !live}
                  onClick={() => openLotConfirm('unsold')}
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
              <Button variant="secondary" className="h-11" disabled={offline || !live} onClick={() => setManualOpen(true)}>
                <Hand className="mr-1.5 h-4 w-4" /> {tx.manualBid}
              </Button>
              <Button variant="destructive" className="h-11" disabled={offline} onClick={() => setConfirm('end')}>
                <Square className="mr-1.5 h-4 w-4" /> {tx.endAuction}
              </Button>
            </div>
          ) : null}

          {!ended ? <CategoryChips state={state} onAction={run} /> : null}

          {!ended ? <AutoAuctionPanel state={state} onAction={run} clockOffset={clockOffset} /> : null}
        </CardContent>
      </Card>

      {/* confirms */}
      <AlertDialog open={confirm === 'sell'} onOpenChange={closeUnlessBusy}>
        <ConfirmShell
          title={tx.sellTitle}
          description={
            lot && lot.bidAmount !== null
              ? tx.sellDesc(lot.teamName ?? '—', lot.playerName || tx.thePlayer, formatBDT(lot.bidAmount)) + changedNote
              : tx.noBidToSell
          }
          actionLabel={tx.sellNow}
          pending={busy}
          onAction={() => void confirmAndRun('force_sell', lotPayload())}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'unsold'} onOpenChange={closeUnlessBusy}>
        <ConfirmShell
          title={tx.unsoldTitle}
          description={tx.unsoldDesc(lot?.playerName || tx.thisPlayer) + changedNote}
          actionLabel={tx.markUnsold}
          destructive
          pending={busy}
          onAction={() => void confirmAndRun('force_unsold', lotPayload())}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'skip'} onOpenChange={closeUnlessBusy}>
        <ConfirmShell
          title={tx.skipTitle}
          description={
            tx.skipDesc(
              lot?.playerName || tx.thisPlayer,
              lot?.teamName ?? '—',
              lot?.bidAmount != null ? formatBDT(lot.bidAmount) : '—',
            ) + changedNote
          }
          actionLabel={tx.skip}
          destructive
          pending={busy}
          onAction={() => void confirmAndRun('skip', lotPayload())}
        />
      </AlertDialog>
      <AlertDialog open={confirm === 'end'} onOpenChange={closeUnlessBusy}>
        <ConfirmShell
          title={tx.endTitle}
          description={tx.endDesc}
          actionLabel={tx.endAuction}
          destructive
          pending={busy}
          onAction={() => void confirmAndRun('end')}
        />
      </AlertDialog>

      <AlertDialog open={confirm === 'rounds'} onOpenChange={closeUnlessBusy}>
        <ConfirmShell
          title={tx.roundTitle(state.round + 1)}
          description={tx.roundDesc(leftOver, state.autoAdvance)}
          actionLabel={tx.startReauction}
          pending={busy}
          onAction={() => void confirmAndRun('reauction_unsold')}
        />
      </AlertDialog>

      <AlertDialog open={confirm === 'reopen'} onOpenChange={closeUnlessBusy}>
        <ConfirmShell
          title={tx.reopenTitle}
          description={tx.reopenDesc}
          actionLabel={tx.reopenAuction}
          pending={busy}
          onAction={() => void confirmAndRun('reopen')}
        />
      </AlertDialog>

      <ManualBidDialog
        state={state}
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSubmit={async (teamId, amount, playerId) => {
          // Pinned to the player shown when Submit was pressed: if the lot changed
          // meanwhile, the engine refuses the bid instead of moving it.
          const res = await run('manual_bid', { teamId, amount, playerId })
          if (res.ok) setManualOpen(false)
          return res.ok
        }}
      />
    </>
  )
}
