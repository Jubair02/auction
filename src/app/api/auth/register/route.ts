import { after } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { track } from '@/lib/analytics'
import { hashPassword } from '@/lib/crypto'
import { createSession, setSessionCookie, jsonError } from '@/lib/auth'
import { isUniqueViolation, readJson, toSafeUser, EMAIL_RE } from '../../_lib/helpers'
import { clientKey, rateLimit } from '@/lib/rate-limit-shared'

export const runtime = 'nodejs'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name is too long'),
  email: z.string().trim().toLowerCase().max(120).regex(EMAIL_RE, 'Please enter a valid email address'),
  phone: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  role: z.enum(['ORGANIZER', 'MANAGER'], { message: 'Role must be ORGANIZER or MANAGER' }),
})

export async function POST(req: Request) {
  // 20/hour per IP: several organizers or managers at one venue (shared
  // Wi-Fi, carrier NAT) can each still create an account.
  const retryAfter = await rateLimit(clientKey(req, 'register'), 20, 60 * 60 * 1000)
  if (retryAfter !== null) {
    return jsonError(`Too many accounts created from here. Please try again in ${retryAfter} seconds.`, 429)
  }

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid registration details', 400)
  }
  const { name, email, phone, password, role } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return jsonError('An account with this email already exists', 409)

  let user
  try {
    user = await db.user.create({
      data: {
        name,
        email, // already lowercased
        phone: phone || null,
        passwordHash: hashPassword(password),
        role,
        status: 'ACTIVE',
      },
    })
  } catch (err) {
    // Two sign-ups with the same email at the same moment: the check above can't catch it.
    if (isUniqueViolation(err)) return jsonError('An account with this email already exists', 409)
    throw err
  }

  await setSessionCookie(await createSession(user.id, user.role as 'ORGANIZER' | 'MANAGER', user.sessionVersion))
  const signedUp = user
  after(() => track('signup', { userId: signedUp.id, props: { role: signedUp.role } }))
  return Response.json({ user: toSafeUser(user) }, { status: 201 })
}
