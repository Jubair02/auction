'use client'

// Warm up a tournament's page before the click lands: hovering, focusing or
// pressing "Manage" starts both the page code download and its data request,
// in parallel, so by the time navigation happens most of the wait is gone.
import { prefetch } from '@/lib/api-cache'

export const TOURNAMENTS_URL = '/api/tournaments'
export const tournamentDetailUrl = (id: string) => `/api/tournaments/${id}`

export function prefetchTournament(id: string): void {
  prefetch(tournamentDetailUrl(id))
  void import('@/components/organizer/tournament-detail').catch(() => undefined)
}

/** Props for a button/link that opens a tournament: prefetch on intent. */
export function prefetchTournamentProps(id: string) {
  const warm = () => prefetchTournament(id)
  return { onPointerEnter: warm, onFocus: warm, onPointerDown: warm }
}
