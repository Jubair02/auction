// Branding for the share cards: brand colour, title sponsor and logos.
//
// Satori (next/og) can't decode WebP — and every upload is stored as WebP —
// so logos are read straight from our own uploads table (they are always
// /api/uploads/<id> URLs) and re-encoded to a small PNG data URI. Nothing is
// fetched over the network. Any failure just leaves the logo out.
import sharp from 'sharp'
import { db } from '@/lib/db'
import { normalizeHex, titleSponsor } from '@/lib/brand-color'
import type { PublicBranding } from '@/lib/types'
import { UPLOAD_URL_RE } from '../../_lib/helpers'

export interface CardBranding {
  /** Brand colour (#RRGGBB) or null for the NeelamGhor look. */
  accent: string | null
  /** PRO + "hide NeelamGhor branding": no wordmark, no platform footer. */
  hidePlatform: boolean
  tournamentName: string
  /** PNG data URI of the tournament logo (only loaded when it replaces the wordmark). */
  tournamentLogo: string | null
  sponsorName: string | null
  sponsorLogo: string | null
}

const LOGO_PX = 96

/** An /api/uploads/<id> image as a PNG data URI for Satori, or null. */
export async function uploadAsPngDataUri(url: string | null | undefined, size = LOGO_PX): Promise<string | null> {
  if (!url || !UPLOAD_URL_RE.test(url)) return null
  const id = url.slice(url.lastIndexOf('/') + 1)
  try {
    const row = await db.upload.findUnique({ where: { id }, select: { data: true } })
    if (!row) return null
    const png = await sharp(Buffer.from(row.data))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

export async function cardBranding(branding: PublicBranding | null): Promise<CardBranding | null> {
  if (!branding) return null
  const sponsor = titleSponsor(branding.sponsors)
  const [tournamentLogo, sponsorLogo] = await Promise.all([
    branding.hidePlatform ? uploadAsPngDataUri(branding.logoUrl) : Promise.resolve(null),
    sponsor ? uploadAsPngDataUri(sponsor.logoUrl) : Promise.resolve(null),
  ])
  return {
    accent: normalizeHex(branding.brandColor),
    hidePlatform: branding.hidePlatform,
    tournamentName: branding.name,
    tournamentLogo,
    sponsorName: sponsor?.name ?? null,
    sponsorLogo,
  }
}
