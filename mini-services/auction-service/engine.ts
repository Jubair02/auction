// ============================================================
// NeelamGhor — AuctionEngine (live auction state machine)
// One in-memory Room per auctionId; authoritative for timers, bids,
// stage transitions (GOING ONCE/TWICE) and presence. Every transition
// is persisted to SQLite via Prisma. Rooms are rebuilt from the DB on
// first touch after a service restart, and self-heal on join if the
// DB state diverges from memory (e.g. external reset).
// ============================================================
import { createHash, randomInt, randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import type {
  Prisma,
  Auction,
  Tournament,
  Team,
  Player,
  RoomParticipant,
} from '@prisma/client'
import type { RoomState, RoomStateWire, RoomRole, SocketIdentity } from '../../src/lib/types'
import { BOUNDED_TX_SQL, type ResilientClient } from '../../src/lib/db-resilience'
import { bdt, maxBidFor, validateBid } from './rules'

type EngineStatus = 'READY' | 'LIVE' | 'PAUSED' | 'ENDED'
type NotifLevel = 'info' | 'success' | 'warning' | 'error'

/** Who triggered a money- or ownership-moving event. Null actor = the timer. */
interface Actor {
  id?: string | null
  name?: string | null
}

/** Append-only audit trail entry. */
type AuditType = 'SALE' | 'RE_AUCTION' | 'REFUND' | 'UNSOLD' | 'SKIPPED'

/** Thrown when a re-auction loses the compare-and-swap race. */
class SaleAlreadyChanged extends Error {}

const CATEGORY_CODES = ['A', 'B', 'C', 'D', 'E']
/** Pause between a SOLD/UNSOLD call and the auto-picked next player, so everyone sees the result. */
const AUTO_ADVANCE_DELAY_MS = 4000
const BID_TIMER_RANGE = { min: 5, max: 600 }

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
}

/** Short content fingerprint used to skip re-sending unchanged lists. */
const fingerprint = (value: unknown) => createHash('sha1').update(JSON.stringify(value)).digest('base64url').slice(0, 16)

export class AuctionEngine {
  private rooms = new Map<string, Room>()
  private building = new Map<string, Promise<Room>>()
  private socketRooms = new Map<string, { auctionId: string; identity: SocketIdentity }>()
  private locks = new Map<string, Promise<unknown>>()
  private ticker: ReturnType<typeof setInterval>
  private timerEmitter: ReturnType<typeof setInterval>

  constructor(
    private io: Server,
    private db: ResilientClient,
  ) {
    // Single global ticker: stage transitions + finalize (500ms resolution).
    this.ticker = setInterval(() => void this.tick(), 500)
    // 1s timer broadcast while LIVE + currentPlayer + not paused.
    this.timerEmitter = setInterval(() => this.emitTimers(), 1000)
  }

