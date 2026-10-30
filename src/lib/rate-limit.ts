// ============================================================
// Minimal in-memory rate limiter (auth endpoints, room lookups/joins and the
// socket mini-service — each process keeps its own buckets). Single-process
// only — it is a brute-force speed bump, not a distributed quota.
// No Next.js imports: shared with the socket mini-service.
// ============================================================

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Best-effort client identity: the first proxy-forwarded address, else the peer. */
export function clientKey(req: Request, scope: string): string {
  return headerClientKey((name) => req.headers.get(name) ?? undefined, scope)
}

/** Same as clientKey, for callers holding raw headers (socket.io handshakes). */
export function headerClientKey(
  getHeader: (name: string) => string | string[] | undefined,
  scope: string,
  peer?: string,
): string {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const forwarded = first(getHeader('x-forwarded-for')) ?? ''
  const ip = forwarded.split(',')[0]?.trim() || first(getHeader('x-real-ip')) || peer || 'unknown'
  return `${scope}:${ip}`
}

/** Seconds to wait if the bucket is already exhausted — without counting this call. */
export function rateLimitBlocked(key: string, limit: number): number | null {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= Date.now() || bucket.count < limit) return null
  return Math.ceil((bucket.resetAt - Date.now()) / 1000)
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
