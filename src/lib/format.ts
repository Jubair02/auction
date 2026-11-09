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

/** UI language for the date helpers (same values as Lang in lib/i18n). */
export type DateLang = 'en' | 'bn'

// Bangla month/day names, but Western digits — as the rest of the UI (and BD receipts) use.
const DATE_LOCALE: Record<DateLang, string> = { en: 'en-GB', bn: 'bn-BD-u-nu-latn' }

/** "12 Nov 2026" / "১২ নভে, 2026"-style dates; pass the UI language (default English). */
export function formatDate(value: string | Date | null | undefined, withTime = false, lang: DateLang = 'en'): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(DATE_LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}

const RELATIVE_DAY: Record<DateLang, { today: string; tomorrow: string }> = {
  en: { today: 'Today', tomorrow: 'Tomorrow' },
  bn: { today: 'আজ', tomorrow: 'আগামীকাল' },
}

/** "Today, 7:00 pm" / "Tomorrow, 7:00 pm" / "Thu 12 Nov, 7:00 pm" — or null when no time is set. */
export function formatAuctionWhen(iso: string | null, lang: DateLang = 'en'): { text: string; past: boolean } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(d) - day(now)) / 86_400_000)
  const locale = DATE_LOCALE[lang]
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true })
  const date =
    days === 0
      ? RELATIVE_DAY[lang].today
      : days === 1
        ? RELATIVE_DAY[lang].tomorrow
        : d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
  return { text: `${date}, ${time}`, past: d.getTime() < now.getTime() }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatTime(value: string | Date, lang: DateLang = 'en'): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(DATE_LOCALE[lang], { hour: '2-digit', minute: '2-digit' })
}

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  AVAILABLE: 'Available',
  LIVE: 'Live',
  SOLD: 'Sold',
  UNSOLD: 'Unsold',
  SKIPPED: 'Skipped',
}

/** Status pill colours, light and dark theme. */
export const PLAYER_STATUS_COLORS: Record<PlayerStatus, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
  LIVE: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  SOLD: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800',
  UNSOLD: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60',
  SKIPPED: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
}

export const TOURNAMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  READY: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60',
  LIVE: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  COMPLETED: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800',
}

export const TEAM_PALETTE = [
  '#0F766E', '#B45309', '#7C3AED', '#BE123C', '#1D4ED8', '#15803D', '#B91C1C', '#A16207', '#0E7490', '#6D28D9',
]

/** File-name-safe slug for downloads, e.g. "Mirpur Corporate Cup 2026" → "mirpur-corporate-cup-2026". */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tournament'
  )
}
