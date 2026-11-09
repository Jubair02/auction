import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { getPublicBranding } from '@/lib/branding'
import { resultsArePublic } from '../../_lib/public-results'
import { cardBranding } from '../../_lib/card-branding'
import { amount, CARD_HEADERS, CARD_SIZE, CardFrame, cardTheme, clip } from '../../_lib/card'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ playerId: string }> }

// GET /api/og/sold/:playerId — 1200×630 "SOLD" card for a player bought in a
// tournament whose results are public and final.
export async function GET(_req: Request, { params }: RouteParams) {
  const { playerId } = await params
  const player = await db.player
    .findUnique({
      where: { id: playerId },
      select: {
        name: true,
        role: true,
        status: true,
        soldPrice: true,
        playerNumber: true,
        soldToTeam: { select: { name: true, color: true } },
        tournament: {
          select: {
            id: true,
            name: true,
            resultsPublic: true,
            status: true,
            archivedAt: true,
            plan: true,
            logoUrl: true,
            brandColor: true,
            brandHidePlatform: true,
            auction: { select: { status: true } },
          },
        },
      },
    })
    .catch(() => null)

  if (
    !player ||
    player.status !== 'SOLD' ||
    player.soldPrice === null ||
    !player.soldToTeam ||
    !resultsArePublic(player.tournament, player.tournament.auction)
  ) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // PRO branding: brand colour, title sponsor, white-label. Never blocks the card.
  const brand = await getPublicBranding(player.tournament)
    .then(cardBranding)
    .catch(() => null)
  const theme = cardTheme(brand)

  const teamColor = /^#[0-9a-f]{6}$/i.test(player.soldToTeam.color ?? '') ? player.soldToTeam.color! : '#14b8a6'

  return new ImageResponse(
    (
      <CardFrame eyebrow={clip(player.tournament.name.toUpperCase(), 36)} brand={brand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 48, flexGrow: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 300,
              height: 300,
              borderRadius: 999,
              border: '10px solid #fcd34d',
              color: '#fcd34d',
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: 6,
              transform: 'rotate(-10deg)',
            }}
          >
            SOLD
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 }}>
            <span style={{ fontSize: 26, color: theme.tint }}>
              {clip(`#${String(player.playerNumber).padStart(3, '0')} · ${player.role}`, 40)}
            </span>
            <span style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, marginTop: 4 }}>
              {clip(player.name, 24)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, fontSize: 30 }}>
              <span style={{ display: 'flex', width: 22, height: 22, borderRadius: 999, backgroundColor: teamColor }} />
              <span>to {clip(player.soldToTeam.name, 32)}</span>
            </div>
            <span style={{ fontSize: 72, fontWeight: 700, color: '#fcd34d', marginTop: 22 }}>{amount(player.soldPrice)}</span>
          </div>
        </div>
      </CardFrame>
    ),
    { ...CARD_SIZE, headers: CARD_HEADERS },
  )
}
