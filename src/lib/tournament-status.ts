// Where a tournament stands, as the organizer and admin pages show it. The
// stored tournament status alone isn't enough: a paused auction is still live,
// and an ended auction means the tournament is done.
import type { TournamentSummary } from '@/lib/types'

type StatusFields = Pick<TournamentSummary, 'status' | 'auctionStatus' | 'roomCode' | 'auctionAt' | 'createdAt'>

export type TournamentPhase = 'LIVE' | 'READY' | 'DRAFT' | 'COMPLETED'

export const PHASE_LABELS: Record<TournamentPhase, string> = {
  LIVE: 'Live',
  READY: 'Ready',
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export const isLive = (t: Pick<StatusFields, 'auctionStatus'>) => t.auctionStatus === 'LIVE' || t.auctionStatus === 'PAUSED'
export const isDone = (t: Pick<StatusFields, 'status' | 'auctionStatus'>) => t.status === 'COMPLETED' || t.auctionStatus === 'ENDED'

export function tournamentPhase(t: Pick<StatusFields, 'status' | 'auctionStatus'>): TournamentPhase {
  if (isLive(t)) return 'LIVE'
  if (isDone(t)) return 'COMPLETED'
  return t.status === 'DRAFT' ? 'DRAFT' : 'READY'
}

export const auctionTime = (t: Pick<StatusFields, 'auctionAt'>) =>
  t.auctionAt ? new Date(t.auctionAt).getTime() : Number.POSITIVE_INFINITY

/** Live first, then ready rooms, then tournaments still being set up, finished ones last. */
export function urgency(t: StatusFields) {
  if (isLive(t)) return 0
  if (isDone(t)) return 3
  return t.roomCode ? 1 : 2
}

/** Most urgent first — soonest auction first within each group, then newest. */
export function byUrgency(a: StatusFields, b: StatusFields) {
  return urgency(a) - urgency(b) || auctionTime(a) - auctionTime(b) || b.createdAt.localeCompare(a.createdAt)
}
