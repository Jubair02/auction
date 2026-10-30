'use client'

// Live auction socket hook — connects to the auction mini-service (port 3003)
// through the gateway using the mandatory `io('/?XTransformPort=3003')` pattern.
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { mergeRoomState } from '@/lib/room-state'
import type { OrganizerAction, RoomNotification, RoomState, RoomStateWire } from '@/lib/types'

export interface AuctionSocketApi {
  connected: boolean
  joined: boolean
  joinError: string | null
  state: RoomState | null
  /** serverTime - clientTime at last snapshot, to correct countdowns */
  clockOffset: number
  notifications: RoomNotification[]
  placeBid: (amount: number) => void
  organizerAction: (action: OrganizerAction, payload?: Record<string, unknown>) => void
  rejoin: () => void
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
  const [state, setState] = useState<RoomState | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const [notifications, setNotifications] = useState<RoomNotification[]>([])

  const doJoin = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !tokenRef.current) return
    socket.emit('join_room', { roomCode, token: tokenRef.current }, (ack: { ok: boolean; error?: string; state?: RoomState }) => {
      if (ack?.ok && ack.state) {
        setJoined(true)
        setJoinError(null)
        setState(ack.state)
        setClockOffset(ack.state.serverTime - Date.now())
      } else {
        setJoined(false)
        setJoinError(ack?.error || 'Failed to join room')
      }
    })
  }, [roomCode])

  useEffect(() => {
    if (!token) return
    const socket = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      doJoin()
    })
    socket.on('disconnect', () => {
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
      if (n.level === 'error') toast.error(n.message)
      else if (n.level === 'warning') toast.warning(n.message)
      else if (n.level === 'success') toast.success(n.message)
      else toast(n.message)
    })

    socket.on('error', (e: { message: string }) => {
      if (e?.message) toast.error(e.message)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
      setJoined(false)
      setState(null)
      setNotifications([])
    }
  }, [roomCode, token, doJoin])

  const placeBid = useCallback((amount: number) => {
    socketRef.current?.emit('place_bid', { amount })
  }, [])

  const organizerAction = useCallback((action: OrganizerAction, payload?: Record<string, unknown>) => {
    socketRef.current?.emit('organizer_action', { action, payload })
  }, [])

  const rejoin = useCallback(() => doJoin(), [doJoin])

  return { connected, joined, joinError, state, clockOffset, notifications, placeBid, organizerAction, rejoin }
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
