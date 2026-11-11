import { randomBytes } from 'node:crypto'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { clearSessionCookie, jsonError } from '@/lib/auth'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { track } from '@/lib/analytics'
import { clientKey, rateLimit } from '@/lib/rate-limit-shared'
import { normalizeBdPhone } from '@/lib/phone'
import { readJson, requireSession } from '../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/account — everything the account page shows: the role-specific
// workspace summary (tournaments owned, teams managed, staff seats, platform
// counts for admins) plus what blocks a deletion.
export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth
  const isAdmin = user.role === 'ADMIN'

  const [blocking, teams, managedTeams, staffRoles, payments, pendingPayments, platform] = await Promise.all([
    db.tournament.findMany({
      where: { organizerId: user.id, archivedAt: null },
      select: { id: true, name: true, status: true, sport: true, plan: true, logoUrl: true, _count: { select: { teams: true, players: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.team.findMany({
      where: { managerUserId: user.id, tournament: { archivedAt: null } },
      select: {
        id: true,
        name: true,
        color: true,
        logoUrl: true,
        budget: true,
        spent: true,
        maxSquad: true,
        _count: { select: { players: true } },
        tournament: { select: { id: true, name: true, status: true } },
      },
      orderBy: { tournament: { createdAt: 'desc' } },
      take: 6,
    }),
    db.team.count({ where: { managerUserId: user.id } }),
    db.tournamentStaff.findMany({
      where: { userId: user.id, tournament: { archivedAt: null } },
      select: { role: true, tournament: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    db.payment.count({ where: { userId: user.id } }),
    db.payment.count({ where: { userId: user.id, status: 'PENDING' } }),
    isAdmin
      ? Promise.all([
          db.user.count({ where: { deletedAt: null } }),
          db.tournament.count({ where: { archivedAt: null } }),
          db.tournament.count({ where: { archivedAt: null, status: 'LIVE' } }),
          db.payment.count({ where: { status: 'PENDING' } }),
        ]).then(([users, tournaments, live, pending]) => ({ users, tournaments, live, pendingPayments: pending }))
      : Promise.resolve(null),
  ])

  return Response.json({
    user,
    // Kept as {id, name} first for the deletion blocker; the extra fields feed the workspace list.
    activeTournaments: blocking.map(({ _count, ...tn }) => ({ ...tn, teams: _count.teams, players: _count.players })),
    teams: teams.map(({ _count, ...team }) => ({ ...team, squad: _count.players })),
    managedTeams,
    staffRoles: staffRoles.map((s) => ({ role: s.role, ...s.tournament })),
    payments,
    pendingPayments,
    platform,
    canDelete: !isAdmin,
  })
}

// PATCH /api/account {name?, phone?} — edit your own profile. Email (the login)
// and role stay as they are. → { user }
export async function PATCH(req: Request) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  const data: { name?: string; phone?: string | null } = {}
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 60) return jsonError('Name must be 2–60 characters', 400)
    data.name = name
  }
  if (body.phone !== undefined) {
    const raw = typeof body.phone === 'string' ? body.phone.trim() : ''
    if (raw === '') data.phone = null
    else {
      const phone = normalizeBdPhone(raw)
      if (!phone) return jsonError('Enter a valid Bangladeshi mobile number, e.g. 01712345678', 400)
      data.phone = phone
    }
  }
  if (Object.keys(data).length === 0) return jsonError('No valid fields to update', 400)

  const updated = await db.user.update({ where: { id: user.id }, data })
  return Response.json({ user: { ...user, name: updated.name, phone: updated.phone } })
}

// DELETE /api/account {password} — anonymizes the caller's account.
// The row stays (bids, payments and archived tournaments keep a valid owner)
// but every personal field is wiped and all sessions end.
export async function DELETE(req: Request) {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  // Password guesses against a stolen session are bounded.
  const retryAfter = await rateLimit(`${clientKey(req, 'account-delete')}:${user.id}`, 5, 15 * 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many attempts. Please try again in ${retryAfter} seconds.`, 429)

  if (user.role === 'ADMIN') {
    return jsonError('Admin accounts cannot be deleted here. Ask another admin to remove your admin role first.', 403)
  }

  const body = await readJson(req)
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password) return jsonError('Enter your password to confirm', 400)

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, deletedAt: true } })
  if (!row || row.deletedAt) return jsonError('Account not found', 404)
  if (!verifyPassword(password, row.passwordHash)) return jsonError('Incorrect password', 401)

  const owned = await db.tournament.count({ where: { organizerId: user.id, archivedAt: null } })
  if (owned > 0) {
    return jsonError(
      `You still own ${owned} tournament${owned === 1 ? '' : 's'}. Delete or archive ${owned === 1 ? 'it' : 'them'} first, then delete your account.`,
      409,
    )
  }

  const now = new Date()
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        name: 'Deleted user',
        email: `deleted-${user.id}@deleted.invalid`,
        phone: null,
        // Nobody knows this password, so the account can never be logged into again.
        passwordHash: hashPassword(randomBytes(32).toString('hex')),
        deletedAt: now,
        sessionVersion: { increment: 1 },
      },
    }),
    db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
    db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    db.team.updateMany({ where: { managerUserId: user.id }, data: { managerUserId: null } }),
    db.tournamentStaff.deleteMany({ where: { userId: user.id } }),
  ])
  await clearSessionCookie()
  after(() => track('account_deleted', { userId: user.id, props: { role: user.role } }))
  return Response.json({ ok: true })
}
