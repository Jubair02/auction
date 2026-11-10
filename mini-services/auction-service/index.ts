// ============================================================
// NeelamGhor — live auction socket mini-service (port 3003)
// Event routing + token auth. The game logic lives in engine.ts.
//
// Run EXACTLY ONE instance. Room state, bid timers and the per-room lock
// live in this process's memory; a second instance would run its own
// clocks against the same rooms. A lease row in the database enforces it
// (lease.ts): an instance only starts listening once it holds the lease.
// Health check: GET /healthz.
// ============================================================
import './env' // MUST be first: loads DATABASE_URL / AUCTION_SECRET from the parent .env
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { explainTokenFailure, getAuctionSecret, secretFingerprint, verifyToken } from '../../src/lib/crypto'
import { createResilientClient } from '../../src/lib/db-resilience'
import { headerClientKey, rateLimit } from '../../src/lib/rate-limit'
import { reportError } from '../../src/lib/report-error'
import type { RoomState, SocketIdentity } from '../../src/lib/types'
import { AuctionEngine, ROOM_CLOSED, SocketGone } from './engine'
import { acquireLease, type Lease } from './lease'
import { startOutboxWorker } from './outbox'

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
// Per ROOM, viewers only: a reconnect storm (a stream link shared to
// thousands, or everyone reconnecting after a restart) is admitted at a
// steady pace instead of all at once. Seats (organizer/managers) are exempt.
const VIEWER_JOINS_PER_ROOM = { limit: 30, windowMs: 10_000 }
// Per viewer pass, checked BEFORE the room budget is charged: one pass
// hammering join_room from many sockets can no longer use up the room's budget
// and lock every other viewer out.
const VIEWER_JOINS_PER_PASS = { limit: 6, windowMs: 60_000 }
// One viewer pass (one REST join) may be open in a few tabs, not hundreds.
const MAX_SOCKETS_PER_VIEWER_PASS = 5

/**
 * Prisma's default pool is (CPUs × 2 + 1) connections — 3 on a small instance —
 * shared by every room's bids, joins and timers. Use an explicit size unless
 * the URL already sets one (Neon's pooler multiplexes these, so 10 is cheap).
 */
function withPoolSize(size: number): { datasourceUrl?: string } {
  const raw = process.env.DATABASE_URL
  if (!raw) return {}
  try {
    const url = new URL(raw)
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', String(size))
    return { datasourceUrl: url.toString() }
  } catch {
    return {}
  }
}
const POOL_SIZE = Number(process.env.AUCTION_DB_POOL_SIZE) || 10

// Retries transient connection failures on reads; 20 s transaction budget.
const db = createResilientClient(withPoolSize(POOL_SIZE))
// The SMS outbox, the retention sweep and the engine lease get their own small
// pool, so background work never makes a bid wait for a connection.
const backgroundDb = createResilientClient(withPoolSize(2))
// Delivers queued SMS (Notification outbox) and runs the hourly data-retention sweep.
const stopOutbox = startOutboxWorker(backgroundDb)

/** Set once shutdown starts: no new connections, joins, bids or actions. */
let shuttingDown = false
const RESTARTING = 'The auction service is restarting — try again in a moment'
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/', // DO NOT change — Caddy gateway requires this exact path
  // Cross-origin long-polling (the WebSocket fallback) needs CORS headers.
  ...(ALLOWED_ORIGINS.length > 0 ? { cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] } } : {}),
  allowRequest: (req, callback) => callback(null, originAllowed(req.headers.origin, req.headers.host)),
  maxHttpBufferSize: 16 * 1024, // every client message is a tiny JSON object
  // A phone that silently loses Wi-Fi is noticed within ~30 s (was up to 85 s),
  // so the room's seatless hold and auto-pause start promptly.
  pingTimeout: 20000,
  pingInterval: 10000,
})
const engine = new AuctionEngine(io, db)

// ---------- GET /healthz ----------
// Engine.IO is mounted on path "/", so it claims EVERY plain HTTP request it
// sees. Take its request listener(s) back out and put a router in front that
// answers /healthz itself and hands everything else to Engine.IO unchanged
// (WebSocket upgrades use the separate 'upgrade' event and are untouched).
const startedAt = Date.now()
const HEALTH_DB_TIMEOUT_MS = 2_000

