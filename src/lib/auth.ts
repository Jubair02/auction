// Session auth for Next.js API routes (httpOnly HMAC cookie)
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getAuctionSecret, signToken, verifyToken } from '@/lib/crypto'
import type { SafeUser, UserRole } from '@/lib/types'

export const SESSION_COOKIE = 'ng_session'
const SESSION_TTL = 60 * 60 * 24 * 14 // 14 days
// Behind TLS in production the session cookie must not travel over plain HTTP.
const SECURE_COOKIE = process.env.NODE_ENV === 'production'

export interface SessionUser {
  id: string
  role: UserRole
}

/**
 * Starts a session: one Session row per login, named in the cookie (`sid`).
 * Logging out revokes exactly that row, so a copied cookie stops working
 * while the user's other devices stay signed in. `sessionVersion` is still
 * embedded — a password reset bumps it and ends every session at once.
 */
export async function createSession(userId: string, role: UserRole, sessionVersion: number): Promise<string> {
  const session = await db.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_TTL * 1000) },
    select: { id: true },
  })
  // Occasionally drop long-dead rows so the table stays small.
  if (Math.random() < 0.02) {
    void db.session
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
      .catch(() => undefined)
  }
  return signToken({ sub: userId, role, sv: sessionVersion, sid: session.id }, SESSION_TTL)
}

/** Logout: revokes the session named in the current cookie (if any), then clears the cookie. */
export async function endCurrentSession(): Promise<void> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    const payload = token ? verifyToken<{ sid?: string }>(token) : null
    if (payload?.sid) {
      await db.session.updateMany({ where: { id: payload.sid, revokedAt: null }, data: { revokedAt: new Date() } })
    }
  } catch {
    // still clear the cookie below
  }
  await clearSessionCookie()
}

export async function setSessionCookie(token: string) {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE_COOKIE,
    maxAge: SESSION_TTL,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: SECURE_COOKIE, maxAge: 0, path: '/' })
}

export async function getSessionUser(): Promise<SafeUser | null> {
  return (await getSessionUserWithVersion())?.user ?? null
}

/**
 * The session user plus their current session version — put into live-auction
 * seat passes so the socket service can tell when the account was signed out
 * everywhere (password reset) after the pass was issued. Server-side only.
 */
export async function getSessionUserWithVersion(): Promise<{ user: SafeUser; sessionVersion: number } | null> {
  // A missing AUCTION_SECRET must surface as a server error, not be swallowed
  // below and silently log everyone out.
  getAuctionSecret()
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null
    const payload = verifyToken<{ sub: string; role: UserRole; sv?: number; sid?: string }>(token)
    // Cookies from before server-side sessions carry no `sid`; they are no
    // longer accepted (they could never be revoked) — the user just logs in again.
    if (!payload?.sub || !payload.sid) return null
    // Only the columns used below (not the password hash) — this runs on every
    // signed-in request.
    const session = await db.session.findUnique({
      where: { id: payload.sid },
      select: {
        revokedAt: true,
        expiresAt: true,
        userId: true,
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, sessionVersion: true },
        },
      },
    })
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.userId !== payload.sub) return null
    const user = session.user
    if (user.status === 'BLOCKED') return null
    // Cookies issued before session versioning carry no `sv` and count as 0.
    if ((payload.sv ?? 0) !== user.sessionVersion) return null
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role as UserRole,
        status: user.status as SafeUser['status'],
        createdAt: user.createdAt.toISOString(),
      },
      sessionVersion: user.sessionVersion,
    }
  } catch {
    return null
  }
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

export async function requireUser(): Promise<{ user: SafeUser } | { response: Response }> {
  const user = await getSessionUser()
  if (!user) return { response: jsonError('You must be logged in', 401) }
  return { user }
}

export async function requireRole(...roles: UserRole[]): Promise<{ user: SafeUser } | { response: Response }> {
  const result = await requireUser()
  if ('response' in result) return result
  if (!roles.includes(result.user.role)) {
    return { response: jsonError('You do not have permission for this action', 403) }
  }
  return result
}
