// Run: npm test (node --test). AuctionEngine against an in-memory fake
// database and a fake Socket.IO server; time is node:test's mock timers
// (setInterval / setTimeout / Date), so every test is deterministic.
import { describe, it, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import type { Server, Socket } from 'socket.io'
import type { ResilientClient } from '../../src/lib/db-resilience.ts'
import type { SocketIdentity } from '../../src/lib/types.ts'
import { AuctionEngine, SocketGone } from './engine.ts'
import { FakeDb, FakeIo, FakeSocket, deferred, flush, type DbState } from './test-utils.ts'

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0)
const MIN = 60_000

const base = { auctionId: 'a1', roomCode: 'ROOM1' }
const ORG: SocketIdentity = { ...base, role: 'ORGANIZER', name: 'Organizer', userId: 'org' }
const M1: SocketIdentity = { ...base, role: 'MANAGER', name: 'Tigers Manager', userId: 'u1', teamId: 't1' }
const M2: SocketIdentity = { ...base, role: 'MANAGER', name: 'Lions Manager', userId: 'u2', teamId: 't2' }

const team = (id: string, name: string, managerUserId: string, over: Record<string, unknown> = {}) => ({
  id,
  tournamentId: 'tn1',
  name,
  logoUrl: null,
  color: '#123456',
  managerUserId,
  budget: 100_000,
  spent: 0,
  minSquad: 0,
  maxSquad: 5,
  ...over,
})

const player = (id: string, playerNumber: number, basePrice: number, over: Record<string, unknown> = {}) => ({
  id,
  tournamentId: 'tn1',
  name: `Player ${playerNumber}`,
  photoUrl: null,
  phone: null,
  role: 'Batsman',
  category: null,
  basePrice,
  previousTeam: null,
  playerNumber,
  soldPrice: null,
  soldToTeamId: null,
  status: 'AVAILABLE',
  auctionCycle: 0,
  createdAt: new Date(T0 - 86_400_000),
  ...over,
})

/** LIVE auction, empty block, 10 s bidding + 3 s per GOING call, ৳1,000 increments. */
type SeedOverrides = { auction?: Record<string, unknown>; teams?: any[]; players?: any[] } & Omit<Partial<DbState>, 'auction'>

function seed(over: SeedOverrides = {}): Partial<DbState> {
  const { auction, teams, players, ...rest } = over
  return {
    tournament: [
      { id: 'tn1', name: 'Test Cup', sport: 'CRICKET', auctionMode: 'NORMAL', status: 'LIVE', organizerId: 'org', plan: 'FREE', smsEnabled: false, smsLang: 'en' },
    ],
    auction: [
      {
        id: 'a1',
        tournamentId: 'tn1',
        roomCode: 'ROOM1',
        status: 'LIVE',
        bidTimerSeconds: 10,
        goingIntervalSeconds: 3,
        minIncrement: 1_000,
        currentCategory: null,
        currentPlayerId: null,
        currentBidAmount: null,
        currentBidTeamId: null,
        bidCount: 0,
        allowPreviousOwnerRebid: true,
        allowOpenClaim: false,
        autoAdvance: false,
        round: 1,
        createdAt: new Date(T0 - 86_400_000),
        ...auction,
      },
    ],
    team: teams ?? [team('t1', 'Tigers', 'u1'), team('t2', 'Lions', 'u2')],
    player: players ?? [player('p1', 1, 10_000), player('p2', 2, 10_000), player('p3', 3, 20_000)],
    ...rest,
  }
}

function makeEngine(db: FakeDb) {
  const io = new FakeIo()
  const engine = new AuctionEngine(io as unknown as Server, db as unknown as ResilientClient)
  /** The live in-memory room (private state, read for assertions only). */
  const room = (): any => (engine as any).rooms.get('a1')
  return { io, engine, room }
}