async function dbReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      db.$queryRaw`SELECT 1`.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), HEALTH_DB_TIMEOUT_MS)
      }),
    ])
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function healthz(res: ServerResponse): Promise<void> {
  const ok = await dbReachable()
  const body = { ok, uptimeSec: Math.round((Date.now() - startedAt) / 1000), rooms: engine.roomCount, ...(ok ? {} : { error: 'database unreachable' }) }
  res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

const engineIoListeners = httpServer.listeners('request') as ((req: IncomingMessage, res: ServerResponse) => void)[]
httpServer.removeAllListeners('request')
httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  const pathname = (req.url ?? '').split('?')[0]
  if (pathname === '/healthz' && (req.method === 'GET' || req.method === 'HEAD')) {
    void healthz(res).catch(() => {
      if (!res.headersSent) res.writeHead(503)
      res.end()
    })
    return
  }
  for (const listener of engineIoListeners) listener.call(httpServer, req, res)
})

const emitError = (socket: Socket, message: string) => socket.emit('error', { message })

/** Ack shape for place_bid / organizer_action (newer clients pass one; old clients don't). */
type ActionAck = (res: { ok: true } | { ok: false; error: string }) => void

/**
 * Reports an outcome: through the ack when the client sent one, otherwise as
 * before (an 'error' event on failure, nothing on success).
 */
function reply(socket: Socket, ack: ActionAck | undefined, error: string | null): void {
  if (ack) ack(error ? { ok: false, error } : { ok: true })
  else if (error) emitError(socket, error)
}

/** Socket.IO passes the ack as the last argument; tolerate a missing payload. */
function splitArgs<T>(data: unknown, ack: unknown): { data: T | undefined; ack: ActionAck | undefined } {
  if (typeof data === 'function') return { data: undefined, ack: data as ActionAck }
  return { data: (data ?? undefined) as T | undefined, ack: typeof ack === 'function' ? (ack as ActionAck) : undefined }
}

/** Seconds to wait when this socket has exceeded its budget for the event, else null. */
function throttled(socket: Socket, scope: keyof typeof LIMITS): number | null {
  const { limit, windowMs } = LIMITS[scope]
  return rateLimit(`${scope}:${socket.id}`, limit, windowMs)
}

// ---------- room lookup cache ----------
// Every join used to read the auction row by room code. Codes never change
// for an auction, so a short cache spares the database during join storms.
const ROOM_CACHE_MS = 30_000
const roomCache = new Map<string, { id: string; tournamentId: string; at: number }>()

async function findRoom(roomCode: string): Promise<{ id: string; tournamentId: string } | null> {
  const hit = roomCache.get(roomCode)
  if (hit && Date.now() - hit.at < ROOM_CACHE_MS) return hit
  const found = await db.auction.findUnique({
    where: { roomCode },
    select: { id: true, tournamentId: true, tournament: { select: { archivedAt: true } } },
  })
  // A deleted (archived) tournament's room is gone, as on the website.
  if (!found || found.tournament.archivedAt) {
    roomCache.delete(roomCode)
    return null
  }
  const auction = { id: found.id, tournamentId: found.tournamentId }
  if (roomCache.size > 1000) roomCache.clear()
  roomCache.set(roomCode, { ...auction, at: Date.now() })
  return auction
}

// ---------- viewer pass fan-out ----------
const viewerPassSockets = new Map<string, Set<string>>()
const passKeyOf = (token: string) => token.slice(token.lastIndexOf('.') + 1)

function releaseViewerPass(socket: Socket): void {
  const key = socket.data.viewerPass as string | undefined
  if (!key) return
  socket.data.viewerPass = undefined
  const set = viewerPassSockets.get(key)
  set?.delete(socket.id)
  if (set && set.size === 0) viewerPassSockets.delete(key)
}

// ---------- seat re-validation ----------
// Seat passes live for hours, so the account behind an organizer or manager
// seat is re-checked on join and — at most every SEAT_RECHECK_MS — before each
// bid and organizer action. A blocked account, a password reset (sessionVersion
// bump) or an organizer who no longer owns the tournament is cut off within
// seconds, even on a connection that was already open.
const SEAT_RECHECK_MS = 5_000
// Contains "pass": the room page treats that as a stale seat and re-seats a
// still-valid organizer automatically, or sends others back to the join card.
const SEAT_REVOKED = 'Your seat pass is no longer valid — log in again to rejoin.'

/** Seat passes issued after login sessions carry the session id (`sid`). */
type SeatIdentity = SocketIdentity & { sid?: string }

// A manager seat that no longer belongs to this account (the organizer reassigned
// or removed the team's manager): back to the join card, not an automatic re-seat.
const MANAGER_SEAT_GONE = "This seat is no longer valid — log in as the team's manager and join again."

