import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { readJson, requireSessionRole } from '../../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// PATCH /api/admin/tournaments/:id/plan {plan: 'FREE'|'PRO'} — ADMIN only manual override
// (e.g. comp a tournament, or undo a mistaken approval).
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const body = await readJson(req)
  if (!body || (body.plan !== 'FREE' && body.plan !== 'PRO')) return jsonError('plan must be FREE or PRO', 400)
  const plan = body.plan

  const tournament = await db.tournament.findUnique({ where: { id }, select: { id: true, plan: true, proSince: true } })
  if (!tournament) return jsonError('Tournament not found', 404)

  const updated = await db.tournament.update({
    where: { id },
    data: plan === 'PRO' ? { plan, proSince: tournament.proSince ?? new Date() } : { plan, proSince: null },
    select: { id: true, plan: true, proSince: true },
  })

  if (plan === 'PRO' && tournament.plan !== 'PRO') {
    await track('pro_activated', { userId: auth.user.id, tournamentId: id, props: { via: 'admin' } })
  }
  return Response.json({
    id: updated.id,
    plan: updated.plan === 'PRO' ? 'PRO' : 'FREE',
    proSince: updated.proSince ? updated.proSince.toISOString() : null,
  })
}
