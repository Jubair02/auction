import { createSession, jsonError, setSessionCookie } from '@/lib/auth'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { db } from '@/lib/db'
import { clientKey, rateLimit } from '@/lib/rate-limit-shared'
import { readJson, requireSession } from '../../_lib/helpers'

export const runtime = 'nodejs'

/**
 * POST /api/account/password {currentPassword, newPassword} — change the
 * password while signed in. Every existing session (other phones, a shared
 * venue laptop) and every seat pass ends, as after a reset; this device gets
 * a fresh session so the user stays signed in here.
 */
export async function POST(req: Request) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  // Guesses of the current password from a stolen session are bounded.
  const retryAfter = await rateLimit(`${clientKey(req, 'password-change')}:${user.id}`, 5, 15 * 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many attempts. Please try again in ${retryAfter} seconds.`, 429)

  const body = await readJson(req)
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword) return jsonError('Enter your current password', 400)
  if (newPassword.length < 6 || newPassword.length > 72) return jsonError('New password must be 6–72 characters', 400)

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, deletedAt: true } })
  if (!row || row.deletedAt) return jsonError('Account not found', 404)
  if (!verifyPassword(currentPassword, row.passwordHash)) return jsonError('Incorrect password', 401)
  if (verifyPassword(newPassword, row.passwordHash)) return jsonError('Choose a password different from your current one', 400)

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword), sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    return u
  })
  await setSessionCookie(await createSession(user.id, user.role, updated.sessionVersion))
  return Response.json({ ok: true })
}
