// ============================================================
// Minimal in-memory rate limiter for the auth endpoints.
// Single-process only (the app runs as one standalone server) — it is a
// brute-force speed bump, not a distributed quota.
// ============================================================

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Best-effort client identity: the first proxy-forwarded address, else the peer. */
export function clientKey(req: Request, scope: string): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return `${scope}:${ip}`
}

/**
 * Returns null when the call is allowed, or the number of seconds to wait.
 * Expired buckets are swept lazily so the map cannot grow without bound.
 */
export function rateLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now()

  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (bucket.count >= limit) return Math.ceil((bucket.resetAt - now) / 1000)
  bucket.count++
  return null
}

/** Clears the bucket after a successful attempt (so honest users are never punished). */
export function rateLimitReset(key: string): void {
  buckets.delete(key)
}
