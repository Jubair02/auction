import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { CRICKET_ROLES, FOOTBALL_ROLES } from '@/lib/types'
import { readJson } from '../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ code: string }> }

const NOT_FOUND = 'This registration link is not valid. Ask the organizer for the current link.'
const MAX_PENDING_PER_TOURNAMENT = 2000

async function findTournament(code: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(code)) return null
  return db.tournament.findUnique({ where: { registrationCode: code } })
}

// GET /api/register/:code — public info for the sign-up page
export async function GET(req: Request, { params }: RouteParams) {
  const retryAfter = rateLimit(clientKey(req, 'register-player-view'), 120, 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many requests. Please try again in ${retryAfter} seconds.`, 429)

  const { code } = await params
  const t = await findTournament(code)
  if (!t) return jsonError(NOT_FOUND, 404)

  return Response.json({
    tournamentName: t.name,
    sport: t.sport,
    location: t.location,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    logoUrl: t.logoUrl,
    open: t.registrationOpen,
    roles: t.sport === 'FOOTBALL' ? FOOTBALL_ROLES : CRICKET_ROLES,
  })
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  // Lenient: local (01XXXXXXXXX) or international (+8801…), spaces/dashes allowed.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{8,20}$/, 'Enter a valid phone number'),
  role: z.string().trim().min(1, 'Pick your playing role'),
  previousTeam: z.string().trim().max(80).optional().nullable(),
  // Only our own uploads — never an arbitrary third-party URL.
  photoUrl: z
    .string()
    .regex(/^\/api\/uploads\/[a-z0-9]{20,40}$/i)
    .optional()
    .nullable(),
})

// POST /api/register/:code — a player signs up; lands as PENDING for the organizer
export async function POST(req: Request, { params }: RouteParams) {
  const retryAfter = rateLimit(clientKey(req, 'register-player'), 10, 60 * 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many sign-ups from here. Please try again in ${retryAfter} seconds.`, 429)

  const { code } = await params
  const t = await findTournament(code)
  if (!t) return jsonError(NOT_FOUND, 404)
  if (!t.registrationOpen) return jsonError('Registration for this tournament is closed.', 403)

  const body = await readJson(req)
  const parsed = body ? schema.safeParse(body) : null
  if (!parsed?.success) return jsonError(parsed?.error.issues[0]?.message ?? 'Invalid registration', 400)
  const data = parsed.data

  const roles: readonly string[] = t.sport === 'FOOTBALL' ? FOOTBALL_ROLES : CRICKET_ROLES
  if (!roles.includes(data.role)) return jsonError(`Role must be one of: ${roles.join(', ')}`, 400)

  const phone = data.phone.replace(/[\s-]/g, '')
  const [duplicate, pendingCount] = await Promise.all([
    db.playerRegistration.findFirst({
      where: { tournamentId: t.id, phone, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true },
    }),
    db.playerRegistration.count({ where: { tournamentId: t.id, status: 'PENDING' } }),
  ])
  if (duplicate) return jsonError('This phone number is already registered for this tournament.', 409)
  if (pendingCount >= MAX_PENDING_PER_TOURNAMENT) {
    return jsonError('Registration is full right now. Please contact the organizer.', 403)
  }

  await db.playerRegistration.create({
    data: {
      tournamentId: t.id,
      name: data.name,
      phone,
      role: data.role,
      previousTeam: data.previousTeam || null,
      photoUrl: data.photoUrl || null,
    },
  })
  return Response.json({ ok: true }, { status: 201 })
}
