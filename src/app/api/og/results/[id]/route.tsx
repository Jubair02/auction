import { ImageResponse } from 'next/og'
import { sportLabel } from '@/lib/types'
import { getPublicBrandingById } from '@/lib/branding'
import { loadPublicResultsSummary } from '../../_lib/public-results'
import { cardBranding } from '../../_lib/card-branding'
import { amount, CARD_HEADERS, CARD_SIZE, CardFrame, cardTheme, clip } from '../../_lib/card'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const MEDALS = ['#fbbf24', '#e2e8f0', '#f59e0b']

// GET /api/og/results/:id — 1200×630 share card for public, finished results
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const summary = await loadPublicResultsSummary(id).catch(() => null)
  if (!summary) return Response.json({ error: 'Not found' }, { status: 404 })
  // PRO branding: brand colour, title sponsor, white-label. Never blocks the card.
  const brand = await getPublicBrandingById(id)
    .then(cardBranding)
    .catch(() => null)
  const theme = cardTheme(brand)

  const sport = sportLabel(summary.sport, 'en', summary.sportName?.trim() || null)
  const facts = [`${summary.teamCount} teams`, `${summary.soldCount} players sold`, `${amount(summary.totalValue)} total`]

  return new ImageResponse(
    (
      <CardFrame eyebrow="AUCTION RESULTS" brand={brand}>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
          <div style={{ display: 'flex', fontSize: 26, color: theme.tint }}>
            {clip(`${sport} auction${summary.location ? ` · ${summary.location}` : ''}`, 70)}
          </div>
          <div style={{ display: 'flex', fontSize: 54, fontWeight: 700, lineHeight: 1.1, marginTop: 6, letterSpacing: -1 }}>
            {clip(summary.name, 40)}
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 24, color: theme.soft, marginTop: 14 }}>
            {facts.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {summary.topBuys.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 28, color: theme.soft }}>No players were sold.</div>
          ) : (
            summary.topBuys.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '8px 22px',
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: MEDALS[i],
                    color: '#052e2b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <span style={{ fontSize: 28, fontWeight: 700 }}>{clip(p.name, 34)}</span>
                  {p.teamName ? <span style={{ fontSize: 18, color: theme.tint }}>{clip(p.teamName, 48)}</span> : null}
                </div>
                <span style={{ fontSize: 34, fontWeight: 700, color: '#fcd34d' }}>{amount(p.price)}</span>
              </div>
            ))
          )}
        </div>
      </CardFrame>
    ),
    { ...CARD_SIZE, headers: CARD_HEADERS },
  )
}