  dispose(): void {
    clearInterval(this.ticker)
    clearInterval(this.timerEmitter)
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
        socket.leave(`auction:${prev.auctionId}`)
        void this.refreshParticipants(old).then(() => this.schedulePresenceBroadcast(old))
      }
    }

    // Under the room lock: a heal/rebuild must never swap the room object out
    // from under a bid, organizer action or timer tick that is mid-flight.
    const room = await this.withLock(auctionId, async () => {
      const existing = this.rooms.get(auctionId)
      return existing ? this.syncIfStale(existing) : this.getOrBuild(auctionId)
    })

    room.sockets.set(socket.id, { role: identity.role, name: identity.name, teamId: identity.teamId })
    this.socketRooms.set(socket.id, { auctionId, identity })
    // Join the broadcast room BEFORE building the snapshot we hand back, so no
    // broadcast can fall in the gap between the two (the client ignores delta
    // broadcasts until its full snapshot arrives).
    await socket.join(`auction:${auctionId}`)

    await this.upsertParticipant(room, identity)
    await this.refreshParticipants(room)
    this.schedulePresenceBroadcast(room)
    return this.buildState(room)
  }

  async leave(socket: Socket): Promise<void> {
    const rec = this.socketRooms.get(socket.id)
    this.socketRooms.delete(socket.id)
    if (!rec) return
    const room = this.rooms.get(rec.auctionId)
    if (!room) return
    room.sockets.delete(socket.id)

    const stillOnline = [...room.sockets.values()].some(
      (s) => s.role === rec.identity.role && s.name === rec.identity.name,
    )
    if (!stillOnline) {
      try {
        await this.db.roomParticipant.updateMany({
          where: { auctionId: room.auctionId, role: rec.identity.role, name: rec.identity.name },
          data: { online: false, lastSeen: new Date() },
        })
      } catch {
        // non-fatal
      }
    }
    await this.refreshParticipants(room)
    this.schedulePresenceBroadcast(room)
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
      room.participants = await this.db.roomParticipant.findMany({
        where: { auctionId: room.auctionId },
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
  async placeBid(socket: Socket, identity: SocketIdentity, rawAmount: unknown): Promise<void> {
    await this.withLock(identity.auctionId, async () => {
      // Resolved inside the lock — a join may have rebuilt the room meanwhile.
      const room = this.rooms.get(identity.auctionId)
      if (!room) return this.emitError(socket, 'Join the room first')
      if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
      const player = room.players.find((p) => p.id === room.currentPlayerId)
      if (!room.currentPlayerId || !player) return this.emitError(socket, 'No player on the block')
      const amount = Number(rawAmount)
      const team = room.teams.find((t) => t.id === identity.teamId)
      if (!team) return this.emitError(socket, 'You are not assigned to a team in this room')
      if (!(await this.holdsSeat(team, identity.userId))) {
        return this.emitError(socket, "You are no longer this team's manager — log in with the team's account and rejoin")
      }
      const invalid = this.validateBid(room, team, player, amount, { manual: false })
      if (invalid) return this.emitError(socket, invalid)

      const created = await this.db.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
        const bid = await tx.bid.create({
          data: {
            auctionId: room.auctionId,
            playerId: player.id,
            teamId: team.id,
            teamName: team.name,
            playerName: player.name,
            amount,
            cycle: player.auctionCycle,
          },
        })
        await tx.auction.update({
          where: { id: room.auctionId },
          data: { currentBidAmount: amount, currentBidTeamId: team.id, bidCount: { increment: 1 } },
        })
        return bid
      })

      room.currentBid = { amount, teamId: team.id, teamName: team.name, teamColor: team.color }
      room.currentBidHistory = [
        ...room.currentBidHistory,
        { teamId: team.id, teamName: team.name, amount, createdAt: created.createdAt.toISOString() },
      ]
      room.stage = 0
      room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
      room.pausedRemainingMs = null
      this.notify(room, 'success', `${team.name} bids ${bdt(amount)} for ${player.name}`)
      this.broadcast(room)
    })
  }

  async organizerAction(
    socket: Socket,
    identity: SocketIdentity,
    action: string | undefined,
    payload: Record<string, unknown> | undefined,
  ): Promise<void> {
    const actor: Actor = { id: identity.userId ?? null, name: identity.name }
    await this.withLock(identity.auctionId, async () => {
      // Resolved inside the lock — a join may have rebuilt the room meanwhile.
      const room = this.rooms.get(identity.auctionId)
      if (!room) return this.emitError(socket, 'Join the room first')
      switch (action) {
        case 'start': return this.actionStart(socket, room)
        case 'pause': return this.actionPause(socket, room)
        case 'resume': return this.actionResume(socket, room)
        case 'next_player': return this.actionNextPlayer(socket, room)
        case 'select_player': return this.actionSelectPlayer(socket, room, payload)
        case 'set_category': return this.actionSetCategory(socket, room, payload)
        case 'skip': return this.actionSkip(socket, room, actor)
        case 'force_sell': return this.actionForceSell(socket, room, actor)
        case 'force_unsold': return this.actionForceUnsold(socket, room, actor)
        case 'reauction': return this.actionReauction(socket, room, payload, actor)
        case 'manual_bid': return this.manualBid(socket, room, payload, actor)
        case 'end': return this.actionEnd(socket, room)
        case 'reopen': return this.actionReopen(socket, room)
        case 'set_auto_advance': return this.actionSetAutoAdvance(socket, room, payload)
        case 'set_bid_timer': return this.actionSetBidTimer(socket, room, payload)
        case 'reauction_unsold': return this.actionReauctionUnsold(socket, room, actor)
        default: return this.emitError(socket, `Unknown action: ${String(action)}`)
      }
    })
  }

  // ---------- organizer actions ----------
  private async actionStart(socket: Socket, room: Room): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'Auction has already ended')
    if (room.status !== 'READY') return this.emitError(socket, 'Auction already started')
    // Pick up anything the organizer added since the room was first built.
    await this.resyncPool(room)
    if (room.players.length === 0) return this.emitError(socket, 'Add at least one player before starting')
    if (room.teams.length === 0) return this.emitError(socket, 'Add at least one team before starting')
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'LIVE' } }),
      this.db.tournament.update({ where: { id: room.tournament.id }, data: { status: 'LIVE' } }),
    ])
    room.status = 'LIVE'
    room.pausedRemainingMs = null

    // CATEGORY mode: default to the first category that still has players.
    if (room.tournament.auctionMode === 'CATEGORY' && !room.currentCategory) {
      const first = CATEGORY_CODES.find((code) =>
        room.players.some((p) => p.category === code && p.status === 'AVAILABLE'),
      )
      if (first) {
        room.currentCategory = first
        await this.db.auction.update({ where: { id: room.auctionId }, data: { currentCategory: first } })
      }
    }

    this.notify(room, 'success', 'Auction started! Good luck everyone.')
    if (!room.currentPlayerId) await this.pickNextPlayer(room)
    this.broadcast(room)
  }

  private async actionPause(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    room.status = 'PAUSED'
    room.pausedRemainingMs =
      room.currentPlayerId && room.timerEndsAt != null
        ? Math.max(0, room.timerEndsAt - Date.now())
        : null
    await this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'PAUSED' } })
    this.notify(room, 'info', 'Auction paused')
    this.broadcast(room)
  }

  private async actionResume(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'PAUSED') return this.emitError(socket, 'Auction is not paused')
    room.status = 'LIVE'
    room.timerEndsAt = room.currentPlayerId ? Date.now() + (room.pausedRemainingMs ?? room.sessionTimerSeconds * 1000) : null
    room.pausedRemainingMs = null
    if (!room.currentPlayerId) this.scheduleAutoAdvance(room)
    await this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'LIVE' } })
    this.notify(room, 'info', 'Auction resumed')
    this.broadcast(room)
  }

  private async actionNextPlayer(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (room.currentPlayerId) return this.emitError(socket, 'A player is already on the block')
    await this.resyncPool(room)
    await this.pickNextPlayer(room)
    this.broadcast(room)
  }

  private async actionSelectPlayer(socket: Socket, room: Room, payload: Record<string, unknown> | undefined): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (room.currentPlayerId) return this.emitError(socket, 'A player is already on the block')
    await this.resyncPool(room)
    const playerId = String(payload?.playerId ?? '')
    const player = room.players.find((p) => p.id === playerId)
    if (!player) return this.emitError(socket, 'Player not found')
    if (player.status !== 'AVAILABLE' && player.status !== 'UNSOLD' && player.status !== 'SKIPPED') {
      return this.emitError(socket, 'Player is not selectable (SOLD players need Re-auction)')
    }
    await this.putOnBlock(room, player)
    this.broadcast(room)
  }

  private async actionSetCategory(socket: Socket, room: Room, payload: Record<string, unknown> | undefined): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'Auction has ended')
    if (room.tournament.auctionMode !== 'CATEGORY') return this.emitError(socket, 'This auction is not in category mode')
    const category = String(payload?.category ?? '').toUpperCase()
    if (!CATEGORY_CODES.includes(category)) return this.emitError(socket, 'Invalid category (A–E)')
    room.currentCategory = category
    await this.db.auction.update({ where: { id: room.auctionId }, data: { currentCategory: category } })
    this.notify(room, 'info', `Category ${category} selected`)
    this.broadcast(room)
  }

  private async actionSkip(socket: Socket, room: Room, actor: Actor): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!room.currentPlayerId || !player) return this.emitError(socket, 'No player on the block')
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
    this.notify(room, 'info', `${player.name} is skipped by the organizer`)
    this.broadcast(room)
  }

  private async actionForceSell(socket: Socket, room: Room, actor: Actor): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (!room.currentPlayerId) return this.emitError(socket, 'No player on the block')
    if (!room.currentBid) return this.emitError(socket, 'No bid to sell — use Force Unsold instead')
    await this.finalizeSold(room, actor)
  }

  private async actionForceUnsold(socket: Socket, room: Room, actor: Actor): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (!room.currentPlayerId) return this.emitError(socket, 'No player on the block')
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
    socket: Socket,
    room: Room,
    payload: Record<string, unknown> | undefined,
    actor: Actor,
  ): Promise<void> {
    // ---- when is re-auction allowed ----
    if (room.status === 'ENDED') {
      return this.emitError(socket, 'The auction has ended — reopen it before re-auctioning a player.')
    }
    if (room.status === 'PAUSED') {
      return this.emitError(socket, 'Resume the auction before re-auctioning a player.')
    }
    if (room.status !== 'LIVE') {
      return this.emitError(socket, 'Start the auction before re-auctioning a player.')
    }
    if (room.currentPlayerId) {
      const onBlock = room.players.find((p) => p.id === room.currentPlayerId)
      return this.emitError(
        socket,
        `${onBlock?.name ?? 'A player'} is on the block — sell, mark unsold or skip them first.`,
      )
    }

    const playerId = String(payload?.playerId ?? '')
    if (!playerId) return this.emitError(socket, 'No player selected')

    // Always read the row fresh: the cached pool can lag behind, and the
    // freshness of `status` is what makes the swap below safe.
    const player = await this.db.player.findUnique({ where: { id: playerId } })
    if (!player || player.tournamentId !== room.tournament.id) {
      return this.emitError(socket, 'Player not found in this tournament')
    }
    if (player.status === 'LIVE') {
      return this.emitError(socket, 'This player is already on the auction block.')
    }
    if (player.status !== 'SOLD') {
      return this.emitError(
        socket,
        `Only a sold player can be re-auctioned — ${player.name} is ${player.status.toLowerCase()}. Pick them from the pool to put them on the block.`,
      )
    }
    if (!player.soldToTeamId || player.soldPrice == null) {
      return this.emitError(socket, 'That sale has no recorded team or price, so it cannot be refunded.')
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
        return this.emitError(socket, 'That sale has already been changed — refresh the pool and try again.')
      }
      throw err
    }

    // Purses and squad counts must be re-read: the new cycle's bid ceilings
    // are computed from the state *after* the refund, never from stale values.
    await this.resyncPool(room)

    room.currentPlayerId = player.id
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
      `${player.name} goes back under the hammer (round ${nextCycle + 1}) — ${bdt(refund)} refunded to ${team?.name ?? 'the previous team'}. Bidding restarts at ${bdt(player.basePrice)}.` +
        (room.allowPreviousOwnerRebid ? '' : ` ${team?.name ?? 'The previous team'} cannot bid in this round.`),
    )
    this.broadcast(room)
  }

  private async actionEnd(socket: Socket, room: Room): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'Auction already ended')
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
    this.notify(room, 'success', 'Auction ended. Final squads are ready!')
    this.broadcast(room)
  }

  /**
   * Undoes an End. Sold players, budgets and squads are untouched — the room
   * simply goes live again so the organizer can keep going. Without this an
   * accidental End leaves the tournament permanently stuck on COMPLETED.
   */
  private async actionReopen(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'ENDED') return this.emitError(socket, 'The auction is not ended')
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
      room.autoAdvance
        ? 'Auction reopened — Auto Auction brings the next player up shortly.'
        : 'Auction reopened — bring the next player to the block.',
    )
    this.broadcast(room)
  }

  private async manualBid(
    socket: Socket,
    room: Room,
    payload: Record<string, unknown> | undefined,
    actor: Actor,
  ): Promise<void> {
    const teamId = String(payload?.teamId ?? '')
    const team = room.teams.find((t) => t.id === teamId)
    if (!team) return this.emitError(socket, 'Team not found')
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!room.currentPlayerId || !player) return this.emitError(socket, 'No player on the block')
    const amount = Number(payload?.amount)
    const invalid = this.validateBid(room, team, player, amount, { manual: true })
    if (invalid) return this.emitError(socket, invalid)

    await this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
      await tx.bid.create({
        data: {
          auctionId: room.auctionId,
          playerId: player.id,
          teamId: team.id,
          teamName: team.name,
          playerName: player.name,
          amount,
          cycle: player.auctionCycle,
        },
      })
      await tx.auction.update({
        where: { id: room.auctionId },
        data: { currentBidAmount: amount, currentBidTeamId: team.id, bidCount: { increment: 1 } },
      })
    })

    room.currentBid = { amount, teamId: team.id, teamName: team.name, teamColor: team.color }
    room.currentBidHistory = [
      ...room.currentBidHistory,
      { teamId: team.id, teamName: team.name, amount, createdAt: new Date().toISOString() },
    ]
    room.stage = 0
    room.timerEndsAt = Date.now() + room.sessionTimerSeconds * 1000
    room.pausedRemainingMs = null
    this.notify(room, 'info', `Manual bid by ${actor.name ?? 'the organizer'}: ${team.name} → ${bdt(amount)}`)
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
          ? `Round ${room.round} complete — re-auction the ${leftOver} unsold & skipped player${leftOver === 1 ? '' : 's'}, or finalize the auction.`
          : `Round ${room.round} complete — every player has been sold. Finalize the auction when ready.`,
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
          room.currentCategory = nextCode
          await this.db.auction.update({
            where: { id: room.auctionId },
            data: { currentCategory: nextCode },
          })
          this.notify(room, 'info', `Category complete — moving on to Category ${nextCode}`)
          candidates = pool.filter((p) => p.category === nextCode)
        } else {
          // Nothing categorised is left; fall back to the uncategorised players
          // so they can never be stranded outside the A–E buckets.
          candidates = pool.filter((p) => !p.category)
          if (candidates.length === 0) {
            this.notify(room, 'info', 'No categorised players left — end the auction or pick from the pool.')
            return false
          }
          this.notify(room, 'warning', 'Auctioning players that have no category set')
        }
      }
    }

    const player = candidates[randomInt(candidates.length)]
    await this.putOnBlock(room, player)
    return true
  }

  private async putOnBlock(room: Room, player: Player): Promise<void> {
    await this.db.$transaction([
      this.db.$queryRawUnsafe(BOUNDED_TX_SQL),
      this.db.player.update({ where: { id: player.id }, data: { status: 'LIVE' } }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: player.id, currentBidAmount: null, currentBidTeamId: null },
      }),
    ])
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
    this.notify(room, 'info', `Player #${player.playerNumber} — ${player.name} is on the block!`)
  }

  private async finalizeSold(room: Room, actor?: Actor): Promise<void> {
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    const bid = room.currentBid
    if (!player || !bid) return
    // Compare-and-swap on "still on the block in this cycle": if a previous
    // attempt committed but its reply was lost (dropped DB connection) and the
    // timer retries, the team must not be charged twice.
    const applied = await this.db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(BOUNDED_TX_SQL)
      const claimed = await tx.player.updateMany({
        where: { id: player.id, status: 'LIVE', auctionCycle: player.auctionCycle },
        data: { status: 'SOLD', soldPrice: bid.amount, soldToTeamId: bid.teamId },
      })
      if (claimed.count !== 1) return false
      await tx.team.update({ where: { id: bid.teamId }, data: { spent: { increment: bid.amount } } })
      await tx.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
      })
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
    if (!applied) {
      const row = await this.db.player.findUnique({ where: { id: player.id } })
      const alreadySold = row?.status === 'SOLD' && row.soldToTeamId === bid.teamId && row.soldPrice === bid.amount
      if (!alreadySold) {
        // Something else changed the player — trust the database, not memory.
        console.error(`[engine] sale of ${player.id} skipped: player is ${row?.status ?? 'missing'} in the database`)
        await this.resyncPool(room)
        room.currentPlayerId = null
        room.currentBid = null
        room.currentBidHistory = []
        room.stage = 0
        room.timerEndsAt = null
        this.broadcast(room)
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
    this.notify(room, 'success', `${player.name} SOLD to ${bid.teamName} for ${bdt(bid.amount)}!`)
    this.broadcast(room)
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
    this.notify(room, 'error', `${player.name} goes UNSOLD`)
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
  private async actionReauctionUnsold(socket: Socket, room: Room, actor: Actor): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'The auction is finalized — reopen it first.')
    if (room.status !== 'LIVE') return this.emitError(socket, 'Resume the auction before starting a new round.')
    if (room.currentPlayerId) return this.emitError(socket, 'A player is on the block — finish this round first.')

    await this.resyncPool(room)
    if (room.players.some((p) => p.status === 'AVAILABLE')) {
      return this.emitError(socket, 'This round still has players to auction — finish the round first.')
    }
    const returning = room.players.filter((p) => p.status === 'UNSOLD' || p.status === 'SKIPPED')
    if (returning.length === 0) return this.emitError(socket, 'There are no unsold or skipped players to re-auction.')

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

    await this.resyncPool(room)
    room.round = nextRound
    room.lastResult = null
    room.previousOwnerTeamId = null
    // CATEGORY mode: start the round at the first category that has players again.
    if (room.tournament.auctionMode === 'CATEGORY') {
      const first = CATEGORY_CODES.find((code) => room.players.some((p) => p.category === code && p.status === 'AVAILABLE'))
      if (first && first !== room.currentCategory) {
        room.currentCategory = first
        await this.db.auction.update({ where: { id: room.auctionId }, data: { currentCategory: first } })
      }
    }
    this.scheduleAutoAdvance(room) // Auto Auction ON → the round's first player comes up by itself
    this.notify(
      room,
      'success',
      `Round ${nextRound} started — ${returning.length} unsold & skipped player${returning.length === 1 ? ' is' : 's are'} back under the hammer.`,
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
      if (!picked) this.notify(room, 'info', 'Auto Auction: no players left to bring up.')
    } catch (err) {
      // e.g. a dropped DB connection — try again shortly rather than stall.
      console.error('[engine] auto-advance pick failed, retrying in 3s:', (err as Error).message)
      if (!room.currentPlayerId) room.nextPlayerAt = Date.now() + 3000
    }
    this.broadcast(room)
  }

  private async actionSetAutoAdvance(
    socket: Socket,
    room: Room,
    payload: Record<string, unknown> | undefined,
  ): Promise<void> {
    if (typeof payload?.enabled !== 'boolean') return this.emitError(socket, 'enabled must be true or false')
    const enabled = payload.enabled
    if (enabled !== room.autoAdvance) {
      await this.db.auction.update({ where: { id: room.auctionId }, data: { autoAdvance: enabled } })
      room.autoAdvance = enabled
      this.notify(
        room,
        'info',
        enabled
          ? room.currentPlayerId
            ? 'Auto Auction ON — the next player comes up automatically after this one.'
            : 'Auto Auction ON'
          : 'Auto Auction OFF — use Next player to bring up each player.',
      )
    }
    // Never touches a running session; arms (or cancels) only the next transition.
    this.scheduleAutoAdvance(room)
    this.broadcast(room)
  }

  private async actionSetBidTimer(
    socket: Socket,
    room: Room,
    payload: Record<string, unknown> | undefined,
  ): Promise<void> {
    const seconds = Number(payload?.seconds)
    if (!Number.isInteger(seconds) || seconds < BID_TIMER_RANGE.min || seconds > BID_TIMER_RANGE.max) {
      return this.emitError(socket, `Bidding duration must be ${BID_TIMER_RANGE.min}–${BID_TIMER_RANGE.max} seconds`)
    }
    if (seconds !== room.bidTimerSeconds) {
      await this.db.auction.update({ where: { id: room.auctionId }, data: { bidTimerSeconds: seconds } })
      room.bidTimerSeconds = seconds
      this.notify(
        room,
        'info',
        room.currentPlayerId
          ? `Bidding duration set to ${seconds}s — applies from the next player.`
          : `Bidding duration set to ${seconds}s.`,
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
      if (this.autoAdvanceDue(room, now) && !room.ticking) {
        room.ticking = true
        try {
          await this.withLock(room.auctionId, async () => {
            const live = this.rooms.get(room.auctionId)
            if (live) await this.autoAdvanceNow(live)
          })
        } catch (err) {
          console.error('[engine] auto-advance error', err)
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
        console.error('[engine] tick error', err)
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
      this.notify(room, 'warning', 'GOING ONCE!')
      this.broadcast(room)
    } else if (room.stage === 1) {
      room.stage = 2
      room.timerEndsAt = now + room.goingIntervalSeconds * 1000
      this.notify(room, 'warning', 'GOING TWICE!')
      this.broadcast(room)
    } else {
      room.timerEndsAt = null
      try {
        if (room.currentBid) await this.finalizeSold(room)
        else await this.finalizeUnsold(room)
      } catch (err) {
        // Usually a dropped DB connection. Memory is only updated after a
        // successful write, so retry shortly instead of leaving the player
        // stranded on the block with no timer. finalizeSold is idempotent.
        console.error('[engine] closing the lot failed, retrying in 2s:', (err as Error).message)
        if (room.currentPlayerId) room.timerEndsAt = Date.now() + 2000
      }
    }
  }

  private emitTimers(): void {
    const now = Date.now()
    for (const room of this.rooms.values()) {
      if (room.status !== 'LIVE' || !room.currentPlayerId || room.timerEndsAt == null) continue
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
  private notify(room: Room, level: NotifLevel, message: string): void {
    this.io.to(`auction:${room.auctionId}`).emit('notification', {
      id: randomUUID(),
      level,
      message,
      at: new Date().toISOString(),
    })
  }

  private emitError(socket: Socket, message: string): void {
    socket.emit('error', { message })
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

  /** Heals in-memory state if the DB diverged (external reset, REST edits). */
  private async syncIfStale(room: Room): Promise<Room> {
    try {
      const row = await this.db.auction.findUnique({ where: { id: room.auctionId } })
      if (!row) return room
      const stale =
        row.status !== room.status ||
        row.currentPlayerId !== room.currentPlayerId ||
        row.currentCategory !== room.currentCategory ||
        row.currentBidAmount !== (room.currentBid?.amount ?? null)
      if (!stale) {
        this.applySettings(room, row)
        return room
      }
      if (room.presenceTimer) {
        clearTimeout(room.presenceTimer)
        room.presenceTimer = null
      }
      const fresh = await this.buildRoom(room.auctionId)
      fresh.sockets = room.sockets // keep live presence
      this.rooms.set(room.auctionId, fresh)
      return fresh
    } catch {
      return room
    }
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
  private async resyncPool(room: Room): Promise<void> {
    try {
      const [auctionRow, teams, players, squadGroups] = await Promise.all([
        this.db.auction.findUnique({ where: { id: room.auctionId } }),
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
      if (auctionRow) this.applySettings(room, auctionRow)
    } catch {
      // keep the previous cache — a stale pool beats dropping the live room
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
