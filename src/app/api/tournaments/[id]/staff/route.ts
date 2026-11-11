import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit-shared'
import {
  EMAIL_RE,
  isUniqueViolation,
  loadTournamentForOwner,
  readJson,
  requireSession,
} from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// Route files may only export handlers/config, so this guard is not shared.
const isStaffRole = (v: unknown): v is 'CO_ORGANIZER' | 'AUCTIONEER' => v === 'CO_ORGANIZER' || v === 'AUCTIONEER'

// Adding staff: per caller IP and per tournament, so it can't be used to probe
// which emails have accounts.
const ADDS_PER_WINDOW = 20
const ADD_WINDOW_MS = 15 * 60 * 1000

/**
 * GET /api/tournaments/:id/staff — any staff member (incl. auctioneers).
 * → { owner: {userId, name, email}, staff: [{userId, name, email, role, addedAt}], myAccess }
 * Emails go to the owner, ADMINs and co-organizers only: auctioneers run the
 * room and never get contact details (email is null for them).
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user, 'run')
  if ('response' in loaded) return loaded.response

  const [owner, rows] = await Promise.all([
    db.user.findUnique({ where: { id: loaded.tournament.organizerId }, select: { id: true, name: true, email: true } }),
    db.tournamentStaff.findMany({
      where: { tournamentId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true, email: true } } },
    }),
  ])

  const seesEmails = loaded.access !== 'AUCTIONEER'
  return Response.json({
    owner: owner ? { userId: owner.id, name: owner.name, email: seesEmails ? owner.email : null } : null,
    staff: rows.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      email: seesEmails ? r.user.email : null,
      role: r.role,
      addedAt: r.createdAt.toISOString(),
    })),
    myAccess: loaded.access,
  })
}

/**
 * POST /api/tournaments/:id/staff — owner/ADMIN adds an organizer account as staff.
 * Body: { email, role: 'CO_ORGANIZER' | 'AUCTIONEER' } → 201 { member }
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const tooMany = (retryAfter: number) =>
    Response.json(
      { error: `Too many attempts. Please try again in ${retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  const perIp = await rateLimit(clientKey(req, 'staff-add'), ADDS_PER_WINDOW, ADD_WINDOW_MS)
  if (perIp !== null) return tooMany(perIp)

  const loaded = await loadTournamentForOwner(id, user, 'owner')
  if ('response' in loaded) return loaded.response
  const { tournament } = loaded
  // Charged only once the caller is known to be the owner: anyone else could
  // otherwise use up this tournament's budget and lock the owner out.
  const perTournament = await rateLimit(`staff-add-tournament:${id}`, ADDS_PER_WINDOW, ADD_WINDOW_MS)
  if (perTournament !== null) return tooMany(perTournament)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 120) return jsonError('Please enter a valid email address', 400)
  if (!isStaffRole(body.role)) return jsonError('Role must be CO_ORGANIZER or AUCTIONEER', 400)
  const role = body.role

  const target = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true, deletedAt: true },
  })
  if (!target || target.deletedAt) {
    return jsonError('No NeelamGhor account uses this email. Ask them to create an organizer account first.', 404)
  }
  if (target.status !== 'ACTIVE') return jsonError('This account is blocked and cannot be added', 400)
  if (target.role !== 'ORGANIZER') {
    return jsonError(
      target.role === 'MANAGER'
        ? 'This is a team manager account. Ask them to create an organizer account first.'
        : 'Only organizer accounts can be added as staff. Ask them to create an organizer account first.',
      400,
    )
  }
  if (target.id === tournament.organizerId) return jsonError('The tournament owner already has full access', 400)

  try {
    const row = await db.tournamentStaff.create({
      data: { tournamentId: id, userId: target.id, role, addedById: user.id },
    })
    return Response.json(
      {
        member: {
          userId: target.id,
          name: target.name,
          email: target.email,
          role: row.role,
          addedAt: row.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError('This person is already on the staff of this tournament', 409)
    throw err
  }
}
