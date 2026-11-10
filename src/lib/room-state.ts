// Applies a `room_state` broadcast to the client's copy. Pure (unit-tested).
import type { RoomState, RoomStateWire } from './types'

export interface MergeResult {
  state: RoomState | null
  /** The client's copy no longer matches the server — fetch a full snapshot. */
  needsResync: boolean
}

/**
 * Broadcasts omit `players` / `participants` when they are unchanged since the
 * previous broadcast. Fill them in from the previous state, but only when that
 * copy is provably the one the server means (same fingerprint); otherwise ask
 * for a resync rather than show a stale pool.
 */
export function mergeRoomState(prev: RoomState | null, next: RoomStateWire): MergeResult {
  // Full snapshot (both lists present): take it as is.
  if (next.players && next.participants) return { state: next as RoomState, needsResync: false }

  // A delta before we have any snapshot (it raced our join ack): drop it —
  // the ack carries a full snapshot.
  if (!prev) return { state: null, needsResync: false }

  const players = next.players ?? (prev.playersHash === next.playersHash ? prev.players : null)
  const participants =
    next.participants ?? (prev.participantsHash === next.participantsHash ? prev.participants : null)
  if (!players || !participants) return { state: prev, needsResync: true }

  return { state: { ...next, players, participants }, needsResync: false }
}

/**
 * A seat saved in this browser tab may only be reused by the account it was
 * issued to (shared phones at a venue). Organizer and manager seats without an
 * owner — saved before this check existed — are rejected; anonymous viewer
 * seats stay usable by anyone in the tab.
 */
export function seatBelongsTo(seat: { role: string; userId?: string | null }, currentUserId: string | null): boolean {
  if (seat.role === 'VIEWER' && !seat.userId) return true
  return !!seat.userId && seat.userId === currentUserId
}

/** The part of the room an outbid check looks at. */
export interface BidSnapshot {
  status: string
  playerId: string | null
  bid: { teamId: string; teamName: string; amount: number } | null
}

export type OutbidChange =
  /** My team was leading this player and another team just bid over it. */
  | { type: 'outbid'; byTeam: string; amount: number }
  /** Still beaten, by a newer bid (update the banner; no new alarm). */
  | { type: 'raised'; byTeam: string; amount: number }
  /** The alert no longer applies: we lead again, the player changed, or bidding stopped. */
  | { type: 'clear' }
  | null

/**
 * What changed for `myTeamId` between two room broadcasts. Pure, so the alarm
 * fires exactly once per lost lead and never for someone else's bidding war.
 */
export function outbidChange(prev: BidSnapshot | null, next: BidSnapshot, myTeamId: string | undefined, alerted: boolean): OutbidChange {
  if (!myTeamId) return null
  const samePlayer = !!prev && !!next.playerId && prev.playerId === next.playerId
  if (next.status !== 'LIVE' || !samePlayer || next.bid?.teamId === myTeamId) return alerted ? { type: 'clear' } : null
  if (!next.bid || prev.bid?.amount === next.bid.amount) return null
  if (prev.bid?.teamId === myTeamId) return { type: 'outbid', byTeam: next.bid.teamName, amount: next.bid.amount }
  return alerted ? { type: 'raised', byTeam: next.bid.teamName, amount: next.bid.amount } : null
}
