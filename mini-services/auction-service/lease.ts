// Single-instance guard. Rooms, bid timers and the per-room lock live in one
// process's memory, so a second engine instance (a scaled-out service, an
// overlapping zero-downtime deploy, a copy started by mistake) would run its
// own clocks against the same rooms. Each instance must hold the lease row in
// the ServiceLease table before it serves anything; the holder renews it every
// few seconds and releases it on shutdown. A crashed holder's lease simply
// expires.
//
// Works through Neon's PgBouncer pooler (plain rows, unlike session-level
// advisory locks). Database time is used throughout, so instance clocks don't matter.
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import type { ResilientClient } from '../../src/lib/db-resilience.ts'

const TTL_SECONDS = 30
const RENEW_MS = 5_000
const WAIT_RETRY_MS = 3_000

/**
 * A deployed instance (Render, Railway, Fly, or NODE_ENV=production) versus a
 * developer's machine. Production always wins the lease: a local `npm run dev`
 * pointed at the production database by mistake must never be able to keep
 * the real service from starting (it would wait, never open its port, and the
 * host would fail the deploy). Two production instances still never overlap.
 */
export const IS_PRODUCTION_HOST =
  process.env.NODE_ENV === 'production' || !!process.env.RENDER || !!process.env.RAILWAY_ENVIRONMENT || !!process.env.FLY_APP_NAME

const isProdHolder = (holder: string | null | undefined) => !!holder && holder.startsWith('prod:')

// Stable across `bun --hot` re-evaluations of the module in the same process,
// so a hot reload renews its own lease instead of waiting for it to expire.
const g = globalThis as { __ngLeaseHolder?: string }
export const LEASE_HOLDER = (g.__ngLeaseHolder ??= `${IS_PRODUCTION_HOST ? 'prod' : 'dev'}:${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`)

/** Shown when a local copy finds (or loses the lease to) the production service. */
export const SHARED_DB_WARNING =
  '[auction-service] The PRODUCTION auction service is using this database, so this local copy will not run. ' +
  'Your .env points local development at the production database — create a separate Neon branch for development ' +
  'and put its URL in .env (DEPLOY.md → "Separate databases per environment").'

/** Override for tests that run a second engine on purpose against their own rooms. */
export const LEASE_NAME = process.env.AUCTION_LEASE_NAME?.trim() || 'auction-engine'

type Attempt = { ok: true; tookOverFrom: string | null } | { ok: false; holder: string | null; expiresInS: number | null }

const missingTable = (err: unknown) => /ServiceLease.*does not exist|relation "ServiceLease"/i.test(String((err as Error)?.message ?? err))

async function attempt(db: ResilientClient): Promise<Attempt> {
  // Taken when: we already hold it, it has expired, or we are production and the
  // holder is not (a developer's copy on the same database). `prev` reports who
  // held it, so a takeover is logged.
  const rows = await db.$queryRaw<{ holder: string; previous: string | null }[]>`
    WITH prev AS (SELECT "holder" FROM "ServiceLease" WHERE "name" = ${LEASE_NAME})
    INSERT INTO "ServiceLease" ("name", "holder", "expiresAt", "acquiredAt")
    VALUES (${LEASE_NAME}, ${LEASE_HOLDER}, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${TTL_SECONDS}::int), now() AT TIME ZONE 'UTC')
    ON CONFLICT ("name") DO UPDATE
      SET "holder" = EXCLUDED."holder",
          "expiresAt" = EXCLUDED."expiresAt",
          "acquiredAt" = CASE WHEN "ServiceLease"."holder" = EXCLUDED."holder" THEN "ServiceLease"."acquiredAt" ELSE EXCLUDED."acquiredAt" END
      WHERE "ServiceLease"."holder" = EXCLUDED."holder"
         OR "ServiceLease"."expiresAt" < (now() AT TIME ZONE 'UTC')
         OR (${IS_PRODUCTION_HOST}::boolean AND "ServiceLease"."holder" NOT LIKE 'prod:%')
    RETURNING "holder", (SELECT "holder" FROM prev) AS "previous"`
  if (rows.length === 1) {
    const previous = rows[0].previous
    return { ok: true, tookOverFrom: previous && previous !== LEASE_HOLDER && !isProdHolder(previous) && IS_PRODUCTION_HOST ? previous : null }
  }
  const cur = await db.$queryRaw<{ holder: string; expires_in: number }[]>`
    SELECT "holder", EXTRACT(EPOCH FROM ("expiresAt" - (now() AT TIME ZONE 'UTC')))::float AS expires_in
    FROM "ServiceLease" WHERE "name" = ${LEASE_NAME}`
  return { ok: false, holder: cur[0]?.holder ?? null, expiresInS: cur[0] ? Math.max(0, Math.ceil(cur[0].expires_in)) : null }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface Lease {
  /** Stops renewing and deletes the row if this instance still holds it. */
  release(): Promise<void>
}

/**
 * Resolves once this instance holds the lease (waiting while another live
 * instance holds it), then keeps renewing it. `onLost` runs if a renewal finds
 * that another instance has taken it over — the caller must stop serving.
 */
export async function acquireLease(db: ResilientClient, onLost: (holder: string | null) => void): Promise<Lease> {
  let waitingLogged = false
  for (;;) {
    try {
      const res = await attempt(db)
      if (res.ok) {
        if (res.tookOverFrom) {
          console.warn(
            `[auction-service] took the engine lease over from a development copy (${res.tookOverFrom}) that was using ` +
              'this production database. That copy stops itself. Local development needs its own database (DEPLOY.md).',
          )
        }
        break
      }
      if (!waitingLogged) {
        if (!IS_PRODUCTION_HOST && isProdHolder(res.holder)) console.warn(SHARED_DB_WARNING)
        else
          console.warn(
            `[auction-service] another instance holds the engine lease (${res.holder ?? 'unknown'}, expires in ` +
              `${res.expiresInS ?? '?'}s). Waiting — this instance serves nothing until it is released or expires. ` +
              'Run exactly ONE instance; deploys must be stop-then-start (see DEPLOY.md).',
          )
        waitingLogged = true
      }
    } catch (err) {
      if (missingTable(err)) {
        console.error(
          '[auction-service] WARNING: the ServiceLease table is missing — run the database migrations (npm run db:deploy). ' +
            'Starting WITHOUT the single-instance guard.',
        )
        return { release: async () => undefined }
      }
      console.error('[auction-service] could not reach the database for the engine lease, retrying:', (err as Error).message)
    }
    await sleep(WAIT_RETRY_MS)
  }
  console.log(`[auction-service] engine lease "${LEASE_NAME}" acquired by ${LEASE_HOLDER}`)

  let stopped = false
  const timer = setInterval(() => {
    void (async () => {
      try {
        const res = await attempt(db)
        if (!res.ok && !stopped) {
          stopped = true
          clearInterval(timer)
          onLost(res.holder)
        }
      } catch (err) {
        // A database blip: the lease is only lost if another instance takes it
        // after it expires, which the next successful renewal will reveal.
        console.error('[auction-service] engine lease renewal failed (will retry):', (err as Error).message)
      }
    })()
  }, RENEW_MS)

  return {
    async release() {
      stopped = true
      clearInterval(timer)
      try {
        await db.$executeRaw`DELETE FROM "ServiceLease" WHERE "name" = ${LEASE_NAME} AND "holder" = ${LEASE_HOLDER}`
      } catch {
        // It expires on its own.
      }
    },
  }
}