async function setup(t: TestContext, dbSeed: Partial<DbState> = seed()) {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: T0 })
  const db = new FakeDb(dbSeed)
  const made = makeEngine(db)
  t.after(() => made.engine.dispose())
  const orgSocket = new FakeSocket('s-org')
  const joined = await made.engine.joinRoom(orgSocket as unknown as Socket, ORG, 'a1')
  /** Moves the clock forward in ticker-sized steps, letting async work settle after each. */
  const advance = async (ms: number, step = 500) => {
    for (let left = ms; left > 0; left -= step) {
      t.mock.timers.tick(Math.min(step, left))
      await flush()
    }
  }
  const select = async (playerId = 'p1') => assert.equal(await made.engine.organizerAction(ORG, 'select_player', { playerId }), null)
  const sales = () => db.state.auctionEvent.filter((e) => e.type === 'SALE')
  return { t, db, ...made, orgSocket, joined, advance, select, sales }
}

const quiet = (t: TestContext) => {
  t.mock.method(console, 'error', () => {})
  t.mock.method(console, 'log', () => {})
}

describe('AuctionEngine — bidding timer', () => {
  it('a bid resets the clock to the full session duration (also from GOING ONCE)', async (t) => {
    const { engine, db, room, advance, select } = await setup(t)
    await select()
    assert.equal(room().timerEndsAt, T0 + 10_000)

    await advance(4_000)
    assert.equal(await engine.placeBid(M1, 10_000), null)
    assert.equal(room().timerEndsAt, T0 + 14_000)
    assert.equal(room().stage, 0)

    await advance(10_000) // → GOING ONCE
    assert.equal(room().stage, 1)
    assert.equal(await engine.placeBid(M2, 11_000), null)
    assert.equal(room().stage, 0)
    assert.equal(room().timerEndsAt, T0 + 24_000)

    const row = db.one('auction', 'a1')!
    assert.equal(row.currentBidAmount, 11_000)
    assert.equal(row.currentBidTeamId, 't2')
    assert.equal(row.bidCount, 2)
    assert.deepEqual(db.state.bid.map((b) => [b.teamId, b.amount, b.cycle]), [['t1', 10_000, 0], ['t2', 11_000, 0]])
  })

  it('advances GOING ONCE → GOING TWICE → SOLD at the right times', async (t) => {
    const { engine, db, io, room, advance, select, sales } = await setup(t)
    await select()
    await advance(2_000)
    assert.equal(await engine.placeBid(M1, 10_000), null) // ends at T0+12s

    await advance(9_500) // T0+11.5s
    assert.equal(room().stage, 0)
    await advance(500) // T0+12s
    assert.equal(room().stage, 1)
    assert.equal(room().timerEndsAt, T0 + 15_000)
    assert.ok(io.notes().includes('GOING ONCE!'))

    await advance(2_500) // T0+14.5s
    assert.equal(room().stage, 1)
    await advance(500) // T0+15s
    assert.equal(room().stage, 2)
    assert.equal(room().timerEndsAt, T0 + 18_000)
    assert.ok(io.notes().includes('GOING TWICE!'))

    await advance(2_500) // T0+17.5s
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')
    await advance(500) // T0+18s
    const p1 = db.one('player', 'p1')!
    assert.equal(p1.status, 'SOLD')
    assert.equal(p1.soldToTeamId, 't1')
    assert.equal(p1.soldPrice, 10_000)
    assert.equal(db.one('team', 't1')!.spent, 10_000)
    assert.equal(sales().length, 1)
    assert.equal(db.one('auction', 'a1')!.currentPlayerId, null)
    assert.equal(room().currentPlayerId, null)
    assert.equal(room().lastResult.type, 'SOLD')
    assert.ok(io.notes().some((m) => m.includes('SOLD to Tigers')))
  })

  it('with no bid the lot goes UNSOLD after the last call', async (t) => {
    const { db, room, advance, select } = await setup(t)
    await select()
    await advance(15_500)
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')
    await advance(500) // 10 + 3 + 3 s
    assert.equal(db.one('player', 'p1')!.status, 'UNSOLD')
    assert.deepEqual(db.state.auctionEvent.map((e) => e.type), ['UNSOLD'])
    assert.equal(room().currentPlayerId, null)
  })

  it('refuses a bid that arrived after the final deadline, but honours one that arrived in time and waited for the lock', async (t) => {
    const { engine, db, room, advance, select, sales } = await setup(t)
    await select()
    assert.equal(await engine.placeBid(M1, 10_000), null)
    await advance(13_000) // GOING TWICE, closes at T0+16s
    assert.equal(room().stage, 2)
    assert.equal(room().timerEndsAt, T0 + 16_000)

    // Arrived after the deadline (the lot just has not been closed yet).
    assert.match((await engine.placeBid(M2, 11_000, { receivedAt: T0 + 16_001 }))!, /Too late/)

    // A slow organizer action holds the room lock across the deadline.
    const gate = deferred()
    db.hook((c) => (c.model === 'auction' && c.op === 'update' && c.args.data?.bidTimerSeconds === 20 ? gate.promise : undefined))
    const action = engine.organizerAction(ORG, 'set_bid_timer', { seconds: 20 })
    await advance(2_900) // T0+15.9s
    const bid = engine.placeBid(M2, 11_000) // received in time, now waits for the lock
    await advance(600) // T0+16.5s: past the deadline; the tick queues behind the bid
    assert.equal(room().stage, 2)
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')

    gate.resolve()
    assert.equal(await action, null)
    assert.equal(await bid, null)
    await flush()
    assert.deepEqual(room().currentBid, { amount: 11_000, teamId: 't2', teamName: 'Lions', teamColor: '#123456' })
    assert.equal(room().stage, 0)
    assert.equal(room().timerEndsAt, T0 + 16_500 + 10_000) // session duration is unchanged until the next player
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')
    assert.equal(sales().length, 0)
  })

  it('pause freezes the remaining time and resume restores it', async (t) => {
    const { engine, db, room, advance, select } = await setup(t)
    await select()
    await advance(4_000)
    assert.equal(await engine.organizerAction(ORG, 'pause', undefined), null)
    assert.equal(room().status, 'PAUSED')
    assert.equal(room().pausedRemainingMs, 6_000)
    assert.equal(db.one('auction', 'a1')!.status, 'PAUSED')
    assert.match((await engine.placeBid(M1, 10_000))!, /not live/)

    await advance(20_000) // nothing moves while paused
    assert.equal(room().stage, 0)
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')

    assert.equal(await engine.organizerAction(ORG, 'resume', undefined), null) // T0+24s
    assert.equal(room().timerEndsAt, T0 + 30_000)
    assert.equal(room().pausedRemainingMs, null)
    await advance(5_500)
    assert.equal(room().stage, 0)
    await advance(500)
    assert.equal(room().stage, 1)
  })

  it('a failed DB write on pause leaves memory untouched and surfaces the error', async (t) => {
    const { engine, db, io, room, advance, select } = await setup(t)
    await select()
    await advance(4_000)
    const remove = db.hook((c) => {
      if (c.model === 'auction' && c.op === 'update' && c.args.data?.status === 'PAUSED') throw new Error('connection lost')
    })
    await assert.rejects(engine.organizerAction(ORG, 'pause', undefined), /connection lost/)
    assert.equal(room().status, 'LIVE')
    assert.equal(room().pausedRemainingMs, null)
    assert.equal(room().timerEndsAt, T0 + 10_000)
    assert.equal(db.one('auction', 'a1')!.status, 'LIVE')
    assert.ok(!io.notes().includes('Auction paused'))

    await advance(6_000) // the lot keeps running
    assert.equal(room().stage, 1)
    remove()
    assert.equal(await engine.organizerAction(ORG, 'pause', undefined), null)
    assert.equal(room().status, 'PAUSED')
  })
})

