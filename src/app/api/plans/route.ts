import { getPlanSettings, PLAN_DEFAULTS } from '@/lib/plans'

export const runtime = 'nodejs'

// GET /api/plans — public: Pro price, Free limits and where to send the Pro payment.
export async function GET() {
  try {
    const plans = await getPlanSettings()
    // Changes rarely; let the CDN answer it for a minute like /api/settings.
    return Response.json(plans, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch {
    // Never break the pricing card over a settings hiccup: fall back to the defaults.
    return Response.json({ ...PLAN_DEFAULTS, bkashNumber: null, nagadNumber: null, instructions: null })
  }
}
