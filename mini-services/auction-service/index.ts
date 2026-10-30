// ============================================================
// NeelamGhor — live auction socket mini-service (port 3003)
// Event routing + token auth. The game logic lives in engine.ts.
// ============================================================
import './env' // MUST be first: loads DATABASE_URL / AUCTION_SECRET from the parent .env
import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { getAuctionSecret, verifyToken } from '../../src/lib/crypto'
import { createResilientClient } from '../../src/lib/db-resilience'
import { headerClientKey, rateLimit } from '../../src/lib/rate-limit'
import type { RoomState, SocketIdentity } from '../../src/lib/types'
import { AuctionEngine } from './engine'

// Fail fast: without the shared secret no token can be verified.
try {
  getAuctionSecret()
} catch (err) {
  console.error(`[auction-service] ${(err as Error).message}`)
  process.exit(1)
}

// Behind the gateway the web app reaches this service on its own origin, so
// same-origin needs no configuration. ALLOWED_ORIGINS (comma-separated, e.g.
// "https://neelamghor.com,https://www.neelamghor.com") admits extra origins.
// Outside production, a page served by Next directly on :3000 talks to :3003
// cross-origin, so those local origins are allowed too.
const DEV_ORIGINS = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']
const ALLOWED_ORIGINS = [
  ...DEV_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
]

/**
 * Browsers do not apply CORS to WebSockets, so the Origin is checked here for
 * every transport. Requests without an Origin are non-browser clients (smoke
 * test, tooling) — they still need a signed token to join anything.
 */
function originAllowed(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    return !!host && new URL(origin).host === host
  } catch {
    return false
  }
}

// Abuse limits. Connections are per IP and generous (many viewers can share a
// carrier-NAT address); events are per socket — no human bids faster than this.
const LIMITS = {
  connect: { limit: 60, windowMs: 60_000 },
  join: { limit: 10, windowMs: 60_000 },
  bid: { limit: 10, windowMs: 5_000 },
  action: { limit: 30, windowMs: 10_000 },
}

// Retries transient connection failures on reads; 20 s transaction budget.
const db = createResilientClient()
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/', // DO NOT change — Caddy gateway requires this exact path
  // Cross-origin long-polling (the WebSocket fallback) needs CORS headers.
  ...(ALLOWED_ORIGINS.length > 0 ? { cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] } } : {}),
  allowRequest: (req, callback) => callback(null, originAllowed(req.headers.origin, req.headers.host)),
  maxHttpBufferSize: 16 * 1024, // every client message is a tiny JSON object
  pingTimeout: 60000,
  pingInterval: 25000,
})
const engine = new AuctionEngine(io, db)

const emitError = (socket: Socket, message: string) => socket.emit('error', { message })

/** True when this socket has exceeded its budget for the event (and says so). */
function throttled(socket: Socket, scope: keyof typeof LIMITS): boolean {
  const { limit, windowMs } = LIMITS[scope]
  const retryAfter = rateLimit(`${scope}:${socket.id}`, limit, windowMs)
  if (retryAfter === null) return false
  emitError(socket, `Slow down — try again in ${retryAfter}s`)
  return true
}

io.use((socket, next) => {
  const { limit, windowMs } = LIMITS.connect
  const key = headerClientKey((name) => socket.handshake.headers[name], 'socket-connect', socket.handshake.address)
  if (rateLimit(key, limit, windowMs) !== null) return next(new Error('Too many connections — try again shortly'))
  next()
})

interface JoinAck {
  ok: boolean
  error?: string
  state?: RoomState
}