describe('AuctionEngine — stale and illegal requests', () => {
  it('rejects a bid pinned to a player who is no longer on the block', async (t) => {
    const { engine, db, select } = await setup(t)
    await select('p1')
    assert.match((await engine.placeBid(M1, 10_000, { playerId: 'p2' }))!, /player on the block changed/)
    assert.equal(db.state.bid.length, 0)
    assert.equal(await engine.placeBid(M1, 10_000, { playerId: 'p1' }), null)
  })

  it('rejects force_sell when the player or the bid the organizer saw is stale', async (t) => {
    const { engine, db, select, sales } = await setup(t)
    await select('p1')
    assert.equal(await engine.placeBid(M1, 10_000), null)

    assert.match((await engine.organizerAction(ORG, 'force_sell', { playerId: 'p2', bidAmount: 10_000 }))!, /player on the block changed/)
    assert.match((await engine.organizerAction(ORG, 'force_sell', { playerId: 'p1', bidAmount: 9_000 }))!, /new bid came in/)
    assert.match((await engine.organizerAction(ORG, 'force_sell', { playerId: 'p1', bidAmount: null }))!, /new bid came in/)
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')
    assert.equal(sales().length, 0)

    assert.equal(await engine.organizerAction(ORG, 'force_sell', { playerId: 'p1', bidAmount: 10_000 }), null)
    assert.equal(db.one('player', 'p1')!.status, 'SOLD')
    assert.equal(db.one('team', 't1')!.spent, 10_000)
  })

  it('enforces the squad reserve (maxBidFor) and a full squad', async (t) => {
    // Tigers: ৳50,000 left and must still buy 2 more after this one → keep ৳10k + ৳20k back.
    const { engine, io, room, select } = await setup(
      t,
      seed({ teams: [team('t1', 'Tigers', 'u1', { budget: 50_000, minSquad: 3 }), team('t2', 'Lions', 'u2', { maxSquad: 0 })] }),
    )
    await select('p1')
    assert.equal(io.lastState().teams.find((x: any) => x.id === 't1').maxBid, 20_000)
    assert.match((await engine.placeBid(M1, 21_000))!, /Maximum bid is ৳20,000/)
    assert.match((await engine.placeBid(M2, 10_000))!, /squad is full/)
    assert.equal(room().currentBid, null)
    assert.equal(await engine.placeBid(M1, 20_000), null)
    assert.equal(room().currentBid.amount, 20_000)
  })
})

