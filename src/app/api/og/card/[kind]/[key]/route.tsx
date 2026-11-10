import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { getPublicBranding } from '@/lib/branding'
import { sportLabel } from '@/lib/types'
import { cardBranding, uploadAsPngDataUri } from '../../../_lib/card-branding'
import { amount, CARD_SIZE, CardFrame, cardTheme, clip } from '../../../_lib/card'
import { OG_CARD_KINDS, ogSignatureValid, type OgCardKind } from '../../../_lib/sign'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ kind: string; key: string }> }

// Live details (room status, team counts) change, so cache for minutes, not hours.
const HEADERS = { 'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600' }

const notFound = () => Response.json({ error: 'Not found' }, { status: 404 })

const TOURNAMENT_SELECT = {
  id: true,
  name: true,
  sport: true,
  sportName: true,
  location: true,
  logoUrl: true,
  plan: true,
  brandColor: true,
  brandHidePlatform: true,
  archivedAt: true,
} as const

interface CardData {
  tournament: {
    id: string
    name: string
    sport: string
    sportName: string | null
    location: string | null
    logoUrl: string | null
    plan: string
    brandColor: string | null
    brandHidePlatform: boolean
  }
  eyebrow: string
  /** Big call to action under the name, e.g. "Room BD26-K7QX". */
  headline: string
  /** Facts in a row: team counts, fee, date. */
  facts: string[]
  footnote: string
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' })

async function loadCard(kind: OgCardKind, key: string): Promise<CardData | null> {
  if (kind === 'room') {
    const auction = await db.auction.findUnique({
      where: { roomCode: key.toUpperCase() },
      select: { roomCode: true, status: true, tournament: { select: { ...TOURNAMENT_SELECT, _count: { select: { teams: true } } } } },
    })
    if (!auction || auction.tournament.archivedAt) return null
    const ended = auction.status === 'ENDED'
    return {
      tournament: auction.tournament,
      eyebrow: ended ? 'AUCTION FINISHED' : auction.status === 'LIVE' ? 'LIVE AUCTION' : 'PLAYER AUCTION',
      headline: `Room ${auction.roomCode}`,
      facts: [`${auction.tournament._count.teams} teams`],
      footnote: ended ? 'See every sale and the final squads' : 'Watch every bid live — no app or sign-up needed',
    }
  }
  if (kind === 'register') {
    const t = await db.tournament.findUnique({
      where: { registrationCode: key },
      select: { ...TOURNAMENT_SELECT, registrationOpen: true, registrationFee: true, auctionAt: true },
    })
    if (!t || t.archivedAt) return null
    return {
      tournament: t,
      eyebrow: 'PLAYER REGISTRATION',
      headline: t.registrationOpen ? 'Registration is open' : 'Registration is closed',
      facts: [
        t.registrationFee ? `Fee ${amount(t.registrationFee)}` : 'Free to register',
        ...(t.auctionAt ? [`Auction ${dateFmt.format(t.auctionAt)}`] : []),
      ],
      footnote: 'Sign up as a player for the auction',
    }
  }
  // league: only a public, live tournament (the page itself says the same).
  const t = await db.tournament.findUnique({
    where: { id: key },
    select: { ...TOURNAMENT_SELECT, resultsPublic: true, _count: { select: { teams: true } } },
  })
  if (!t || t.archivedAt || !t.resultsPublic) return null
  const played = await db.match.count({ where: { tournamentId: t.id, status: 'COMPLETED' } })
  return {
    tournament: t,
    eyebrow: 'FIXTURES & TABLE',
    headline: 'Points table, results & stats',
    facts: [`${t._count.teams} teams`, `${played} ${played === 1 ? 'match' : 'matches'} played`],
    footnote: 'Follow every match of the league',
  }
}

// GET /api/og/card/:kind/:key?s=<signature> — 1200×630 link-preview image for a
// room (key = room code), player registration (key = registration code) or
// league (key = tournament id) link. Only URLs signed by the page metadata work.
export async function GET(req: Request, { params }: RouteParams) {
  const { kind, key } = await params
  if (!OG_CARD_KINDS.includes(kind as OgCardKind)) return notFound()
  const sig = new URL(req.url).searchParams.get('s')
  if (!ogSignatureValid(kind as OgCardKind, key, sig)) return notFound()

  const card = await loadCard(kind as OgCardKind, key).catch(() => null)
  if (!card) return notFound()

  // PRO branding (colour, sponsor, white-label) and the tournament's own logo. Never blocks the card.
  const [brand, logo] = await Promise.all([
    getPublicBranding(card.tournament)
      .then(cardBranding)
      .catch(() => null),
    uploadAsPngDataUri(card.tournament.logoUrl, 220).catch(() => null),
  ])
  const theme = cardTheme(brand)
  const t = card.tournament
  const sport = sportLabel(t.sport, 'en', t.sportName?.trim() || null)

  return new ImageResponse(
    (
      <CardFrame eyebrow={card.eyebrow} brand={brand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 44, flexGrow: 1 }}>
          {logo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 240,
                height: 240,
                borderRadius: 32,
                backgroundColor: '#ffffff',
                flexShrink: 0,
              }}
            >
              <img src={logo} width={208} height={208} alt="" style={{ objectFit: 'contain' }} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
            <span style={{ fontSize: 26, color: theme.tint }}>
              {clip(`${sport}${t.location ? ` · ${t.location}` : ''}`, logo ? 44 : 64)}
            </span>
            <span style={{ fontSize: logo ? 56 : 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, marginTop: 6 }}>
              {clip(t.name, logo ? 30 : 38)}
            </span>
            <span style={{ fontSize: 40, fontWeight: 700, color: '#fcd34d', marginTop: 20 }}>{card.headline}</span>
            <div style={{ display: 'flex', gap: 28, fontSize: 26, color: theme.soft, marginTop: 14 }}>
              {card.facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <span style={{ fontSize: 24, color: theme.tint, marginTop: 18 }}>{card.footnote}</span>
          </div>
        </div>
      </CardFrame>
    ),
    { ...CARD_SIZE, headers: HEADERS },
  )
}
