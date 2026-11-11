'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, apiGet } from '@/lib/api'
import { type PaymentDTO, type PaymentStatus, type Plan, type SafeUser, type TournamentSummary } from '@/lib/types'

export type AdminUser = SafeUser & { tournamentCount: number }
export type AdminTournament = TournamentSummary & { organizerName?: string; archivedAt?: string | null }
export type AdminPayment = PaymentDTO & { tournamentPlan: Plan | null }
export type PaymentFilter = PaymentStatus | 'ALL'

// One request per list, shared by every tab through the cache.
export const STATS_URL = '/api/admin/stats'
export const USERS_URL = '/api/admin/users'
export const TOURNAMENTS_URL = '/api/admin/tournaments'
export const SETTINGS_URL = '/api/admin/settings'
export const paymentsUrl = (status: PaymentFilter) => `/api/admin/payments?status=${status}`
export const PLANS_URL = '/api/plans'

export const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800',
  ORGANIZER: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
}

/** The admin users / tournaments lists hold the newest this many (the API's cap). */
export const ADMIN_LIST_LIMIT = 500

/**
 * When a list holds only the newest ADMIN_LIST_LIMIT rows, a typed search (2+
 * characters) asks the server instead, so older rows are still found. Null
 * while not searching the server (or while the answer is on its way).
 */
export function useServerSearch<T>(baseUrl: string, key: 'users' | 'tournaments', query: string, capped: boolean): T[] | null {
  const q = query.trim()
  const active = capped && q.length >= 2
  const [result, setResult] = useState<{ q: string; rows: T[] } | null>(null)
  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = setTimeout(() => {
      apiGet<Record<string, unknown>>(`${baseUrl}?q=${encodeURIComponent(q)}`)
        .then((data) => {
          if (!cancelled) setResult({ q, rows: (data[key] as T[] | undefined) ?? [] })
        })
        .catch(() => undefined)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, baseUrl, key, q])
  return active && result?.q === q ? result.rows : null
}

/** Toast for a failed list load; `fallback` is the translated "Could not load …" text. */
export const loadError = (fallback: string) => (ex: unknown) =>
  toast.error(ex instanceof ApiError ? ex.message : fallback)

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** Filter pills with live counts — the same pattern the player pool uses. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 pl-9" />
    </div>
  )
}

export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  )
}
