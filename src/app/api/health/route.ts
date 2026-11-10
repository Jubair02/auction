import { db } from '@/lib/db'
import { secretFingerprint } from '@/lib/crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/health — liveness + database reachability for uptime monitors and
// deploy checks. Reveals nothing beyond up/down, plus the AUCTION_SECRET
// fingerprint (a truncated hash — useless to an attacker) so it can be compared
// with the auction service's startup log when room joins fail.
export async function GET() {
  let secret: string
  try {
    secret = secretFingerprint()
  } catch {
    secret = 'missing'
  }
  // Without the secret no session or seat pass can be checked: the site is down for everyone.
  if (secret === 'missing') {
    return Response.json({ status: 'error', secret }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', secret }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[health] database check failed:', err)
    return Response.json({ status: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
