import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { generateOneTimeToken, hashOneTimeToken } from '@/lib/crypto'
import { passwordResetEmail, sendEmail } from '@/lib/email'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { readJson } from '../../_lib/helpers'

export const runtime = 'nodejs'

const RESET_TTL_MINUTES = 30

const schema = z.object({ email: z.string().trim().toLowerCase().min(3).max(120) })

// Identical for every outcome, so the endpoint cannot be used to discover
// which emails have accounts.
const GENERIC_OK = {
  message: 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.',
}

/**
 * Base URL for links in emails. Never derived from the request's Host header
 * in production — a forged Host would make us mail out links to an attacker's
 * site ("password reset poisoning").
 */
function appBaseUrl(req: Request): string | null {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'production') return null
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return host ? `${proto}://${host}` : null
}

// POST /api/auth/forgot-password {email} — emails a single-use reset link
export async function POST(req: Request) {
  const retryAfter = rateLimit(clientKey(req, 'forgot-password'), 5, 15 * 60 * 1000)
  if (retryAfter !== null) {
    return jsonError(`Too many reset requests. Please try again in ${retryAfter} seconds.`, 429)
  }

  const body = await readJson(req)
  const parsed = body ? schema.safeParse(body) : null
  if (!parsed?.success) return jsonError('Enter the email address you registered with', 400)
  const { email } = parsed.data

  // Per-address cap too, so one inbox cannot be flooded from many IPs.
  if (rateLimit(`forgot-password-email:${email}`, 3, 60 * 60 * 1000) !== null) {
    return Response.json(GENERIC_OK)
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.status !== 'ACTIVE') return Response.json(GENERIC_OK)

  const baseUrl = appBaseUrl(req)
  if (!baseUrl) {
    console.error('[forgot-password] APP_URL is not set — cannot build a reset link in production')
    return Response.json(GENERIC_OK)
  }

  const token = generateOneTimeToken()
  await db.$transaction([
    // Only the newest link works.
    db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOneTimeToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      },
    }),
  ])

  // The token rides in the URL fragment: the client router reads it, and
  // browsers never send fragments to the server or in Referer headers.
  const link = `${baseUrl}/reset-password#${token}`
  const message = passwordResetEmail({ name: user.name, link, ttlMinutes: RESET_TTL_MINUTES })

  // Not awaited: waiting on Resend only for real accounts would make response
  // times reveal which emails are registered.
  void sendEmail({ to: user.email, ...message }).catch((err) => {
    console.error('[forgot-password] sending the reset email failed:', (err as Error).message)
  })

  return Response.json(GENERIC_OK)
}
