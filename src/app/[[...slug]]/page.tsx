import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { parseTheme, THEME_COOKIE } from '@/lib/theme-cookie'
import { LANG_COOKIE, parseLang } from '@/lib/lang-cookie'
import { headerClientKey } from '@/lib/rate-limit'
import { rateLimit } from '@/lib/rate-limit-shared'
import { sportLabel } from '@/lib/types'
import ClientApp from '@/components/client-app'
import { loadPublicResultsSummary } from '@/app/api/og/_lib/public-results'

type PageProps = { params: Promise<{ slug?: string[] }> }

// Pages that hold secrets or private dashboards: never indexed.
// (Results pages are decided per tournament below: public results may be indexed.)
const PRIVATE = new Set(['dashboard', 'account', 'tournaments', 'results', 'my-team', 'admin', 'invite', 'reset-password', 'forgot-password', 'overlay'])

/** Absolute site origin for link-preview image URLs: APP_URL, else this request's host. */
async function siteOrigin(): Promise<string | null> {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return null
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

const formatAmount = (n: number) => `৳${new Intl.NumberFormat('en-IN').format(Math.round(n))}`

/**
 * Every path renders the same app; this gives shared links a real
 * preview (WhatsApp / Facebook unfurl the tournament name instead of a
 * generic page). Lookups are best-effort — a failure falls back to defaults.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [head, arg] = (await params).slug ?? []
  if (!head) return {}
  const noindex: Metadata = PRIVATE.has(head) ? { robots: { index: false, follow: false } } : {}

  // The preview lookups below reveal whether a room / registration code exists,
  // so they share a per-IP budget — otherwise this page would sidestep the
  // wrong-code limit on /api/rooms/:code. Over budget → just no rich preview.
  if ((head === 'room' || head === 'register-player' || head === 'league') && arg) {
    const h = await headers()
    const key = headerClientKey((name) => h.get(name) ?? undefined, 'preview-lookup')
    if ((await rateLimit(key, 60, 10 * 60 * 1000)) !== null) return noindex
  }

  try {
    if (head === 'room' && arg) {
      const auction = await db.auction.findUnique({
        where: { roomCode: arg.toUpperCase() },
        select: { roomCode: true, status: true, tournament: { select: { name: true, sport: true } } },
      })
      if (auction) {
        const sport = auction.tournament.sport === 'OTHER' ? '' : `${sportLabel(auction.tournament.sport).toLowerCase()} `
        const title = `${auction.tournament.name} — live ${sport}player auction`
        const description =
          auction.status === 'ENDED'
            ? `The ${auction.tournament.name} auction has finished. Room ${auction.roomCode} on NeelamGhor.`
            : `Watch or bid live in room ${auction.roomCode} on NeelamGhor.`
        return { title, description, openGraph: { title, description }, robots: { index: false, follow: false } }
      }
    }
    if (head === 'results' && arg) {
      const r = await loadPublicResultsSummary(arg)
      if (r) {
        const title = `${r.name} — auction results`
        const top = r.topBuys[0]
        const description = [
          `${r.teamCount} teams, ${r.soldCount} players sold for ${formatAmount(r.totalValue)}.`,
          top ? `Top buy: ${top.name}${top.teamName ? ` (${top.teamName})` : ''} for ${formatAmount(top.price)}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
        const origin = await siteOrigin()
        const image = origin
          ? [{ url: `${origin}/api/og/results/${encodeURIComponent(r.id)}`, width: 1200, height: 630, alt: title }]
          : undefined
        return {
          title,
          description,
          openGraph: { title, description, type: 'website', ...(image ? { images: image } : {}) },
          twitter: { card: 'summary_large_image', title, description, ...(image ? { images: image.map((i) => i.url) } : {}) },
        }
      }
    }
    if (head === 'league' && arg) {
      const t = await db.tournament.findUnique({
        where: { id: arg },
        select: { name: true, location: true, resultsPublic: true, archivedAt: true },
      })
      // Only a public, live tournament gets a rich, indexable preview.
      if (t && t.resultsPublic && !t.archivedAt) {
        const title = `${t.name} — fixtures, points table & stats`
        const description = `Fixtures, results, the points table and player stats for ${t.name}${t.location ? ` in ${t.location}` : ''} — live on NeelamGhor.`
        return {
          title,
          description,
          openGraph: { title, description, type: 'website' },
          twitter: { card: 'summary', title, description },
        }
      }
      return { robots: { index: false, follow: false } }
    }
    if (head === 'register-player' && arg) {
      const t = await db.tournament.findUnique({
        where: { registrationCode: arg },
        select: { name: true, sport: true, location: true },
      })
      if (t) {
        const title = `Register for ${t.name}`
        const description = `Sign up as a ${t.sport === 'OTHER' ? '' : `${sportLabel(t.sport).toLowerCase()} `}player for the ${t.name} auction${t.location ? ` in ${t.location}` : ''}.`
        return { title, description, openGraph: { title, description }, robots: { index: false, follow: false } }
      }
    }
  } catch (err) {
    console.error('[metadata] lookup failed:', (err as Error).message)
  }

  if (head === 'invite') {
    const title = "You're invited to manage a team on NeelamGhor"
    return { title, openGraph: { title }, ...noindex }
  }
  return noindex
}

/**
 * Server-renders the real page for the path (the client router starts from
 * `slug`), in the visitor's language from the `ng_lang` cookie.
 */
export default async function Page({ params }: PageProps) {
  const slug = (await params).slug ?? []
  const jar = await cookies()
  const lang = parseLang(jar.get(LANG_COOKIE)?.value)
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value)
  // Who is signed in, so the first render already shows the right header and
  // page (instead of a signed-out header that flips after /api/auth/me).
  // Undefined on any failure: the browser then checks the session itself.
  const initialUser = await getSessionUser().catch(() => undefined)
  return (
    <ClientApp
      initialSegs={slug}
      lang={lang}
      lowData={await initialLowData(jar.get(LOW_DATA_COOKIE)?.value)}
      initialUser={initialUser}
      theme={theme}
    />
  )
}

/** Mirror of the client's `ng_low_data` choice (src/lib/low-data.ts). */
const LOW_DATA_COOKIE = 'ng_low_data'

/**
 * Data saver for the server render: the visitor's saved choice, else the
 * browser's `Save-Data: on` header — so a data-saver visitor's HTML already
 * leaves out the hero image instead of starting its download.
 */
async function initialLowData(cookie: string | undefined): Promise<boolean> {
  if (cookie === 'on' || cookie === 'off') return cookie === 'on'
  return (await headers()).get('save-data')?.trim().toLowerCase() === 'on'
}
