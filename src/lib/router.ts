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

/** Current path segments, e.g. ['room', 'BD26-DEMO']. Empty until mounted. */
export function useRoute(): { segs: string[]; fragment: string } {
  const [route, setRoute] = useState<{ segs: string[]; fragment: string }>({ segs: [], fragment: '' })

  useEffect(() => {
    upgradeLegacyHashUrl()
    const update = () => setRoute({ segs: currentSegs(), fragment: window.location.hash.replace(/^#/, '') })
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
// user was trying to bid in). Per-tab, consumed once.
const RETURN_TO_KEY = 'ng_return_to'

export function setReturnTo(route: string) {
  try {
    sessionStorage.setItem(RETURN_TO_KEY, route)
  } catch {
    // storage unavailable — the user just lands on the dashboard
  }
}

export function peekReturnTo(): string | null {
  try {
    return typeof window === 'undefined' ? null : sessionStorage.getItem(RETURN_TO_KEY)
  } catch {
    return null
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

/** Navigate within the app, e.g. navigate('/tournaments'). */
export function navigate(to: string) {
  const target = to.startsWith('/') ? to : `/${to}`
  if (!isAppPath(target)) return
  if (window.location.pathname + window.location.hash !== target) {
    window.history.pushState(null, '', target)
    window.dispatchEvent(new Event(NAV_EVENT))
  }
  window.scrollTo(0, 0)
}

/** Absolute URL for sharing (WhatsApp, invites, emails built client-side). */
export function shareUrl(path: string): string {
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
}
