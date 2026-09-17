// ============================================================
// Smoke test for the live auction mini-service (demo room BD26-DEMO).
// Run with the service up:  bun scripts/smoke.ts
// Resets BD26-DEMO to READY before AND after the run, so the demo
// room is always left in a clean state for the integrator.
// ============================================================
import '../env' // ensure DATABASE_URL / AUCTION_SECRET (parent .env) before Prisma
import { PrismaClient } from '@prisma/client'
import { signToken } from '../../../src/lib/crypto'
import { io, type Socket } from 'socket.io-client'
import type { RoomState } from '../../../src/lib/types'

const db = new PrismaClient()
const URL = 'http://localhost:3003'
const ROOM = 'BD26-DEMO'

let organizer: Socket | null = null
let manager: Socket | null = null

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

/** Restores the demo room to a pristine READY state (smoke-test only). */
async function resetDemoRoom() {
  const auction = await db.auction.findUnique({ where: { roomCode: ROOM } })
  if (!auction) throw new Error(`${ROOM} not found — run the seed first (bun prisma/seed.ts)`)
  await db.bid.deleteMany({ where: { auctionId: auction.id } })
  await db.roomParticipant.deleteMany({ where: { auctionId: auction.id } })
  await db.player.updateMany({
    where: { tournamentId: auction.tournamentId },
    data: { status: 'AVAILABLE', soldPrice: null, soldToTeamId: null },
  })
  await db.team.updateMany({ where: { tournamentId: auction.tournamentId }, data: { spent: 0 } })
  await db.auction.update({
    where: { id: auction.id },
    data: {
      status: 'READY',
      currentCategory: null,
      currentPlayerId: null,
      currentBidAmount: null,
      currentBidTeamId: null,
      bidCount: 0,
    },
  })
  await db.tournament.update({ where: { id: auction.tournamentId }, data: { status: 'READY' } })
  return auction
}

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(URL, { path: '/', transports: ['websocket', 'polling'], forceNew: true, timeout: 5000 })
    s.on('connect', () => resolve(s))
    s.on('connect_error', (e) => reject(new Error(`connect_error: ${e.message}`)))
  })
}

function emitAck<T = Record<string, unknown>>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (err: unknown, res: T) => {
      if (err) reject(new Error(`${event} ack timed out`))
      else resolve(res)
    })
  })
}

function onceEvent(socket: Socket, event: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => socket.once(event, resolve))
}

async function waitFor<T>(desc: string, fn: () => T | null | undefined, timeoutMs = 8000): Promise<T> {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const v = fn()
    if (v !== null && v !== undefined) return v
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`TIMEOUT waiting for: ${desc}`)
}

