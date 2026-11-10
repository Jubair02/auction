'use client'

// Sends a browser crash (caught by an error boundary) to /api/client-errors,
// which logs it and alerts like a server error. A handful per page load at
// most; never throws, never blocks the UI.
const MAX_REPORTS_PER_PAGE = 5
let sent = 0
const seen = new Set<string>()

export function reportClientError(error: unknown, where: string): void {
  try {
    if (typeof window === 'undefined' || sent >= MAX_REPORTS_PER_PAGE) return
    const err = error instanceof Error ? error : new Error(String(error))
    const key = `${where}|${err.message}`
    if (seen.has(key)) return
    seen.add(key)
    sent++
    const payload = JSON.stringify({
      name: err.name,
      message: err.message,
      stack: err.stack?.slice(0, 2_000),
      where,
      path: window.location.pathname,
    })
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // reporting must never cause a second failure
  }
}
