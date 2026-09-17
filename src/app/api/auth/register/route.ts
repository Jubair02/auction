import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'
import { createSessionToken, setSessionCookie, jsonError } from '@/lib/auth'
import { readJson, toSafeUser, EMAIL_RE } from '../../_lib/helpers'

export const runtime = 'nodejs'

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name is too long'),
  email: z.string().trim().toLowerCase().max(120).regex(EMAIL_RE, 'Please enter a valid email address'),
  phone: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  role: z.enum(['ORGANIZER', 'MANAGER'], { message: 'Role must be ORGANIZER or MANAGER' }),
})

export async function POST(req: Request) {
  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid registration details', 400)
  }
  const { name, email, phone, password, role } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return jsonError('An account with this email already exists', 409)

  const user = await db.user.create({
    data: {
      name,
      email, // already lowercased
      phone: phone || null,
      passwordHash: hashPassword(password),
      role,
      status: 'ACTIVE',
    },
  })

  await setSessionCookie(createSessionToken(user.id, user.role as 'ORGANIZER' | 'MANAGER'))
  return Response.json({ user: toSafeUser(user) }, { status: 201 })
}