io.on('connection', (socket) => {
  socket.on('join_room', async (data: { roomCode?: string; token?: string }, ack?: (res: JoinAck) => void) => {
    try {
      if (throttled(socket, 'join')) return ack?.({ ok: false, error: 'Too many join attempts — wait a moment and retry' })
      const roomCode = String(data?.roomCode ?? '').trim().toUpperCase()
      const token = String(data?.token ?? '')
      if (!roomCode || !token) return ack?.({ ok: false, error: 'roomCode and token are required' })

      const identity = verifyToken<SocketIdentity>(token)
      if (!identity || !identity.auctionId) return ack?.({ ok: false, error: 'Invalid or expired token' })

      const auction = await db.auction.findUnique({ where: { roomCode } })
      if (!auction) return ack?.({ ok: false, error: 'Room not found' })
      if (identity.auctionId !== auction.id) return ack?.({ ok: false, error: 'Token is not valid for this room' })

      // A bidding seat belongs to the team's manager account — re-check against
      // the DB so a seat the organizer reassigned (or a token issued before the
      // login requirement) cannot keep bidding.
      if (identity.role === 'MANAGER') {
        const team = identity.teamId
          ? await db.team.findUnique({ where: { id: identity.teamId }, select: { tournamentId: true, managerUserId: true } })
          : null
        if (
          !identity.userId ||
          !team ||
          team.tournamentId !== auction.tournamentId ||
          team.managerUserId !== identity.userId
        ) {
          return ack?.({ ok: false, error: "This seat is no longer valid — log in as the team's manager and join again." })
        }
      }

      // Socket tokens live for hours; re-check the account behind a privileged
      // seat so a blocked user or a former organizer is cut off on (re)join.
      if (identity.role === 'MANAGER' || identity.role === 'ORGANIZER') {
        const user = identity.userId
          ? await db.user.findUnique({ where: { id: identity.userId }, select: { role: true, status: true } })
          : null
        const tournament =
          identity.role === 'ORGANIZER'
            ? await db.tournament.findUnique({ where: { id: auction.tournamentId }, select: { organizerId: true } })
            : null
        const allowed =
          !!user &&
          user.status === 'ACTIVE' &&
          (identity.role === 'MANAGER' || user.role === 'ADMIN' || tournament?.organizerId === identity.userId)
        if (!allowed) return ack?.({ ok: false, error: 'Your access to this seat has been revoked — log in again.' })
      }

      const state = await engine.joinRoom(socket, identity, auction.id)
      socket.data.identity = identity
      return ack?.({ ok: true, state })
    } catch (err) {
      console.error('[auction-service] join_room failed:', err)
      return ack?.({ ok: false, error: 'Join failed' })
    }
  })

  socket.on('place_bid', async (data: { amount?: unknown }) => {
    try {
      const identity = socket.data.identity as SocketIdentity | undefined
      if (!identity) return emitError(socket, 'Join the room first')
      if (identity.role !== 'MANAGER') return emitError(socket, 'Only team managers can bid')
      if (throttled(socket, 'bid')) return
      await engine.placeBid(socket, identity, data?.amount)
    } catch (err) {
      console.error('[auction-service] place_bid failed:', err)
      emitError(socket, 'Bid failed — try again')
    }
  })

  socket.on('organizer_action', async (data: { action?: string; payload?: Record<string, unknown> }) => {
    try {
      const identity = socket.data.identity as SocketIdentity | undefined
      if (!identity) return emitError(socket, 'Join the room first')
      if (identity.role !== 'ORGANIZER') return emitError(socket, 'Only the organizer can perform this action')
      if (throttled(socket, 'action')) return
      await engine.organizerAction(socket, identity, data?.action, data?.payload)
    } catch (err) {
      console.error('[auction-service] organizer_action failed:', err)
      emitError(socket, 'Action failed — try again')
    }
  })

  socket.on('disconnect', () => {
    void engine.leave(socket)
  })
})

// Hosts like Render assign the port via PORT; locally it stays 3003.
const PORT = Number(process.env.PORT) || 3003
httpServer.listen(PORT, () => {
  console.log(`[auction-service] live auction engine listening on port ${PORT} (path "/")`)
})

// Graceful shutdown
let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[auction-service] ${signal} received — shutting down…`)
  engine.dispose()
  io.close()
  httpServer.close()
  await db.$disconnect().catch(() => undefined)
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
