import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { accessAllows, loadTournamentForOwner, readJson, requireSession } from '../../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string; userId: string }> }

const isStaffRole = (v: unknown): v is 'CO_ORGANIZER' | 'AUCTIONEER' => v === 'CO_ORGANIZER' || v === 'AUCTIONEER'

/**
 * PATCH /api/tournaments/:id/staff/:userId — owner/ADMIN changes a staff role.
 * Body: { role: 'CO_ORGANIZER' | 'AUCTIONEER' } → { member: {userId, role} }
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id, userId } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user, 'owner')
  if ('response' in loaded) return loaded.response

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  if (!isStaffRole(body.role)) return jsonError('Role must be CO_ORGANIZER or AUCTIONEER', 400)

  const updated = await db.tournamentStaff.updateMany({
    where: { tournamentId: id, userId },
    data: { role: body.role },
  })
  if (updated.count === 0) return jsonError('This person is not on the staff of this tournament', 404)
  return Response.json({ member: { userId, role: body.role } })
}

/**
 * DELETE /api/tournaments/:id/staff/:userId — owner/ADMIN removes a staff
 * member, or a staff member leaves the tournament themselves. → { ok: true }
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id, userId } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user, 'run')
  if ('response' in loaded) return loaded.response
  if (userId !== user.id && !accessAllows(loaded.access, 'owner')) {
    return jsonError('Only the tournament owner can remove staff', 403)
  }

  const removed = await db.tournamentStaff.deleteMany({ where: { tournamentId: id, userId } })
  if (removed.count === 0) return jsonError('This person is not on the staff of this tournament', 404)
  // Live-room seats are re-checked by the auction service, which drops an
  // organizer seat once its holder is no longer owner, ADMIN or staff.
  return Response.json({ ok: true })
}
