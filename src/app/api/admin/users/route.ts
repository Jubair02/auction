import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { readJson, requireSessionRole, toSafeUser } from '../../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/admin/users — ADMIN only
export async function GET() {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tournaments: true } } },
  })

  return Response.json({
    users: users.map((u) => ({
      ...toSafeUser(u),
      tournamentCount: u._count.tournaments,
    })),
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
