'use client'

// Live auction socket hook — connects to the auction mini-service (port 3003).
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { mergeRoomState } from '@/lib/room-state'
export { seatBelongsTo } from '@/lib/room-state'
import type { OrganizerAction, RoomNotification, RoomState, RoomStateWire } from '@/lib/types'

/** How long a bid / organizer action waits for the server's acknowledgement. */
const ACK_TIMEOUT_MS = 8000

/**
 * Outcome of a bid or organizer action:
 *  - `offline`: not sent at all (the room isn't connected and joined);
 *  - `timeout`: sent, but the server never confirmed it (it may or may not have landed);
 *  - `rejected`: the server refused it — `error` says why.
 */
export type ActionResult =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'timeout' | 'rejected'; error?: string }

type AckResponse = { ok: true } | { ok: false; error?: string }

/** Notification kinds that are only feed entries — never worth a toast. */
const QUIET_KINDS = new Set<RoomNotification['kind']>(['bid', 'going'])

/** Room toasts: errors/warnings and sold/unsold always; every bid and "going once" stays in the feed only. */
function toastNotification(n: RoomNotification) {
  const kind = n.kind
  if (kind && QUIET_KINDS.has(kind)) return
  if (n.level === 'error') toast.error(n.message)
  else if (n.level === 'warning') toast.warning(n.message)
  else if (n.level === 'success') toast.success(n.message)
  // Plain info is only toasted when the server marks it as something that matters
  // (an older server sends no `kind`, and its info messages are bids and "going").
  else if (kind) toast(n.message)
}

export interface AuctionSocketApi {
  connected: boolean
  joined: boolean
  joinError: string | null
  /** Consecutive failed attempts to reach the auction service (0 once connected). */
  connectFailures: number
  state: RoomState | null
  /** serverTime - clientTime at last snapshot, to correct countdowns */
  clockOffset: number
  notifications: RoomNotification[]
  /** Places a bid on `playerId` (the player the manager saw on the block). Never queued while offline. */
  placeBid: (amount: number, playerId: string) => Promise<ActionResult>
  organizerAction: (action: OrganizerAction, payload?: Record<string, unknown>) => Promise<ActionResult>
  rejoin: () => void
}

/**
 * Where the auction service lives, as seen from this page:
 *  - NEXT_PUBLIC_AUCTION_URL when set (e.g. a dedicated wss:// host);
 *  - Next served directly on :3000 (local `next dev` / `next start`, no
 *    gateway): straight to :3003 on the same host;
 *  - otherwise behind the gateway (Caddy), which routes `?XTransformPort=3003`.
 */
function auctionEndpoint(): { url: string; path: string } {
  const configured = process.env.NEXT_PUBLIC_AUCTION_URL
  if (configured) return { url: configured, path: '/' }
  const { protocol, hostname, port } = window.location
  if (port === '3000') return { url: `${protocol}//${hostname}:3003`, path: '/' }
  // Hosted without a gateway (e.g. Vercel) the gateway route below can't work —
  // say so in the console instead of failing silently. See DEPLOY.md.
  if (process.env.NODE_ENV === 'production' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.warn(
      '[auction] NEXT_PUBLIC_AUCTION_URL is not set; trying the same-origin gateway route. ' +
        'If the room never connects, set NEXT_PUBLIC_AUCTION_URL to the auction service URL and redeploy.',
    )
  }
  return { url: '/?XTransformPort=3003', path: '/' }
}

