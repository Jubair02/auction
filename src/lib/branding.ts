// Public branding for a tournament: what the stream overlay, live room, results
// and league pages and share cards show. Server-only (uses the database).
//
// Branding is a PRO feature: a FREE tournament always shows NeelamGhor branding
// and no sponsors, whatever was saved.
import { db } from '@/lib/db'
import { normalizeHex } from '@/lib/brand-color'
import type { PublicBranding, SponsorDTO, SponsorTier } from '@/lib/types'

const TIERS: readonly SponsorTier[] = ['TITLE', 'ASSOCIATE', 'SPONSOR', 'PARTNER']
const tierRank = (t: string) => {
  const i = TIERS.indexOf(t as SponsorTier)
  return i === -1 ? TIERS.length : i
}

export function serializeSponsor(s: {
  id: string
  name: string
  logoUrl: string | null
  url: string | null
  tier: string
  sortOrder: number
}): SponsorDTO {
  return {
    id: s.id,
    name: s.name,
    logoUrl: s.logoUrl,
    url: s.url,
    tier: (TIERS as readonly string[]).includes(s.tier) ? (s.tier as SponsorTier) : 'SPONSOR',
    sortOrder: s.sortOrder,
  }
}

/** Title sponsors first, then by the organizer's order. */
export function sortSponsors<T extends { tier: string; sortOrder: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.sortOrder - b.sortOrder)
}

export async function getPublicBranding(tournament: {
  id: string
  name: string
  plan: string
  logoUrl: string | null
  brandColor: string | null
  brandHidePlatform: boolean
}): Promise<PublicBranding> {
  const pro = tournament.plan === 'PRO'
  const sponsors = pro
    ? sortSponsors(await db.sponsor.findMany({ where: { tournamentId: tournament.id } })).map(serializeSponsor)
    : []
  return {
    name: tournament.name,
    logoUrl: tournament.logoUrl,
    brandColor: pro ? normalizeHex(tournament.brandColor) : null,
    hidePlatform: pro && tournament.brandHidePlatform,
    sponsors,
  }
}

/** Public branding by tournament id (share cards, link previews); null when there is no such tournament. */
export async function getPublicBrandingById(tournamentId: string): Promise<PublicBranding | null> {
  const t = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, plan: true, logoUrl: true, brandColor: true, brandHidePlatform: true },
  })
  return t ? getPublicBranding(t) : null
}
