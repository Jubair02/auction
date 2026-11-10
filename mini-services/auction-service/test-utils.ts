// ============================================================
// Test doubles for engine.test.ts — no database, no network.
//
// FakeDb implements only the Prisma surface engine.ts (and the outbox writers
// it calls) touches, with the semantics the engine relies on:
//  - model calls return LAZY thenables (like PrismaPromise), so an array
//    $transaction runs them in order and rolls everything back on a throw;
//  - interactive $transaction(fn) rolls back when fn throws;
//  - updateMany returns { count } (the engine's compare-and-swaps);
//  - the single-statement bid write ($queryRaw INSERT "Bid" + UPDATE
//    "Auction") is emulated, including the Bid → Auction foreign key.
// Hooks run before every call and can throw (simulated DB failure) or
// return a promise (a slow DB call holding the room lock).
// ============================================================
import { BOUNDED_TX_SQL } from '../../src/lib/db-resilience.ts'

type Row = Record<string, any>

export const MODELS = [
  'auction',
  'tournament',
  'team',
  'player',
  'bid',
  'roomParticipant',
  'auctionEvent',
  'analyticsEvent',
  'notification',
  'playerRegistration',
] as const
export type ModelName = (typeof MODELS)[number]
export type DbState = Record<ModelName, Row[]>

export interface DbCall {
  model: ModelName | '$raw'
  op: string
  args: any
}
export type DbHook = (call: DbCall) => void | Promise<void>

const isPlainObject = (v: unknown): v is Row =>
  typeof v === 'object' && v !== null && !(v instanceof Date) && !Array.isArray(v)

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue
    // Compound unique keys, e.g. auctionId_role_name: { auctionId, role, name }.
    if (isPlainObject(cond) && !(key in row) && key.includes('_')) {
      if (!matches(row, cond)) return false
      continue
    }
    if (isPlainObject(cond)) {
      if ('in' in cond && !(cond.in as unknown[]).some((v) => sameValue(row[key], v))) return false
      if ('not' in cond && sameValue(row[key], cond.not)) return false
      continue
    }
    if (!sameValue(row[key], cond)) return false
  }
  return true
}

function applyData(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    if (isPlainObject(value) && 'increment' in value) row[key] = (row[key] ?? 0) + value.increment
    else if (isPlainObject(value) && 'decrement' in value) row[key] = (row[key] ?? 0) - value.decrement
    else row[key] = value
  }
}

function project(row: Row | undefined, select: Row | undefined): Row | null {
  if (!row) return null
  const copy = structuredClone(row)
  if (!select) return copy
  const out: Row = {}
  for (const [k, on] of Object.entries(select)) if (on) out[k] = copy[k]
  return out
}

function sortRows(rows: Row[], orderBy: Row | undefined): Row[] {
  if (!orderBy) return rows
  const [[field, dir]] = Object.entries(orderBy)
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const x = a[field] instanceof Date ? a[field].getTime() : a[field]
    const y = b[field] instanceof Date ? b[field].getTime() : b[field]
    return x < y ? -sign : x > y ? sign : 0
  })
}

/** Lazy, like PrismaPromise: nothing runs until it is awaited (or put through $transaction). */
class LazyOp<T> implements PromiseLike<T> {
  private promise: Promise<T> | null = null
  // Plain field (node's type stripping cannot run parameter properties).
  private readonly run: () => Promise<T>
  constructor(run: () => Promise<T>) {
    this.run = run
  }
  exec(): Promise<T> {
    this.promise ??= this.run()
    return this.promise
  }
  then<A = T, B = never>(ok?: ((v: T) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.exec().then(ok, bad)
  }
}

export class FakeDb {
  state: DbState
  calls: DbCall[] = []
  hooks: DbHook[] = []
  private seq = 0

  constructor(seed: Partial<DbState> = {}) {
    this.state = Object.fromEntries(MODELS.map((m) => [m, structuredClone(seed[m] ?? [])])) as DbState
    for (const m of MODELS) (this as any)[m] = this.model(m)
  }

  /** Install a hook; returns its remover. */
  hook(fn: DbHook): () => void {
    this.hooks.push(fn)
    return () => {
      this.hooks = this.hooks.filter((h) => h !== fn)
    }
  }

  one(model: ModelName, id: string): Row | undefined {
    return this.state[model].find((r) => r.id === id)
  }

  private op<T>(model: DbCall['model'], op: string, args: any, body: () => T): LazyOp<T> {
    return new LazyOp(async () => {
      const call = { model, op, args }
      this.calls.push(call)
      for (const h of [...this.hooks]) await h(call)
      return body()
    })
  }

  private newId(model: string): string {
    return `${model}-${++this.seq}`
  }

