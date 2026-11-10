import { clientKey, rateLimit } from '@/lib/rate-limit'
import { reportError } from '@/lib/report-error'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 8 * 1024
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined)

/**
 * POST /api/client-errors {message, stack?, where?, path?}
 * Browser crashes caught by an error boundary (lib/client-error-report.ts).
 * Best effort and anonymous: rate-limited per address, always answers 204.
 */
export async function POST(req: Request) {
  // Per instance, in memory: cheap, and enough to stop one page from flooding alerts.
  if (rateLimit(clientKey(req, 'client-errors'), 10, 60_000) !== null) return new Response(null, { status: 204 })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) return new Response(null, { status: 204 })
  let body: Record<string, unknown> | null = null
  try {
    const text = await req.text()
    if (text.length <= MAX_BODY_BYTES) body = JSON.parse(text) as Record<string, unknown>
  } catch {
    body = null
  }
  const message = clip(body?.message, 500)
  if (!message) return new Response(null, { status: 204 })
  const error = new Error(message)
  error.name = clip(body?.name, 80) ?? 'BrowserError'
  error.stack = clip(body?.stack, 2_000) ?? error.stack
  await reportError(error, {
    source: 'browser',
    where: clip(body?.where, 80) ?? 'ui',
    // Path only — never the query string or fragment (invite / reset tokens).
    path: clip(body?.path, 200)?.split(/[?#]/)[0],
    userAgent: clip(req.headers.get('user-agent'), 200),
  })
  return new Response(null, { status: 204 })
}