describe('AuctionEngine — finalize-sold compare-and-swap', () => {
  it('another writer already sold the lot: no double sale, room rebuilt from the DB', async (t) => {
    quiet(t)
    const { engine, db, io, room, advance, select, sales } = await setup(t)
    await select('p1')
    assert.equal(await engine.placeBid(M1, 10_000), null)
    const before = room()

    // Concurrent change straight in the database.
    Object.assign(db.one('player', 'p1')!, { status: 'SOLD', soldToTeamId: 't2', soldPrice: 15_000 })
    Object.assign(db.one('auction', 'a1')!, { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null })
    db.one('team', 't2')!.spent = 15_000

    await advance(16_000) // the timer tries to sell to Tigers
    assert.equal(db.one('team', 't1')!.spent, 0)
    assert.equal(db.one('player', 'p1')!.soldToTeamId, 't2')
    assert.equal(sales().length, 0)
    assert.notEqual(room(), before) // swapped for a fresh build
    assert.equal(room().currentPlayerId, null)
    assert.equal(room().players.find((p: any) => p.id === 'p1').soldToTeamId, 't2')
    assert.ok(!io.notes().some((m) => m.includes('SOLD to Tigers')))
    void engine
  })

  it('player row changed under a matching auction row: the transaction rolls back', async (t) => {
    quiet(t)
    const { engine, db, select, sales } = await setup(t)
    await select('p1')
    assert.equal(await engine.placeBid(M1, 10_000), null)
    db.one('player', 'p1')!.status = 'UNSOLD' // external edit

    assert.equal(await engine.organizerAction(ORG, 'force_sell', undefined), null)
    const row = db.one('auction', 'a1')!
    assert.equal(row.currentPlayerId, 'p1') // the auction CAS was rolled back with the player CAS
    assert.equal(row.currentBidAmount, 10_000)
    assert.equal(db.one('team', 't1')!.spent, 0)
    assert.equal(sales().length, 0)
  })

  it('a sale that already committed (lost reply) is not charged twice', async (t) => {
    quiet(t)
    const { engine, db, room, select, sales } = await setup(t)
    await select('p1')
    assert.equal(await engine.placeBid(M1, 10_000), null)
    // The earlier attempt committed, but memory never heard back.
    Object.assign(db.one('player', 'p1')!, { status: 'SOLD', soldToTeamId: 't1', soldPrice: 10_000 })
    Object.assign(db.one('auction', 'a1')!, { currentPlayerId: null, currentBidAmount: null, currentBidTeamId: null })
    db.one('team', 't1')!.spent = 10_000
    db.state.auctionEvent.push({ id: 'ev0', auctionId: 'a1', type: 'SALE', playerId: 'p1', cycle: 0, createdAt: new Date(T0) })

    assert.equal(await engine.organizerAction(ORG, 'force_sell', undefined), null)
    assert.equal(db.one('team', 't1')!.spent, 10_000)
    assert.equal(sales().length, 1)
    assert.equal(room().currentPlayerId, null)
    const t1 = room().teams.find((x: any) => x.id === 't1')
    assert.equal(t1.spent, 10_000)
    assert.equal(t1.squadCount, 1)
  })
})

