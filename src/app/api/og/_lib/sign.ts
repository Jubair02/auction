// Link-preview images for room, registration and league links are addressed by
// the same code or id as the page. A room or registration code is short enough
// to guess, so an unsigned image URL would let anyone probe codes (and read the
// tournament name) without the page's per-IP limit. The page's metadata signs
// the image URL; the image route refuses anything it did not sign.
import { createHmac, timingSafeEqual } from 'crypto'
import { getAuctionSecret } from '@/lib/crypto'

export type OgCardKind = 'room' | 'league' | 'register'

export const OG_CARD_KINDS: readonly OgCardKind[] = ['room', 'league', 'register']

export function ogSignature(kind: OgCardKind, key: string): string {
  return createHmac('sha256', getAuctionSecret()).update(`og-card:${kind}:${key}`).digest('base64url').slice(0, 22)
}

export function ogSignatureValid(kind: OgCardKind, key: string, sig: string | null): boolean {
  if (!sig) return false
  const expected = Buffer.from(ogSignature(kind, key))
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Path of the signed card image for `kind`/`key` (append to the site origin). */
export function ogCardPath(kind: OgCardKind, key: string): string {
  return `/api/og/card/${kind}/${encodeURIComponent(key)}?s=${ogSignature(kind, key)}`
}
