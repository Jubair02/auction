// ============================================================
// NeelamGhor — AuctionEngine (live auction state machine)
// One in-memory Room per auctionId; authoritative for timers, bids,
// stage transitions (GOING ONCE/TWICE) and presence. Every transition
// is persisted to SQLite via Prisma. Rooms are rebuilt from the DB on
// first touch after a service restart, and self-heal on join if the
// DB state diverges from memory (e.g. external reset).
// ============================================================
import { randomInt, randomUUID } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import type {
  Prisma,
  PrismaClient,
  Auction,
  Tournament,
  Team,
  Player,
  RoomParticipant,
} from '@prisma/client'
import type { RoomState, RoomRole, SocketIdentity } from '../../src/lib/types'

type EngineStatus = 'READY' | 'LIVE' | 'PAUSED' | 'ENDED'
type NotifLevel = 'info' | 'success' | 'warning' | 'error'

const CATEGORY_CODES = ['A', 'B', 'C', 'D', 'E']
const EN_IN = new Intl.NumberFormat('en-IN')
const bdt = (n: number) => `৳${EN_IN.format(n)}`

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
  stage: 0 | 1 | 2
  timerEndsAt: number | null
  pausedRemainingMs: number | null
  lastResult: RoomState['lastResult']
  soldFeed: RoomState['soldFeed']
  bidTimerSeconds: number
  goingIntervalSeconds: number
  minIncrement: number
  auction: Auction
  tournament: Tournament
  teams: TeamCache[]
  players: Player[]
  participants: RoomParticipant[]
  sockets: Map<string, SocketPresence>
  ticking: boolean
  presenceTimer: ReturnType<typeof setTimeout> | null
}

export class AuctionEngine {
  private rooms = new Map<string, Room>()
  private building = new Map<string, Promise<Room>>()
  private socketRooms = new Map<string, { auctionId: string; identity: SocketIdentity }>()
  private locks = new Map<string, Promise<unknown>>()
  private ticker: ReturnType<typeof setInterval>
  private timerEmitter: ReturnType<typeof setInterval>

