import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { readJson, requireSessionRole, toSafeUser } from '../../_lib/helpers'

export const runtime = 'nodejs'

/** The admin list shows the newest this many; ?q= searches every account. */
const LIST_LIMIT = 500

// GET /api/admin/users[?q=] — ADMIN only → { users, total }
export async function GET(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100) ?? ''
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q } },
        ],
      }
    : {}
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { _count: { select: { tournaments: true } } },
    }),
    db.user.count({ where }),
  ])

  return Response.json({
    users: users.map((u) => ({
      ...toSafeUser(u),
      tournamentCount: u._count.tournaments,
    })),
    total,
  })
}

// PATCH /api/admin/users — {userId, status: ACTIVE|BLOCKED} — ADMIN only
export async function PATCH(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response
  const { user } = auth

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!userId) return jsonError('userId is required', 400)

  if (body.status !== 'ACTIVE' && body.status !== 'BLOCKED') {
    return jsonError('Status must be ACTIVE or BLOCKED', 400)
  }

  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) return jsonError('User not found', 404)

  if (target.id === user.id) return jsonError('You cannot change your own status', 400)
  if (target.role === 'ADMIN') return jsonError('Cannot change the status of an admin account', 400)

  const updated = await db.user.update({
    where: { id: userId },
    data: { status: body.status },
  })
  return Response.json({ user: toSafeUser(updated) })
}
