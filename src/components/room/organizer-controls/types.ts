import type { ActionResult } from '@/lib/use-auction-socket'
import type { OrganizerAction, RoomState } from '@/lib/types'

export type RunAction = (action: OrganizerAction, payload?: Record<string, unknown>) => Promise<ActionResult>

export interface OrganizerControlsProps {
  state: RoomState
  /** Sends an organizer action; resolves with the server's acknowledgement. */
  onAction: RunAction
  /** serverTime − clientTime, so the session countdown matches the server. */
  clockOffset?: number
  /** Connected and seated — actions are disabled while the room is offline. */
  online?: boolean
  /** Reopening an ended auction (co-organizer and up — false for auctioneers). */
  canReopen?: boolean
}
