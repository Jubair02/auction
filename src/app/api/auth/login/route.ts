import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { track } from '@/lib/analytics'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { createSession, setSessionCookie, jsonError } from '@/lib/auth'
import { readJson, toSafeUser } from '../../_lib/helpers'
import { clientKey, rateLimit, rateLimitBlocked, rateLimitReset } from '@/lib/rate-limit-shared'

export const runtime = 'nodejs'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  password: z.string().min(1, 'Password is required').max(200),
})

const MINUTE = 60 * 1000
// Three independent budgets:
//  - per IP: caps one address across all accounts. Never reset by a success,
//    so logging into your own account cannot wipe the counter while you guess
//    at someone else's.
//  - per IP + email: the tight one; a correct login clears only this key.
//  - per account (failures only, from any IP): bounds a distributed guess at
//    one account. Shared-Wi-Fi users are unaffected unless they keep failing.
const PER_IP = { limit: 30, windowMs: 5 * MINUTE }
const PER_IP_EMAIL = { limit: 10, windowMs: 5 * MINUTE }
const PER_ACCOUNT_FAILURES = { limit: 20, windowMs: 60 * MINUTE }

// Unknown emails still pay for one scrypt, so response time does not reveal
// which addresses have accounts. Computed once, on the first such request.
let dummyHash: string | null = null
const timingDummy = () => (dummyHash ??= hashPassword('not-a-real-password'))

const tooMany = (seconds: number) =>
  jsonError(`Too many login attempts. Please try again in ${seconds} seconds.`, 429)

export async function POST(req: Request) {
  const ipKey = clientKey(req, 'login')
  const ipRetry = await rateLimit(ipKey, PER_IP.limit, PER_IP.windowMs)
  if (ipRetry !== null) return tooMany(ipRetry)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid login details', 400)
  }
  const { email, password } = parsed.data

  const pairKey = `${clientKey(req, 'login-pair')}:${email}`
  const accountKey = `login-acct:${email}`
  const pairRetry = await rateLimit(pairKey, PER_IP_EMAIL.limit, PER_IP_EMAIL.windowMs)
  if (pairRetry !== null) return tooMany(pairRetry)
  const accountRetry = await rateLimitBlocked(accountKey, PER_ACCOUNT_FAILURES.limit)
  if (accountRetry !== null) return tooMany(accountRetry)

  const user = await db.user.findUnique({ where: { email } })
  let ok = false
  if (user) ok = verifyPassword(password, user.passwordHash)
  else verifyPassword(password, timingDummy())
  // A deleted (anonymized) account answers exactly like a wrong password.
  if (!user || !ok || user.deletedAt) {
    await rateLimit(accountKey, PER_ACCOUNT_FAILURES.limit, PER_ACCOUNT_FAILURES.windowMs)
    return jsonError('Invalid email or password', 401)
  }
  if (user.status === 'BLOCKED') {
    return jsonError('Your account has been blocked. Please contact support.', 403)
  }

  await rateLimitReset(pairKey)
  await setSessionCookie(await createSession(user.id, user.role as 'ADMIN' | 'ORGANIZER' | 'MANAGER', user.sessionVersion))
  after(() => track('login', { userId: user.id }))
  return Response.json({ user: toSafeUser(user) })
}
