// The first path segments the app renders (src/components/app-root.tsx). The
// server uses this to answer a real 404 for anything else instead of "200 + a
// spinner" (src/app/[[...slug]]/page.tsx). routes.test.ts fails CI when
// app-root handles a route that is missing here. No imports: shared by the
// server page and the unit tests.

export const ROUTE_HEADS: ReadonlySet<string> = new Set([
  '', // landing
  'account',
  'admin',
  'dashboard',
  'forgot-password',
  'invite',
  'join',
  'league',
  'login',
  'my-team',
  'overlay',
  'pricing',
  'privacy',
  'register',
  'register-player',
  'reset-password',
  'results',
  'room',
  'terms',
  'tournaments',
])

/** Whether the app has a page for this path (by its first segment). */
export function isKnownRoute(segs: readonly string[]): boolean {
  return ROUTE_HEADS.has(segs[0] ?? '')
}
