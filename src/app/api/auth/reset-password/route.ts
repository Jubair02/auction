import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { hashOneTimeToken, hashPassword } from '@/lib/crypto'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { readJson } from '../../_lib/helpers'

export const runtime = 'nodejs'

const schema = z.object({
  token: z.string().min(20).max(200),
  // Same rules as registration.
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
})

const INVALID_LINK = 'This reset link is invalid or has expired. Request a new one.'

// POST /api/auth/reset-password {token, password}
export async function POST(req: Request) {
  const retryAfter = rateLimit(clientKey(req, 'reset-password'), 10, 15 * 60 * 1000)
  if (retryAfter !== null) {
    return jsonError(`Too many attempts. Please try again in ${retryAfter} seconds.`, 429)
  }

  const body = await readJson(req)
  const parsed = body ? schema.safeParse(body) : null
  if (!parsed?.success) {
    return jsonError(parsed?.error.issues[0]?.message ?? 'Invalid request', 400)
  }
  const { token, password } = parsed.data
  const tokenHash = hashOneTimeToken(token)

  const ok = await db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } })
    if (!row || row.usedAt || row.expiresAt <= new Date() || row.user.status !== 'ACTIVE') return false

    // Compare-and-swap: a double-submitted link can only ever be spent once.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (claimed.count !== 1) return false

    await tx.user.update({
      where: { id: row.userId },
      // Bumping the version signs the account out everywhere — whoever knew
      // the old password loses their session too.
      data: { passwordHash: hashPassword(password), sessionVersion: { increment: 1 } },
    })
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, id: { not: row.id } } })
    return true
  })

  if (!ok) return jsonError(INVALID_LINK, 400)
  return Response.json({ ok: true })
}
