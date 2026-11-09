import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { readJson, requireSessionRole } from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// PATCH /api/admin/payments/:id {action: 'approve'|'reject', note?} — ADMIN only.
// Approving makes the tournament Pro. Only a PENDING payment can be reviewed, once.
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response
  const { user } = auth

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  if (body.action !== 'approve' && body.action !== 'reject') return jsonError('action must be approve or reject', 400)
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return jsonError('note must be text', 400)
  const note = typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null
  if (note && note.length > 300) return jsonError('Note must be at most 300 characters', 400)

  const payment = await db.payment.findUnique({ where: { id } })
  if (!payment) return jsonError('Payment not found', 404)
  if (payment.status !== 'PENDING') return jsonError('This payment was already reviewed', 409)

  const now = new Date()
  const review = { reviewNote: note, reviewedById: user.id, reviewedAt: now }

  if (body.action === 'reject') {
    // Compare-and-swap: a second admin tab can't review the same payment twice.
    const claimed = await db.payment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', ...review } })
    if (claimed.count === 0) return jsonError('This payment was already reviewed', 409)
    return Response.json({ ok: true, status: 'REJECTED' })
  }

  const approved = await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', ...review } })
    if (claimed.count === 0) return false
    if (payment.tournamentId) {
      // Already Pro (e.g. comped by an admin) keeps its original proSince.
      await tx.tournament.updateMany({
        where: { id: payment.tournamentId, plan: { not: 'PRO' } },
        data: { plan: 'PRO', proSince: now },
      })
    }
    return true
  })
  if (!approved) return jsonError('This payment was already reviewed', 409)

  await track('pro_activated', {
    userId: payment.userId,
    tournamentId: payment.tournamentId,
    props: { via: 'payment', method: payment.method, amount: payment.amount },
  })
  return Response.json({ ok: true, status: 'APPROVED' })
}