export function useAuctionSocket(roomCode: string, token: string | null): AuctionSocketApi {
  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef<string | null>(null)
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  const [connected, setConnected] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [connectFailures, setConnectFailures] = useState(0)
  const [state, setState] = useState<RoomState | null>(null)
  const [clockOffset, setRawClockOffset] = useState(0)
  const [notifications, setNotifications] = useState<RoomNotification[]>([])
  // Read by placeBid / organizerAction, which must not emit unless seated.
  const joinedRef = useRef(false)
  useEffect(() => {
    joinedRef.current = joined
  }, [joined])

  // Every 1s timer tick measures the offset again, and network jitter moves it
  // by a few ms each time. Re-rendering the whole room for that is wasted work,
  // so only real drift (beyond what a countdown display can show) is applied.
  const clockOffsetRef = useRef(0)
  const setClockOffset = useCallback((offset: number) => {
    if (Math.abs(offset - clockOffsetRef.current) < 250) return
    clockOffsetRef.current = offset
    setRawClockOffset(offset)
  }, [])

  const doJoin = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !tokenRef.current) return
    socket.emit('join_room', { roomCode, token: tokenRef.current }, (ack: { ok: boolean; error?: string; state?: RoomState }) => {
      if (ack?.ok && ack.state) {
        joinedRef.current = true
        setJoined(true)
        setJoinError(null)
        setState(ack.state)
        setClockOffset(ack.state.serverTime - Date.now())
      } else {
        joinedRef.current = false
        setJoined(false)
        setJoinError(ack?.error || 'Failed to join room')
      }
    })
  }, [roomCode, setClockOffset])

  useEffect(() => {
    if (!token) return
    const endpoint = auctionEndpoint()
    const socket = io(endpoint.url, {
      path: endpoint.path,
      transports: ['websocket', 'polling'],
      // Networks that block WebSocket (some offices, captive Wi-Fi) fall back to long-polling.
      tryAllTransports: true,
      forceNew: true,
      // A live auction must survive a service restart or a phone switching
      // networks: keep retrying (backing off to 5s) instead of giving up.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
    socketRef.current = socket

    // Counts failed connection attempts so the room can say "the live service
    // is unreachable" instead of spinning on "Connecting…" forever.
    socket.on('connect_error', () => setConnectFailures((n) => n + 1))
    socket.on('connect', () => {
      setConnectFailures(0)
      setConnected(true)
      doJoin()
    })
    socket.on('disconnect', () => {
      // Never replay a bid or organizer action after a reconnect: whatever was
      // waiting in the send buffer is dropped, and its ack resolves as unconfirmed.
      socket.sendBuffer = []
      joinedRef.current = false
      setConnected(false)
      setJoined(false)
    })

    // Broadcasts may omit the (large) player pool / participant list when
    // unchanged; merge into our copy, or re-join for a full snapshot on a gap.
    socket.on('room_state', (next: RoomStateWire) => {
      setClockOffset(next.serverTime - Date.now())
      setState((prev) => {
        const merged = mergeRoomState(prev, next)
        if (merged.needsResync) queueMicrotask(() => doJoin())
        return merged.state
      })
    })

    socket.on('timer', (t: { serverTime: number }) => {
      setClockOffset(t.serverTime - Date.now())
    })

    socket.on('notification', (n: RoomNotification) => {
      setNotifications((prev) => [n, ...prev].slice(0, 50))
      toastNotification(n)
    })

    socket.on('error', (e: { message: string }) => {
      if (e?.message) toast.error(e.message)
    })

    // The server re-checks organizer/manager seats while connected (blocked
    // account, password reset, lost ownership). Surface it as a join error so
    // the room page can re-seat or send the user back to the join card.
    socket.on('seat_revoked', (e: { message?: string }) => {
      joinedRef.current = false
      setJoined(false)
      setJoinError(e?.message || 'Your seat is no longer valid — log in again.')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
      setJoined(false)
      setState(null)
      setNotifications([])
    }
  }, [roomCode, token, doJoin, setClockOffset])

  /** Emits with an acknowledgement and a timeout; refuses (never buffers) while offline. */
  const emitWithAck = useCallback((event: string, data: unknown): Promise<ActionResult> => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !joinedRef.current) {
      return Promise.resolve({ ok: false, reason: 'offline' })
    }
    return new Promise<ActionResult>((resolve) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(event, data, (err: Error | null, res?: AckResponse) => {
        if (err) resolve({ ok: false, reason: 'timeout' })
        else if (res?.ok) resolve({ ok: true })
        else resolve({ ok: false, reason: 'rejected', error: res && !res.ok ? res.error : undefined })
      })
    })
  }, [])

  const placeBid = useCallback(
    (amount: number, playerId: string) => emitWithAck('place_bid', { amount, playerId }),
    [emitWithAck],
  )

  const organizerAction = useCallback(
    (action: OrganizerAction, payload?: Record<string, unknown>) => emitWithAck('organizer_action', { action, payload }),
    [emitWithAck],
  )

  const rejoin = useCallback(() => doJoin(), [doJoin])

  return { connected, joined, joinError, connectFailures, state, clockOffset, notifications, placeBid, organizerAction, rejoin }
}

/** Live countdown derived from server timerEndsAt corrected by clockOffset. */
export function useCountdown(timerEndsAt: number | null | undefined, clockOffset: number, active: boolean): number {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!active || !timerEndsAt) {
      const t = setTimeout(() => setRemaining(0), 0)
      return () => clearTimeout(t)
    }
    const compute = () => setRemaining(Math.max(0, timerEndsAt - (Date.now() + clockOffset)))
    const t0 = setTimeout(compute, 0)
    const id = setInterval(compute, 200)
    return () => {
      clearTimeout(t0)
      clearInterval(id)
    }
  }, [timerEndsAt, clockOffset, active])
  return active && timerEndsAt ? remaining : 0
}

/** Persisted room identity in sessionStorage (survives refresh within the tab). */
export interface StoredIdentity {
  role: 'ORGANIZER' | 'MANAGER' | 'VIEWER'
  name: string
  teamId?: string
  teamName?: string
  socketToken: string
  at: number
  /** Account the seat was issued to (null for an anonymous viewer). A seat is only reused by that account. */
  userId?: string | null
}

export function saveRoomIdentity(roomCode: string, identity: StoredIdentity) {
  try {
    sessionStorage.setItem(`ng_room_${roomCode.toUpperCase()}`, JSON.stringify(identity))
  } catch {
    // ignore
  }
}

export function loadRoomIdentity(roomCode: string): StoredIdentity | null {
  try {
    const raw = sessionStorage.getItem(`ng_room_${roomCode.toUpperCase()}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredIdentity
    // tokens last 12h; drop stale ones
    if (Date.now() - parsed.at > 10 * 60 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

export function clearRoomIdentity(roomCode: string) {
  try {
    sessionStorage.removeItem(`ng_room_${roomCode.toUpperCase()}`)
  } catch {
    // ignore
  }
}

/** Drops every saved room seat in this tab — on logout, so the next person can't bid with them. */
export function clearAllRoomIdentities() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('ng_room_')) sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