describe('AuctionEngine — restart and eviction', () => {
  it('a new engine on the same DB restores the player, bid, ladder and a fresh timer', async (t) => {
    const first = await setup(t)
    await first.select('p1')
    await first.advance(1_000)
    assert.equal(await first.engine.placeBid(M1, 10_000), null)
    await first.advance(1_000)
    assert.equal(await first.engine.placeBid(M2, 11_000), null)
    await first.advance(11_000) // GOING ONCE when the "crash" happens
    assert.equal(first.room().stage, 1)
    first.engine.dispose()

    const second = makeEngine(first.db)
    t.after(() => second.engine.dispose())
    const state = await second.engine.joinRoom(new FakeSocket('s2') as unknown as Socket, ORG, 'a1')
    assert.equal(state.status, 'LIVE')
    assert.equal(state.currentPlayer?.id, 'p1')
    assert.deepEqual(state.currentBid, { amount: 11_000, teamId: 't2', teamName: 'Lions', teamColor: '#123456' })
    assert.deepEqual(state.currentBidHistory.map((h) => [h.teamId, h.amount]), [['t1', 10_000], ['t2', 11_000]])
    // Stages are not persisted: the lot restarts with a full session.
    assert.equal(state.stage, 0)
    assert.equal(state.timerEndsAt, T0 + 13_000 + 10_000)

    await first.advance(10_000)
    assert.ok(second.io.notes().includes('GOING ONCE!'))
    await first.advance(6_000)
    assert.equal(first.db.one('player', 'p1')!.soldToTeamId, 't2')
    assert.equal(first.db.one('team', 't2')!.spent, 11_000)
  })

  it('a PAUSED lot comes back paused with a full session to resume', async (t) => {
    const s = await setup(
      t,
      seed({ auction: { status: 'PAUSED', currentPlayerId: 'p1' }, players: [player('p1', 1, 10_000, { status: 'LIVE' }), player('p2', 2, 10_000)] }),
    )
    assert.equal(s.joined.status, 'PAUSED')
    assert.equal(s.joined.pausedRemainingMs, 10_000)
    assert.equal(s.joined.timerEndsAt, null)
    assert.equal(await s.engine.organizerAction(ORG, 'resume', undefined), null)
    assert.equal(s.room().timerEndsAt, T0 + 10_000)
  })

  it('a re-auctioned lot keeps only its own cycle on the ladder and the previous-owner lockout', async (t) => {
    const s = await setup(
      t,
      seed({
        auction: { currentPlayerId: 'p1', currentBidAmount: 12_000, currentBidTeamId: 't2', allowPreviousOwnerRebid: false, bidCount: 2 },
        players: [player('p1', 1, 10_000, { status: 'LIVE', auctionCycle: 1 }), player('p2', 2, 10_000)],
        bid: [
          { id: 'b0', auctionId: 'a1', playerId: 'p1', teamId: 't1', teamName: 'Tigers', playerName: 'Player 1', amount: 10_000, cycle: 0, createdAt: new Date(T0 - 5_000) },
          { id: 'b1', auctionId: 'a1', playerId: 'p1', teamId: 't2', teamName: 'Lions', playerName: 'Player 1', amount: 12_000, cycle: 1, createdAt: new Date(T0 - 1_000) },
        ],
        auctionEvent: [{ id: 'e1', auctionId: 'a1', type: 'RE_AUCTION', playerId: 'p1', cycle: 1, teamId: 't1', createdAt: new Date(T0 - 2_000) }],
      }),
    )
    assert.deepEqual(s.joined.currentBidHistory.map((h) => h.amount), [12_000])
    assert.equal(s.joined.previousOwnerTeamId, 't1')
    assert.match((await s.engine.placeBid(M1, 13_000))!, /lost this player/)
  })

  it('evicts a room nobody has been connected to for 30 minutes, and rebuilds it on the next join', async (t) => {
    quiet(t)
    const s = await setup(t)
    assert.equal(s.engine.roomCount, 1)
    await s.engine.leave(s.orgSocket as unknown as Socket)

    await s.advance(29 * MIN, MIN)
    assert.equal(s.engine.roomCount, 1)
    await s.advance(2 * MIN, MIN)
    assert.equal(s.engine.roomCount, 0)

    const sock = new FakeSocket('s-again')
    const state = await s.engine.joinRoom(sock as unknown as Socket, ORG, 'a1')
    assert.equal(s.engine.roomCount, 1)
    // With nobody connected the LIVE auction paused itself after 30 s (and stays paused).
    assert.equal(state.status, 'PAUSED')

    await s.advance(40 * MIN, MIN) // someone is connected: never evicted
    assert.equal(s.engine.roomCount, 1)
  })
})

