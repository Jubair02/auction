// ============================================================
// NeelamGhor — end-to-end join + bidding test.
// Drives the REAL web API (Next on WEB_URL) and the REAL auction service
// (socket.io on AUCTION_URL) like browsers would, and checks the database.
// Self-contained: creates its own users/tournament/teams/players (all named
// "E2E …") and deletes them at the end, even when a check fails.
//
//   bun mini-services/auction-service/scripts/e2e.ts
//   WEB_URL=http://localhost:3100 AUCTION_URL=http://localhost:3003 bun …
// ============================================================
import '../env' // DATABASE_URL / AUCTION_SECRET from the project .env
import { PrismaClient } from '@prisma/client'
import { io, type Socket } from 'socket.io-client'
import { hashPassword } from '../../../src/lib/crypto'
import { mergeRoomState } from '../../../src/lib/room-state'
import type { RoomState, RoomStateWire } from '../../../src/lib/types'

const WEB = process.env.WEB_URL ?? 'http://localhost:3000'
const AUCTION = process.env.AUCTION_URL ?? 'http://localhost:3003'
const db = new PrismaClient()
const RUN = `e2e${Date.now().toString(36)}`
const PASSWORD = 'e2e-Pass-1234'

// ---------------- tiny test harness ----------------
const results: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: unknown) {
  results.push({ name, ok, detail: ok ? undefined : typeof detail === 'string' ? detail : JSON.stringify(detail) })
  console.log(`${ok ? '  ✔' : '  ✖'} ${name}${ok ? '' : `  → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor<T>(what: string, fn: () => T | null | undefined | false, ms = 15000): Promise<T | null> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = fn()
    if (v) return v
    await sleep(100)
  }
  console.log(`    (timed out waiting for: ${what})`)
  return null
}

// ---------------- HTTP ----------------
async function http(method: string, path: string, body?: unknown, cookie?: string) {
  const res = await fetch(WEB + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json: any = null
  try {
    json = await res.json()
  } catch {
    // no body
  }
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] }
}
async function login(email: string) {
  const r = await http('POST', '/api/auth/login', { email, password: PASSWORD })
  const cookie = r.setCookie.map((c) => c.split(';')[0]).find((c) => c.startsWith('ng_session='))
  if (r.status !== 200 || !cookie) throw new Error(`login ${email} failed: ${r.status} ${JSON.stringify(r.json)}`)
  return cookie
}

// ---------------- sockets ----------------
interface Client {
  label: string
  socket: Socket
  state: RoomState | null
  errors: string[]
  notes: string[]
  deltas: number
  fulls: number
}
const clients: Client[] = []
function connect(label: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const socket = io(AUCTION, { path: '/', transports: ['websocket'], forceNew: true, reconnection: false, timeout: 5000 })
    const c: Client = { label, socket, state: null, errors: [], notes: [], deltas: 0, fulls: 0 }
    socket.on('room_state', (next: RoomStateWire) => {
      if (next.players && next.participants) c.fulls++
      else c.deltas++
      const merged = mergeRoomState(c.state, next)
      if (merged.needsResync) c.errors.push('RESYNC NEEDED')
      c.state = merged.state
    })
    socket.on('error', (e: { message: string }) => c.errors.push(e.message))
    socket.on('notification', (n: { message: string }) => c.notes.push(n.message))
    socket.on('connect', () => {
      clients.push(c)
      resolve(c)
    })
    socket.on('connect_error', (e) => reject(new Error(`${label} connect_error: ${e.message}`)))
  })
}
function join(c: Client, roomCode: string, token: string): Promise<{ ok: boolean; error?: string; state?: RoomState }> {
  return new Promise((resolve) =>
    c.socket.emit('join_room', { roomCode, token }, (ack: { ok: boolean; error?: string; state?: RoomState }) => {
      if (ack.ok && ack.state) c.state = ack.state
      resolve(ack)
    }),
  )
}
const bid = (c: Client, amount: number) => c.socket.emit('place_bid', { amount })
const act = (c: Client, action: string, payload?: Record<string, unknown>) => c.socket.emit('organizer_action', { action, payload })
const lastError = (c: Client, since: number) => c.errors.slice(since).join(' | ')

