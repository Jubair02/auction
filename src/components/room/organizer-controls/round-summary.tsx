'use client'

import { CircleCheck, Repeat, Trophy } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import type { RoomState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
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

/**
 * Sold / Unsold / Skipped summary shown when a round runs out of players
 * (with the next-round and finalize actions), and read-only once finalized.
 */
export function RoundSummary({
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
    { label: tx.tileSold, value: state.pool.sold, sub: formatBDT(totalValue), tone: 'text-emerald-700 dark:text-emerald-400' },
    { label: tx.tileUnsold, value: state.pool.unsold, sub: null, tone: 'text-rose-700 dark:text-rose-400' },
    { label: tx.tileSkipped, value: state.pool.skipped, sub: null, tone: 'text-slate-700 dark:text-slate-300' },
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
                  p.status === 'UNSOLD' ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200' : 'border-border bg-background text-foreground',
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