describe('AuctionEngine — auction-day hardening', () => {
  it('a bid that arrived in time but is still on its way to the lock keeps the lot open', async (t) => {
    const { engine, db, room, advance, select, sales } = await setup(t)
    await select()
    assert.equal(await engine.placeBid(M1, 10_000), null)
    await advance(15_900) // GOING TWICE, closes at T0+16s; now T0+15.9s
    assert.equal(room().stage, 2)

    // Arrives in time, then waits on the seat re-check (a DB round trip).
    const done = engine.bidArrived('a1', Date.now())
    await advance(1_000) // T0+16.9s — past the deadline
    assert.equal(room().stage, 2)
    assert.equal(db.one('player', 'p1')!.status, 'LIVE')
    assert.equal(sales().length, 0)

    assert.equal(await engine.placeBid(M2, 11_000, { receivedAt: T0 + 15_900 }), null)
    done()
    assert.equal(room().stage, 0)
    assert.equal(room().currentBid.teamId, 't2')
    assert.equal(sales().length, 0)
  })

  it('the grace is bounded, and a bid that arrived after the deadline does not hold the lot', async (t) => {
    quiet(t)
    const late = await setup(t)
    await late.select()
    assert.equal(await late.engine.placeBid(M1, 10_000), null)
    await late.advance(16_000)
    late.engine.bidArrived('a1', T0 + 16_100) // arrived too late: ignored by the close
    await late.advance(1_000)
    assert.equal(late.sales().length, 1)
  })

  it('a bid that never finishes holds the lot for at most 3 s past the deadline', async (t) => {
    const { engine, advance, select, sales } = await setup(t)
    await select()
    assert.equal(await engine.placeBid(M1, 10_000), null)
    await advance(15_900)
    engine.bidArrived('a1', Date.now()) // never answered
    await advance(2_500) // T0+18.4s: still inside the grace
    assert.equal(sales().length, 0)
    await advance(1_500) // T0+19.9s: past it
    assert.equal(sales().length, 1)
  })

  it('the database refuses a bid when the auction row no longer matches memory (no Bid row, room rebuilt)', async (t) => {
    quiet(t)
    const { engine, db, room, select } = await setup(t)
    await select('p1')
    assert.equal(await engine.placeBid(M1, 10_000), null)
    const before = room()
    // Another writer (a second engine instance) already took a higher bid.
    Object.assign(db.one('auction', 'a1')!, { currentBidAmount: 15_000, currentBidTeamId: 't2' })

    assert.match((await engine.placeBid(M2, 11_000))!, /moved on/)
    assert.equal(db.state.bid.length, 1)
    assert.equal(db.one('auction', 'a1')!.currentBidAmount, 15_000)
    assert.notEqual(room(), before)
    assert.equal(room().currentBid.amount, 15_000)
  })

  it('a LIVE auction with no organizer or manager connected pauses itself after 30 s', async (t) => {
    quiet(t)
    const { engine, db, room, advance, orgSocket, io } = await setup(t)
    const viewer = new FakeSocket('s-viewer')
    await engine.joinRoom(viewer as unknown as Socket, { ...base, role: 'VIEWER', name: 'Fan' }, 'a1')
    await engine.leave(orgSocket as unknown as Socket)

    await advance(29_000)
    assert.equal(room().status, 'LIVE')
    await advance(2_000)
    assert.equal(room().status, 'PAUSED')
    assert.equal(db.one('auction', 'a1')!.status, 'PAUSED')
    assert.ok(io.notes().some((m) => m.includes('paused automatically')))
  })

  it('does not pause while a team manager is connected', async (t) => {
    const { engine, room, advance, orgSocket } = await setup(t)
    await engine.joinRoom(new FakeSocket('s-m1') as unknown as Socket, M1, 'a1')
    await engine.leave(orgSocket as unknown as Socket)
    await advance(2 * MIN, 1_000)
    assert.equal(room().status, 'LIVE')
  })

  it('a socket that dropped while its join waited is never registered', async (t) => {
    const { engine, room } = await setup(t)
    const gone = new FakeSocket('s-gone')
    gone.disconnected = true
    await assert.rejects(engine.joinRoom(gone as unknown as Socket, M1, 'a1'), SocketGone)
    assert.equal(room().sockets.has('s-gone'), false)
  })

  it('a socket that dropped during the presence write is removed again, and its row marked offline', async (t) => {
    const { engine, db, room } = await setup(t)
    const sock = new FakeSocket('s-flaky')
    db.hook((c) => {
      if (c.model === 'roomParticipant' && c.op === 'upsert' && c.args.create?.name === M1.name) sock.disconnected = true
    })
    await assert.rejects(engine.joinRoom(sock as unknown as Socket, M1, 'a1'), SocketGone)
    assert.equal(room().sockets.has('s-flaky'), false)
    const row = db.state.roomParticipant.find((r) => r.name === M1.name)
    assert.equal(row?.online, false)
  })

  it('a manual bid is refused when the player it was opened for has left the block', async (t) => {
    const { engine, select } = await setup(t)
    await select('p1')
    assert.match(
      (await engine.organizerAction(ORG, 'manual_bid', { teamId: 't1', amount: 10_000, playerId: 'p2' }))!,
      /player on the block changed/,
    )
    assert.equal(await engine.organizerAction(ORG, 'manual_bid', { teamId: 't1', amount: 10_000, playerId: 'p1' }), null)
  })
})