  private model(name: ModelName) {
    const rows = () => this.state[name]
    const withDefaults = (data: Row): Row => {
      const row: Row = { id: this.newId(name), createdAt: new Date(), ...structuredClone(data) }
      if (name === 'roomParticipant') {
        row.joinedAt ??= new Date()
        row.lastSeen ??= new Date()
      }
      return row
    }
    return {
      findUnique: (args: Row) => this.op(name, 'findUnique', args, () => project(rows().find((r) => matches(r, args.where)), args.select)),
      findFirst: (args: Row = {}) =>
        this.op(name, 'findFirst', args, () => project(sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy)[0], args.select)),
      findMany: (args: Row = {}) =>
        this.op(name, 'findMany', args, () =>
          sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy).map((r) => project(r, args.select)!),
        ),
      create: (args: Row) =>
        this.op(name, 'create', args, () => {
          const row = withDefaults(args.data)
          rows().push(row)
          return structuredClone(row)
        }),
      createMany: (args: Row) =>
        this.op(name, 'createMany', args, () => {
          for (const d of args.data as Row[]) rows().push(withDefaults(d))
          return { count: (args.data as Row[]).length }
        }),
      update: (args: Row) =>
        this.op(name, 'update', args, () => {
          const row = rows().find((r) => matches(r, args.where))
          if (!row) throw new Error(`FakeDb: ${name}.update — record to update not found`)
          applyData(row, args.data)
          return structuredClone(row)
        }),
      updateMany: (args: Row) =>
        this.op(name, 'updateMany', args, () => {
          const hit = rows().filter((r) => matches(r, args.where))
          for (const row of hit) applyData(row, args.data)
          return { count: hit.length }
        }),
      upsert: (args: Row) =>
        this.op(name, 'upsert', args, () => {
          const row = rows().find((r) => matches(r, args.where))
          if (row) {
            applyData(row, args.update)
            return structuredClone(row)
          }
          const created = withDefaults(args.create)
          rows().push(created)
          return structuredClone(created)
        }),
      groupBy: (args: Row) =>
        this.op(name, 'groupBy', args, () => {
          const [by] = args.by as string[]
          const groups = new Map<unknown, number>()
          for (const r of rows().filter((x) => matches(x, args.where))) groups.set(r[by], (groups.get(r[by]) ?? 0) + 1)
          return [...groups].map(([key, n]) => ({ [by]: key, _count: { _all: n } }))
        }),
    }
  }

  $queryRawUnsafe(sql: string) {
    return this.op('$raw', 'queryRawUnsafe', { sql }, () => {
      if (sql !== BOUNDED_TX_SQL) throw new Error(`FakeDb: unexpected raw SQL: ${sql}`)
      return []
    })
  }

  /** Only the engine's single-statement bid write (persistBid). */
  $queryRaw(strings: TemplateStringsArray, ...values: any[]) {
    const sql = strings.join('?')
    return this.op('$raw', 'queryRaw', { sql, values }, () => {
      if (!sql.includes('INSERT INTO "Bid"') || !sql.includes('UPDATE "Auction"')) {
        throw new Error('FakeDb: unexpected $queryRaw')
      }
      const [newAmount, newTeamId, whereAuctionId, wherePlayerId, belowAmount, id, playerId, teamId, teamName, playerName, amount, cycle, createdAtIso] =
        values
      const auction = this.one('auction', whereAuctionId)
      // Compare-and-swap: only a LIVE auction with this player on the block and
      // a lower stored bid moves; the Bid row is inserted only when it did.
      if (
        !auction ||
        auction.status !== 'LIVE' ||
        auction.currentPlayerId !== wherePlayerId ||
        (auction.currentBidAmount != null && !(auction.currentBidAmount < belowAmount))
      ) {
        return [{ bids: 0 }]
      }
      this.state.bid.push({ id, auctionId: auction.id, playerId, teamId, teamName, playerName, amount, cycle, createdAt: new Date(createdAtIso) })
      auction.currentBidAmount = newAmount
      auction.currentBidTeamId = newTeamId
      auction.bidCount = (auction.bidCount ?? 0) + 1
      return [{ bids: 1 }]
    })
  }

  async $transaction(arg: unknown): Promise<any> {
    const snapshot = structuredClone(this.state)
    try {
      if (typeof arg === 'function') return await arg(this)
      const results: unknown[] = []
      for (const op of arg as LazyOp<unknown>[]) results.push(await op)
      return results
    } catch (err) {
      this.state = snapshot // roll back
      throw err
    }
  }
}

// ------------------------------------------------------------
// Socket.IO doubles
// ------------------------------------------------------------
export interface Emission {
  room: string
  event: string
  payload: any
}

export class FakeIo {
  emitted: Emission[] = []
  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.emitted.push({ room, event, payload })
        return true
      },
    }
  }
  /** Messages of the notifications sent so far. */
  notes(): string[] {
    return this.emitted.filter((e) => e.event === 'notification').map((e) => e.payload.message as string)
  }
  lastState(): any {
    return [...this.emitted].reverse().find((e) => e.event === 'room_state')?.payload
  }
}

export class FakeSocket {
  rooms = new Set<string>()
  /** Flip to true to simulate the client dropping (socket.io sets it on disconnect). */
  disconnected = false
  id: string
  constructor(id: string) {
    this.id = id
  }
  join(room: string): Promise<void> {
    this.rooms.add(room)
    return Promise.resolve()
  }
  leave(room: string): void {
    this.rooms.delete(room)
  }
}

// ------------------------------------------------------------
// Misc
// ------------------------------------------------------------
/** Drains promise chains that only wait on microtasks / the (instant) fake DB. */
export async function flush(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise<void>((r) => setImmediate(r))
}

export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
