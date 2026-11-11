import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { serializeSponsor } from '@/lib/branding'
import { isNotFound, loadTournamentForOwner, readJson, requireSession } from '../../../../_lib/helpers'
import { parseSponsorBody, PRO_ONLY } from '../_lib/sponsors'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string; sponsorId: string }> }

/**
 * PATCH /api/tournaments/:id/sponsors/:sponsorId — owner / ADMIN / co-organizer, PRO only.
 * Body: any of { name, logoUrl, url, tier } → { sponsor: SponsorDTO }
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id, sponsorId } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response
  if (loaded.tournament.plan !== 'PRO') return jsonError(PRO_ONLY, 402)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  const parsed = parseSponsorBody(body, false)
  if (!parsed.ok) return parsed.response
  if (Object.keys(parsed.data).length === 0) return jsonError('No valid fields to update', 400)

  const existing = await db.sponsor.findFirst({ where: { id: sponsorId, tournamentId: id }, select: { id: true } })
  if (!existing) return jsonError('Sponsor not found', 404)

  let sponsor
  try {
    sponsor = await db.sponsor.update({ where: { id: sponsorId }, data: parsed.data })
  } catch (err) {
    if (isNotFound(err)) return jsonError('Sponsor not found', 404)
    throw err
  }
  return Response.json({ sponsor: serializeSponsor(sponsor) })
}

/**
 * DELETE /api/tournaments/:id/sponsors/:sponsorId — owner / ADMIN / co-organizer.
 * Allowed on any plan, so a tournament without Pro can still clean up. → { ok: true }
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id, sponsorId } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response

  const { count } = await db.sponsor.deleteMany({ where: { id: sponsorId, tournamentId: id } })
  if (count === 0) return jsonError('Sponsor not found', 404)
  return Response.json({ ok: true })
}
