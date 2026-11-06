// Rate limits that hold across every server instance. The website runs on
// Vercel — many short-lived serverless instances — so the in-memory limiter
// (src/lib/rate-limit.ts) gives each instance its own counters and an attacker
// effectively gets limit × instances attempts. These counters live in Postgres
// (table "RateLimit"): one atomic upsert per check.
//
// Fails OPEN to the in-memory limiter if the database is unreachable: a DB
// blip must never lock everyone out of logging in.
import { db } from '@/lib/db'
import { rateLimit as memoryLimit, rateLimitBlocked as memoryBlocked, rateLimitReset as memoryReset } from '@/lib/rate-limit'

export { clientKey } from '@/lib/rate-limit'

/** Seconds until the window resets. */
const secondsUntil = (resetAt: Date) => Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))

/**
 * Counts this call. Returns null when allowed, or the seconds to wait once
 * more than `limit` calls were made within `windowMs`.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<number | null> {
  try {
    const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowMs / 1000}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`
    // Occasionally sweep long-expired counters so the table stays small.
    if (Math.random() < 0.01) {
      void db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 hour'`.catch(() => undefined)
    }
    const row = rows[0]
    return row && row.count > limit ? secondsUntil(row.resetAt) : null
  } catch (err) {
    console.error('[rate-limit] database counter unavailable, using in-memory fallback:', (err as Error).message)
    return memoryLimit(key, limit, windowMs)
  }
}

/** Seconds to wait if the bucket is already exhausted — without counting this call. */
export async function rateLimitBlocked(key: string, limit: number): Promise<number | null> {
  try {
    const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
      SELECT "count", "resetAt" FROM "RateLimit" WHERE "key" = ${key} AND "resetAt" > now()`
    const row = rows[0]
    return row && row.count >= limit ? secondsUntil(row.resetAt) : null
  } catch {
    return memoryBlocked(key, limit)
  }
}

/** Clears a bucket (e.g. after a successful login, so honest users are never punished). */
export async function rateLimitReset(key: string): Promise<void> {
  memoryReset(key)
  try {
    await db.$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${key}`
  } catch {
    // the counter expires by itself
  }
}
