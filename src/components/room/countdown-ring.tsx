'use client'

import { motion } from 'framer-motion'
import { Pause } from 'lucide-react'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CountdownRingProps {
  remainingMs: number
  totalMs: number
  paused?: boolean
  className?: string
}

/** Circular SVG countdown ring — green >10s, amber 6–10s, red <=5s with pulse. */
export function CountdownRing({ remainingMs, totalMs, paused = false, className }: CountdownRingProps) {
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)

  const tone = paused
    ? { stroke: '#64748B', text: 'text-slate-600' }
    : seconds <= 5
      ? { stroke: '#E11D48', text: 'text-rose-600' }
      : seconds <= 10
        ? { stroke: '#D97706', text: 'text-amber-600' }
        : { stroke: '#059669', text: 'text-emerald-600' }

  return (
    <div className={cn('relative', className)} role="timer" aria-label={`Time remaining ${formatClock(remainingMs)}`}>
      <svg viewBox="0 0 128 128" className="h-32 w-32 sm:h-40 sm:w-40" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: 0.25, ease: 'linear' }}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className={cn('absolute inset-0 flex flex-col items-center justify-center', paused && 'animate-pulse')}>
        {paused ? (
          <Pause className="mb-0.5 h-5 w-5 text-slate-500" aria-hidden />
        ) : null}
        <span className={cn('text-3xl font-black tabular-nums tracking-tight sm:text-4xl', tone.text)}>
          {formatClock(remainingMs)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {paused ? 'Paused' : 'on the clock'}
        </span>
      </div>
    </div>
  )
}