  constructor(
    private io: Server,
    private db: PrismaClient,
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

    let room = this.rooms.get(auctionId)
    if (room) room = await this.syncIfStale(room)
    else room = await this.getOrBuild(auctionId)

    room.sockets.set(socket.id, { role: identity.role, name: identity.name, teamId: identity.teamId })
    this.socketRooms.set(socket.id, { auctionId, identity })

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
  // Client actions
  // ----------------------------------------------------------
  async placeBid(socket: Socket, identity: SocketIdentity, rawAmount: unknown): Promise<void> {
    const room = this.rooms.get(identity.auctionId)
    if (!room) return this.emitError(socket, 'Join the room first')
    await this.withLock(room.auctionId, async () => {
      if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
      const player = room.players.find((p) => p.id === room.currentPlayerId)
      if (!room.currentPlayerId || !player) return this.emitError(socket, 'No player on the block')
      const amount = Number(rawAmount)
      if (!Number.isInteger(amount) || amount <= 0) return this.emitError(socket, 'Invalid bid amount')
      const team = room.teams.find((t) => t.id === identity.teamId)
      if (!team) return this.emitError(socket, 'You are not assigned to a team in this room')
      const minBid = room.currentBid ? room.currentBid.amount + room.minIncrement : player.basePrice
      if (amount < minBid) return this.emitError(socket, `Minimum bid is ${bdt(minBid)}`)
      if (amount > team.budget - team.spent) return this.emitError(socket, 'Bid exceeds your available budget')
      if (team.squadCount >= team.maxSquad) return this.emitError(socket, 'Your squad is full')

      const created = await this.db.$transaction(async (tx) => {
        const bid = await tx.bid.create({
          data: {
            auctionId: room.auctionId,
            playerId: player.id,
            teamId: team.id,
            teamName: team.name,
            playerName: player.name,
            amount,
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
      room.timerEndsAt = Date.now() + room.bidTimerSeconds * 1000
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
    const room = this.rooms.get(identity.auctionId)
    if (!room) return this.emitError(socket, 'Join the room first')
    await this.withLock(room.auctionId, async () => {
      switch (action) {
        case 'start': return this.actionStart(socket, room)
        case 'pause': return this.actionPause(socket, room)
        case 'resume': return this.actionResume(socket, room)
        case 'next_player': return this.actionNextPlayer(socket, room)
        case 'select_player': return this.actionSelectPlayer(socket, room, payload)
        case 'set_category': return this.actionSetCategory(socket, room, payload)
        case 'skip': return this.actionSkip(socket, room)
        case 'force_sell': return this.actionForceSell(socket, room)
        case 'force_unsold': return this.actionForceUnsold(socket, room)
        case 'reauction': return this.actionReauction(socket, room, payload)
        case 'manual_bid': return this.manualBid(socket, room, payload)
        case 'end': return this.actionEnd(socket, room)
        default: return this.emitError(socket, `Unknown action: ${String(action)}`)
      }
    })
  }

  // ---------- organizer actions ----------
  private async actionStart(socket: Socket, room: Room): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'Auction has already ended')
    if (room.status !== 'READY') return this.emitError(socket, 'Auction already started')
    await this.db.$transaction([
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
    room.timerEndsAt = Date.now() + (room.pausedRemainingMs ?? room.bidTimerSeconds * 1000)
    room.pausedRemainingMs = null
    await this.db.auction.update({ where: { id: room.auctionId }, data: { status: 'LIVE' } })
    this.notify(room, 'info', 'Auction resumed')
    this.broadcast(room)
  }

  private async actionNextPlayer(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (room.currentPlayerId) return this.emitError(socket, 'A player is already on the block')
    const ok = await this.pickNextPlayer(room)
    if (ok) this.broadcast(room)
  }

  private async actionSelectPlayer(socket: Socket, room: Room, payload: Record<string, unknown> | undefined): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (room.currentPlayerId) return this.emitError(socket, 'A player is already on the block')
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

  private async actionSkip(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!room.currentPlayerId || !player) return this.emitError(socket, 'No player on the block')
    await this.db.$transaction([
      this.db.player.update({ where: { id: player.id }, data: { status: 'SKIPPED' } }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
      }),
    ])
    const i = room.players.findIndex((p) => p.id === player.id)
    if (i >= 0) room.players[i] = { ...room.players[i], status: 'SKIPPED' }
    room.currentPlayerId = null
    room.currentBid = null
    room.currentBidHistory = []
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.notify(room, 'info', `${player.name} is skipped by the organizer`)
    this.broadcast(room)
  }

  private async actionForceSell(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (!room.currentPlayerId) return this.emitError(socket, 'No player on the block')
    if (!room.currentBid) return this.emitError(socket, 'No bid to sell — use Force Unsold instead')
    await this.finalizeSold(room)
  }

  private async actionForceUnsold(socket: Socket, room: Room): Promise<void> {
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    if (!room.currentPlayerId) return this.emitError(socket, 'No player on the block')
    await this.finalizeUnsold(room)
  }

  private async actionReauction(socket: Socket, room: Room, payload: Record<string, unknown> | undefined): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'Auction has ended')
    const playerId = String(payload?.playerId ?? '')
    const player = await this.db.player.findUnique({ where: { id: playerId } })
    if (!player || player.tournamentId !== room.tournament.id) return this.emitError(socket, 'Player not found')
    if (player.status !== 'SOLD' && player.status !== 'UNSOLD' && player.status !== 'SKIPPED') {
      return this.emitError(socket, 'Only SOLD, UNSOLD or SKIPPED players can be re-auctioned')
    }

    const ops: Prisma.PrismaPromise<unknown>[] = []
    if (player.status === 'SOLD' && player.soldToTeamId) {
      const team = room.teams.find((t) => t.id === player.soldToTeamId)
      const refund = Math.max(0, (team?.spent ?? 0) - (player.soldPrice ?? 0))
      ops.push(this.db.team.update({ where: { id: player.soldToTeamId }, data: { spent: refund } }))
    }
    // If another player is currently on the block, send them back to the pool.
    if (room.currentPlayerId && room.currentPlayerId !== player.id) {
      ops.push(
        this.db.player.update({
          where: { id: room.currentPlayerId },
          data: { status: 'AVAILABLE', soldPrice: null, soldToTeamId: null },
        }),
      )
    }
    ops.push(
      this.db.player.update({
        where: { id: player.id },
        data: { status: 'LIVE', soldPrice: null, soldToTeamId: null },
      }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: player.id, currentBidAmount: null, currentBidTeamId: null, status: 'LIVE' },
      }),
    )
    if (room.status === 'READY') {
      ops.push(this.db.tournament.update({ where: { id: room.tournament.id }, data: { status: 'LIVE' } }))
    }
    await this.db.$transaction(ops)
    await this.refreshCache(room)

    room.status = 'LIVE'
    room.currentPlayerId = player.id
    room.currentBid = null
    room.currentBidHistory = []
    room.stage = 0
    room.timerEndsAt = Date.now() + room.bidTimerSeconds * 1000
    room.pausedRemainingMs = null
    this.notify(room, 'info', `${player.name} is re-auctioned!`)
    this.broadcast(room)
  }

  private async actionEnd(socket: Socket, room: Room): Promise<void> {
    if (room.status === 'ENDED') return this.emitError(socket, 'Auction already ended')
    const liveOnes = room.players.filter((p) => p.status === 'LIVE')
    await this.db.$transaction([
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
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.notify(room, 'success', 'Auction ended. Final squads are ready!')
    this.broadcast(room)
  }

  private async manualBid(socket: Socket, room: Room, payload: Record<string, unknown> | undefined): Promise<void> {
    const teamId = String(payload?.teamId ?? '')
    const team = room.teams.find((t) => t.id === teamId)
    if (!team) return this.emitError(socket, 'Team not found')
    if (room.status !== 'LIVE') return this.emitError(socket, 'Auction is not live')
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!room.currentPlayerId || !player) return this.emitError(socket, 'No player on the block')
    const amount = Number(payload?.amount)
    if (!Number.isInteger(amount) || amount <= 0) return this.emitError(socket, 'Invalid bid amount')
    const minBid = room.currentBid ? room.currentBid.amount + room.minIncrement : player.basePrice
    if (amount < minBid) return this.emitError(socket, `Minimum bid is ${bdt(minBid)}`)
    if (amount > team.budget - team.spent) return this.emitError(socket, 'Bid exceeds available budget of this team')
    if (team.squadCount >= team.maxSquad) return this.emitError(socket, 'This team squad is full')

    await this.db.$transaction(async (tx) => {
      await tx.bid.create({
        data: {
          auctionId: room.auctionId,
          playerId: player.id,
          teamId: team.id,
          teamName: team.name,
          playerName: player.name,
          amount,
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
    room.timerEndsAt = Date.now() + room.bidTimerSeconds * 1000
    room.pausedRemainingMs = null
    this.notify(room, 'info', `Manual bid: ${team.name} → ${bdt(amount)}`)
    this.broadcast(room)
  }

  // ---------- player picking / finalization ----------
  private async pickNextPlayer(room: Room): Promise<boolean> {
    const pool = room.players.filter((p) => p.status === 'AVAILABLE')
    if (pool.length === 0) {
      this.notify(room, 'error', 'No players available')
      return false
    }
    let candidates = pool
    if (room.tournament.auctionMode === 'CATEGORY') {
      candidates = pool.filter((p) => p.category === room.currentCategory)
      if (candidates.length === 0) {
        this.notify(room, 'error', `No available players in Category ${room.currentCategory ?? '-'} — switch category`)
        return false
      }
    }
    const player = candidates[randomInt(candidates.length)]
    await this.putOnBlock(room, player)
    return true
  }

  private async putOnBlock(room: Room, player: Player): Promise<void> {
    await this.db.$transaction([
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
    room.stage = 0
    room.timerEndsAt = Date.now() + room.bidTimerSeconds * 1000
    room.pausedRemainingMs = null
    this.notify(room, 'info', `Player #${player.playerNumber} — ${player.name} is on the block!`)
  }

  private async finalizeSold(room: Room): Promise<void> {
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    const bid = room.currentBid
    if (!player || !bid) return
    await this.db.$transaction([
      this.db.player.update({
        where: { id: player.id },
        data: { status: 'SOLD', soldPrice: bid.amount, soldToTeamId: bid.teamId },
      }),
      this.db.team.update({ where: { id: bid.teamId }, data: { spent: { increment: bid.amount } } }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
      }),
    ])
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
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.notify(room, 'success', `${player.name} SOLD to ${bid.teamName} for ${bdt(bid.amount)}!`)
    this.broadcast(room)
  }

  private async finalizeUnsold(room: Room): Promise<void> {
    const player = room.players.find((p) => p.id === room.currentPlayerId)
    if (!player) return
    await this.db.$transaction([
      this.db.player.update({ where: { id: player.id }, data: { status: 'UNSOLD' } }),
      this.db.auction.update({
        where: { id: room.auctionId },
        data: { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null },
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
    room.stage = 0
    room.timerEndsAt = null
    room.pausedRemainingMs = null
    this.notify(room, 'error', `${player.name} goes UNSOLD`)
    this.broadcast(room)
  }

  // ----------------------------------------------------------
  // Timers
  // ----------------------------------------------------------
  private async tick(): Promise<void> {
    const now = Date.now()
    for (const room of [...this.rooms.values()]) {
      if (room.status !== 'LIVE' || !room.currentPlayerId || room.timerEndsAt == null) continue
      if (room.ticking || now < room.timerEndsAt) continue
      room.ticking = true
      try {
        await this.withLock(room.auctionId, () => this.advanceTimer(room))
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
      if (room.currentBid) await this.finalizeSold(room)
      else await this.finalizeUnsold(room)
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

  private broadcast(room: Room): void {
    if (room.presenceTimer) {
      clearTimeout(room.presenceTimer)
      room.presenceTimer = null
    }
    this.io.to(`auction:${room.auctionId}`).emit('room_state', this.buildState(room))
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
      if (!stale) return room
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
      stage: 0,
      timerEndsAt: null,
      pausedRemainingMs: null,
      lastResult: null,
      soldFeed: [],
      bidTimerSeconds: auction.bidTimerSeconds,
      goingIntervalSeconds: auction.goingIntervalSeconds,
      minIncrement: auction.minIncrement,
      auction,
      tournament,
      teams: [],
      players: [],
      participants: [],
      sockets: new Map(),
      ticking: false,
      presenceTimer: null,
    }
    await this.refreshCache(room)

    const bids = await this.db.bid.findMany({ where: { auctionId }, orderBy: { createdAt: 'asc' } })
    if (auction.currentPlayerId) {
      room.currentBidHistory = bids
        .filter((b) => b.playerId === auction.currentPlayerId)
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
      const lastBid = [...bids].reverse().find((b) => b.playerId === p.id)
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

    // Resume timers after restart.
    if (room.status === 'LIVE' && room.currentPlayerId) {
      room.stage = 0
      room.timerEndsAt = Date.now() + room.bidTimerSeconds * 1000
    } else if (room.status === 'PAUSED' && room.currentPlayerId) {
      room.pausedRemainingMs = room.bidTimerSeconds * 1000
    }
    return room
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
        where: { tournamentId: room.tournament.id, soldToTeamId: { not: null } },
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
    for (const p of room.players) {
      if (p.status === 'AVAILABLE') available++
      else if (p.status === 'SOLD') sold++
      else if (p.status === 'UNSOLD') unsold++
      else if (p.status === 'SKIPPED') skipped++
    }

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
            playerNumber: currentPlayerRow.playerNumber,
            name: currentPlayerRow.name,
            role: currentPlayerRow.role,
            category: currentPlayerRow.category,
            basePrice: currentPlayerRow.basePrice,
            photoUrl: currentPlayerRow.photoUrl,
            previousTeam: currentPlayerRow.previousTeam,
            phone: currentPlayerRow.phone,
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
        squadCount: t.squadCount,
        maxSquad: t.maxSquad,
        minSquad: t.minSquad,
        online: this.teamOnline(room, t.id),
      })),
      participants: room.participants.map((p) => ({
        name: p.name,
        role: p.role as RoomRole,
        teamId: p.teamId,
        online: this.identityOnline(room, p.role as RoomRole, p.name),
      })),
      players: room.players.map((p) => ({
        id: p.id,
        playerNumber: p.playerNumber,
        name: p.name,
        role: p.role,
        category: p.category,
        basePrice: p.basePrice,
        status: p.status as RoomState['players'][number]['status'],
        soldPrice: p.soldPrice,
        teamName: p.soldToTeamId ? teamNameById.get(p.soldToTeamId) ?? null : null,
      })),
      pool: { total: room.players.length, available, sold, unsold, skipped },
      lastResult: room.lastResult,
      soldFeed: room.soldFeed,
      minIncrement: room.minIncrement,
      bidTimerSeconds: room.bidTimerSeconds,
      goingIntervalSeconds: room.goingIntervalSeconds,
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