async function seatRevokedReason(identity: SeatIdentity, tournamentId: string): Promise<string | null> {
  if (identity.role !== 'MANAGER' && identity.role !== 'ORGANIZER') return null
  if (identity.role === 'MANAGER' && (!identity.userId || !identity.teamId)) return MANAGER_SEAT_GONE
  const [user, session, team, room] = await Promise.all([
    identity.userId
      ? db.user.findUnique({ where: { id: identity.userId }, select: { role: true, status: true, sessionVersion: true } })
      : null,
    // The login session the pass was issued under: logging out on that device
    // (or the session expiring) ends the seat too. Older passes carry no sid
    // and keep the previous behaviour.
    identity.sid
      ? db.session.findUnique({ where: { id: identity.sid }, select: { userId: true, revokedAt: true, expiresAt: true } })
      : null,
    // A bidding seat belongs to the team's CURRENT manager. Re-checked here (not
    // only on join) so a manager the organizer replaces mid-lot stops bidding
    // within SEAT_RECHECK_MS instead of at the next player.
    identity.role === 'MANAGER' && identity.teamId
      ? db.team.findUnique({ where: { id: identity.teamId }, select: { tournamentId: true, managerUserId: true } })
      : null,
    // Deleting a tournament with auction history archives it: its seats end too.
    db.tournament.findUnique({ where: { id: tournamentId }, select: { archivedAt: true } }),
  ])
  if (identity.role === 'MANAGER' && (!team || team.tournamentId !== tournamentId || team.managerUserId !== identity.userId)) {
    return MANAGER_SEAT_GONE
  }
  if (!user || user.status !== 'ACTIVE') return SEAT_REVOKED
  // Passes issued before session versions carry none and count as 0.
  if ((identity.sv ?? 0) !== user.sessionVersion) return SEAT_REVOKED
  if (identity.sid) {
    if (!session || session.userId !== identity.userId || session.revokedAt || session.expiresAt <= new Date()) {
      return SEAT_REVOKED
    }
  }
  if (!room || room.archivedAt) return ROOM_CLOSED
  // The organizer seat belongs to the owner, an ADMIN, or tournament staff
  // (co-organizer or auctioneer) — removing someone from the staff ends it.
  if (identity.role === 'ORGANIZER' && user.role !== 'ADMIN') {
    // (Prisma treats an undefined filter as "match anything" — never let one through.)
    if (!identity.userId) return SEAT_REVOKED
    const tournament = await db.tournament.findFirst({
      where: {
        id: tournamentId,
        OR: [{ organizerId: identity.userId }, { staff: { some: { userId: identity.userId } } }],
      },
      select: { id: true },
    })
    if (!tournament) return SEAT_REVOKED
  }
  return null
}

/**
 * The reason, when the seat is no longer valid. The socket is unseated (no
 * more actions, no more room broadcasts) and told via `seat_revoked`; the
 * client shows it as a join error, which re-seats a still-valid organizer or
 * returns others to the join card. (Not a server-side disconnect: socket.io
 * clients deliberately don't reconnect after one, leaving "Connecting…" forever.)
 */
async function seatRevoked(socket: Socket, identity: SeatIdentity): Promise<string | null> {
  const checkedAt = (socket.data.seatCheckedAt as number | undefined) ?? 0
  if (Date.now() - checkedAt < SEAT_RECHECK_MS) return null
  const reason = await seatRevokedReason(identity, socket.data.tournamentId as string)
  if (!reason) {
    socket.data.seatCheckedAt = Date.now()
    return null
  }
  socket.data.identity = undefined
  socket.leave(`auction:${identity.auctionId}`)
  await engine.leave(socket)
  socket.emit('seat_revoked', { message: reason })
  return reason
}

