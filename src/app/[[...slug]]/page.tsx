import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { headerClientKey } from '@/lib/rate-limit'
import { rateLimit } from '@/lib/rate-limit-shared'
import { sportLabel } from '@/lib/types'
import ClientApp from '@/components/client-app'

type PageProps = { params: Promise<{ slug?: string[] }> }

// Pages that hold secrets or private dashboards: never indexed.
const PRIVATE = new Set(['dashboard', 'tournaments', 'results', 'my-team', 'admin', 'invite', 'reset-password', 'forgot-password', 'overlay'])

/**
 * Every path renders the same client app; this only gives shared links a real
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
  if ((head === 'room' || head === 'register-player') && arg) {
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

export default function Page() {
  return <ClientApp />
}
