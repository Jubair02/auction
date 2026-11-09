// Brand colour helpers — pure (no React, no database), safe on the server,
// in the browser and inside next/og share cards.
//
// A tournament's brand colour is chosen by the organizer, so it can be
// anything from near-white to near-black. Nothing here ever puts text on it
// without picking a readable foreground first (WCAG relative luminance).

/** Sponsor rules shared by the API and the branding panel. */
export const SPONSOR_LIMITS = { max: 20, nameMin: 2, nameMax: 60, urlMax: 200 } as const
export const SPONSOR_TIERS = ['TITLE', 'ASSOCIATE', 'SPONSOR', 'PARTNER'] as const

/** Default accent when a tournament has no brand colour (NeelamGhor teal-700). */
export const DEFAULT_BRAND_COLOR = '#0F766E'

/** Swatches offered in the branding panel. */
export const BRAND_PRESETS: readonly string[] = [
  '#0F766E', // teal (NeelamGhor)
  '#047857', // emerald
  '#15803D', // green
  '#1D4ED8', // blue
  '#0E7490', // cyan
  '#4338CA', // indigo
  '#7C3AED', // violet
  '#BE185D', // pink
  '#B91C1C', // red
  '#C2410C', // orange
  '#A16207', // amber/gold
  '#0F172A', // navy / near-black
]

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i

/** "#0f766e", "0F766E" or "#0f7" → "#0F766E"; anything else → null. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null
  const m = HEX_RE.exec(input.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return `#${h.toUpperCase()}`
}

/** Strict form the API stores: "#RRGGBB". */
export function isHexColor(input: unknown): input is string {
  return typeof input === 'string' && /^#[0-9a-f]{6}$/i.test(input)
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex)
  if (!n) return null
  return {
    r: Number.parseInt(n.slice(1, 3), 16),
    g: Number.parseInt(n.slice(3, 5), 16),
    b: Number.parseInt(n.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const p = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase()
}

/** WCAG 2.x relative luminance, 0 (black) … 1 (white). Invalid colours count as black. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

/** WCAG contrast ratio between two colours, 1 … 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white — whichever reads better on the given background. */
export function readableForeground(background: string): '#000000' | '#FFFFFF' {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000') ? '#FFFFFF' : '#000000'
}

/**
 * The colour itself when it already reaches `minRatio` against `surface`,
 * otherwise the same hue mixed towards black (light surfaces) or white (dark
 * surfaces) until it does. Use it for brand-coloured text and thin lines.
 */
export function ensureContrast(color: string, surface = '#FFFFFF', minRatio = 4.5): string {
  const rgb = hexToRgb(color)
  const base = normalizeHex(color)
  if (!rgb || !base) return readableForeground(surface)
  if (contrastRatio(base, surface) >= minRatio) return base
  const toward = relativeLuminance(surface) > 0.5 ? 0 : 255
  for (let step = 1; step <= 20; step++) {
    const t = step / 20
    const mixed = rgbToHex(
      rgb.r + (toward - rgb.r) * t,
      rgb.g + (toward - rgb.g) * t,
      rgb.b + (toward - rgb.b) * t,
    )
    if (contrastRatio(mixed, surface) >= minRatio) return mixed
  }
  return toward === 0 ? '#000000' : '#FFFFFF'
}

/** Mixes `a` towards `b`: t = 0 → a, t = 1 → b. Invalid input returns `a` unchanged. */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return a
  const k = Math.min(1, Math.max(0, t))
  return rgbToHex(x.r + (y.r - x.r) * k, x.g + (y.g - x.g) * k, x.b + (y.b - x.b) * k)
}

/** "#0F766E" + 0.2 → "rgba(15, 118, 110, 0.2)". Invalid colours give transparent. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return 'rgba(0, 0, 0, 0)'
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}

export interface BrandPalette {
  /** Fill colour (the brand colour, or the default). */
  bg: string
  /** Text/icons on `bg`: black or white. */
  fg: string
  /** Brand colour safe to use as text on a white surface (≥ 4.5:1). */
  onLight: string
  /** Brand colour safe to use as text on a dark (slate-950) surface (≥ 4.5:1). */
  onDark: string
}

/** Everything a surface needs to use a brand colour safely; null/invalid → NeelamGhor teal. */
export function brandPalette(color: string | null | undefined): BrandPalette {
  const bg = normalizeHex(color) ?? DEFAULT_BRAND_COLOR
  return {
    bg,
    fg: readableForeground(bg),
    onLight: ensureContrast(bg, '#FFFFFF'),
    onDark: ensureContrast(bg, '#020617'),
  }
}

export type ContrastLevel = 'good' | 'low' | 'poor'

/**
 * How well the colour works as text/accents on a white page: 'good' ≥ 4.5:1
 * (WCAG AA for text), 'low' ≥ 3:1 (fine for large text and fills), 'poor' below.
 */
export function contrastLevelOnWhite(color: string): ContrastLevel {
  const r = contrastRatio(color, '#FFFFFF')
  return r >= 4.5 ? 'good' : r >= 3 ? 'low' : 'poor'
}

/**
 * A sponsor's website link: http(s) only, at most SPONSOR_LIMITS.urlMax
 * characters. "example.com" gets https:// added. '' / null → null (no link);
 * false = invalid.
 */
export function parseSponsorUrl(input: unknown): string | null | false {
  if (input === null || input === undefined) return null
  if (typeof input !== 'string') return false
  let s = input.trim()
  if (s === '') return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`
  if (s.length > SPONSOR_LIMITS.urlMax) return false
  let url: URL
  try {
    url = new URL(s)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (!url.hostname.includes('.') || url.username || url.password) return false
  const out = url.toString()
  return out.length > SPONSOR_LIMITS.urlMax ? false : out
}

/** The sponsor shown as "Presented by": the first TITLE sponsor, if any. */
export function titleSponsor<T extends { tier: string }>(sponsors: readonly T[]): T | null {
  return sponsors.find((s) => s.tier === 'TITLE') ?? null
}
