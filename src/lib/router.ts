'use client'

// Tiny client router over real URL paths (/room/BD26-DEMO). The server renders
// the app for the requested path (src/app/[[...slug]]/page.tsx passes it in) and
// adds per-path link-preview metadata; navigation after that is history.pushState.
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

/** Pages whose token is in the fragment, which only the browser can read. */
const needsFragment = (segs: string[]) => (segs[0] === 'reset-password' || segs[0] === 'invite') && !segs[1]

/**
 * Current path segments, e.g. ['room', 'BD26-DEMO'].
 *
 * Pass `initialSegs` (the path the server rendered, from page.tsx) and the
 * first render — on the server and while hydrating — already uses the real
 * route, so the server HTML is the actual page. The fragment is read after
 * mount; until then `ready` stays false on pages that need it (the token
 * links), so they show a neutral loader. Without `initialSegs`, `ready` is
 * false until the URL has been read after mount.
 */
export function useRoute(initialSegs?: string[]): { segs: string[]; fragment: string; ready: boolean } {
  const [route, setRoute] = useState<{ segs: string[]; fragment: string; mounted: boolean }>(() => ({
    segs: initialSegs ?? [],
    fragment: '',
    mounted: false,
  }))

  useEffect(() => {
    upgradeLegacyHashUrl()
    const update = () =>
      setRoute({ segs: currentSegs(), fragment: window.location.hash.replace(/^#/, ''), mounted: true })
    update()
    window.addEventListener('popstate', update)
    window.addEventListener(NAV_EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAV_EVENT, update)
    }
  }, [])

  const ready = route.mounted || (initialSegs !== undefined && !needsFragment(route.segs))
  return { segs: route.segs, fragment: route.fragment, ready }
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

/**
 * The visitor is signing up to bid: they came from a room ("/room/CODE") or a
 * team invite ("/invite#<token>", or "/invite/<token>" on older links).
 */
export function cameToBid(returnTo: string | null): boolean {
  return /^\/(room\/|invite(?:[/#]|$))/.test(returnTo ?? '')
}

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
 * True when the browser's Back goes to another page of this app — not out to
 * WhatsApp, a search engine or an empty new tab.
 */
export function canGoBackInApp(): boolean {
  return typeof window !== 'undefined' && (window.history.state as { inApp?: boolean } | null)?.inApp === true
}

/**
 * Navigate within the app, e.g. navigate('/tournaments'). `replace` swaps the
 * current history entry instead of adding one (redirects away from a page).
 */
export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  const target = to.startsWith('/') ? to : `/${to}`
  if (!isAppPath(target)) return
  if (window.location.pathname + window.location.hash !== target) {
    // A pushed entry is marked: the page before it is part of this app (see canGoBackInApp).
    if (replace) window.history.replaceState(window.history.state, '', target)
    else window.history.pushState({ inApp: true }, '', target)
    window.dispatchEvent(new Event(NAV_EVENT))
  }
  window.scrollTo(0, 0)
}
