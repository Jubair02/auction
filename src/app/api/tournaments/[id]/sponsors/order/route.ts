import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { loadTournamentForOwner, readJson, requireSession } from '../../../../_lib/helpers'
import { listSponsors, PRO_ONLY } from '../_lib/sponsors'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PATCH /api/tournaments/:id/sponsors/order — owner / ADMIN / co-organizer, PRO only.
 * Body: { ids: string[] } — every sponsor of the tournament exactly once, in the
 * new order → { sponsors: SponsorDTO[] }. Title sponsors still show first; the
 * order applies within each tier.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response
  if (loaded.tournament.plan !== 'PRO') return jsonError(PRO_ONLY, 402)

  const body = await readJson(req)
  const ids: unknown = body?.ids
  if (!Array.isArray(ids) || !ids.every((x): x is string => typeof x === 'string')) {
    return jsonError('ids must be a list of sponsor ids', 400)
  }

  const current = await db.sponsor.findMany({ where: { tournamentId: id }, select: { id: true } })
  const known = new Set(current.map((s) => s.id))
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((x) => known.has(x))) {
    return jsonError('The sponsor list changed — reload and try again', 409)
  }

  await db.$transaction(
    ids.map((sponsorId, index) => db.sponsor.update({ where: { id: sponsorId }, data: { sortOrder: index } })),
  )
  return Response.json({ sponsors: await listSponsors(id) })
}
