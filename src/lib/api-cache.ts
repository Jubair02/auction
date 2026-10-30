'use client'

// Stale-while-revalidate cache for GET requests. A page that was visited (or
// prefetched) recently renders its last data immediately and refreshes it in
// the background, so navigation never waits on the network for content it
// already has. Every mount still revalidates, so data stays current.
import { useCallback, useEffect, useState } from 'react'
import { apiGet, ApiError } from '@/lib/api'

interface Entry {
  data?: unknown
  /** When the request that produced `data` started. */
  at: number
  inflight?: Promise<unknown>
}

// Older than this, cached data is not shown at all (a skeleton is better than
// a long-stale page); it is only used as a starting point while revalidating.
const MAX_STALE_MS = 5 * 60_000
// Within this, a prefetch reuses the cached copy instead of hitting the API again.
const FRESH_MS = 10_000

const cache = new Map<string, Entry>()

function load<T>(url: string): Promise<T> {
  const entry = cache.get(url)
  if (entry?.inflight) return entry.inflight as Promise<T>
  const started = Date.now()
  const inflight: Promise<T> = apiGet<T>(url).then(
    (data) => {
      const current = cache.get(url)
      // A response from before a newer request (one started after a save)
      // must never overwrite what that newer request returned.
      if (current && current.at > started) return data
      const newer = current?.inflight !== inflight ? current?.inflight : undefined
      cache.set(url, { data, at: started, inflight: newer })
      return data
    },
    (err) => {
      const current = cache.get(url)
      if (current?.inflight === inflight) {
        if (current.data === undefined) cache.delete(url)
        else cache.set(url, { data: current.data, at: current.at })
      }
      throw err
    },
  )
  cache.set(url, { data: entry?.data, at: entry?.at ?? 0, inflight })
  return inflight
}

/** Cached data for `url`, if it is recent enough to show. */
export function peekCached<T>(url: string): T | undefined {
  const entry = cache.get(url)
  if (!entry || entry.data === undefined || Date.now() - entry.at > MAX_STALE_MS) return undefined
  return entry.data as T
}

/** Start loading `url` ahead of time (on hover / press of a link to it). */
export function prefetch(url: string): void {
  const entry = cache.get(url)
  if (entry?.inflight || (entry && Date.now() - entry.at < FRESH_MS)) return
  load(url).catch(() => undefined)
}

/** Drop cached responses after a change that makes them wrong (save, delete…). */
export function invalidateCached(...urls: string[]): void {
  for (const url of urls) cache.delete(url)
}

export interface CachedGet<T> {
  data: T | undefined
  /** No data to show yet (first visit, or the cached copy was too old). */
  loading: boolean
  error: ApiError | Error | null
  /** Fetch fresh data now; resolves once it is applied. */
  refetch: () => Promise<void>
}

/**
 * Shows cached data for `url` instantly (when there is any) and always fetches
 * a fresh copy on mount. `onError` runs for failed fetches, e.g. to toast.
 */
export function useCachedGet<T>(url: string, onError?: (err: unknown) => void): CachedGet<T> {
  const [state, setState] = useState<{ url: string; data: T | undefined; error: Error | null; done: boolean }>(() => ({
    url,
    data: peekCached<T>(url),
    error: null,
    done: false,
  }))

  // A new url (another tournament) starts from that url's cache, not the old data.
  let current = state
  if (state.url !== url) {
    current = { url, data: peekCached<T>(url), error: null, done: false }
    setState(current)
  }

  const fetchFresh = useCallback(
    async (force: boolean) => {
      if (force) {
        // A mutation just happened: never reuse a request started before it.
        const entry = cache.get(url)
        if (entry?.inflight) cache.set(url, { data: entry.data, at: entry.at })
      }
      try {
        const fresh = await load<T>(url)
        // Read back from the cache: if a newer request already landed, show that.
        const data = (cache.get(url)?.data as T | undefined) ?? fresh
        setState((s) => (s.url === url ? { url, data, error: null, done: true } : s))
      } catch (err) {
        setState((s) => (s.url === url ? { ...s, error: err as Error, done: true } : s))
        onError?.(err)
      }
    },
    // onError is a notification callback; a new identity must not refetch.
    [url],
  )

  useEffect(() => {
    void fetchFresh(false)
  }, [fetchFresh])

  const refetch = useCallback(() => fetchFresh(true), [fetchFresh])

  return {
    data: current.data,
    loading: current.data === undefined && !current.done,
    error: current.error,
    refetch,
  }
}
