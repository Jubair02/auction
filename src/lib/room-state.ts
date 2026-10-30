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