async function main() {
  console.log('— resetting BD26-DEMO demo room —')
  const auction = await resetDemoRoom()
  const team = await db.team.findFirst({ where: { tournamentId: auction.tournamentId }, orderBy: { name: 'asc' } })
  assert(team, 'seeded team exists')

  // Fabricate socket tokens with the same HMAC secret the join API uses.
  const orgToken = signToken({ auctionId: auction.id, roomCode: ROOM, role: 'ORGANIZER', name: 'Smoke Organizer' }, 600)
  const mgrToken = signToken(
    { auctionId: auction.id, roomCode: ROOM, role: 'MANAGER', name: 'Smoke Manager', teamId: team!.id, teamName: team!.name },
    600,
  )

  const states: RoomState[] = []
  const notes: { id: string; level: string; message: string }[] = []
  let lastTimer: { remainingMs: number; stage: number; serverTime: number } | null = null

  console.log('— connecting sockets —')
  organizer = await connect()
  organizer.on('room_state', (s: RoomState) => states.push(s))
  organizer.on('notification', (n: { id: string; level: string; message: string }) => notes.push(n))
  organizer.on('timer', (t: { remainingMs: number; stage: number; serverTime: number }) => { lastTimer = t })
  manager = await connect()

  console.log('— joining room (organizer + manager, lowercase roomCode to test normalization) —')
  const join1 = await emitAck<{ ok: boolean; error?: string; state?: RoomState }>(organizer, 'join_room', { roomCode: ROOM, token: orgToken })
  assert(join1.ok && join1.state, `organizer join ok (${join1.error ?? ''})`)
  const s0 = join1.state!
  assert(s0.roomCode === ROOM, 'roomCode normalized to uppercase')
  assert(s0.auctionId === auction.id, 'auctionId matches')
  assert(s0.status === 'READY', `status READY (got ${s0.status})`)
  assert(s0.mode === 'CATEGORY', 'mode CATEGORY')
  assert(s0.teams.length === 8, `8 teams (got ${s0.teams.length})`)
  assert(s0.players.length === 40, `40 players (got ${s0.players.length})`)
  assert(s0.categories.length > 0 && s0.categories[0].code === 'A', 'categories computed for CATEGORY mode')
  assert(s0.participants.some((p) => p.name === 'Smoke Organizer' && p.role === 'ORGANIZER' && p.online), 'organizer presence online')
  assert(typeof s0.minIncrement === 'number' && s0.minIncrement === 5000, 'minIncrement 5000')

  const join2 = await emitAck<{ ok: boolean; error?: string; state?: RoomState }>(manager, 'join_room', { roomCode: 'bd26-demo', token: mgrToken })
  assert(join2.ok && join2.state, `manager join ok (${join2.error ?? ''})`)
  const mgrTeam = join2.state!.teams.find((t) => t.id === team!.id)
  assert(mgrTeam?.online === true, 'manager team shows online in presence')

  console.log('— start —')
  organizer!.emit('organizer_action', { action: 'start' })
  const live = await waitFor('status LIVE with currentPlayer', () => {
    const s = states[states.length - 1]
    return s?.status === 'LIVE' && s.currentPlayer ? s : null
  })
  const player = live.currentPlayer!
  assert(notes.some((n) => n.message === 'Auction started! Good luck everyone.'), 'start notification broadcast')
  assert(notes.some((n) => n.message.includes('is on the block!')), 'on-the-block notification broadcast')
  const tEv = await waitFor('timer event', () => lastTimer)
  assert(tEv.remainingMs > 0, `timer remainingMs > 0 (got ${tEv.remainingMs})`)
  assert(tEv.stage === 0, 'timer stage 0')
  console.log(`  player on block: #${player.playerNumber} ${player.name} (base ৳${player.basePrice}, category ${player.category})`)

  console.log('— manager bids base price —')
  manager!.emit('place_bid', { amount: player.basePrice })
  const bidState = await waitFor('currentBid present', () => {
    const s = states[states.length - 1]
    return s?.currentBid ? s : null
  })
  assert(bidState.currentBid!.amount === player.basePrice, `bid amount (got ${bidState.currentBid!.amount})`)
  assert(bidState.currentBid!.teamId === team!.id, 'bid teamId')
  assert(bidState.currentBid!.teamName === team!.name, 'bid teamName')
  assert(bidState.currentBidHistory.length === 1, 'currentBidHistory length 1')
  assert(bidState.stage === 0, 'stage reset to 0 on bid')
  assert(bidState.timerEndsAt !== null, 'timer restarted on bid')
  assert(notes.some((n) => n.level === 'success' && n.message.includes(`${team!.name} bids`)), 'bid notification broadcast')
  const bidRow = await db.bid.findFirst({ where: { auctionId: auction.id, playerId: player.id } })
  assert(bidRow && bidRow.amount === player.basePrice && bidRow.teamId === team!.id && bidRow.teamName === team!.name, 'Bid row persisted')
  const auc1 = await db.auction.findUnique({ where: { id: auction.id } })
  assert(auc1?.currentBidAmount === player.basePrice && auc1.currentBidTeamId === team!.id && auc1.bidCount === 1, 'auction bid state persisted')

  console.log('— pause / resume —')
  organizer!.emit('organizer_action', { action: 'pause' })
  await waitFor('status PAUSED', () => {
    const s = states[states.length - 1]
    return s?.status === 'PAUSED' ? s : null
  })
  assert((states[states.length - 1].pausedRemainingMs ?? -1) >= 0, 'pausedRemainingMs set')
  organizer!.emit('organizer_action', { action: 'resume' })
  await waitFor('status LIVE again', () => {
    const s = states[states.length - 1]
    return s?.status === 'LIVE' ? s : null
  })

  console.log('— invalid low bid rejected (error event to bidder only) —')
  const errPromise = onceEvent(manager!, 'error')
  manager!.emit('place_bid', { amount: player.basePrice + 1 }) // below base + minIncrement
  const err = await errPromise
  assert(typeof err?.message === 'string' && err.message.includes('Minimum bid'), `min-bid error (got ${JSON.stringify(err)})`)
  const aucStill = await db.auction.findUnique({ where: { id: auction.id } })
  assert(aucStill?.currentBidAmount === player.basePrice, 'no state change after rejected bid')

  console.log('— force_sell —')
  organizer!.emit('organizer_action', { action: 'force_sell' })
  const sold = await waitFor('lastResult SOLD', () => {
    const s = states[states.length - 1]
    return s?.lastResult?.type === 'SOLD' && !s.currentPlayer ? s : null
  })
  assert(sold.lastResult!.price === player.basePrice, 'sold price in lastResult')
  assert(sold.lastResult!.teamId === team!.id, 'sold teamId in lastResult')
  assert(sold.soldFeed[0]?.playerName === player.name, 'soldFeed updated (latest first)')
  assert(sold.pool.sold === 1, `pool.sold === 1 (got ${sold.pool.sold})`)
  assert(notes.some((n) => n.message.includes(`SOLD to ${team!.name}`)), 'SOLD notification broadcast')
  const pAfter = await db.player.findUnique({ where: { id: player.id } })
  assert(pAfter?.status === 'SOLD' && pAfter.soldPrice === player.basePrice && pAfter.soldToTeamId === team!.id, 'player SOLD in DB')
  const tAfter = await db.team.findUnique({ where: { id: team!.id } })
  assert(tAfter?.spent === player.basePrice, `team.spent updated (got ${tAfter?.spent})`)

  console.log('— set_category —')
  organizer!.emit('organizer_action', { action: 'set_category', payload: { category: 'B' } })
  await waitFor('currentCategory B', () => {
    const s = states[states.length - 1]
    return s?.currentCategory === 'B' ? s : null
  })
  organizer!.emit('organizer_action', { action: 'set_category', payload: { category: 'A' } })
  await waitFor('currentCategory back to A', () => {
    const s = states[states.length - 1]
    return s?.currentCategory === 'A' ? s : null
  })

  console.log('— end —')
  organizer!.emit('organizer_action', { action: 'end' })
  await waitFor('status ENDED', () => {
    const s = states[states.length - 1]
    return s?.status === 'ENDED' ? s : null
  })
  const aucEnd = await db.auction.findUnique({ where: { id: auction.id } })
  assert(aucEnd?.status === 'ENDED' && aucEnd.currentPlayerId === null, 'auction ENDED in DB')
  const tEnd = await db.tournament.findUnique({ where: { id: auction.tournamentId } })
  assert(tEnd?.status === 'COMPLETED', 'tournament COMPLETED in DB')
  assert(notes.some((n) => n.message === 'Auction ended. Final squads are ready!'), 'end notification broadcast')

  console.log('— restoring BD26-DEMO to pristine READY state —')
  await resetDemoRoom()
  const restored = await db.auction.findUnique({ where: { roomCode: ROOM } })
  assert(restored?.status === 'READY', 'room restored to READY')
  console.log('\nSMOKE OK — all assertions passed.')
}

main()
  .then(async () => {
    organizer?.disconnect()
    manager?.disconnect()
    await db.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('\nSMOKE FAILED:', e instanceof Error ? e.message : e)
    try {
      await resetDemoRoom()
      console.error('(BD26-DEMO restored to READY)')
    } catch {
      // ignore cleanup failure
    }
    organizer?.disconnect()
    manager?.disconnect()
    await db.$disconnect().catch(() => undefined)
    process.exit(1)
  })
