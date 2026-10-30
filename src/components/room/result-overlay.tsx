'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gavel, UserX } from 'lucide-react'
import type { RoomState } from '@/lib/types'
import { formatBDT } from '@/lib/format'
import { TeamAvatar } from '@/components/shared/avatars'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    sold: 'SOLD!',
    unsold: 'UNSOLD',
    boughtByPre: 'bought by ',
    boughtByPost: '',
    noBids: (n: number) => `No bids for Player #${n} — the house moves on`,
  },
  bn: {
    sold: 'বিক্রি!',
    unsold: 'অবিক্রিত',
    boughtByPre: '',
    boughtByPost: ' কিনে নিয়েছে',
    noBids: (n: number) => `খেলোয়াড় #${n}-এর জন্য কোনো বিড আসেনি — নিলাম এগিয়ে চলছে`,
  },
} satisfies Strings<{
  sold: string
  unsold: string
  boughtByPre: string
  boughtByPost: string
  noBids: (n: number) => string
}>

interface ResultOverlayProps {
  lastResult: RoomState['lastResult']
  currentPlayerOnBlock: boolean
  /** When true the parent controls visibility (no internal auto-dismiss). */
  forceVisible?: boolean
}

/** SOLD / UNSOLD moment — shows for ~5s or until the next player steps onto the block. */
export function ResultOverlay({ lastResult, currentPlayerOnBlock, forceVisible = false }: ResultOverlayProps) {
  const t = useStrings(STRINGS)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const resultKey = lastResult?.at ?? null

  // Auto-dismiss after 5s (only when the parent does not control visibility).
  useEffect(() => {
    if (forceVisible || !resultKey) return
    const timer = setTimeout(() => setDismissedKey(resultKey), 5000)
    return () => clearTimeout(timer)
  }, [resultKey, forceVisible])

  const visible = !!lastResult && !currentPlayerOnBlock && (forceVisible || dismissedKey !== resultKey)
  const sold = lastResult?.type === 'SOLD'

  return (
    <AnimatePresence>
      {visible && lastResult ? (
        <motion.div
          key={lastResult.at}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="relative overflow-hidden"
          aria-live="polite"
        >
          <div
            className={
              sold
                ? 'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-teal-300 bg-gradient-to-b from-teal-50 to-background px-4 py-10 text-center shadow-sm'
                : 'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-rose-200 bg-gradient-to-b from-rose-50 to-background px-4 py-10 text-center shadow-sm'
            }
          >
            {sold ? <SoldConfetti /> : null}
            <div
              className={
                sold
                  ? 'flex items-center gap-2 rounded-full bg-teal-600 px-5 py-1.5 text-xl font-black tracking-wide text-white sm:text-2xl'
                  : 'flex items-center gap-2 rounded-full bg-rose-600 px-5 py-1.5 text-xl font-black tracking-wide text-white sm:text-2xl'
              }
            >
              {sold ? <Gavel className="h-5 w-5" aria-hidden /> : <UserX className="h-5 w-5" aria-hidden />}
              {sold ? t.sold : t.unsold}
            </div>
            {sold ? (
              <>
                <div className="flex items-center gap-3">
                  <TeamAvatar
                    name={lastResult.teamName || '?'}
                    color={null}
                    className="h-12 w-12"
                  />
                  <div className="text-left">
                    <p className="text-xl font-extrabold sm:text-2xl">{lastResult.playerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.boughtByPre}<span className="font-semibold text-foreground">{lastResult.teamName}</span>{t.boughtByPost}
                    </p>
                  </div>
                </div>
                <p className="text-3xl font-black tabular-nums text-teal-700 sm:text-4xl">
                  {formatBDT(lastResult.price ?? 0)}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-extrabold sm:text-2xl">{lastResult.playerName}</p>
                <p className="text-sm text-muted-foreground">
                  {t.noBids(lastResult.playerNumber)}
                </p>
              </>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Tasteful, sparse confetti burst — a handful of teal/amber shapes. */
function SoldConfetti() {
  const pieces = [
    { left: '8%', delay: 0, color: '#0D9488', size: 10, rotate: 220 },
    { left: '20%', delay: 0.12, color: '#F59E0B', size: 8, rotate: 140 },
    { left: '34%', delay: 0.05, color: '#14B8A6', size: 12, rotate: 300 },
    { left: '52%', delay: 0.18, color: '#FBBF24', size: 8, rotate: 180 },
    { left: '66%', delay: 0.08, color: '#0D9488', size: 10, rotate: 260 },
    { left: '80%', delay: 0.14, color: '#F59E0B', size: 9, rotate: 320 },
    { left: '92%', delay: 0.02, color: '#14B8A6', size: 11, rotate: 200 },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{ left: p.left, width: p.size, height: p.size * 0.6, backgroundColor: p.color }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: '110%', opacity: [0, 1, 1, 0.6], rotate: p.rotate }}
          transition={{ duration: 1.6 + i * 0.12, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
