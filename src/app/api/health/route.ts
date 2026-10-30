import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/health — liveness + database reachability for uptime monitors and
// deploy checks. Deliberately reveals nothing beyond up/down.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[health] database check failed:', err)
    return Response.json({ status: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
