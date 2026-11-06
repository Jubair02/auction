'use client'

// Tiny client router over real URL paths (/room/BD26-DEMO). The server renders
// the same app shell for every path (src/app/[[...slug]]/page.tsx) and adds
// per-path link-preview metadata; navigation after that is history.pushState.
//
// Secrets (password-reset and invite tokens) travel in the URL *fragment*
// (/reset-password#<token>): browsers never send fragments to the server or in
// Referer headers, so tokens stay out of access logs.
import { useEffect, useState } from 'react'

const NAV_EVENT = 'ng:navigate'

function currentSegs(): string[] {
  return window.location.pathname.split('/').filter(Boolean).map(decodeURIComponent)
}

/**
 * Links shared before the switch to paths look like /#/room/BD26-DEMO.
 * Rewrite them in place (no request is made) so they keep working.
 */
function upgradeLegacyHashUrl(): void {
  const { hash } = window.location
  if (hash.startsWith('#/')) window.history.replaceState(null, '', hash.slice(1) || '/')
}

/**
 * Current path segments, e.g. ['room', 'BD26-DEMO']. `ready` is false until
 * the URL has been read after mount (the server render can't know it) — show
 * a neutral loader until then, never the landing page or the app chrome.
 */
export function useRoute(): { segs: string[]; fragment: string; ready: boolean } {
  const [route, setRoute] = useState<{ segs: string[]; fragment: string; ready: boolean }>({
    segs: [],
    fragment: '',
    ready: false,
  })

  useEffect(() => {
    upgradeLegacyHashUrl()
    const update = () =>
      setRoute({ segs: currentSegs(), fragment: window.location.hash.replace(/^#/, ''), ready: true })
    update()
    window.addEventListener('popstate', update)
    window.addEventListener(NAV_EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAV_EVENT, update)
    }
  }, [])

  return route
}

// Where to land after login/register (e.g. back into the auction room the
// user was trying to bid in). Per-tab, consumed once, and short-lived: an
// abandoned login must not drop a much later, ordinary login into an old room.
const RETURN_TO_KEY = 'ng_return_to'
const RETURN_TO_TTL_MS = 15 * 60 * 1000

export function setReturnTo(route: string) {
  try {
    sessionStorage.setItem(RETURN_TO_KEY, JSON.stringify({ route, at: Date.now() }))
  } catch {
    // storage unavailable — the user just lands on the dashboard
  }
}

export function peekReturnTo(): string | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = sessionStorage.getItem(RETURN_TO_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as { route?: unknown; at?: unknown }
    if (typeof saved.route !== 'string' || typeof saved.at !== 'number') return null
    return Date.now() - saved.at <= RETURN_TO_TTL_MS ? saved.route : null
  } catch {
    return null // includes values saved by older versions (plain strings)
  }
}

/** An in-app path only: "/x", never "//host" or "https://…". */
const isAppPath = (route: string) => route.startsWith('/') && !route.startsWith('//')

export function consumeReturnTo(): string | null {
  const route = peekReturnTo()
  try {
    sessionStorage.removeItem(RETURN_TO_KEY)
  } catch {
    // ignore
  }
  return route && isAppPath(route) ? route : null
}

/**
 * Navigate within the app, e.g. navigate('/tournaments'). `replace` swaps the
 * current history entry instead of adding one (redirects away from a page).
 */
export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  const target = to.startsWith('/') ? to : `/${to}`
  if (!isAppPath(target)) return
  if (window.location.pathname + window.location.hash !== target) {
    if (replace) window.history.replaceState(null, '', target)
    else window.history.pushState(null, '', target)
    window.dispatchEvent(new Event(NAV_EVENT))
  }
  window.scrollTo(0, 0)
}
