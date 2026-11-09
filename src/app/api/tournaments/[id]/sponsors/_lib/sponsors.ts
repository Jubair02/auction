// Shared validation for the sponsors routes (private folder — never routed).
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { parseSponsorUrl, SPONSOR_LIMITS, SPONSOR_TIERS } from '@/lib/brand-color'
import { serializeSponsor, sortSponsors } from '@/lib/branding'
import type { SponsorDTO, SponsorTier } from '@/lib/types'
import { IMAGE_URL_ERROR, parseImageUrl } from '../../../../_lib/helpers'

export const PRO_ONLY = 'Sponsors are a Pro feature — upgrade this tournament to add sponsors'

export interface SponsorInput {
  name?: string
  logoUrl?: string | null
  url?: string | null
  tier?: SponsorTier
}

/**
 * Validates a sponsor body. `create` requires a name; an edit validates only
 * the fields it sends.
 */
export function parseSponsorBody(
  body: Record<string, unknown>,
  create: boolean,
): { ok: true; data: SponsorInput } | { ok: false; response: Response } {
  const data: SponsorInput = {}
  const fail = (msg: string) => ({ ok: false as const, response: jsonError(msg, 400) })

  if (body.name !== undefined || create) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (name.length < SPONSOR_LIMITS.nameMin || name.length > SPONSOR_LIMITS.nameMax) {
      return fail(`Sponsor name must be ${SPONSOR_LIMITS.nameMin}–${SPONSOR_LIMITS.nameMax} characters`)
    }
    data.name = name
  }

  const logo = parseImageUrl(body.logoUrl)
  if (logo === false) return fail(IMAGE_URL_ERROR)
  if (logo !== undefined) data.logoUrl = logo

  if (body.url !== undefined) {
    const url = parseSponsorUrl(body.url)
    if (url === false) {
      return fail(
        `Sponsor link must be a web address starting with http:// or https:// (at most ${SPONSOR_LIMITS.urlMax} characters)`,
      )
    }
    data.url = url
  }

  if (body.tier !== undefined) {
    if (typeof body.tier !== 'string' || !(SPONSOR_TIERS as readonly string[]).includes(body.tier)) {
      return fail(`Tier must be one of ${SPONSOR_TIERS.join(', ')}`)
    }
    data.tier = body.tier as SponsorTier
  }
  return { ok: true, data }
}

/** The tournament's sponsors in display order (title sponsors first). */
export async function listSponsors(tournamentId: string): Promise<SponsorDTO[]> {
  const rows = await db.sponsor.findMany({ where: { tournamentId } })
  return sortSponsors(rows).map(serializeSponsor)
}
