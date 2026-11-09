// Who may open which page — the single table the router and the post-login
// redirect both use. This is navigation only: every API route enforces the
// same rules (and tournament ownership) on the server.
import type { UserRole } from '@/lib/types'

/**
 * public — anyone, logged in or not
 * guest  — logged-out visitors only (login / register); users go to their dashboard
 * auth   — any logged-in user
 * roles  — logged-in users with one of these roles
 */
export type PageAccess = 'public' | 'guest' | 'auth' | readonly UserRole[]

const STAFF: readonly UserRole[] = ['ORGANIZER', 'ADMIN']

export function pageAccess(segs: string[]): PageAccess {
  switch (segs[0] ?? '') {
    case 'login':
    case 'register':
      return 'guest'
    case 'dashboard':
    case 'account':
      return 'auth'
    case 'tournaments':
      return STAFF
    case 'my-team':
      return ['MANAGER']
    case 'admin':
      return ['ADMIN']
    // Landing, privacy notice, password reset, invites (they handle login
    // themselves), the live room, overlay, player registration, join-by-code,
    // 404 — and results / league pages (fixtures, points table): public ones are
    // for everyone, and the API decides (private ones ask the visitor to log in).
    case 'results':
    case 'league':
    default:
      return 'public'
  }
}

export function canOpen(segs: string[], role: UserRole | null): boolean {
  const access = pageAccess(segs)
  if (access === 'public') return true
  if (access === 'guest') return role === null
  if (role === null) return false
  return access === 'auth' || access.includes(role)
}

/** Every role's dashboard lives at /dashboard; the page renders the role's own view. */
export const DASHBOARD_PATH = '/dashboard'

/**
 * Where to send a user right after login: back to the page they were trying to
 * reach if their role may open it, otherwise their own dashboard.
 */
export function postLoginPath(returnTo: string | null, role: UserRole): string {
  if (!returnTo) return DASHBOARD_PATH
  const segs = returnTo.split(/[?#]/)[0].split('/').filter(Boolean)
  return canOpen(segs, role) && pageAccess(segs) !== 'guest' ? returnTo : DASHBOARD_PATH
}
