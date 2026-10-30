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

/** `sessionVersion` is the user's current value — bumping it in the DB revokes this token. */
export function createSessionToken(userId: string, role: UserRole, sessionVersion: number): string {
  return signToken({ sub: userId, role, sv: sessionVersion }, SESSION_TTL)
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
  // A missing AUCTION_SECRET must surface as a server error, not be swallowed
  // below and silently log everyone out.
  getAuctionSecret()
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null
    const payload = verifyToken<{ sub: string; role: UserRole; sv?: number }>(token)
    if (!payload?.sub) return null
    const user = await db.user.findUnique({ where: { id: payload.sub } })
    if (!user || user.status === 'BLOCKED') return null
    // Cookies issued before session versioning carry no `sv` and count as 0.
    if ((payload.sv ?? 0) !== user.sessionVersion) return null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      status: user.status as SafeUser['status'],
      createdAt: user.createdAt.toISOString(),
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