io.use((socket, next) => {
  if (shuttingDown) return next(new Error(RESTARTING))
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
      if (shuttingDown) return ack?.({ ok: false, error: RESTARTING })
      if (throttled(socket, 'join') !== null) return ack?.({ ok: false, error: 'Too many join attempts — wait a moment and retry' })
      const roomCode = String(data?.roomCode ?? '').trim().toUpperCase()
      const token = String(data?.token ?? '')
      if (!roomCode || !token) return ack?.({ ok: false, error: 'roomCode and token are required' })

      const identity = verifyToken<SeatIdentity>(token)
      if (!identity || !identity.auctionId) {
        const reason = explainTokenFailure(token)
        console.warn(`[auction-service] join rejected for ${roomCode}: ${reason}`)
        return ack?.({ ok: false, error: reason })
      }

      let passKey: string | undefined
      if (identity.role === 'VIEWER') {
        // Per-pass checks first: they cost the room nothing, so one pass can't
        // spend the shared budget below on joins that were going to be refused.
        passKey = passKeyOf(token)
        const open = viewerPassSockets.get(passKey)
        if (open && !open.has(socket.id) && open.size >= MAX_SOCKETS_PER_VIEWER_PASS) {
          return ack?.({ ok: false, error: 'This viewer pass is open in too many tabs — close one and try again' })
        }
        const passWait = rateLimit(`viewer-pass-join:${passKey}`, VIEWER_JOINS_PER_PASS.limit, VIEWER_JOINS_PER_PASS.windowMs)
        if (passWait !== null) return ack?.({ ok: false, error: `Too many join attempts — try again in ${passWait}s` })
        // Keyed by the signed auction id, so a made-up room code can't drain another room's budget.
        const { limit, windowMs } = VIEWER_JOINS_PER_ROOM
        const wait = rateLimit(`viewer-join:${identity.auctionId}`, limit, windowMs)
        if (wait !== null) {
          return ack?.({ ok: false, error: `Lots of people are joining right now — try again in ${wait}s` })
        }
      }

      const auction = await findRoom(roomCode)
      if (!auction) return ack?.({ ok: false, error: 'Room not found' })
      if (identity.auctionId !== auction.id) return ack?.({ ok: false, error: 'Token is not valid for this room' })

      // Seats are re-checked against the DB: the account (blocked? signed out?),
      // and for managers that they still manage this team — a seat the
      // organizer reassigned (or a token issued before the login requirement)
      // cannot keep bidding.
      const revoked = await seatRevokedReason(identity, auction.tournamentId)
      if (revoked) return ack?.({ ok: false, error: revoked })

      const state = await engine.joinRoom(socket, identity, auction.id)
      socket.data.identity = identity
      socket.data.tournamentId = auction.tournamentId
      socket.data.seatCheckedAt = Date.now()
      if (socket.data.viewerPass !== passKey) {
        releaseViewerPass(socket)
        if (passKey) {
          let set = viewerPassSockets.get(passKey)
          if (!set) viewerPassSockets.set(passKey, (set = new Set()))
          set.add(socket.id)
          socket.data.viewerPass = passKey
        }
      }
      return ack?.({ ok: true, state })
    } catch (err) {
      // The client dropped mid-join: nobody is listening for the answer.
      if (err instanceof SocketGone) return
      void reportError(err, { source: 'auction-service', where: 'join_room', roomCode: data?.roomCode })
      return ack?.({ ok: false, error: 'Join failed' })
    }
  })

  // place_bid { amount, playerId? } [, ack]. Newer clients pass playerId (the
  // player they saw on the block) and an ack: every refusal comes back through
  // it, and { ok: true } once the bid is saved. Old clients get 'error' events.
  socket.on('place_bid', async (rawData: unknown, rawAck?: unknown) => {
    // Before anything that can wait: a bid's lateness is judged by arrival.
    const receivedAt = Date.now()
    const { data, ack } = splitArgs<{ amount?: unknown; playerId?: unknown }>(rawData, rawAck)
    let done: (() => void) | undefined
    try {
      if (shuttingDown) return reply(socket, ack, RESTARTING)
      const identity = socket.data.identity as SeatIdentity | undefined
      if (!identity) return reply(socket, ack, 'Join the room first')
      if (identity.role !== 'MANAGER') return reply(socket, ack, 'Only team managers can bid')
      const wait = throttled(socket, 'bid')
      if (wait !== null) return reply(socket, ack, ack ? 'Too many bids — slow down' : `Slow down — try again in ${wait}s`)
      // From here the bid may wait (seat re-check, room lock): the lot must not
      // close under a bid that arrived before its deadline.
      done = engine.bidArrived(identity.auctionId, receivedAt)
      const revoked = await seatRevoked(socket, identity)
      if (revoked) return ack?.({ ok: false, error: revoked }) // old clients: the seat_revoked event says it
      const error = await engine.placeBid(identity, data?.amount, { playerId: data?.playerId, receivedAt })
      reply(socket, ack, error)
    } catch (err) {
      void reportError(err, { source: 'auction-service', where: 'place_bid' })
      reply(socket, ack, 'Bid failed — try again')
    } finally {
      done?.()
    }
  })

  // organizer_action { action, payload } [, ack] — same ack contract as place_bid.
  socket.on('organizer_action', async (rawData: unknown, rawAck?: unknown) => {
    const { data, ack } = splitArgs<{ action?: string; payload?: Record<string, unknown> }>(rawData, rawAck)
    try {
      if (shuttingDown) return reply(socket, ack, RESTARTING)
      const identity = socket.data.identity as SeatIdentity | undefined
      if (!identity) return reply(socket, ack, 'Join the room first')
      if (identity.role !== 'ORGANIZER') return reply(socket, ack, 'Only the organizer can perform this action')
      const wait = throttled(socket, 'action')
      if (wait !== null) return reply(socket, ack, `Slow down — try again in ${wait}s`)
      const revoked = await seatRevoked(socket, identity)
      if (revoked) return ack?.({ ok: false, error: revoked })
      const payload = data?.payload && typeof data.payload === 'object' ? data.payload : undefined
      const error = await engine.organizerAction(identity, data?.action, payload)
      reply(socket, ack, error)
    } catch (err) {
      void reportError(err, { source: 'auction-service', where: 'organizer_action', action: data?.action })
      reply(socket, ack, 'Action failed — try again')
    }
  })

  socket.on('disconnect', () => {
    releaseViewerPass(socket)
    void engine.leave(socket)
  })
})

