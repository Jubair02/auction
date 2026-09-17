import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/crypto'
import { createSessionToken, setSessionCookie, jsonError } from '@/lib/auth'
import { readJson, toSafeUser } from '../../_lib/helpers'

export const runtime = 'nodejs'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: Request) {
  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid login details', 400)
  }
  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonError('Invalid email or password', 401)
  }
  if (user.status === 'BLOCKED') {
    return jsonError('Your account has been blocked. Please contact support.', 403)
  }

  await setSessionCookie(createSessionToken(user.id, user.role as 'ADMIN' | 'ORGANIZER' | 'MANAGER'))
  return Response.json({ user: toSafeUser(user) })
}
