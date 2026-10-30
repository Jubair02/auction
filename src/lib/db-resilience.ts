// Shared Prisma settings for a hosted Postgres that is far away and sleeps
// when idle (Neon, ap-southeast-1): round trips are 100–600 ms and the first
// connection after a quiet spell can fail. Used by the web app (src/lib/db.ts)
// and the auction service. No Next.js imports.
import { Prisma, PrismaClient } from '@prisma/client'

/** Interactive transactions make several round trips; 5 s (Prisma's default) is too tight. */
export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const

/**
 * Run first inside a transaction (scoped to that transaction only). If the
 * connection dies mid-transaction, Postgres would otherwise keep it open —
 * holding its row locks — until idle_in_transaction_session_timeout (5 min
 * on Neon), and other transactions wait on those locks forever
 * (lock_timeout 0). One abandoned sale would freeze the whole auction room.
 */
export const BOUNDED_TX_SQL =
  "SELECT set_config('lock_timeout', '8s', true), set_config('idle_in_transaction_session_timeout', '20s', true)"

// Reads only: a read can always be repeated. A write whose connection dropped
// mid-flight may already have committed, so writes are never retried blindly.
const READS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'])

// P1001: can't reach the server · P1017: server closed the connection · P2024: pool wait timed out
const TRANSIENT = new Set(['P1001', 'P1017', 'P2024'])

export function isTransientDbError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true
  if (err instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT.has(err.code)
  return err instanceof Error && /Can't reach database server|Server has closed the connection|ConnectionReset/i.test(err.message)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A PrismaClient whose reads retry (up to 3 tries) on transient connection errors. */
export function createResilientClient(options: Prisma.PrismaClientOptions = {}) {
  return new PrismaClient({ transactionOptions: TRANSACTION_OPTIONS, ...options }).$extends({
    name: 'retry-transient-reads',
    query: {
      async $allOperations({ operation, args, query }) {
        if (!READS.has(operation)) return query(args)
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args)
          } catch (err) {
            if (attempt >= 3 || !isTransientDbError(err)) throw err
            await sleep(attempt * 500)
          }
        }
      },
    },
  })
}

export type ResilientClient = ReturnType<typeof createResilientClient>
