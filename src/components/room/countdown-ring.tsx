'use client'

import { motion } from 'framer-motion'
import { Pause } from 'lucide-react'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CountdownRingProps {
  remainingMs: number
  totalMs: number
  paused?: boolean
  /** Sizes the ring — defaults to h-32/w-32, h-40/w-40 from sm. */
  className?: string
}

/** Circular SVG countdown ring — green >10s, amber 6–10s, red <=5s with pulse. Reads well on light and dark. */
export function CountdownRing({ remainingMs, totalMs, paused = false, className }: CountdownRingProps) {
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)

  const tone = paused
    ? { stroke: 'text-slate-500 dark:text-slate-400', text: 'text-slate-600 dark:text-slate-300' }
    : seconds <= 5
      ? { stroke: 'text-rose-600 dark:text-rose-500', text: 'text-rose-600 dark:text-rose-400' }
      : seconds <= 10
        ? { stroke: 'text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-300' }
        : { stroke: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-300' }

  return (
    <div
      className={cn('@container relative h-32 w-32 shrink-0 sm:h-40 sm:w-40', className)}
      role="timer"
      aria-label={`Time remaining ${formatClock(remainingMs)}`}
    >
      <svg viewBox="0 0 128 128" className="h-full w-full" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200 dark:text-white/10" />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: 0.25, ease: 'linear' }}
          transform="rotate(-90 64 64)"
          className={cn('transition-colors', tone.stroke)}
        />
      </svg>
      <div className={cn('absolute inset-0 flex flex-col items-center justify-center', paused && 'animate-pulse')}>
        {paused ? <Pause className="mb-0.5 h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden /> : null}
        <span className={cn('text-[22cqw] font-black tabular-nums leading-none tracking-tight', tone.text)}>
          {formatClock(remainingMs)}
        </span>
        <span className="mt-1 text-[max(8px,6.5cqw)] font-semibold uppercase tracking-widest text-muted-foreground">
          {paused ? 'Paused' : 'on the clock'}
        </span>
      </div>
    </div>
  )
}
