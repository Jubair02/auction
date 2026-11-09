import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { SPONSOR_LIMITS } from '@/lib/brand-color'
import { serializeSponsor } from '@/lib/branding'
import { loadTournamentForOwner, readJson, requireSession } from '../../../_lib/helpers'
import { listSponsors, parseSponsorBody, PRO_ONLY } from './_lib/sponsors'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/tournaments/:id/sponsors — any staff member.
 * → { sponsors: SponsorDTO[], plan } (title sponsors first, then the organizer's order)
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user, 'run')
  if ('response' in loaded) return loaded.response

  return Response.json({
    sponsors: await listSponsors(id),
    plan: loaded.tournament.plan === 'PRO' ? 'PRO' : 'FREE',
  })
}

/**
 * POST /api/tournaments/:id/sponsors — owner / ADMIN / co-organizer, PRO only.
 * Body: { name, logoUrl?, url?, tier? } → 201 { sponsor: SponsorDTO }
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user, 'manage')
  if ('response' in loaded) return loaded.response
  if (loaded.tournament.plan !== 'PRO') return jsonError(PRO_ONLY, 402)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  const parsed = parseSponsorBody(body, true)
  if (!parsed.ok) return parsed.response

  const [count, last] = await Promise.all([
    db.sponsor.count({ where: { tournamentId: id } }),
    db.sponsor.findFirst({ where: { tournamentId: id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
  ])
  if (count >= SPONSOR_LIMITS.max) return jsonError(`A tournament can have at most ${SPONSOR_LIMITS.max} sponsors`, 400)

  const sponsor = await db.sponsor.create({
    data: {
      tournamentId: id,
      name: parsed.data.name!,
      logoUrl: parsed.data.logoUrl ?? null,
      url: parsed.data.url ?? null,
      tier: parsed.data.tier ?? 'SPONSOR',
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  return Response.json({ sponsor: serializeSponsor(sponsor) }, { status: 201 })
}
