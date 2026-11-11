// ============================================================
// NeelamGhor — AuctionEngine (live auction state machine)
// One in-memory Room per auctionId; authoritative for timers, bids,
// stage transitions (GOING ONCE/TWICE) and presence. Every transition
// is persisted to Postgres via Prisma (database first, memory second).
// Rooms are rebuilt from the DB on first touch after a service restart,
// and self-heal on join if the DB state diverges from memory (e.g.
// external reset).
//
// SINGLE INSTANCE ONLY: timers, the per-room lock and the room state live
// in this process's memory. Two instances would each run their own clock
// and lock. Compare-and-swaps on the DB stop them from double-selling or
// selling to a lower bidder, but bids would still race. Run exactly one.
// ============================================================
import { createHash, randomInt, randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import type {
  Auction,
  Tournament,
  Team,
  Player,
  RoomParticipant,
} from '@prisma/client'
import type { RoomNotification, RoomState, RoomStateWire, RoomRole, SocketIdentity } from '../../src/lib/types'
// Explicit .ts extensions so `node --test` (type stripping) can load this file
// too (engine.test.ts); Bun and tsc (allowImportingTsExtensions) accept both.
import { BOUNDED_TX_SQL, type ResilientClient } from '../../src/lib/db-resilience.ts'
import { maxBidFor, validateBid } from './rules.ts'
import { queuePlayerSoldSms, trackServiceEvent } from './outbox.ts'
import { reportError } from '../../src/lib/report-error.ts'
import { roomText, type RoomMsg } from '../../src/lib/room-messages.ts'

/** Engine failures worth an alert (logged as JSON; posted to ALERT_WEBHOOK_URL when set). */
const alert = (where: string, err: unknown, extra: Record<string, unknown> = {}) =>
  void reportError(err, { source: 'auction-service', where, ...extra })

type EngineStatus = 'READY' | 'LIVE' | 'PAUSED' | 'ENDED'
type NotifLevel = RoomNotification['level']
type NotifKind = NonNullable<RoomNotification['kind']>
/** What an action resolves to: a refusal message, or nothing on success. */
type Outcome = string | void

/** Who triggered a money- or ownership-moving event. Null actor = the timer. */
interface Actor {
  id?: string | null
  name?: string | null
}

/** Append-only audit trail entry. */
type AuditType = 'SALE' | 'RE_AUCTION' | 'REFUND' | 'UNSOLD' | 'SKIPPED'

/** Thrown when a re-auction loses the compare-and-swap race. */
class SaleAlreadyChanged extends Error {}
/** Thrown inside finalizeSold's transaction to roll back a half-applied sale. */
class LotAlreadyChanged extends Error {}
/** Thrown by persistBid when the database's auction row no longer matches memory. */
class BidOutOfDate extends Error {}
/** Thrown by joinRoom when the socket disconnected while the join was in flight. */
export class SocketGone extends Error {}

/**
 * Organizer actions an AUCTIONEER may not take: re-auctioning a sold player
 * refunds the team, and reopening undoes a finalized auction.
 */
export const CO_ORGANIZER_ACTIONS: ReadonlySet<string> = new Set(['reauction', 'reopen'])

/** Refusal for a room whose tournament was deleted (archived). Also used by index.ts. */
export const ROOM_CLOSED = 'This auction room has been closed.'

const CATEGORY_CODES = ['A', 'B', 'C', 'D', 'E']
/** Pause between a SOLD/UNSOLD call and the auto-picked next player, so everyone sees the result. */
const AUTO_ADVANCE_DELAY_MS = 4000
const BID_TIMER_RANGE = { min: 5, max: 600 }
/** A join re-checks the room against the database (self-heal) at most this often. */
const SYNC_INTERVAL_MS = 5_000
/** A room nobody is connected to is dropped from memory after this long (rebuilt from the DB on the next join). */
const EMPTY_ROOM_TTL_MS = 30 * 60_000
const EVICT_SWEEP_MS = 60_000
/**
 * A bid that arrived before the final call ran out can still be on its way to
 * the room lock (seat re-check, a DB round trip). The lot waits for it — at
 * most this long past the deadline — instead of closing under it.
 */
const CLOSE_GRACE_MS = 3_000
/**
 * A LIVE auction with no organizer and no team manager connected (venue Wi-Fi
 * down, the organizer's phone died) pauses itself after this long, so lots
 * don't close and Auto Auction doesn't run through the pool with nobody there.
 */
const NO_SEATS_PAUSE_MS = 30_000

interface BidView {
  amount: number
  teamId: string
  teamName: string
  teamColor: string | null
}

interface HistoryEntry {
  teamId: string
  teamName: string
  amount: number
  createdAt: string
}

type TeamCache = Team & { squadCount: number }

interface SocketPresence {
  role: RoomRole
  name: string
  teamId?: string
}

interface Room {
  auctionId: string
  roomCode: string
  status: EngineStatus
  currentCategory: string | null
  currentPlayerId: string | null
  currentBid: BidView | null
  currentBidHistory: HistoryEntry[]
  /** Team that lost the player on the block in a re-auction; null on a first outing. */
  previousOwnerTeamId: string | null
  /** Auction policy: may that previous owner bid again in this cycle? */
  allowPreviousOwnerRebid: boolean
  stage: 0 | 1 | 2
  timerEndsAt: number | null
  pausedRemainingMs: number | null
  lastResult: RoomState['lastResult']
  soldFeed: RoomState['soldFeed']
  /** Configured bidding duration; locked into sessionTimerSeconds when a player goes on the block. */
  bidTimerSeconds: number
  /** Duration of the CURRENT player's session — bids reset the timer to this. */
  sessionTimerSeconds: number
  goingIntervalSeconds: number
  minIncrement: number
  /** Auto Auction: bring the next player up by itself after a lot closes. */
  autoAdvance: boolean
  /** When Auto Auction will pick the next player (epoch ms); the single source of truth for the pick. */
  nextPlayerAt: number | null
  /** 1 = main auction; each "Re-Auction Unsold & Skipped Players" starts the next round. */
  round: number
  auction: Auction
  tournament: Tournament
  teams: TeamCache[]
  players: Player[]
  participants: RoomParticipant[]
  sockets: Map<string, SocketPresence>
  ticking: boolean
  presenceTimer: ReturnType<typeof setTimeout> | null
  /** Fingerprints of the pool / participant list in the last broadcast (delta sends). */
  lastPlayersHash: string | null
  lastParticipantsHash: string | null
  /** When a join last compared this room with the database (epoch ms). */
  lastSyncAt: number
  /** Since when no socket has been connected (epoch ms); null while someone is. */
  emptySince: number | null
  /** Since when no organizer or manager socket has been connected while LIVE (epoch ms). */
  seatlessSince: number | null
  /**
   * The lot whose final deadline passed and is being closed (the close may be
   * retried after a DB error). Bids received after `deadline` are refused even
   * though a retry moves timerEndsAt forward.
   */
  closing: { playerId: string; deadline: number } | null
}

/** Short content fingerprint used to skip re-sending unchanged lists. */
const fingerprint = (value: unknown) => createHash('sha1').update(JSON.stringify(value)).digest('base64url').slice(0, 16)

export class AuctionEngine {
  private rooms = new Map<string, Room>()
  private building = new Map<string, Promise<Room>>()
  private socketRooms = new Map<string, { auctionId: string; identity: SocketIdentity }>()
  private locks = new Map<string, Promise<unknown>>()
  /** Arrival times of bids still being processed, per auction (see CLOSE_GRACE_MS). */
  private inFlightBids = new Map<string, Set<{ at: number }>>()
  private ticker: ReturnType<typeof setInterval>
  private timerEmitter: ReturnType<typeof setInterval>
  private evictor: ReturnType<typeof setInterval>
  // Plain fields, not constructor parameter properties: node's type stripping
  // (used by `npm test`) cannot run parameter properties.
  private io: Server
  private db: ResilientClient

  constructor(io: Server, db: ResilientClient) {
    this.io = io
    this.db = db
    // Single global ticker: stage transitions + finalize (500ms resolution).
    this.ticker = setInterval(() => void this.tick(), 500)
    // 1s timer broadcast while LIVE + currentPlayer + not paused.
    this.timerEmitter = setInterval(() => this.emitTimers(), 1000)
    // Drop rooms nobody has been connected to for a while.
    this.evictor = setInterval(() => void this.evictIdleRooms(), EVICT_SWEEP_MS)
  }

  dispose(): void {
    clearInterval(this.ticker)
    clearInterval(this.timerEmitter)
    clearInterval(this.evictor)
  }

  /** Set by shutdown(): leaves stop writing presence one socket at a time. */
  private closing = false

  /**
   * Graceful stop: no new ticks, wait (up to `timeoutMs`) for every bid,
   * organizer action and timer step already holding or queued on a room lock
   * to finish — so a committed sale is also acknowledged — then mark everyone
   * offline in one write instead of one per disconnecting socket.
   */
  async shutdown(timeoutMs: number): Promise<void> {
    this.closing = true
    this.dispose()
    let timer: ReturnType<typeof setTimeout> | undefined
    const drained = await Promise.race([
      Promise.allSettled([...this.locks.values()]).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
    clearTimeout(timer)
    if (!drained) console.warn(`[engine] shutdown: room work still running after ${timeoutMs}ms — stopping anyway`)
    const auctionIds = [...this.rooms.keys()]
    if (auctionIds.length === 0) return
    try {
      await this.db.roomParticipant.updateMany({
        where: { auctionId: { in: auctionIds }, online: true },
        data: { online: false, lastSeen: new Date() },
      })
    } catch {
      // presence is best-effort
    }
  }

  /**
   * Call as soon as a bid event arrives — before the seat re-check or anything
   * else that can wait — and call the returned function once it is answered.
   * While it is pending, a lot whose deadline it beat will not close.
   */
  bidArrived(auctionId: string, receivedAt: number): () => void {
    let set = this.inFlightBids.get(auctionId)
    if (!set) this.inFlightBids.set(auctionId, (set = new Set()))
    const entry = { at: receivedAt }
    set.add(entry)
    return () => {
      const live = this.inFlightBids.get(auctionId)
      if (!live) return
      live.delete(entry)
      if (live.size === 0) this.inFlightBids.delete(auctionId)
    }
  }

  private bidInFlightBefore(auctionId: string, deadline: number): boolean {
    const set = this.inFlightBids.get(auctionId)
    if (!set) return false
    for (const e of set) if (e.at <= deadline) return true
    return false
  }

  /** Rooms currently held in memory (for /healthz). */
  get roomCount(): number {
    return this.rooms.size
  }

  // ----------------------------------------------------------
  // Presence / join / leave
  // ----------------------------------------------------------
  async joinRoom(socket: Socket, identity: SocketIdentity, auctionId: string): Promise<RoomState> {
    // If this socket previously joined another room, drop it from there.
    const prev = this.socketRooms.get(socket.id)
    if (prev && prev.auctionId !== auctionId) {
      this.socketRooms.delete(socket.id)
      const old = this.rooms.get(prev.auctionId)
      if (old) {
        old.sockets.delete(socket.id)
        if (old.sockets.size === 0) old.emptySince ??= Date.now()
        socket.leave(`auction:${prev.auctionId}`)
        if (prev.identity.role === 'VIEWER') this.schedulePresenceBroadcast(old)
        else void this.refreshParticipants(old).then(() => this.schedulePresenceBroadcast(old))
      }
    }

    // A heal can swap the room object and an idle room can be evicted while
    // we wait, so only register on the room that is live right now. The check
    // and the registration below run in one synchronous step.
    let room = await this.roomForJoin(auctionId, identity)
    for (let attempt = 0; this.rooms.get(auctionId) !== room && attempt < 3; attempt++) {
      room = await this.roomForJoin(auctionId, identity)
    }

    // The client may have dropped while we waited on the database. Its
    // 'disconnect' has then already run (and found nothing to clean up), so
    // registering now would leave a ghost seat that never leaves the room.
    if (socket.disconnected) throw new SocketGone()
    room.sockets.set(socket.id, { role: identity.role, name: identity.name, teamId: identity.teamId })
    room.emptySince = null
    this.socketRooms.set(socket.id, { auctionId, identity })
    // Join the broadcast room BEFORE building the snapshot we hand back, so no
    // broadcast can fall in the gap between the two (the client ignores delta
    // broadcasts until its full snapshot arrives).
    await socket.join(`auction:${auctionId}`)

    if (identity.role === 'VIEWER') {
      // Viewers are a live count, never listed (see buildState), so their
      // presence row is fire-and-forget and the participant list is untouched.
      // Anonymous viewers have no row at all (a big stream would add thousands).
      if (!identity.anon) void this.upsertParticipant(room, identity)
    } else {
      await this.upsertParticipant(room, identity)
      await this.refreshParticipants(room)
    }
    // Dropped during the writes above: 'disconnect' ran leave() already, but
    // the presence row may have been marked online after it. Leave again.
    if (socket.disconnected) {
      this.socketRooms.set(socket.id, { auctionId, identity })
      await this.leave(socket)
      throw new SocketGone()
    }
    this.schedulePresenceBroadcast(room)
    return this.buildState(room)
  }

  /**
   * The room a join attaches to, built from the DB on first use and healed
   * if the DB diverged (external reset, REST edits) — at most once every
   * SYNC_INTERVAL_MS. Seat joins (organizer/manager) heal under the room lock
   * as before. Viewer joins never hold the lock for a DB read: one viewer per
   * interval probes the auction row outside the lock, and only a real
   * divergence takes the lock (which re-reads before swapping anything).
   */
  private async roomForJoin(auctionId: string, identity: SocketIdentity): Promise<Room> {
    const existing = this.rooms.get(auctionId)
    // Under the room lock: a heal/rebuild must never swap the room object out
    // from under a bid, organizer action or timer tick that is mid-flight.
    if (!existing) return this.withLock(auctionId, () => this.getOrBuild(auctionId))
    if (Date.now() - existing.lastSyncAt < SYNC_INTERVAL_MS) return existing
    existing.lastSyncAt = Date.now() // claim the check before any await
    if (identity.role !== 'VIEWER') {
      return this.withLock(auctionId, async () => {
        const live = this.rooms.get(auctionId)
        return live ? this.syncIfStale(live) : this.getOrBuild(auctionId)
      })
    }
    try {
      const row = await this.db.auction.findUnique({ where: { id: auctionId } })
      if (!row || !this.diverged(existing, row)) return existing
    } catch {
      return existing
    }
    return this.withLock(auctionId, async () => {
      const live = this.rooms.get(auctionId)
      return live ? this.syncIfStale(live) : this.getOrBuild(auctionId)
    })
  }

  async leave(socket: Socket): Promise<void> {
    const rec = this.socketRooms.get(socket.id)
    this.socketRooms.delete(socket.id)
    if (!rec || this.closing) return
    const room = this.rooms.get(rec.auctionId)
    if (!room) return
    room.sockets.delete(socket.id)
    if (room.sockets.size === 0) room.emptySince ??= Date.now()

    const stillOnline = [...room.sockets.values()].some(
      (s) => s.role === rec.identity.role && s.name === rec.identity.name,
    )
    if (!stillOnline && !rec.identity.anon) {
      try {
        await this.db.roomParticipant.updateMany({
          where: { auctionId: room.auctionId, role: rec.identity.role, name: rec.identity.name },
          data: { online: false, lastSeen: new Date() },
        })
      } catch {
        // non-fatal
      }
    }
    // Viewer rows are not part of the participant list — nothing to re-read.
    if (rec.identity.role !== 'VIEWER') await this.refreshParticipants(room)
    this.schedulePresenceBroadcast(room)
  }

  /**
   * Frees memory held by rooms nobody has been connected to for
   * EMPTY_ROOM_TTL_MS. The DB is always up to date (every transition is
   * written before memory changes), so the next join rebuilds the room —
   * exactly like after a service restart. Done under the room lock, so no
   * bid, action or tick is mid-flight, and joins re-check the live room.
   */
  private async evictIdleRooms(): Promise<void> {
    const now = Date.now()
    for (const room of [...this.rooms.values()]) {
      if (room.sockets.size > 0) {
        room.emptySince = null
        continue
      }
      room.emptySince ??= now
      if (now - room.emptySince < EMPTY_ROOM_TTL_MS || room.ticking) continue
      try {
        await this.withLock(room.auctionId, async () => {
          if (this.rooms.get(room.auctionId) !== room || room.sockets.size > 0 || room.ticking) return
          if (room.presenceTimer) clearTimeout(room.presenceTimer)
          room.presenceTimer = null
          this.rooms.delete(room.auctionId)
          this.building.delete(room.auctionId)
          console.log(`[engine] evicted idle room ${room.roomCode} (no connections for ${Math.round((now - room.emptySince!) / 60_000)} min)`)
        })
        // Drop the lock chain too, unless something queued on it meanwhile.
        const chain = this.locks.get(room.auctionId)
        if (chain && !this.rooms.has(room.auctionId)) {
          void chain.then(() => {
            if (this.locks.get(room.auctionId) === chain && !this.rooms.has(room.auctionId)) this.locks.delete(room.auctionId)
          })
        }
      } catch (err) {
        console.error('[engine] room eviction failed:', (err as Error).message)
      }
    }
  }

  private async upsertParticipant(room: Room, identity: SocketIdentity): Promise<void> {
    try {
      await this.db.roomParticipant.upsert({
        where: {
          auctionId_role_name: {
            auctionId: room.auctionId,
            role: identity.role,
            name: identity.name,
          },
        },
        create: {
          auctionId: room.auctionId,
          role: identity.role,
          name: identity.name,
          teamId: identity.teamId ?? null,
          userId: identity.userId ?? null,
          online: true,
        },
        update: {
          online: true,
          lastSeen: new Date(),
          teamId: identity.teamId ?? undefined,
          userId: identity.userId ?? undefined,
        },
      })
    } catch {
      // presence is best-effort; never block the join
    }
  }

  private async refreshParticipants(room: Room): Promise<void> {
    try {
      // Seats only: viewers are counted from live sockets, never listed, and a
      // streamed auction can have hundreds of viewer rows.
      room.participants = await this.db.roomParticipant.findMany({
        where: { auctionId: room.auctionId, role: { not: 'VIEWER' } },
        orderBy: { joinedAt: 'asc' },
      })
    } catch {
      // keep previous cache
    }
  }

  private identityOnline(room: Room, role: RoomRole, name: string): boolean {
    for (const s of room.sockets.values()) {
      if (s.role === role && s.name === name) return true
    }
    return false
  }

  private teamOnline(room: Room, teamId: string): boolean {
    for (const s of room.sockets.values()) {
      if (s.role === 'MANAGER' && s.teamId === teamId) return true
    }
    return false
  }

  // ----------------------------------------------------------
  // Audit trail
  // ----------------------------------------------------------
  /**
   * Builds an append-only audit row. Every sale, re-auction, refund, unsold
   * and skip is recorded with name snapshots so the history stays readable
   * even after a player or team is renamed or removed.
   */
  private auditRow(
    room: Room,
    e: {
      type: AuditType
      cycle: number
      player: Pick<Player, 'id' | 'name' | 'playerNumber'>
      teamId?: string | null
      teamName?: string | null
      amount?: number | null
      refundAmount?: number | null
      actor?: Actor
      reason?: string | null
    },
  ) {
    return {
      auctionId: room.auctionId,
      tournamentId: room.tournament.id,
      type: e.type,
      cycle: e.cycle,
      playerId: e.player.id,
      playerName: e.player.name,
      playerNumber: e.player.playerNumber,
      teamId: e.teamId ?? null,
      teamName: e.teamName ?? null,
      amount: e.amount ?? null,
      refundAmount: e.refundAmount ?? null,
      actorId: e.actor?.id ?? null,
      actorName: e.actor?.name ?? null,
      reason: e.reason ?? null,
    }
  }

  // ----------------------------------------------------------
  // Purse maths
  // ----------------------------------------------------------
  // The rules themselves live in rules.ts (pure, unit-tested).

  /**
   * Is this user still the team's registered manager? The cached team row is
   * trusted when it agrees; otherwise the DB is re-read, because seats are
   * claimed (and reassigned by the organizer) through the REST API after the
   * room cache was built.
   */
  private async holdsSeat(team: TeamCache, userId: string | undefined): Promise<boolean> {
    if (!userId) return false
    if (team.managerUserId === userId) return true
    const fresh = await this.db.team.findUnique({ where: { id: team.id }, select: { managerUserId: true } })
    team.managerUserId = fresh?.managerUserId ?? null
    return team.managerUserId === userId
  }

  /** Shared bid legality check for manager bids and organizer manual bids. */
  private validateBid(
    room: Room,
    team: TeamCache,
    player: Player,
    amount: number,
    opts: { manual: boolean },
  ): string | null {
    return validateBid(room, team, player, amount, opts)
  }

  // ----------------------------------------------------------
  // Client actions
  // ----------------------------------------------------------
  /**
   * A manager's bid. Resolves to null once the bid is saved and broadcast, or
   * to the reason it was refused. Unexpected failures (DB down) throw.
   *
   * `receivedAt` is when the event reached the service — taken before any
   * lock wait. A bid that arrived after the final call (GOING TWICE) ran out
   * is refused even if the lot has not been closed yet; one that arrived in
   * time is honoured even when it only gets the lock after the deadline.
   * `playerId` (newer clients) pins the bid to the player the manager saw.
   */
  async placeBid(
    identity: SocketIdentity,
    rawAmount: unknown,
    opts: { playerId?: unknown; receivedAt?: number } = {},
  ): Promise<string | null> {
    const receivedAt = opts.receivedAt ?? Date.now()
    const outcome = await this.withLock(identity.auctionId, async (): Promise<Outcome> => {
      // Resolved inside the lock — a join may have rebuilt the room meanwhile.
      const room = this.rooms.get(identity.auctionId)
      if (!room) return this.fail('Join the room first')
      // A seat is evidently back: end any seatless hold before this bid moves the clock.
      this.releaseSeatlessHold(room)
      if (room.status !== 'LIVE') return this.fail('Auction is not live')
      if (typeof opts.playerId === 'string' && opts.playerId !== room.currentPlayerId) {
        return this.fail('The player on the block changed — check and bid again')
      }
      // Only the last stage's deadline closes the lot; an earlier deadline just
      // moves on to GOING ONCE/TWICE, where bids are still welcome.
      if (room.stage === 2 && room.timerEndsAt != null && receivedAt > room.timerEndsAt) {
        return this.fail('Too late — bidding on this player had closed')
      }
      // A close that failed and is being retried keeps its original deadline.
      if (room.closing && room.closing.playerId === room.currentPlayerId && receivedAt > room.closing.deadline) {
        return this.fail('Too late — bidding on this player had closed')
      }
      const player = room.players.find((p) => p.id === room.currentPlayerId)
      if (!room.currentPlayerId || !player) return this.fail('No player on the block')
      const amount = Number(rawAmount)
      const team = room.teams.find((t) => t.id === identity.teamId)
      if (!team) return this.fail('You are not assigned to a team in this room')
      if (!(await this.holdsSeat(team, identity.userId))) {
        return this.fail("You are no longer this team's manager — log in with the team's account and rejoin")
      }
      const invalid = this.validateBid(room, team, player, amount, { manual: false })
      if (invalid) return this.fail(invalid)

      let createdAt: Date
      try {
        createdAt = await this.persistBid(room, team, player, amount)
      } catch (err) {
        if (err instanceof BidOutOfDate) return this.bidOutOfDate(room)
        throw err
      }

      room.currentBid = { amount, teamId: team.id, teamName: team.name, teamColor: team.color }
      room.currentBidHistory = [
        ...room.currentBidHistory,
        { teamId: team.id, teamName: team.name, amount, createdAt: createdAt.toISOString() },
      ]
      room.stage = 0
      room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
      room.pausedRemainingMs = null
      this.notify(room, 'success', { code: 'bid', params: { team: team.name, amount, player: player.name } }, 'bid')
      this.broadcast(room)
    })
    return outcome || null
  }

  /**
   * Saves a bid and moves the auction's current bid in ONE statement — one
   * round trip to a far-away Postgres instead of four for an interactive
   * transaction. A single statement is atomic by itself and can never be left
   * idle-in-transaction holding locks, so it needs no BOUNDED_TX_SQL. Same
   * rows as before: one Bid, plus Auction currentBidAmount/TeamId and bidCount (bids write no
   * AuctionEvent). A missing auction row fails the Bid foreign key → throws.
   */
  private async persistBid(room: Room, team: TeamCache, player: Player, amount: number): Promise<Date> {
    const createdAt = new Date()
    // Compare-and-swap: the auction row only moves if the database agrees that
    // this player is on the block of a LIVE auction and the new amount beats the
    // stored one; the Bid row is inserted only when it did. Memory is checked
    // first, so a miss means another writer (a second engine instance, an
    // external edit) changed the auction — the bid must not overwrite it.
    // Prisma stores DateTime as UTC in timestamp(3); an ISO string cast to
    // timestamp keeps the UTC wall time (its "Z" is ignored), exactly as Prisma would.
    const rows = await this.db.$queryRaw<{ bids: number }[]>`
      WITH moved AS (
        UPDATE "Auction"
        SET "currentBidAmount" = ${amount}::int, "currentBidTeamId" = ${team.id}::text, "bidCount" = "bidCount" + 1
        WHERE "id" = ${room.auctionId}::text
          AND "status" = 'LIVE'
          AND "currentPlayerId" = ${player.id}::text
          AND ("currentBidAmount" IS NULL OR "currentBidAmount" < ${amount}::int)
        RETURNING "id"
      ), new_bid AS (
        INSERT INTO "Bid" ("id", "auctionId", "playerId", "teamId", "teamName", "playerName", "amount", "cycle", "createdAt")
        SELECT ${randomUUID()}::text, moved."id", ${player.id}::text, ${team.id}::text, ${team.name}::text, ${player.name}::text,
               ${amount}::int, ${player.auctionCycle}::int, ${createdAt.toISOString()}::timestamp(3)
        FROM moved
        RETURNING "id"
      )
      SELECT (SELECT count(*) FROM new_bid)::int AS "bids"`
    if ((rows[0]?.bids ?? 0) !== 1) throw new BidOutOfDate()
    return createdAt
  }

  /**
   * The database refused a bid that memory accepted: the room no longer
   * matches it. Trust the database — rebuild the room — and refuse the bid.
   */
  private async bidOutOfDate(room: Room): Promise<string> {
    alert('bid-refused-by-db', new Error('Bid refused by the database: the auction row no longer matches memory (second engine instance or external edit?) — rebuilding the room'), { room: room.roomCode })
    try {
      const fresh = await this.replaceRoom(room)
      this.broadcast(fresh)
    } catch (err) {
      console.error('[engine] rebuild after a refused bid failed:', (err as Error).message)
      room.lastSyncAt = 0 // let the next join heal it
    }
    return this.fail('The auction moved on — check the current bid and try again')
  }

  /**
   * An organizer action. Resolves to null on success or to the reason it was
   * refused; unexpected failures (DB down) throw and leave memory untouched.
   */
  async organizerAction(
    identity: SocketIdentity,
    action: string | undefined,
    payload: Record<string, unknown> | undefined,
  ): Promise<string | null> {
    const actor: Actor = { id: identity.userId ?? null, name: identity.name }
    const outcome = await this.withLock(identity.auctionId, async (): Promise<Outcome> => {
      // Resolved inside the lock — a join may have rebuilt the room meanwhile.
      const room = this.rooms.get(identity.auctionId)
      if (!room) return this.fail('Join the room first')
      // The organizer is evidently back: end any seatless hold before the action moves the clock.
      this.releaseSeatlessHold(room)
      // Auctioneers run the floor; undoing finished business is for co-organizers and up.
      if (identity.staff === 'AUCTIONEER' && action && CO_ORGANIZER_ACTIONS.has(action)) {
        return this.fail('Only the tournament owner or a co-organizer can do this')
      }
      switch (action) {
        case 'start': return this.actionStart(room)
        case 'pause': return this.actionPause(room)
        case 'resume': return this.actionResume(room)
        case 'next_player': return this.actionNextPlayer(room)
        case 'select_player': return this.actionSelectPlayer(room, payload)
        case 'set_category': return this.actionSetCategory(room, payload)
        case 'skip': return this.staleLot(room, payload) ?? this.actionSkip(room, actor)
        case 'force_sell': return this.staleLot(room, payload) ?? this.actionForceSell(room, actor)
        case 'force_unsold': return this.staleLot(room, payload) ?? this.actionForceUnsold(room, actor)
        case 'reauction': return this.actionReauction(room, payload, actor)
        // Pinned to the player the dialog was opened for (newer clients send playerId).
        case 'manual_bid': return this.staleLot(room, payload ? { playerId: payload.playerId } : undefined) ?? this.manualBid(room, payload, actor)
        case 'end': return this.actionEnd(room)
        case 'reopen': return this.actionReopen(room)
        case 'set_auto_advance': return this.actionSetAutoAdvance(room, payload)
        case 'set_bid_timer': return this.actionSetBidTimer(room, payload)
        case 'reauction_unsold': return this.actionReauctionUnsold(room, actor)
        default: return this.fail(`Unknown action: ${String(action)}`)
      }
    })
    return outcome || null
  }

  /**
   * Sell / unsold / skip decide a lot, so they must act on the lot the
   * organizer was looking at. Newer clients send the player and the bid they
   * saw; if either moved on meanwhile (a last-second bid, the timer closing
   * the lot) the click is refused instead of hitting the wrong lot or price.
   * Old clients send neither and keep the previous behaviour.
   */
  private staleLot(room: Room, payload: Record<string, unknown> | undefined): string | null {
    if (typeof payload?.playerId === 'string' && payload.playerId !== room.currentPlayerId) {
      return 'The player on the block changed — check and try again'
    }
    if (payload && 'bidAmount' in payload && payload.bidAmount !== (room.currentBid?.amount ?? null)) {
      return 'A new bid came in — check and try again'
    }
    return null
  }

  // ---------- organizer actions ----------
  private async actionStart(room: Room): Promise<Outcome> {
    if (room.status === 'ENDED') return this.fail('Auction has already ended')
    if (room.status !== 'READY') return this.fail('Auction already started')
    if (await this.tournamentArchived(room)) return this.fail(ROOM_CLOSED)
    // Pick up anything the organizer added since the room was first built.
    await this.resyncPool(room)
    if (room.players.length === 0) return this.fail('Add at least one player before starting')
    if (room.teams.length === 0) return this.fail('Add at least one team before starting')
    // CATEGORY mode: default to the first category that still has players —
    // written in the same transaction as the status, so memory only changes
    // once both are saved.
    const firstCategory =
      room.tournament.auctionMode === 'CATEGORY' && !room.currentCategory
        ? CATEGORY_CODES.find((code) => room.players.some((p) => p.category === code && p.status === 'AVAILABLE'))
        : undefined
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { status: 'LIVE', ...(firstCategory ? { currentCategory: firstCategory } : {}) },
      }),
      this.db.tournament.update({ where: { id: room.tournament.id }, data: { status: 'LIVE' } }),
    ])
    room.status = 'LIVE'
    room.pausedRemainingMs = null
    if (firstCategory) room.currentCategory = firstCategory
    // Fire-and-forget: analytics never delays or fails the room.
    void trackServiceEvent(this.db, 'auction_started', { userId: room.tournament.organizerId, tournamentId: room.tournament.id })

    this.notify(room, 'success', { code: 'started' })
    // The auction IS live now (committed above). If bringing up the first
    // player fails, clients must still hear it and Auto Auction must still be
    // scheduled to try again — otherwise the room looks READY and stalls.
    try {
      if (!room.currentPlayerId) await this.pickNextPlayer(room)
    } finally {
      if (!room.currentPlayerId) this.scheduleAutoAdvance(room)
      this.broadcast(room)
    }
  }

  /** `clockAt`: the moment the lot clock stopped (the click, or when the room lost its last seat). */
  private async actionPause(room: Room, message: RoomMsg = { code: 'paused' }, clockAt = Date.now()): Promise<Outcome> {
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    // Freeze the clock at the click, not after the write's round trip.
    const remaining =
      room.currentPlayerId && room.timerEndsAt != null ? Math.max(0, room.timerEndsAt - clockAt) : null
    // DB first: a failed write leaves memory (and the running lot) untouched.
    await this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'PAUSED' } })
    room.status = 'PAUSED'
    room.pausedRemainingMs = remaining
    room.seatlessSince = null
    this.notify(room, 'info', message)
    this.broadcast(room)
  }

  /**
   * Deleting a tournament that has auction history archives it instead. Seat
   * passes issued before that stay valid for hours, so the actions that could
   * bring the auction back to life check the database first.
   */
  private async tournamentArchived(room: Room): Promise<boolean> {
    const t = await this.db.tournament.findUnique({ where: { id: room.tournament.id }, select: { archivedAt: true } })
    return !t || t.archivedAt != null
  }

  private hasSeatOnline(room: Room): boolean {
    for (const s of room.sockets.values()) if (s.role === 'ORGANIZER' || s.role === 'MANAGER') return true
    return false
  }

  /**
   * Tracks how long a LIVE room has had no seat connected; true once it should
   * pause itself. While seatless the lot clock and Auto Auction are held (see
   * tick), so a Wi-Fi drop at the venue never sells or skips anyone.
   */
  private seatlessPauseDue(room: Room, now: number): boolean {
    if (room.status !== 'LIVE' || this.hasSeatOnline(room)) return false
    room.seatlessSince ??= now
    return now - room.seatlessSince >= NO_SEATS_PAUSE_MS
  }

  /** True while a LIVE room is waiting for a seat to come back (its clock is held). */
  private seatlessHold(room: Room): boolean {
    return room.seatlessSince != null && room.status === 'LIVE' && !this.hasSeatOnline(room)
  }

  /**
   * A seat is back (or the room is no longer LIVE): end the hold and push the
   * lot deadline and the next Auto Auction pick back by the time spent
   * waiting, so the lot resumes with the time it had. Call under the lock.
   */
  private releaseSeatlessHold(room: Room): void {
    if (room.seatlessSince == null) return
    const held = Math.max(0, Date.now() - room.seatlessSince)
    room.seatlessSince = null
    if (room.status !== 'LIVE' || held === 0) return
    if (room.timerEndsAt != null) room.timerEndsAt += held
    if (room.nextPlayerAt != null) room.nextPlayerAt += held
    this.broadcast(room)
  }

  /** Runs under the room lock; re-checks, since a seat may have rejoined meanwhile. */
  private async autoPause(room: Room): Promise<void> {
    if (room.status !== 'LIVE' || this.hasSeatOnline(room)) return
    console.log(`[engine] pausing room ${room.roomCode}: no organizer or manager connected for ${NO_SEATS_PAUSE_MS / 1000}s`)
    // The lot clock has been held since the last seat left: pause with the time it had then.
    await this.actionPause(room, { code: 'auto_paused', params: { seconds: NO_SEATS_PAUSE_MS / 1000 } }, room.seatlessSince ?? Date.now())
  }

  private async actionResume(room: Room): Promise<Outcome> {
    if (room.status !== 'PAUSED') return this.fail('Auction is not paused')
    await this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'LIVE' } })
    room.status = 'LIVE'
    room.timerEndsAt = room.currentPlayerId ? Date.now() + (room.pausedRemainingMs ?? room.sessionTimerSeconds * 1000) : null
    room.pausedRemainingMs = null
    if (!room.currentPlayerId) this.scheduleAutoAdvance(room)
    this.notify(room, 'info', { code: 'resumed' })
    this.broadcast(room)
  }

  private async actionNextPlayer(room: Room): Promise<Outcome> {
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    if (room.currentPlayerId) return this.fail('A player is already on the block')
    await this.resyncPool(room)
    await this.pickNextPlayer(room)
    this.broadcast(room)
  }

  private async actionSelectPlayer(room: Room, payload: Record<string, unknown> | undefined): Promise<Outcome> {
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    if (room.currentPlayerId) return this.fail('A player is already on the block')
    await this.resyncPool(room)
    const playerId = String(payload?.playerId ?? '')
    const player = room.players.find((p) => p.id === playerId)
    if (!player) return this.fail('Player not found')
    if (player.status !== 'AVAILABLE' && player.status !== 'UNSOLD' && player.status !== 'SKIPPED') {
      return this.fail('Player is not selectable (SOLD players need Re-auction)')
    }
    const moved = await this.putOnBlock(room, player)
    this.broadcast(room)
    if (!moved) return this.fail('The player on the block changed — check and try again')
  }

  private async actionSetCategory(room: Room, payload: Record<string, unknown> | undefined): Promise<Outcome> {
    if (room.status === 'ENDED') return this.fail('Auction has ended')
    if (room.tournament.auctionMode !== 'CATEGORY') return this.fail('This auction is not in category mode')
    const category = String(payload?.category ?? '').toUpperCase()
    if (!CATEGORY_CODES.includes(category)) return this.fail('Invalid category (A–E)')
    await this.db.auction.update({ where: { id: room.auctionId }, data: { currentCategory: category } })
    room.currentCategory = category
    this.notify(room, 'info', { code: 'category_selected', params: { category } })
    this.broadcast(room)
  }

  private async actionSkip(room: Room, actor: Actor): Promise<Outcome> {
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!room.currentPlayerId || !player) return this.fail('No player on the block')
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      this.db.player.update({ where: { id: player.id }, data: { status: 'SKIPPED' } }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
      }),
      this.db.auctionEvent.create({
        data: this.auditRow(room, { type: 'SKIPPED', cycle: player.auctionCycle, player, actor }),
      }),
    ])
    const i = room.players.findIndex((p) => p.id === player.id)
    if (i >= 0) room.players[i] = { ...room.players[i], status: 'SKIPPED' }
    room.currentPlayerId = null
    room.currentBid = null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.scheduleAutoAdvance(room)
    this.notify(room, 'info', { code: 'skipped', params: { player: player.name } }, 'unsold')
    this.broadcast(room)
  }

  private async actionForceSell(room: Room, actor: Actor): Promise<Outcome> {
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    if (!room.currentPlayerId) return this.fail('No player on the block')
    if (!room.currentBid) return this.fail('No bid to sell — use Force Unsold instead')
    await this.finalizeSold(room, actor)
  }

  private async actionForceUnsold(room: Room, actor: Actor): Promise<Outcome> {
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    if (!room.currentPlayerId) return this.fail('No player on the block')
    await this.finalizeUnsold(room, actor)
  }

  /**
   * Re-auction: opens a NEW auction cycle for a player who was already sold.
   *
   * This is deliberately not an "undo". The original sale stays in the audit
   * trail forever; what changes is that the money and the squad slot go back
   * to the original team and the player starts a fresh cycle from their own
   * base price. Every guarantee the spec asks for is enforced here:
   *
   *  - organizer only (checked by the socket router before we are called)
   *  - only a SOLD player, never AVAILABLE / UNSOLD / SKIPPED / on the block
   *  - the block must be free, so one player is never swapped out mid-bid
   *  - refund is exactly the recorded sale price, never more than was charged
   *  - refund + ownership removal + cycle bump + audit are one transaction
   *  - a compare-and-swap on the sale makes a double-click a no-op, so no
   *    duplicate refund is possible on retry, refresh or a racing organizer
   */
  private async actionReauction(
    room: Room,
    payload: Record<string, unknown> | undefined,
    actor: Actor,
  ): Promise<Outcome> {
    // ---- when is re-auction allowed ----
    if (room.status === 'ENDED') {
      return this.fail('The auction has ended — reopen it before re-auctioning a player.')
    }
    if (room.status === 'PAUSED') {
      return this.fail('Resume the auction before re-auctioning a player.')
    }
    if (room.status !== 'LIVE') {
      return this.fail('Start the auction before re-auctioning a player.')
    }
    if (room.currentPlayerId) {
      const onBlock = room.players.find((p) => p.id === room.currentPlayerId)
      return this.fail(
        `${onBlock?.name ?? 'A player'} is on the block — sell, mark unsold or skip them first.`,
      )
    }

    const playerId = String(payload?.playerId ?? '')
    if (!playerId) return this.fail('No player selected')

    // Always read the row fresh: the cached pool can lag behind, and the
    // freshness of `status` is what makes the swap below safe.
    const player = await this.db.player.findUnique({ where: { id: playerId } })
    if (!player || player.tournamentId !== room.tournament.id) {
      return this.fail('Player not found in this tournament')
    }
    if (player.status === 'LIVE') {
      return this.fail('This player is already on the auction block.')
    }
    if (player.status !== 'SOLD') {
      return this.fail(
        `Only a sold player can be re-auctioned — ${player.name} is ${player.status.toLowerCase()}. Pick them from the pool to put them on the block.`,
      )
    }
    if (!player.soldToTeamId || player.soldPrice == null) {
      return this.fail('That sale has no recorded team or price, so it cannot be refunded.')
    }

    const soldToTeamId = player.soldToTeamId
    const salePrice = player.soldPrice
    const fromCycle = player.auctionCycle
    const nextCycle = fromCycle + 1
    const reason =
      typeof payload?.reason === 'string' && payload.reason.trim() !== ''
        ? payload.reason.trim().slice(0, 200)
        : null

    const team = await this.db.team.findUnique({ where: { id: soldToTeamId } })
    // Never hand back more than the team was actually charged.
    const refund = Math.max(0, Math.min(salePrice, team?.spent ?? 0))

    // Read the lockout policy fresh — the organizer may have just changed it.
    try {
      const row = await this.db.auction.findUnique({
        where: { id: room.auctionId },
        select: { allowPreviousOwnerRebid: true },
      })
      if (row) room.allowPreviousOwnerRebid = row.allowPreviousOwnerRebid
    } catch {
      // keep the cached policy
    }

    try {
      await this.db.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
        // Compare-and-swap on the exact sale we read. If anything about it
        // changed in the meantime (another re-auction, a refresh-triggered
        // retry, a second organizer) this matches zero rows and the whole
        // transaction rolls back — the refund can only ever apply once.
        const claimed = await tx.player.updateMany({
          where: {
            id: player.id,
            status: 'SOLD',
            soldToTeamId,
            soldPrice: salePrice,
            auctionCycle: fromCycle,
          },
          data: { status: 'LIVE', soldPrice: null, soldToTeamId: null, auctionCycle: nextCycle },
        })
        if (claimed.count !== 1) throw new SaleAlreadyChanged()

        if (refund > 0) {
          await tx.team.update({ where: { id: soldToTeamId }, data: { spent: { decrement: refund } } })
        }
        await tx.auction.update({
          where: { id: room.auctionId },
          data: { currentPlayerId: player.id, currentBidAmount: null, currentBidTeamId: null },
        })
        await tx.auctionEvent.createMany({
          data: [
            this.auditRow(room, {
              type: 'REFUND',
              cycle: fromCycle,
              player,
              teamId: soldToTeamId,
              teamName: team?.name ?? null,
              amount: salePrice,
              refundAmount: refund,
              actor,
              reason,
            }),
            this.auditRow(room, {
              type: 'RE_AUCTION',
              cycle: nextCycle,
              player,
              teamId: soldToTeamId,
              teamName: team?.name ?? null,
              amount: salePrice,
              refundAmount: refund,
              actor,
              reason,
            }),
          ],
        })
      })
    } catch (err) {
      if (err instanceof SaleAlreadyChanged) {
        return this.fail('That sale has already been changed — refresh the pool and try again.')
      }
      throw err
    }

    // The transaction committed: apply exactly what it wrote to the cache
    // first, so that even if the re-read below fails, finalizeSold's
    // compare-and-swap (status LIVE + auctionCycle) matches the new cycle and
    // the lot can never be silently dropped, and the refund counts in purses.
    const reborn: Player = { ...player, status: 'LIVE', soldPrice: null, soldToTeamId: null, auctionCycle: nextCycle }
    const ci = room.players.findIndex((p) => p.id === player.id)
    if (ci >= 0) room.players[ci] = reborn
    else room.players.push(reborn)
    const ti = room.teams.findIndex((t) => t.id === soldToTeamId)
    if (ti >= 0) {
      room.teams[ti] = {
        ...room.teams[ti],
        spent: room.teams[ti].spent - refund,
        squadCount: Math.max(0, room.teams[ti].squadCount - 1),
      }
    }
    // Then re-read purses and squads, picking up anything else that changed.
    await this.resyncPool(room)

    room.currentPlayerId = player.id
    room.closing = null
    room.currentBid = null
    room.currentBidHistory = [] // fresh ladder; the old cycle lives on in history
    room.previousOwnerTeamId = soldToTeamId
    room.stage = 0
    // A re-auction is a fresh session: lock in the current configured duration.
    room.sessionTimerSeconds = room.bidTimerSeconds
    room.nextPlayerAt = null
    room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
    room.pausedRemainingMs = null

    this.notify(
      room,
      'warning',
      {
        code: 'reauction',
        params: {
          player: player.name,
          round: nextCycle + 1,
          refund,
          team: team?.name ?? '',
          base: player.basePrice,
          blocked: room.allowPreviousOwnerRebid ? 0 : 1,
        },
      },
    )
    this.broadcast(room)
  }

  private async actionEnd(room: Room): Promise<Outcome> {
    if (room.status === 'ENDED') return this.fail('Auction already ended')
    const liveOnes = room.players.filter((p) => p.status === 'LIVE')
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      ...liveOnes.map((p) =>
        this.db.player.update({
          where: { id: p.id },
          data: { status: 'AVAILABLE', soldPrice: null, soldToTeamId: null },
        }),
      ),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { status: 'ENDED', currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
      }),
      this.db.tournament.update({ where: { id: room.tournament.id }, data: { status: 'COMPLETED' } }),
    ])
    const liveIds = new Set(liveOnes.map((p) => p.id))
    room.players = room.players.map((p) =>
      liveIds.has(p.id) ? { ...p, status: 'AVAILABLE', soldPrice: null, soldToTeamId: null } : p,
    )
    room.status = 'ENDED'
    room.currentPlayerId = null
    room.currentBid = null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    room.nextPlayerAt = null
    void trackServiceEvent(this.db, 'auction_completed', {
      userId: room.tournament.organizerId,
      tournamentId: room.tournament.id,
      props: { round: room.round, sold: room.players.filter((p) => p.status === 'SOLD').length },
    })
    this.notify(room, 'success', { code: 'ended' })
    this.broadcast(room)
  }

  /**
   * Undoes an End. Sold players, budgets and squads are untouched — the room
   * simply goes live again so the organizer can keep going. Without this an
   * accidental End leaves the tournament permanently stuck on COMPLETED.
   */
  private async actionReopen(room: Room): Promise<Outcome> {
    if (room.status !== 'ENDED') return this.fail('The auction is not ended')
    if (await this.tournamentArchived(room)) return this.fail(ROOM_CLOSED)
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'LIVE' } }),
      this.db.tournament.update({ where: { id: room.tournament.id }, data: { status: 'LIVE' } }),
    ])
    await this.resyncPool(room)
    room.status = 'LIVE'
    room.currentPlayerId = null
    room.currentBid = null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.scheduleAutoAdvance(room)
    this.notify(
      room,
      'info',
      { code: 'reopened', params: { auto: room.autoAdvance ? 1 : 0 } },
    )
    this.broadcast(room)
  }

  private async manualBid(
    room: Room,
    payload: Record<string, unknown> | undefined,
    actor: Actor,
  ): Promise<Outcome> {
    const teamId = String(payload?.teamId ?? '')
    const team = room.teams.find((t) => t.id === teamId)
    if (!team) return this.fail('Team not found')
    if (room.status !== 'LIVE') return this.fail('Auction is not live')
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!room.currentPlayerId || !player) return this.fail('No player on the block')
    const amount = Number(payload?.amount)
    const invalid = this.validateBid(room, team, player, amount, { manual: true })
    if (invalid) return this.fail(invalid)

    let createdAt: Date
    try {
      createdAt = await this.persistBid(room, team, player, amount)
    } catch (err) {
      if (err instanceof BidOutOfDate) return this.bidOutOfDate(room)
      throw err
    }

    room.currentBid = { amount, teamId: team.id, teamName: team.name, teamColor: team.color }
    room.currentBidHistory = [
      ...room.currentBidHistory,
      { teamId: team.id, teamName: team.name, amount, createdAt: createdAt.toISOString() },
    ]
    room.stage = 0
    room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
    room.pausedRemainingMs = null
    this.notify(room, 'info', { code: 'manual_bid', params: { by: actor.name ?? '', team: team.name, amount } }, 'bid')
    this.broadcast(room)
  }

  // ---------- player picking / finalization ----------
  private async pickNextPlayer(room: Room): Promise<boolean> {
    const pool = room.players.filter((p) => p.status === 'AVAILABLE')
    if (pool.length === 0) {
      const leftOver = room.players.filter((p) => p.status === 'UNSOLD' || p.status === 'SKIPPED').length
      this.notify(
        room,
        'info',
        leftOver > 0
          ? { code: 'round_complete', params: { round: room.round, left: leftOver } }
          : { code: 'round_all_sold', params: { round: room.round } },
      )
      return false
    }

    let candidates = pool
    if (room.tournament.auctionMode === 'CATEGORY') {
      candidates = pool.filter((p) => p.category === room.currentCategory)

      // Current category is exhausted: roll on to the next one that still has
      // players instead of stalling with an error the organizer must clear.
      if (candidates.length === 0) {
        const nextCode = CATEGORY_CODES.find((code) => pool.some((p) => p.category === code))
        if (nextCode) {
          await this.db.auction.update({
            where: { id: room.auctionId },
            data: { currentCategory: nextCode },
          })
          room.currentCategory = nextCode
          this.notify(room, 'info', { code: 'category_next', params: { category: nextCode } })
          candidates = pool.filter((p) => p.category === nextCode)
        } else {
          // Nothing categorised is left; fall back to the uncategorised players
          // so they can never be stranded outside the A–E buckets.
          candidates = pool.filter((p) => !p.category)
          if (candidates.length === 0) {
            this.notify(room, 'info', { code: 'no_categorised_left' })
            return false
          }
          this.notify(room, 'warning', { code: 'uncategorised_now' })
        }
      }
    }

    const player = candidates[randomInt(candidates.length)]
    await this.putOnBlock(room, player)
    return true
  }

  /**
   * Puts `player` on the block. A compare-and-swap on an empty block: if the
   * database already has someone up (an earlier attempt committed but its
   * reply was lost, so this is a retry), nobody is stranded as LIVE — the room
   * follows the database instead and this returns false.
   */
  private async putOnBlock(room: Room, player: Player): Promise<boolean> {
    room.closing = null
    const moved = await this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
      const block = await tx.auction.updateMany({
        where: { id: room.auctionId, currentPlayerId: null },
        data: { currentPlayerId: player.id, currentBidAmount: null, currentBidTeamId: null },
      })
      if (block.count !== 1) return false
      await tx.player.update({ where: { id: player.id }, data: { status: 'LIVE' } })
      return true
    })
    if (!moved) {
      await this.followBlockInDb(room)
      return false
    }
    const i = room.players.findIndex((p) => p.id === player.id)
    if (i >= 0) room.players[i] = { ...room.players[i], status: 'LIVE' }
    room.currentPlayerId = player.id
    room.currentBid = null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    // New session: the configured duration applies from here (a change made
    // mid-session never touches the player already on the block).
    room.sessionTimerSeconds = room.bidTimerSeconds
    room.nextPlayerAt = null
    room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
    room.pausedRemainingMs = null
    this.notify(room, 'info', { code: 'on_block', params: { number: player.playerNumber, player: player.name } })
    return true
  }

  /** Adopts whoever the database has on the block (a fresh bidding session for them). */
  private async followBlockInDb(room: Room): Promise<void> {
    await this.resyncPool(room, { strict: true })
    const row = room.auction
    const team = row.currentBidTeamId ? room.teams.find((t) => t.id === row.currentBidTeamId) : undefined
    alert('block-out-of-date', new Error(`Room ${room.roomCode}: the database already has ${row.currentPlayerId} on the block — following it`), {
      room: room.roomCode,
    })
    room.currentPlayerId = row.currentPlayerId
    room.currentBid =
      row.currentBidAmount != null && team
        ? { amount: row.currentBidAmount, teamId: team.id, teamName: team.name, teamColor: team.color ?? null }
        : null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    room.sessionTimerSeconds = room.bidTimerSeconds
    room.nextPlayerAt = null
    room.timerEndsAt = row.currentPlayerId ? Date.now() + room.sessionTimerSeconds * 1000 : null
    room.pausedRemainingMs = null
  }

  private async finalizeSold(room: Room, actor?: Actor): Promise<void> {
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    const bid = room.currentBid
    if (!player || !bid) return
    // Compare-and-swap on BOTH rows:
    //  - the auction still has this player on the block with exactly this
    //    winning bid (amount + team), so an instance whose memory is behind the
    //    database (it should never run twice, but) can never sell to a lower
    //    or different bidder;
    //  - the player is still LIVE in this cycle, so if a previous attempt
    //    committed but its reply was lost (dropped DB connection) and the
    //    timer retries, the team is not charged twice.
    let applied: boolean
    try {
      applied = await this.db.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
        const block = await tx.auction.updateMany({
          where: {
            id: room.auctionId,
            currentPlayerId: player.id,
            currentBidAmount: bid.amount,
            currentBidTeamId: bid.teamId,
          },
          data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
        })
        if (block.count !== 1) return false
        const claimed = await tx.player.updateMany({
          where: { id: player.id, status: 'LIVE', auctionCycle: player.auctionCycle },
          data: { status: 'SOLD', soldPrice: bid.amount, soldToTeamId: bid.teamId },
        })
        if (claimed.count !== 1) throw new LotAlreadyChanged() // roll back the auction row too
        await tx.team.update({ where: { id: bid.teamId }, data: { spent: { increment: bid.amount } } })
        // Cycle 0 is the first sale; anything above is a sale from a re-auction.
        await tx.auctionEvent.create({
          data: this.auditRow(room, {
            type: 'SALE',
            cycle: player.auctionCycle,
            player,
            teamId: bid.teamId,
            teamName: bid.teamName,
            amount: bid.amount,
            actor,
          }),
        })
        return true
      })
    } catch (err) {
      if (!(err instanceof LotAlreadyChanged)) throw err
      applied = false
    }
    if (!applied) {
      const row = await this.db.player.findUnique({ where: { id: player.id } })
      const alreadySold =
        row?.status === 'SOLD' &&
        row.soldToTeamId === bid.teamId &&
        row.soldPrice === bid.amount &&
        row.auctionCycle === player.auctionCycle
      if (!alreadySold) {
        // Memory disagrees with the database (another writer, an external
        // edit) — trust the database: rebuild the room from it.
        alert('sale-skipped', new Error(`Sale of ${player.id} to ${bid.teamId} at ${bid.amount} skipped: the database no longer matches (player is ${row?.status ?? 'missing'}) — rebuilding the room`), { room: room.roomCode })
        try {
          const fresh = await this.replaceRoom(room)
          this.broadcast(fresh)
        } catch (rebuildErr) {
          console.error('[engine] rebuild after a skipped sale failed:', (rebuildErr as Error).message)
          await this.resyncPool(room)
          room.currentPlayerId = null
          room.currentBid = null
          room.currentBidHistory = []
          room.stage = 0
          room.timerEndsAt = null
          room.lastSyncAt = 0 // let the next join heal it
          this.scheduleAutoAdvance(room)
          this.broadcast(room)
        }
        return
      }
      // else: the earlier attempt did commit — just bring memory up to date below.
    }
    const pi = room.players.findIndex((p) => p.id === player.id)
    if (pi >= 0) {
      room.players[pi] = { ...room.players[pi], status: 'SOLD', soldPrice: bid.amount, soldToTeamId: bid.teamId }
    }
    const ti = room.teams.findIndex((t) => t.id === bid.teamId)
    if (ti >= 0) {
      room.teams[ti] = {
        ...room.teams[ti],
        spent: room.teams[ti].spent + bid.amount,
        squadCount: room.teams[ti].squadCount + 1,
      }
    }
    const at = new Date().toISOString()
    room.lastResult = {
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.playerNumber,
      teamId: bid.teamId,
      teamName: bid.teamName,
      price: bid.amount,
      type: 'SOLD',
      at,
    }
    room.soldFeed = [{ playerName: player.name, teamName: bid.teamName, price: bid.amount, at }, ...room.soldFeed].slice(0, 12)
    room.currentPlayerId = null
    room.currentBid = null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.scheduleAutoAdvance(room)
    this.notify(room, 'success', { code: 'sold', params: { player: player.name, team: bid.teamName, amount: bid.amount } }, 'sold')
    this.broadcast(room)
    // The sale has committed. Queue the "you were sold" SMS in the background;
    // it never throws and never delays the room (dedupeKey stops repeats).
    void queuePlayerSoldSms(this.db, {
      tournamentId: room.tournament.id,
      player: { id: player.id, name: player.name, phone: player.phone, auctionCycle: player.auctionCycle },
      teamName: bid.teamName,
      price: bid.amount,
    })
  }

  private async finalizeUnsold(room: Room, actor?: Actor): Promise<void> {
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!player) return
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      this.db.player.update({ where: { id: player.id }, data: { status: 'UNSOLD' } }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
      }),
      this.db.auctionEvent.create({
        data: this.auditRow(room, { type: 'UNSOLD', cycle: player.auctionCycle, player, actor }),
      }),
    ])
    const pi = room.players.findIndex((p) => p.id === player.id)
    if (pi >= 0) room.players[pi] = { ...room.players[pi], status: 'UNSOLD' }
    room.lastResult = {
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.playerNumber,
      teamId: null,
      teamName: null,
      price: null,
      type: 'UNSOLD',
      at: new Date().toISOString(),
    }
    room.currentPlayerId = null
    room.currentBid = null
    room.currentBidHistory = []
    room.previousOwnerTeamId = null
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.scheduleAutoAdvance(room)
    this.notify(room, 'error', { code: 'unsold', params: { player: player.name } }, 'unsold')
    this.broadcast(room)
  }

  /**
   * "Re-Auction Unsold & Skipped Players": starts the next round with only the
   * players nobody bought (UNSOLD) or the organizer passed over (SKIPPED).
   * Sold players are untouched. Each returned player's auction cycle is bumped,
   * so their earlier bids stay in the history but never count in the new round.
   * Only allowed once the current round is complete — never mid-round, never
   * automatically.
   */
  private async actionReauctionUnsold(room: Room, actor: Actor): Promise<Outcome> {
    if (room.status === 'ENDED') return this.fail('The auction is finalized — reopen it first.')
    if (room.status !== 'LIVE') return this.fail('Resume the auction before starting a new round.')
    if (room.currentPlayerId) return this.fail('A player is on the block — finish this round first.')

    // Strict: who returns is decided from this read, so a stale pool must not be used.
    await this.resyncPool(room, { strict: true })
    if (room.players.some((p) => p.status === 'AVAILABLE')) {
      return this.fail('This round still has players to auction — finish the round first.')
    }
    const returning = room.players.filter((p) => p.status === 'UNSOLD' || p.status === 'SKIPPED')
    if (returning.length === 0) return this.fail('There are no unsold or skipped players to re-auction.')

    const nextRound = room.round + 1
    const ids = returning.map((p) => p.id)
    await this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
      // Guarded on status, so a double click cannot return anyone twice.
      await tx.player.updateMany({
        where: { id: { in: ids }, status: { in: ['UNSOLD', 'SKIPPED'] } },
        data: { status: 'AVAILABLE', auctionCycle: { increment: 1 } },
      })
      await tx.auction.update({ where: { id: room.auctionId }, data: { round: nextRound } })
      await tx.auctionEvent.createMany({
        data: returning.map((p) =>
          this.auditRow(room, {
            type: 'RE_AUCTION',
            cycle: p.auctionCycle + 1,
            player: p,
            actor,
            reason: `Round ${nextRound}: back in the pool (was ${p.status.toLowerCase()})`,
          }),
        ),
      })
    })

    // Committed: mirror it in the cache first (status + bumped cycle), so a
    // failed re-read below can never leave old cycles in memory — finalizeSold's
    // compare-and-swap would then match nothing and silently drop the lot.
    const returningIds = new Set(ids)
    room.players = room.players.map((p) =>
      returningIds.has(p.id) ? { ...p, status: 'AVAILABLE', auctionCycle: p.auctionCycle + 1 } : p,
    )
    await this.resyncPool(room)
    room.round = nextRound
    room.lastResult = null
    room.previousOwnerTeamId = null
    // CATEGORY mode: start the round at the first category that has players again.
    if (room.tournament.auctionMode === 'CATEGORY') {
      const first = CATEGORY_CODES.find((code) => room.players.some((p) => p.category === code && p.status === 'AVAILABLE'))
      if (first && first !== room.currentCategory) {
        // The new round is already committed: a failure here must not stop the round being announced.
        try {
          await this.db.auction.update({ where: { id: room.auctionId }, data: { currentCategory: first } })
        } catch (err) {
          alert('round-category', err, { room: room.roomCode })
        }
        room.currentCategory = first
      }
    }
    this.scheduleAutoAdvance(room) // Auto Auction ON → the round's first player comes up by itself
    this.notify(
      room,
      'success',
      { code: 'round_started', params: { round: nextRound, count: returning.length } },
    )
    this.broadcast(room)
  }

  // ----------------------------------------------------------
  // Auto Auction
  // ----------------------------------------------------------
  /**
   * After a lot closes (or the block is otherwise empty while LIVE), schedule
   * the automatic pick. Only a timestamp is stored — the ticker performs the
   * pick under the room lock, so it happens exactly once no matter how many
   * clients refresh, reconnect or toggle the setting.
   */
  private scheduleAutoAdvance(room: Room): void {
    if (room.autoAdvance && room.status === 'LIVE' && !room.currentPlayerId) {
      room.nextPlayerAt ??= Date.now() + AUTO_ADVANCE_DELAY_MS
    } else {
      room.nextPlayerAt = null
    }
  }

  private autoAdvanceDue(room: Room, now: number): boolean {
    return (
      room.autoAdvance &&
      room.status === 'LIVE' &&
      !room.currentPlayerId &&
      room.nextPlayerAt != null &&
      now >= room.nextPlayerAt
    )
  }

  /** Runs under the room lock. Re-checks everything: a manual pick may have won the race. */
  private async autoAdvanceNow(room: Room): Promise<void> {
    if (!this.autoAdvanceDue(room, Date.now())) return
    room.nextPlayerAt = null // claim the pick before any await
    try {
      await this.resyncPool(room)
      const picked = await this.pickNextPlayer(room)
      if (!picked) this.notify(room, 'info', { code: 'auto_nothing_left' })
    } catch (err) {
      // e.g. a dropped DB connection — try again shortly rather than stall.
      console.error('[engine] auto-advance pick failed, retrying in 3s:', (err as Error).message)
      if (!room.currentPlayerId) room.nextPlayerAt = Date.now() + 3000
    }
    this.broadcast(room)
  }

  private async actionSetAutoAdvance(
    room: Room,
    payload: Record<string, unknown> | undefined,
  ): Promise<Outcome> {
    if (typeof payload?.enabled !== 'boolean') return this.fail('enabled must be true or false')
    const enabled = payload.enabled
    if (enabled !== room.autoAdvance) {
      await this.db.auction.update({ where: { id: room.auctionId }, data: { autoAdvance: enabled } })
      room.autoAdvance = enabled
      this.notify(
        room,
        'info',
        { code: enabled ? (room.currentPlayerId ? 'auto_on_next' : 'auto_on') : 'auto_off' },
      )
    }
    // Never touches a running session; arms (or cancels) only the next transition.
    this.scheduleAutoAdvance(room)
    this.broadcast(room)
  }

  private async actionSetBidTimer(
    room: Room,
    payload: Record<string, unknown> | undefined,
  ): Promise<Outcome> {
    const seconds = Number(payload?.seconds)
    if (!Number.isInteger(seconds) || seconds < BID_TIMER_RANGE.min || seconds > BID_TIMER_RANGE.max) {
      return this.fail(`Bidding duration must be ${BID_TIMER_RANGE.min}–${BID_TIMER_RANGE.max} seconds`)
    }
    if (seconds !== room.bidTimerSeconds) {
      await this.db.auction.update({ where: { id: room.auctionId }, data: { bidTimerSeconds: seconds } })
      room.bidTimerSeconds = seconds
      this.notify(
        room,
        'info',
        { code: room.currentPlayerId ? 'timer_set_next' : 'timer_set', params: { seconds } },
      )
    }
    this.broadcast(room)
  }

  // ----------------------------------------------------------
  // Timers
  // ----------------------------------------------------------
  private async tick(): Promise<void> {
    const now = Date.now()
    for (const room of [...this.rooms.values()]) {
      if (this.seatlessPauseDue(room, now) && !room.ticking) {
        room.ticking = true
        try {
          await this.withLock(room.auctionId, async () => {
            const live = this.rooms.get(room.auctionId)
            if (live) await this.autoPause(live)
          })
        } catch (err) {
          // e.g. a dropped DB connection — the next tick tries again.
          alert('auto-pause', err, { room: room.roomCode })
        } finally {
          room.ticking = false
        }
        continue
      }
      if (room.seatlessSince != null) {
        // Nobody who can bid or run the room is connected: the lot clock and
        // Auto Auction wait (the room pauses itself after NO_SEATS_PAUSE_MS).
        if (this.seatlessHold(room) || room.ticking) continue
        room.ticking = true
        try {
          await this.withLock(room.auctionId, async () => {
            const live = this.rooms.get(room.auctionId)
            if (live) this.releaseSeatlessHold(live)
          })
        } catch (err) {
          alert('seat-return', err, { room: room.roomCode })
        } finally {
          room.ticking = false
        }
        continue
      }
      if (this.autoAdvanceDue(room, now) && !room.ticking) {
        room.ticking = true
        try {
          await this.withLock(room.auctionId, async () => {
            const live = this.rooms.get(room.auctionId)
            if (live) await this.autoAdvanceNow(live)
          })
        } catch (err) {
          alert('auto-advance', err, { room: room.roomCode })
        } finally {
          room.ticking = false
        }
        continue
      }
      if (room.status !== 'LIVE' || !room.currentPlayerId || room.timerEndsAt == null) continue
      if (room.ticking || now < room.timerEndsAt) continue
      room.ticking = true
      try {
        await this.withLock(room.auctionId, async () => {
          // The snapshot may be stale if a join rebuilt the room; act on the live one.
          const live = this.rooms.get(room.auctionId)
          if (live) await this.advanceTimer(live)
        })
      } catch (err) {
        alert('tick', err, { room: room.roomCode })
      } finally {
        room.ticking = false
      }
    }
  }

  private async advanceTimer(room: Room): Promise<void> {
    if (room.status !== 'LIVE' || !room.currentPlayerId || room.timerEndsAt == null) return
    const now = Date.now()
    if (now < room.timerEndsAt) return
    if (room.stage === 0) {
      room.stage = 1
      room.timerEndsAt = now + room.goingIntervalSeconds * 1000
      this.notify(room, 'warning', { code: 'going_once' }, 'going')
      this.broadcast(room)
    } else if (room.stage === 1) {
      room.stage = 2
      room.timerEndsAt = now + room.goingIntervalSeconds * 1000
      this.notify(room, 'warning', { code: 'going_twice' }, 'going')
      this.broadcast(room)
    } else {
      // An in-time bid is still on its way (seat check / DB): let it land first.
      if (this.bidInFlightBefore(room.auctionId, room.timerEndsAt) && now < room.timerEndsAt + CLOSE_GRACE_MS) return
      // Remember the real deadline: a retried close must not reopen bidding.
      if (room.closing?.playerId !== room.currentPlayerId) room.closing = { playerId: room.currentPlayerId, deadline: room.timerEndsAt }
      room.timerEndsAt = null
      try {
        if (room.currentBid) await this.finalizeSold(room)
        else await this.finalizeUnsold(room)
      } catch (err) {
        // Usually a dropped DB connection. Memory is only updated after a
        // successful write, so retry shortly instead of leaving the player
        // stranded on the block with no timer. finalizeSold is idempotent.
        alert('close-lot', err, { room: room.roomCode, retryInMs: 2000 })
        if (room.currentPlayerId) room.timerEndsAt = Date.now() + 2000
      }
    }
  }

  private emitTimers(): void {
    const now = Date.now()
    for (const room of this.rooms.values()) {
      if (room.status !== 'LIVE' || !room.currentPlayerId || room.timerEndsAt == null) continue
      if (room.seatlessSince != null) continue // clock held — see tick
      this.io.to(`auction:${room.auctionId}`).emit('timer', {
        remainingMs: Math.max(0, room.timerEndsAt - now),
        stage: room.stage,
        serverTime: now,
      })
    }
  }

  // ----------------------------------------------------------
  // Emission helpers
  // ----------------------------------------------------------
  /** `msg` goes out as a code + values (rendered in each viewer's language) plus English for older clients. */
  private notify(room: Room, level: NotifLevel, msg: RoomMsg, kind: NotifKind = 'system'): void {
    const note: RoomNotification = {
      id: randomUUID(),
      level,
      message: roomText(msg, 'en'),
      at: new Date().toISOString(),
      kind,
      code: msg.code,
      ...(msg.params ? { params: msg.params } : {}),
    }
    this.io.to(`auction:${room.auctionId}`).emit('notification', note)
  }

  /** Refusal reason for the caller (index.ts reports it via the ack, or an 'error' event for old clients). */
  private fail(message: string): string {
    return message
  }

  /**
   * Sends the room state to everyone in it. The player pool and participant
   * list — by far the largest parts — are left out when unchanged since the
   * previous broadcast; clients keep their copy and use the fingerprints to
   * detect a gap (then they re-join for a full snapshot).
   */
  private broadcast(room: Room): void {
    if (room.presenceTimer) {
      clearTimeout(room.presenceTimer)
      room.presenceTimer = null
    }
    const state = this.buildState(room)
    const payload: RoomStateWire = { ...state }
    if (state.playersHash === room.lastPlayersHash) delete payload.players
    else room.lastPlayersHash = state.playersHash
    if (state.participantsHash === room.lastParticipantsHash) delete payload.participants
    else room.lastParticipantsHash = state.participantsHash
    this.io.to(`auction:${room.auctionId}`).emit('room_state', payload)
  }

  private schedulePresenceBroadcast(room: Room): void {
    if (room.presenceTimer) return
    room.presenceTimer = setTimeout(() => {
      room.presenceTimer = null
      this.broadcast(room)
    }, 200)
  }

  // ----------------------------------------------------------
  // Room construction / rebuild / state building
  // ----------------------------------------------------------
  private async getOrBuild(auctionId: string): Promise<Room> {
    const existing = this.rooms.get(auctionId)
    if (existing) return existing
    let pending = this.building.get(auctionId)
    if (!pending) {
      pending = this.buildRoom(auctionId).then((room) => {
        this.rooms.set(auctionId, room)
        return room
      })
      this.building.set(auctionId, pending)
      void pending.catch(() => undefined).finally(() => this.building.delete(auctionId))
    }
    return pending
  }

  /** Does the auction row disagree with memory on anything the engine owns? */
  private diverged(room: Room, row: Auction): boolean {
    return (
      row.status !== room.status ||
      row.currentPlayerId !== room.currentPlayerId ||
      row.currentCategory !== room.currentCategory ||
      row.currentBidAmount !== (room.currentBid?.amount ?? null) ||
      row.currentBidTeamId !== (room.currentBid?.teamId ?? null)
    )
  }

  /** Heals in-memory state if the DB diverged (external reset, REST edits). Runs under the room lock. */
  private async syncIfStale(room: Room): Promise<Room> {
    try {
      room.lastSyncAt = Date.now()
      const row = await this.db.auction.findUnique({ where: { id: room.auctionId } })
      if (!row) return room
      if (!this.diverged(room, row)) {
        this.applySettings(room, row)
        return room
      }
      return await this.replaceRoom(room)
    } catch {
      return room
    }
  }

  /** Rebuilds a room from the database and swaps it in, keeping live presence. Runs under the room lock. */
  private async replaceRoom(room: Room): Promise<Room> {
    if (room.presenceTimer) {
      clearTimeout(room.presenceTimer)
      room.presenceTimer = null
    }
    const fresh = await this.buildRoom(room.auctionId)
    fresh.sockets = room.sockets // keep live presence
    fresh.emptySince = room.emptySince
    fresh.seatlessSince = room.seatlessSince
    fresh.closing = room.closing
    this.rooms.set(room.auctionId, fresh)
    return fresh
  }

  private async buildRoom(auctionId: string): Promise<Room> {
    const auction = await this.db.auction.findUnique({ where: { id: auctionId } })
    if (!auction) throw new Error('Auction not found')
    const tournament = await this.db.tournament.findUnique({ where: { id: auction.tournamentId } })
    if (!tournament) throw new Error('Tournament not found')

    const room: Room = {
      auctionId,
      roomCode: auction.roomCode,
      status: auction.status as EngineStatus,
      currentCategory: auction.currentCategory,
      currentPlayerId: auction.currentPlayerId,
      currentBid: null,
      currentBidHistory: [],
      previousOwnerTeamId: null,
      allowPreviousOwnerRebid: auction.allowPreviousOwnerRebid,
      stage: 0,
      timerEndsAt: null,
      pausedRemainingMs: null,
      lastResult: null,
      soldFeed: [],
      bidTimerSeconds: auction.bidTimerSeconds,
      sessionTimerSeconds: auction.bidTimerSeconds,
      goingIntervalSeconds: auction.goingIntervalSeconds,
      minIncrement: auction.minIncrement,
      autoAdvance: auction.autoAdvance,
      nextPlayerAt: null,
      round: auction.round,
      auction,
      tournament,
      teams: [],
      players: [],
      participants: [],
      sockets: new Map(),
      ticking: false,
      presenceTimer: null,
      lastPlayersHash: null,
      lastParticipantsHash: null,
      lastSyncAt: Date.now(),
      emptySince: null,
      seatlessSince: null,
      closing: null,
    }
    await this.refreshCache(room)

    const bids = await this.db.bid.findMany({ where: { auctionId }, orderBy: { createdAt: 'asc' } })
    if (auction.currentPlayerId) {
      // Only the live cycle belongs on the ladder. Bids from a previous cycle
      // of a re-auctioned player stay in history and must not reappear here.
      const onBlock = room.players.find((p) => p.id === auction.currentPlayerId)
      const liveCycle = onBlock?.auctionCycle ?? 0
      room.currentBidHistory = bids
        .filter((b) => b.playerId === auction.currentPlayerId && b.cycle === liveCycle)
        .map((b) => ({
          teamId: b.teamId,
          teamName: b.teamName,
          amount: b.amount,
          createdAt: b.createdAt.toISOString(),
        }))
    }
    if (auction.currentBidAmount != null && auction.currentBidTeamId) {
      const team = room.teams.find((t) => t.id === auction.currentBidTeamId)
      room.currentBid = {
        amount: auction.currentBidAmount,
        teamId: auction.currentBidTeamId,
        teamName: team?.name ?? '',
        teamColor: team?.color ?? null,
      }
    }

    // Reconstruct the sold feed (latest first) from SOLD players + their winning bids.
    const teamNameById = new Map(room.teams.map((t) => [t.id, t.name]))
    const feed: RoomState['soldFeed'] = []
    for (const p of room.players) {
      if (p.status !== 'SOLD') continue
      const lastBid = [...bids].reverse().find((b) => b.playerId === p.id && b.cycle === p.auctionCycle)
      feed.push({
        playerName: p.name,
        teamName: (p.soldToTeamId && teamNameById.get(p.soldToTeamId)) || '',
        price: p.soldPrice ?? 0,
        at: (lastBid?.createdAt ?? auction.createdAt).toISOString(),
      })
    }
    feed.sort((a, b) => (a.at < b.at ? 1 : -1))
    room.soldFeed = feed.slice(0, 12)
    if (room.soldFeed.length > 0) {
      const f = room.soldFeed[0]
      const p = room.players.find((x) => x.status === 'SOLD' && x.name === f.playerName)
      room.lastResult = {
        playerId: p?.id,
        playerName: f.playerName,
        playerNumber: p?.playerNumber ?? 0,
        teamId: p?.soldToTeamId ?? null,
        teamName: f.teamName || null,
        price: f.price,
        type: 'SOLD',
        at: f.at,
      }
    }

    // After a restart no sockets are connected yet.
    try {
      await this.db.roomParticipant.updateMany({ where: { auctionId }, data: { online: false } })
    } catch {
      // non-fatal
    }
    await this.refreshParticipants(room)

    // Recover the re-auction lockout: the RE_AUCTION event for the live cycle
    // names the team that lost the player, so the policy survives a restart.
    if (auction.currentPlayerId) {
      const onBlock = room.players.find((p) => p.id === auction.currentPlayerId)
      if (onBlock && onBlock.auctionCycle > 0) {
        try {
          const ev = await this.db.auctionEvent.findFirst({
            where: {
              auctionId,
              playerId: onBlock.id,
              cycle: onBlock.auctionCycle,
              type: 'RE_AUCTION',
            },
            orderBy: { createdAt: 'desc' },
          })
          room.previousOwnerTeamId = ev?.teamId ?? null
        } catch {
          room.previousOwnerTeamId = null
        }
      }
    }

    // Resume timers after restart.
    if (room.status === 'LIVE' && room.currentPlayerId) {
      room.stage = 0
      room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
    } else if (room.status === 'PAUSED' && room.currentPlayerId) {
      room.pausedRemainingMs = room.sessionTimerSeconds * 1000
    } else if (room.status === 'LIVE') {
      // Empty block after a restart: Auto Auction carries on by itself.
      this.scheduleAutoAdvance(room)
    }
    return room
  }

  /**
   * Re-reads teams and players only (not the auction/tournament rows, which the
   * engine owns while a room is live). Called at the boundaries between players
   * so squad, budget and pool edits made through the REST API while the auction
   * is running are picked up instead of going unnoticed.
   */
  private async resyncPool(room: Room, opts: { strict?: boolean } = {}): Promise<void> {
    try {
      const [auctionRow, tournamentRow, teams, players, squadGroups] = await Promise.all([
        this.db.auction.findUnique({ where: { id: room.auctionId } }),
        // The organizer may switch auction mode (or sport) through the REST
        // API after the room was first opened but before the auction starts.
        this.db.tournament.findUnique({ where: { id: room.tournament.id } }),
        this.db.team.findMany({ where: { tournamentId: room.tournament.id }, orderBy: { name: 'asc' } }),
        this.db.player.findMany({
          where: { tournamentId: room.tournament.id },
          orderBy: { playerNumber: 'asc' },
        }),
        this.db.player.groupBy({
          by: ['soldToTeamId'],
          _count: { _all: true },
          where: { tournamentId: room.tournament.id, status: 'SOLD', soldToTeamId: { not: null } },
        }),
      ])
      const counts = new Map<string, number>()
      for (const g of squadGroups) if (g.soldToTeamId) counts.set(g.soldToTeamId, g._count._all)
      room.teams = teams.map((t) => ({ ...t, squadCount: counts.get(t.id) ?? 0 }))
      room.players = players
      if (tournamentRow) room.tournament = tournamentRow
      if (auctionRow) this.applySettings(room, auctionRow)
    } catch (err) {
      console.error(`[engine] pool re-read failed for room ${room.roomCode}:`, (err as Error).message)
      // Strict callers decide something from this read — they must not act on a stale pool.
      if (opts.strict) throw err
      // Otherwise keep the previous cache — a stale pool beats dropping the live room.
    }
  }

  /**
   * Copies the organizer-editable settings from the auction row. Timings can be
   * changed through the REST API while the auction is READY — possibly after
   * someone already opened the room — and the re-auction policy at any time.
   */
  private applySettings(room: Room, row: Auction): void {
    room.auction = row
    room.bidTimerSeconds = row.bidTimerSeconds
    room.goingIntervalSeconds = row.goingIntervalSeconds
    room.minIncrement = row.minIncrement
    room.allowPreviousOwnerRebid = row.allowPreviousOwnerRebid
    room.autoAdvance = row.autoAdvance
    if (!room.autoAdvance) room.nextPlayerAt = null
    room.round = row.round
  }

  /** Refreshes DB-backed caches (auction/tournament rows, teams+squads, players). */
  private async refreshCache(room: Room): Promise<void> {
    const [auction, tournament, teams, players, squadGroups] = await Promise.all([
      this.db.auction.findUnique({ where: { id: room.auctionId } }),
      this.db.tournament.findUnique({ where: { id: room.tournament.id } }),
      this.db.team.findMany({ where: { tournamentId: room.tournament.id }, orderBy: { name: 'asc' } }),
      this.db.player.findMany({
        where: { tournamentId: room.tournament.id },
        orderBy: { playerNumber: 'asc' },
      }),
      this.db.player.groupBy({
        by: ['soldToTeamId'],
        _count: { _all: true },
        where: { tournamentId: room.tournament.id, status: 'SOLD', soldToTeamId: { not: null } },
      }),
    ])
    if (!auction || !tournament) throw new Error('Auction data missing')
    room.auction = auction
    room.tournament = tournament
    const counts = new Map<string, number>()
    for (const g of squadGroups) if (g.soldToTeamId) counts.set(g.soldToTeamId, g._count._all)
    room.teams = teams.map((t) => ({ ...t, squadCount: counts.get(t.id) ?? 0 }))
    room.players = players
  }

  private buildState(room: Room): RoomState {
    const now = Date.now()
    const teamNameById = new Map(room.teams.map((t) => [t.id, t.name]))
    const currentPlayerRow = room.currentPlayerId
      ? room.players.find((p) => p.id === room.currentPlayerId) ?? null
      : null

    const categories: RoomState['categories'] = []
    if (room.tournament.auctionMode === 'CATEGORY') {
      for (const code of CATEGORY_CODES) {
        const ps = room.players.filter((p) => p.category === code)
        if (ps.length === 0) continue
        categories.push({
          code,
          total: ps.length,
          available: ps.filter((p) => p.status === 'AVAILABLE').length,
          basePrice: Math.min(...ps.map((p) => p.basePrice)),
        })
      }
    }

    let available = 0
    let sold = 0
    let unsold = 0
    let skipped = 0
    let uncategorized = 0
    for (const p of room.players) {
      if (p.status === 'AVAILABLE') available++
      else if (p.status === 'SOLD') sold++
      else if (p.status === 'UNSOLD') unsold++
      else if (p.status === 'SKIPPED') skipped++
      if (!p.category && p.status !== 'SOLD') uncategorized++
    }

    const players: RoomState['players'] = room.players.map((p) => ({
      id: p.id,
      playerNumber: p.playerNumber,
      name: p.name,
      role: p.role,
      category: p.category,
      basePrice: p.basePrice,
      status: p.status as RoomState['players'][number]['status'],
      soldPrice: p.soldPrice,
      auctionCycle: p.auctionCycle,
      teamId: p.soldToTeamId,
      teamName: p.soldToTeamId ? teamNameById.get(p.soldToTeamId) ?? null : null,
    }))

    // Seats only (organizer + managers). Viewers are a live count — a streamed
    // auction can have hundreds, and every past viewer row used to ride along
    // on every single bid broadcast.
    const participants: RoomState['participants'] = room.participants
      .filter((p) => p.role !== 'VIEWER')
      .map((p) => ({
        name: p.name,
        role: p.role as RoomRole,
        teamId: p.teamId,
        online: this.identityOnline(room, p.role as RoomRole, p.name),
      }))
    let viewersOnline = 0
    for (const s of room.sockets.values()) if (s.role === 'VIEWER') viewersOnline++

    return {
      auctionId: room.auctionId,
      roomCode: room.roomCode,
      tournamentId: room.tournament.id,
      tournamentName: room.tournament.name,
      sport: room.tournament.sport as RoomState['sport'],
      mode: room.tournament.auctionMode as RoomState['mode'],
      status: room.status,
      currentCategory: room.currentCategory,
      categories,
      currentPlayer: currentPlayerRow
        ? {
            id: currentPlayerRow.id,
            auctionCycle: currentPlayerRow.auctionCycle,
            playerNumber: currentPlayerRow.playerNumber,
            name: currentPlayerRow.name,
            role: currentPlayerRow.role,
            category: currentPlayerRow.category,
            basePrice: currentPlayerRow.basePrice,
            photoUrl: currentPlayerRow.photoUrl,
            previousTeam: currentPlayerRow.previousTeam,
            // phone deliberately omitted — this state reaches anonymous viewers
          }
        : null,
      currentBid: room.currentBid,
      currentBidHistory: room.currentBidHistory,
      stage: room.stage,
      timerEndsAt: room.timerEndsAt,
      serverTime: now,
      pausedRemainingMs: room.pausedRemainingMs,
      teams: room.teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        logoUrl: t.logoUrl,
        budget: t.budget,
        spent: t.spent,
        remaining: t.budget - t.spent,
        maxBid: maxBidFor(room.players, t, room.currentPlayerId ?? undefined),
        squadCount: t.squadCount,
        maxSquad: t.maxSquad,
        minSquad: t.minSquad,
        online: this.teamOnline(room, t.id),
      })),
      participants,
      participantsHash: fingerprint(participants),
      viewersOnline,
      players,
      playersHash: fingerprint(players),
      pool: { total: room.players.length, available, sold, unsold, skipped, uncategorized },
      lastResult: room.lastResult,
      soldFeed: room.soldFeed,
      minIncrement: room.minIncrement,
      bidTimerSeconds: room.bidTimerSeconds,
      sessionTimerSeconds: room.sessionTimerSeconds,
      goingIntervalSeconds: room.goingIntervalSeconds,
      autoAdvance: room.autoAdvance,
      nextPlayerAt: room.nextPlayerAt,
      round: room.round,
      previousOwnerTeamId: room.previousOwnerTeamId,
      allowPreviousOwnerRebid: room.allowPreviousOwnerRebid,
    }
  }

  // ----------------------------------------------------------
  // Per-room async lock (serializes bids/organizer actions/ticks)
  // ----------------------------------------------------------
  private withLock<T>(auctionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(auctionId) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    this.locks.set(auctionId, next.catch(() => undefined))
    return next
  }
}
