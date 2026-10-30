import { db } from '@/lib/db'

export const runtime = 'nodejs'

// Only these keys are safe to expose without authentication.
const PUBLIC_KEYS = ['siteName', 'announcement', 'supportPhone'] as const

// GET /api/settings — public subset of the admin settings (drives the site-wide banner)
export async function GET() {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: [...PUBLIC_KEYS] } } })
    const settings: Record<string, string> = {}
    for (const row of rows) settings[row.key] = row.value
    // Fetched on every page load; let Vercel's CDN answer it for a minute
    // instead of querying the database each time.
    return Response.json({ settings }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch {
    // Never let a settings hiccup break the shell — the banner is optional chrome.
    return Response.json({ settings: {} })
  }
}
