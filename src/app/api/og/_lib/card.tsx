// Shared look for the 1200×630 share cards (next/og → Satori). Satori needs
// display:flex on every element with more than one child, and inline styles.
//
// Labels are English: the bundled card font is Latin-only. Player, team and
// tournament names written in Bangla still render — next/og fetches the
// missing glyphs (Noto Sans Bengali) on demand — though without full
// conjunct shaping. Amounts use "BDT" for the same reason (৳ is a Bengali glyph).
import type { ReactNode } from 'react'
import { ensureContrast, mixHex, withAlpha } from '@/lib/brand-color'
import type { CardBranding } from './card-branding'

export const CARD_SIZE = { width: 1200, height: 630 }

/**
 * CDN-cacheable for minutes: final results rarely change, but an organizer can
 * still make them private (or delete the tournament) and the card must go too.
 */
export const CARD_HEADERS = { 'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=300' }

export const amount = (n: number) => `BDT ${new Intl.NumberFormat('en-IN').format(Math.round(n))}`

/** Keep long names on one line. */
export const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

export interface CardTheme {
  /** Flat fallback + gradient for the card background (always dark: white text reads on it). */
  background: string
  gradient: string
  /** Light accent for secondary text, the eyebrow and the wordmark's "Ghor". */
  tint: string
  /** Softer, near-white text. */
  soft: string
  /** Brand-coloured highlight (e.g. a stripe), readable on the dark background. */
  stripe: string
}

const DEFAULT_THEME: CardTheme = {
  background: '#0b3b37',
  gradient: 'linear-gradient(135deg, #115e59 0%, #0b3b37 55%, #052e2b 100%)',
  tint: '#99f6e4',
  soft: '#ccfbf1',
  stripe: '#14b8a6',
}

/**
 * Card colours from a brand colour. The background is the brand hue darkened
 * until white text has at least 6:1 contrast on it — a pale or neon brand
 * colour can never make the card unreadable.
 */
export function cardTheme(brand: CardBranding | null | undefined): CardTheme {
  const accent = brand?.accent
  if (!accent) return DEFAULT_THEME
  const top = ensureContrast(accent, '#FFFFFF', 6)
  const mid = ensureContrast(accent, '#FFFFFF', 10)
  const deep = ensureContrast(accent, '#FFFFFF', 15)
  return {
    background: mid,
    gradient: `linear-gradient(135deg, ${top} 0%, ${mid} 55%, ${deep} 100%)`,
    tint: ensureContrast(mixHex(accent, '#FFFFFF', 0.7), mid, 4.5),
    soft: ensureContrast(mixHex(accent, '#FFFFFF', 0.86), mid, 7),
    stripe: ensureContrast(accent, deep, 3),
  }
}

function Wordmark({ theme }: { theme: CardTheme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: '#f59e0b',
          color: '#052e2b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        N
      </div>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
        <span>Neelam</span>
        <span style={{ color: theme.tint }}>Ghor</span>
      </div>
    </div>
  )
}

/** White chip so any logo (dark, light, transparent) stays visible on the dark card. */
function LogoChip({ src, size }: { src: string; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        padding: 6,
      }}
    >
      <img src={src} width={size - 12} height={size - 12} alt="" style={{ objectFit: 'contain' }} />
    </div>
  )
}

export function CardFrame({
  eyebrow,
  brand,
  children,
}: {
  eyebrow: string
  /** PRO branding; null/undefined = the standard NeelamGhor card. */
  brand?: CardBranding | null
  children: ReactNode
}) {
  const theme = cardTheme(brand)
  const hide = !!brand?.hidePlatform
  const sponsor = brand?.sponsorName ?? null

  // Top-left: NeelamGhor, or (white-label) the tournament's own logo.
  const mark = hide ? (
    brand?.tournamentLogo ? <LogoChip src={brand.tournamentLogo} size={56} /> : <div style={{ display: 'flex' }} />
  ) : (
    <Wordmark theme={theme} />
  )

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '56px 64px',
        color: '#ffffff',
        backgroundColor: theme.background,
        backgroundImage: theme.gradient,
        fontFamily: 'Noto Sans, sans-serif',
        position: 'relative',
      }}
    >
      {brand?.accent ? (
        <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, backgroundColor: theme.stripe }} />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {mark}
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: 4,
            color: theme.tint,
            border: `2px solid ${withAlpha(theme.tint, 0.45)}`,
            borderRadius: 999,
            padding: '8px 22px',
          }}
        >
          {eyebrow}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 22, color: theme.tint }}>
        {sponsor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span>Presented by</span>
            {brand?.sponsorLogo ? <LogoChip src={brand.sponsorLogo} size={40} /> : null}
            <span style={{ fontWeight: 700, color: '#ffffff' }}>{clip(sponsor, 40)}</span>
          </div>
        ) : (
          <span>{hide ? '' : 'Live player auctions for Bangladesh'}</span>
        )}
        <span>{hide ? '' : 'neelamghor'}</span>
      </div>
    </div>
  )
}