// Hosts like Render assign the port via PORT; locally it stays 3003.
const PORT = Number(process.env.PORT) || 3003

// Single-instance guard: hold the engine lease BEFORE listening. While another
// instance holds it this one serves nothing — clients keep retrying against
// the live instance, and a zero-downtime deploy (which this service must not
// use) fails its health check instead of running two auctioneers at once.
let lease: Lease | null = null
lease = await acquireLease(backgroundDb, (holder) => {
  void reportError(new Error(`Engine lease taken over by ${holder ?? 'another instance'} — stopping this instance`), {
    source: 'auction-service',
    where: 'lease',
  })
  void shutdown('LEASE_LOST', 1)
})

httpServer.listen(PORT, () => {
  console.log(`[auction-service] live auction engine listening on port ${PORT} (path "/", health check GET /healthz)`)
  console.log(
    '[auction-service] NOTE: run exactly ONE instance of this service — rooms, bid timers and locks live in this ' +
      'process\'s memory. Do not scale it out or run a second copy against the same database.',
  )
  // In production the website (e.g. on Vercel) is on another origin; without
  // ALLOWED_ORIGINS every browser connection is refused and rooms never join.
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS?.trim()) {
    console.warn(
      '[auction-service] WARNING: ALLOWED_ORIGINS is not set. Browsers on your website\'s domain will be refused ' +
        '(only same-origin gateway setups work). Set ALLOWED_ORIGINS="https://your-site.example". See DEPLOY.md.',
    )
  } else if (ALLOWED_ORIGINS.length > 0) {
    console.log(`[auction-service] allowed browser origins: ${ALLOWED_ORIGINS.join(', ')}`)
  }
  // Must equal the "secret" value from the website's /api/health.
  console.log(`[auction-service] AUCTION_SECRET fingerprint: ${secretFingerprint()}`)
})

// ---------- graceful shutdown ----------
// Refuse new work, let every bid / action / timer step already running finish
// (so a committed sale also reaches the clients), then close sockets, release
// the lease (the next instance can start at once) and exit.
const DRAIN_TIMEOUT_MS = 8_000
const HARD_EXIT_MS = 15_000

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[auction-service] ${signal} — shutting down: draining room work…`)
  setTimeout(() => process.exit(exitCode || 1), HARD_EXIT_MS).unref()
  httpServer.close() // stop accepting new connections
  try {
    await engine.shutdown(DRAIN_TIMEOUT_MS)
  } catch (err) {
    console.error('[auction-service] drain failed:', (err as Error).message)
  }
  stopOutbox()
  io.close()
  await lease?.release()
  await Promise.all([db.$disconnect().catch(() => undefined), backgroundDb.$disconnect().catch(() => undefined)])
  console.log('[auction-service] stopped')
  process.exit(exitCode)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

// ---------- crash guards ----------
// A stray rejected promise is logged and alerted, not fatal: room state is
// written to the database before memory, so carrying on is safe. A thrown
// exception may have left memory half-updated, so stop cleanly instead — the
// host restarts the service and rooms rebuild from the database.
process.on('unhandledRejection', (reason) => {
  void reportError(reason, { source: 'auction-service', where: 'unhandledRejection' })
})
process.on('uncaughtException', (err) => {
  void reportError(err, { source: 'auction-service', where: 'uncaughtException' }).finally(() => void shutdown('uncaughtException', 1))
})
