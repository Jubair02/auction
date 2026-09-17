// Formatting helpers — ৳ BDT with Bengali/South-Asian lakh grouping (1,50,000)
import type { PlayerStatus } from '@/lib/types'

export function formatBDT(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `৳${new Intl.NumberFormat('en-IN').format(Math.round(amount))}`
}

export function formatNumber(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN').format(Math.round(amount))
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  AVAILABLE: 'Available',
  LIVE: 'Live',
  SOLD: 'Sold',
  UNSOLD: 'Unsold',
  SKIPPED: 'Skipped',
}

export const PLAYER_STATUS_COLORS: Record<PlayerStatus, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LIVE: 'bg-amber-100 text-amber-900 border-amber-300',
  SOLD: 'bg-teal-100 text-teal-900 border-teal-300',
  UNSOLD: 'bg-rose-100 text-rose-800 border-rose-200',
  SKIPPED: 'bg-slate-200 text-slate-700 border-slate-300',
}

export const TOURNAMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-200 text-slate-700 border-slate-300',
  READY: 'bg-sky-100 text-sky-900 border-sky-200',
  LIVE: 'bg-amber-100 text-amber-900 border-amber-300',
  COMPLETED: 'bg-teal-100 text-teal-900 border-teal-300',
}

export const TEAM_PALETTE = [
  '#0F766E', '#B45309', '#7C3AED', '#BE123C', '#1D4ED8', '#15803D', '#B91C1C', '#A16207', '#0E7490', '#6D28D9',
]