// ---------------- the test ----------------
const created = { userIds: [] as string[], tournamentId: null as string | null }

async function main() {
  console.log(`E2E run ${RUN}\n  web     ${WEB}\n  auction ${AUCTION}\n`)

  // ---- setup: accounts straight in the DB (registration is rate-limited per IP)
  const mkUser = async (tag: string, role: 'ORGANIZER' | 'MANAGER') => {
    const u = await db.user.create({
      data: { name: `E2E ${tag}`, email: `${RUN}-${tag}@example.test`, passwordHash: hashPassword(PASSWORD), role },
    })
    created.userIds.push(u.id)
    return u
  }
  const org = await mkUser('organizer', 'ORGANIZER')
  const mA = await mkUser('manager-a', 'MANAGER')
  const mB = await mkUser('manager-b', 'MANAGER')
  const mC = await mkUser('manager-c', 'MANAGER')
  const [orgC, aC, bC, cC] = [await login(org.email), await login(mA.email), await login(mB.email), await login(mC.email)]
  check('accounts log in through the API', true)

  // ---- organizer builds a tournament through the API
  console.log('\nSetup (organizer, REST)')
  const t = await http('POST', '/api/tournaments', { name: `E2E Cup ${RUN}`, sport: 'CRICKET', auctionMode: 'NORMAL', basePrice: 10000 }, orgC)
  check('create tournament', t.status === 201 || t.status === 200, t)
  const tid: string = t.json?.tournament?.id
  created.tournamentId = tid
  const p = await http(
    'POST',
    `/api/tournaments/${tid}/players`,
    {
      players: [
        { name: 'E2E Player One', role: 'Batsman', basePrice: 10000 },
        { name: 'E2E Player Two', role: 'Bowler', basePrice: 10000 },
        { name: 'E2E Player Three', role: 'All-rounder', basePrice: 10000 },
        { name: 'E2E Player Four', role: 'Wicketkeeper', basePrice: 10000 },
        { name: 'E2E Player Five', role: 'Batsman', basePrice: 10000 },
        { name: 'E2E Player Six', role: 'Bowler', basePrice: 10000 },
      ],
    },
    orgC,
  )
  check('add 6 players', p.status === 201 && p.json?.created === 6, p)
  const tm = await http(
    'POST',
    `/api/tournaments/${tid}/teams`,
    {
      teams: [
        { name: 'E2E Alpha', budget: 60000, maxSquad: 3, minSquad: 2 },
        { name: 'E2E Beta', budget: 60000, maxSquad: 3, minSquad: 0 },
        { name: 'E2E Gamma', budget: 60000, maxSquad: 3, minSquad: 0 },
      ],
    },
    orgC,
  )
  check('add 3 teams', tm.status === 201 && tm.json?.created === 3, tm)
  const teams = await db.team.findMany({ where: { tournamentId: tid } })
  const alpha = teams.find((x) => x.name === 'E2E Alpha')!
  const beta = teams.find((x) => x.name === 'E2E Beta')!
  const gamma = teams.find((x) => x.name === 'E2E Gamma')!
  const au = await http('POST', `/api/tournaments/${tid}/auction`, { bidTimerSeconds: 8, goingIntervalSeconds: 3, minIncrement: 1000 }, orgC)
  check('create auction room (invite-only by default)', au.status === 201 && au.json?.auction?.allowOpenClaim === false, au)
  const code: string = au.json?.auction?.roomCode

  // ---- joining (REST)
  console.log('\nJoining (REST)')
  const room = await http('GET', `/api/rooms/${code.toLowerCase()}`)
  check('public room lookup (case-insensitive)', room.status === 200 && room.json?.teams?.length === 3, room)
  const viewer = await http('POST', `/api/rooms/${code}/join`, { role: 'viewer', name: 'E2E Fan' })
  check('anonymous viewer gets a seat', viewer.status === 200 && !!viewer.json?.socketToken, viewer)
  const anonMgr = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E Anon', teamId: alpha.id })
  check('anonymous manager is refused (401)', anonMgr.status === 401, anonMgr)
  const unassigned = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E A', teamId: alpha.id }, aC)
  check('manager cannot self-claim while invite-only (403)', unassigned.status === 403, unassigned)
  const notOrg = await http('POST', `/api/rooms/${code}/join`, { role: 'organizer' }, aC)
  check('manager cannot take the organizer seat (403)', notOrg.status === 403, notOrg)

  const inv = await http('POST', `/api/teams/${alpha.id}/invite`, {}, orgC)
  check('organizer creates an invite link', inv.status === 200 && !!inv.json?.token, inv)
  const invInfo = await http('GET', `/api/invites/${inv.json.token}`)
  check('invite link shows the team', invInfo.status === 200 && invInfo.json?.teamName === 'E2E Alpha', invInfo)
  const acc = await http('POST', `/api/invites/${inv.json.token}`, {}, aC)
  check('manager A accepts the invite', acc.status === 200 && acc.json?.roomCode === code, acc)
  const acc2 = await http('POST', `/api/invites/${inv.json.token}`, {}, bC)
  check('invite link is single-use', acc2.status === 404, acc2)

  const joinA = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E A', teamId: alpha.id }, aC)
  check('invited manager A takes the Alpha seat', joinA.status === 200 && !!joinA.json?.socketToken, joinA)
  const stealA = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E B', teamId: alpha.id }, bC)
  check("manager B cannot take Alpha's seat (403)", stealA.status === 403, stealA)

  const open = await http('PATCH', `/api/tournaments/${tid}/auction`, { allowOpenClaim: true }, orgC)
  check('organizer turns on open claiming', open.status === 200 && open.json?.auction?.allowOpenClaim === true, open)
  const joinB = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E B', teamId: beta.id }, bC)
  check('manager B claims Beta (open claim)', joinB.status === 200, joinB)
  const joinC = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E C', teamId: gamma.id }, cC)
  check('manager C claims Gamma (open claim)', joinC.status === 200, joinC)
  const twoTeams = await http('POST', `/api/rooms/${code}/join`, { role: 'manager', name: 'E2E A', teamId: gamma.id }, aC)
  check('a manager cannot hold two teams (403/409)', twoTeams.status === 403 || twoTeams.status === 409, twoTeams)
  const joinOrg = await http('POST', `/api/rooms/${code}/join`, { role: 'organizer' }, orgC)
  check('organizer takes the organizer seat', joinOrg.status === 200, joinOrg)

  // ---- joining (sockets)
  console.log('\nJoining (live sockets)')
  const O = await connect('organizer')
  const A = await connect('alpha')
  const B = await connect('beta')
  const C = await connect('gamma')
  const V = await connect('viewer')
  const X = await connect('forger')
  for (const [c, tok] of [
    [O, joinOrg.json.socketToken],
    [A, joinA.json.socketToken],
    [B, joinB.json.socketToken],
    [C, joinC.json.socketToken],
    [V, viewer.json.socketToken],
  ] as const) {
    const ack = await join(c, code, tok)
    check(`${c.label} joins the live room`, ack.ok && ack.state?.players.length === 6, ack.error ?? ack)
  }
  const forged = await join(X, code, joinA.json.socketToken.slice(0, -4) + 'AAAA')
  check('a tampered token is rejected', !forged.ok && /invalid|expired/i.test(forged.error ?? ''), forged)
  const vOnline = await waitFor('viewer count', () => O.state && O.state.viewersOnline >= 1 && O.state)
  check('viewers are counted, not listed', !!vOnline && !O.state!.participants.some((pp) => pp.role === 'VIEWER'), O.state?.participants)

  // ---- bidding
  console.log('\nBidding (live sockets)')
  let e = V.errors.length
  bid(V, 10000)
  await waitFor('viewer bid error', () => V.errors.length > e)
  check('a viewer cannot bid', /only team managers/i.test(lastError(V, e)), lastError(V, e))
  e = A.errors.length
  act(A, 'start')
  await waitFor('manager action error', () => A.errors.length > e)
  check('a manager cannot run organizer actions', /only the organizer/i.test(lastError(A, e)), lastError(A, e))
  e = A.errors.length
  bid(A, 10000)
  await waitFor('bid before start', () => A.errors.length > e)
  check('no bidding before the auction starts', /not live/i.test(lastError(A, e)), lastError(A, e))

  act(O, 'start')
  const started = await waitFor('LIVE with a player', () => A.state?.status === 'LIVE' && A.state.currentPlayer && A.state)
  check('organizer starts — a player goes on the block for everyone', !!started && !!V.state?.currentPlayer, A.state?.status)
  const p1 = A.state!.currentPlayer!
  const base = p1.basePrice

  e = A.errors.length
  bid(A, base - 1000)
  await waitFor('low bid error', () => A.errors.length > e)
  check('a bid under the base price is rejected', /minimum bid/i.test(lastError(A, e)), lastError(A, e))

  bid(A, base)
  const aBid = await waitFor('A at base', () => V.state?.currentBid?.teamId === alpha.id && V.state)
  check('Alpha opens at the base price — every client sees it', !!aBid && V.state!.currentBid!.amount === base && B.state?.currentBid?.amount === base, V.state?.currentBid)

  e = A.errors.length
  bid(A, base + 1000)
  await waitFor('self outbid error', () => A.errors.length > e)
  check('a team cannot outbid itself', /already hold/i.test(lastError(A, e)), lastError(A, e))

  e = B.errors.length
  bid(B, base + 500)
  await waitFor('increment error', () => B.errors.length > e)
  check('a raise below the minimum increment is rejected', /minimum bid/i.test(lastError(B, e)), lastError(B, e))

  // Race: Beta and Gamma bid the same amount at the same instant.
  const eB = B.errors.length
  const eC = C.errors.length
  bid(B, base + 1000)
  bid(C, base + 1000)
  await waitFor('race settled', () => V.state?.currentBid?.amount === base + 1000 && B.errors.length + C.errors.length > eB + eC)
  const winners = [B.errors.length === eB, C.errors.length === eC].filter(Boolean).length
  check('simultaneous equal bids: exactly one wins, the other is rejected', winners === 1 && [beta.id, gamma.id].includes(V.state!.currentBid!.teamId), {
    beta: lastError(B, eB),
    gamma: lastError(C, eC),
  })
  const raceWinner = V.state!.currentBid!.teamId
  const bidRows = await db.bid.count({ where: { playerId: p1.id } })
  check('accepted bids are saved (2 rows), rejected ones are not', bidRows === 2, bidRows)

  // Timer: going once, going twice, sold.
  const sold = await waitFor('auto SOLD', () => V.state?.lastResult?.type === 'SOLD' && V.state.lastResult.playerName === p1.name && V.state, 30000)
  check('the timer runs GOING ONCE → GOING TWICE → SOLD on its own', !!sold && V.notes.some((n) => /GOING ONCE/.test(n)) && V.notes.some((n) => /GOING TWICE/.test(n)), V.notes.slice(-6))
  const p1Row = await db.player.findUnique({ where: { id: p1.id } })
  const winTeam = await db.team.findUnique({ where: { id: raceWinner } })
  const saleEvent = await db.auctionEvent.findFirst({ where: { playerId: p1.id, type: 'SALE' } })
  check(
    'the sale is saved: player SOLD, price, buyer, team spend, audit event',
    p1Row?.status === 'SOLD' && p1Row.soldPrice === base + 1000 && p1Row.soldToTeamId === raceWinner && winTeam?.spent === base + 1000 && !!saleEvent,
    { status: p1Row?.status, price: p1Row?.soldPrice, spent: winTeam?.spent, event: !!saleEvent },
  )

  // Next player: budget guard + reserve for the minimum squad (Alpha: min 2, budget 60k).
  act(O, 'next_player')
  const p2 = await waitFor('next player', () => A.state?.currentPlayer && A.state.currentPlayer.id !== p1.id && A.state.currentPlayer)
  check('next player goes on the block', !!p2, A.state?.currentPlayer)
  const alphaState = A.state!.teams.find((x) => x.id === alpha.id)!
  // Alpha must keep 1 more slot × cheapest base (10k) in reserve → max 50k.
  check("Alpha's max bid holds back purse for its minimum squad", alphaState.maxBid === 50000, alphaState.maxBid)
  e = A.errors.length
  bid(A, 60000)
  await waitFor('over budget error', () => A.errors.length > e)
  check('a bid above the allowed maximum is rejected', /maximum bid|budget/i.test(lastError(A, e)), lastError(A, e))

  // Pause / resume.
  act(O, 'pause')
  await waitFor('paused', () => A.state?.status === 'PAUSED')
  e = A.errors.length
  bid(A, 10000)
  await waitFor('paused bid error', () => A.errors.length > e)
  check('no bidding while paused', A.state?.status === 'PAUSED' && /not live/i.test(lastError(A, e)), lastError(A, e))
  act(O, 'resume')
  check('organizer resumes', !!(await waitFor('resumed', () => A.state?.status === 'LIVE')), A.state?.status)

  // Organizer manual bid + force sell.
  let eO = O.errors.length
  act(O, 'manual_bid', { teamId: beta.id, amount: 10000 })
  const manual = await waitFor('manual bid', () => V.state?.currentBid?.teamId === beta.id && V.state)
  check('organizer places a manual bid for a team', !!manual, { bid: V.state?.currentBid, organizerError: lastError(O, eO) })
  eO = O.errors.length
  act(O, 'force_sell')
  const forced = await waitFor('force sold', () => V.state?.lastResult?.type === 'SOLD' && V.state.lastResult.playerName === p2!.name)
  check('organizer sells immediately', !!forced, { last: V.state?.lastResult, organizerError: lastError(O, eO) })

  // Unsold path.
  act(O, 'next_player')
  const p3 = await waitFor('third player', () => O.state?.currentPlayer && ![p1.id, p2!.id].includes(O.state.currentPlayer.id) && O.state.currentPlayer)
  eO = O.errors.length
  act(O, 'force_unsold')
  await waitFor('unsold', () => V.state?.lastResult?.type === 'UNSOLD' && V.state.lastResult.playerName === p3?.name)
  const p3Row = p3 ? await db.player.findUnique({ where: { id: p3.id } }) : null
  check('organizer marks a player unsold', p3Row?.status === 'UNSOLD', { status: p3Row?.status, organizerError: lastError(O, eO) })

  // Re-auction the first sale: refund + new cycle.
  const spentBefore = (await db.team.findUnique({ where: { id: raceWinner } }))!.spent
  eO = O.errors.length
  act(O, 'reauction', { playerId: p1.id })
  const re = await waitFor('reauction', () => O.state?.currentPlayer?.id === p1.id && O.state)
  const winAfter = await db.team.findUnique({ where: { id: raceWinner } })
  const refund = await db.auctionEvent.findFirst({ where: { playerId: p1.id, type: 'REFUND' } })
  check('re-auction refunds the buyer and puts the player back on the block', !!re && winAfter!.spent === spentBefore - (base + 1000) && refund?.refundAmount === base + 1000, {
    spentBefore,
    spentAfter: winAfter?.spent,
    refund: refund?.refundAmount,
    organizerError: lastError(O, eO),
  })
  act(O, 'skip')
  await waitFor('skipped', () => O.state && !O.state.currentPlayer)

  // Reconnect: a manager drops and comes back with a fresh full snapshot.
  A.socket.disconnect()
  const A2 = await connect('alpha-reconnect')
  const back = await join(A2, code, joinA.json.socketToken)
  check('a manager who reconnects gets the full current state', back.ok && back.state?.players.length === 6 && back.state.status === 'LIVE', back.error)

  // Delta broadcasts kept every client in sync with the server.
  const truth = await db.player.findMany({ where: { tournamentId: tid }, select: { id: true, status: true } })
  const inSync = (c: Client) => truth.every((row) => c.state?.players.find((pp) => pp.id === row.id)?.status === row.status)
  check(
    'lighter broadcasts: lists are skipped when unchanged, yet every client matches the database',
    V.deltas > 0 && inSync(V) && inSync(B) && !clients.some((c) => c.errors.includes('RESYNC NEEDED')),
    { viewerDeltas: V.deltas, viewerFulls: V.fulls },
  )

  // Organizer removes Alpha's manager → that seat stops bidding immediately.
  await http('PATCH', `/api/teams/${alpha.id}`, { managerUserId: null }, orgC)
  act(O, 'next_player')
  await waitFor('fourth player', () => A2.state?.currentPlayer)
  e = A2.errors.length
  bid(A2, 10000)
  await waitFor('revoked seat error', () => A2.errors.length > e)
  check('a manager unlinked by the organizer can no longer bid', /no longer this team/i.test(lastError(A2, e)), lastError(A2, e))

  // ---- Auto Auction + configurable bidding duration
  console.log('\nAuto Auction (live sockets)')
  const lotA = O.state!.currentPlayer!
  const lotASession = O.state!.sessionTimerSeconds
  act(O, 'set_bid_timer', { seconds: 5 })
  await waitFor('duration set', () => O.state?.bidTimerSeconds === 5)
  check(
    'changing the bidding duration mid-lot leaves the current player’s session alone',
    O.state?.bidTimerSeconds === 5 && O.state.sessionTimerSeconds === lotASession && O.state.currentPlayer?.id === lotA.id,
    { configured: O.state?.bidTimerSeconds, session: O.state?.sessionTimerSeconds },
  )
  // Toggle ON several times while a player is on the block (a double click, a laggy UI).
  act(O, 'set_auto_advance', { enabled: true })
  act(O, 'set_auto_advance', { enabled: true })
  act(O, 'set_auto_advance', { enabled: true })
  await waitFor('auto on', () => V.state?.autoAdvance === true)
  check(
    'turning Auto Auction on mid-lot does not interrupt the current player',
    V.state?.autoAdvance === true && V.state.currentPlayer?.id === lotA.id && V.state.nextPlayerAt === null,
    { current: V.state?.currentPlayer?.name, nextPlayerAt: V.state?.nextPlayerAt },
  )
  check('the Auto Auction setting is saved', (await db.auction.findFirst({ where: { tournamentId: tid } }))?.autoAdvance === true)

  // A viewer "refreshes" during the lot — must not cause an extra pick.
  V.socket.disconnect()
  const V2 = await connect('viewer-refresh')
  await join(V2, code, viewer.json.socketToken)

  const picksBefore = O.notes.filter((n) => /is on the block/.test(n)).length
  await waitFor('lot A closes', () => O.state?.lastResult?.playerName === lotA.name, 30000)
  const scheduled = await waitFor('next pick scheduled', () => O.state && !O.state.currentPlayer && O.state.nextPlayerAt && O.state)
  check('when the lot closes, the next pick is scheduled (shown to everyone)', !!scheduled && !!V2.state?.nextPlayerAt, V2.state?.nextPlayerAt)
  const lotB = await waitFor('auto pick', () => O.state?.currentPlayer && O.state.currentPlayer.id !== lotA.id && O.state.currentPlayer, 20000)
  check('Auto Auction brings the next player up by itself', !!lotB && V2.state?.currentPlayer?.id === lotB!.id, O.state?.currentPlayer)
  const remaining = O.state ? O.state.timerEndsAt! - O.state.serverTime : 0
  check(
    'the new bidding duration (5s) applies to the next player, timer reset',
    O.state?.sessionTimerSeconds === 5 && remaining > 3000 && remaining <= 5000,
    { session: O.state?.sessionTimerSeconds, remainingMs: remaining },
  )
  await sleep(1500)
  const picksAfter = O.notes.filter((n) => /is on the block/.test(n)).length
  const liveRows = await db.player.count({ where: { tournamentId: tid, status: 'LIVE' } })
  check('exactly one automatic pick — no duplicate player selection', picksAfter - picksBefore === 1 && liveRows === 1, {
    picks: picksAfter - picksBefore,
    liveRows,
  })

  // Turn Auto OFF mid-lot: the lot finishes normally, then nothing is auto-picked.
  act(O, 'set_auto_advance', { enabled: false })
  await waitFor('auto off', () => O.state?.autoAdvance === false)
  check('turning Auto Auction off mid-lot does not interrupt the current player', O.state?.currentPlayer?.id === lotB!.id, O.state?.currentPlayer)
  await waitFor('lot B closes', () => O.state?.lastResult?.playerName === lotB!.name, 30000)
  await sleep(6000)
  check(
    'with Auto Auction off, no player is picked automatically',
    !O.state?.currentPlayer && O.state?.nextPlayerAt === null,
    { current: O.state?.currentPlayer?.name, nextPlayerAt: O.state?.nextPlayerAt },
  )
  e = O.errors.length
  act(O, 'next_player')
  const manualPick = await waitFor('manual pick', () => O.state?.currentPlayer && O.state)
  check('manual Next player still works', !!manualPick && O.errors.length === e, lastError(O, e))

  // ---- Re-auction rounds (unsold & skipped)
  console.log('\nRe-auction rounds (live sockets)')
  const auctionRow = (await db.auction.findFirst({ where: { tournamentId: tid } }))!
  act(O, 'force_unsold')
  const round1Done = await waitFor('round 1 complete', () => O.state && !O.state.currentPlayer && O.state.pool.available === 0 && O.state)
  check('round 1 completes once no players are left', !!round1Done && O.state!.round === 1, O.state?.pool)
  await sleep(5000)
  check('a completed round does not restart by itself', O.state?.round === 1 && !O.state.currentPlayer, {
    round: O.state?.round,
    current: O.state?.currentPlayer?.name,
  })

  const before = await db.player.findMany({ where: { tournamentId: tid } })
  const returningIds = before.filter((pl) => pl.status === 'UNSOLD' || pl.status === 'SKIPPED').map((pl) => pl.id)
  const soldBefore = before.filter((pl) => pl.status === 'SOLD')
  const bidsBefore = await db.bid.count({ where: { auctionId: auctionRow.id } })
  eO = O.errors.length
  act(O, 'reauction_unsold')
  await waitFor('round 2', () => O.state?.round === 2)
  const after = await db.player.findMany({ where: { tournamentId: tid } })
  const byId = new Map(before.map((pl) => [pl.id, pl]))
  check(
    'round 2 starts with exactly the unsold & skipped players',
    O.state?.round === 2 &&
      O.state.pool.available === returningIds.length &&
      after.filter((pl) => pl.status === 'AVAILABLE').every((pl) => returningIds.includes(pl.id)),
    { available: O.state?.pool.available, expected: returningIds.length, organizerError: lastError(O, eO) },
  )
  check(
    'sold players stay sold, with the same team and price',
    soldBefore.every((pl) => {
      const now = after.find((x) => x.id === pl.id)
      return now?.status === 'SOLD' && now.soldToTeamId === pl.soldToTeamId && now.soldPrice === pl.soldPrice
    }),
  )
  check(
    'earlier bids are kept and returned players start a fresh bidding cycle',
    (await db.bid.count({ where: { auctionId: auctionRow.id } })) === bidsBefore &&
      returningIds.every((id) => after.find((x) => x.id === id)!.auctionCycle === byId.get(id)!.auctionCycle + 1),
  )
  const roundEvents = await db.auctionEvent.count({ where: { auctionId: auctionRow.id, reason: { startsWith: 'Round 2' } } })
  check('each returned player is recorded in the audit trail', roundEvents === returningIds.length, roundEvents)

  // Another round cannot be started while this one still has players.
  eO = O.errors.length
  act(O, 'reauction_unsold')
  await waitFor('mid-round refusal', () => O.errors.length > eO)
  check('a new round cannot start mid-round', /finish the round/i.test(lastError(O, eO)) && O.state?.round === 2, lastError(O, eO))

  // A sale in round 2 works normally — team assignment and budget update.
  const betaSpentBefore = (await db.team.findUnique({ where: { id: beta.id } }))!.spent
  act(O, 'next_player')
  const r2Player = await waitFor('round 2 player', () => O.state?.currentPlayer && O.state.currentPlayer)
  bid(B, r2Player!.basePrice)
  await waitFor('beta bid', () => O.state?.currentBid?.teamId === beta.id)
  act(O, 'force_sell')
  await waitFor('round 2 sale', () => O.state?.lastResult?.type === 'SOLD' && O.state.lastResult.playerName === r2Player!.name)
  const r2Row = await db.player.findUnique({ where: { id: r2Player!.id } })
  const betaAfter = await db.team.findUnique({ where: { id: beta.id } })
  check(
    'a player sold in round 2 updates the team and budget normally',
    r2Row?.status === 'SOLD' && r2Row.soldToTeamId === beta.id && betaAfter!.spent === betaSpentBefore + r2Player!.basePrice,
    { status: r2Row?.status, team: r2Row?.soldToTeamId === beta.id, spentBefore: betaSpentBefore, spentAfter: betaAfter?.spent },
  )

  // Close the rest of round 2 as unsold, then start round 3.
  for (let guard = 0; guard < 8 && (O.state?.pool.available ?? 0) > 0; guard++) {
    act(O, 'next_player')
    const lot = await waitFor('next lot', () => O.state?.currentPlayer && O.state.currentPlayer)
    if (!lot) break
    act(O, 'force_unsold')
    await waitFor('lot closed', () => O.state && !O.state.currentPlayer)
  }
  const leftAfterR2 = (O.state?.pool.unsold ?? 0) + (O.state?.pool.skipped ?? 0)
  act(O, 'reauction_unsold')
  await waitFor('round 3', () => O.state?.round === 3)
  check('multiple rounds: round 3 starts with what is left', O.state?.round === 3 && O.state.pool.available === leftAfterR2, {
    round: O.state?.round,
    available: O.state?.pool.available,
    expected: leftAfterR2,
  })

  act(O, 'end')
  // V2: the original viewer socket was closed by the "refresh" step above.
  await waitFor('ended', () => V2.state?.status === 'ENDED')
  const tRow = await db.tournament.findUnique({ where: { id: tid } })
  check('organizer ends the auction — tournament completed', V2.state?.status === 'ENDED' && tRow?.status === 'COMPLETED', {
    viewer: V2.state?.status,
    tournament: tRow?.status,
  })
}

async function cleanup() {
  for (const c of clients) c.socket.disconnect()
  // Retried: a slow or dropped DB connection must not leave E2E rows behind.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (created.tournamentId) {
        const a = await db.auction.findUnique({ where: { tournamentId: created.tournamentId } })
        if (a) await db.roomParticipant.deleteMany({ where: { auctionId: a.id } })
        await db.tournament.deleteMany({ where: { id: created.tournamentId } }) // cascades players/teams/auction/bids/events
      }
      if (created.userIds.length) await db.user.deleteMany({ where: { id: { in: created.userIds } } })
      console.log('\ncleanup: E2E data removed')
      break
    } catch (err) {
      if (attempt < 3) {
        await sleep(3000)
        continue
      }
      console.error('\ncleanup FAILED — remove rows whose names start with "E2E" manually:', err)
    }
  }
  await db.$disconnect()
}

main()
  .catch((err) => check('test run crashed', false, (err as Error).stack ?? String(err)))
  .finally(async () => {
    await cleanup()
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
    process.exit(failed.length ? 1 : 0)
  })
