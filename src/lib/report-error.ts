// Error reporting shared by the website (instrumentation.ts) and the auction
// service. Every report is one JSON line on stderr (searchable in Vercel /
// Render logs). When ALERT_WEBHOOK_URL is set, it is also posted there — a
// Slack, Discord or Telegram-bridge incoming webhook — so someone hears about
// a failure during a live auction instead of finding it in the logs later.
//
// Throttled: the same error is posted at most once per ALERT_REPEAT_MS, and at
// most ALERT_MAX_PER_HOUR alerts go out in total. No Next.js imports.

const ALERT_REPEAT_MS = 10 * 60_000
const ALERT_MAX_PER_HOUR = 30
const WEBHOOK_TIMEOUT_MS = 4_000

const lastSent = new Map<string, number>()
let hourStart = 0
let sentThisHour = 0

export interface ErrorContext {
  /** Where it happened, e.g. "web", "auction-service". */
  source: string
  /** What was being done, e.g. "POST /api/tournaments", "sale", "unhandledRejection". */
  where?: string
  [key: string]: unknown
}

function describe(err: unknown): { name: string; message: string; stack?: string; digest?: string } {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: unknown }).digest
    return { name: err.name, message: err.message, stack: err.stack, ...(typeof digest === 'string' ? { digest } : {}) }
  }
  return { name: 'NonError', message: typeof err === 'string' ? err : JSON.stringify(err) ?? String(err) }
}

function shouldAlert(key: string, now: number): boolean {
  if (now - hourStart > 60 * 60_000) {
    hourStart = now
    sentThisHour = 0
  }
  if (sentThisHour >= ALERT_MAX_PER_HOUR) return false
  const prev = lastSent.get(key)
  if (prev && now - prev < ALERT_REPEAT_MS) return false
  if (lastSent.size > 500) lastSent.clear()
  lastSent.set(key, now)
  sentThisHour++
  return true
}

/** Logs the error and, when configured, alerts the webhook. Never throws. */
export async function reportError(err: unknown, context: ErrorContext): Promise<void> {
  const e = describe(err)
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development'
  try {
    console.error(
      JSON.stringify({ level: 'error', at: new Date().toISOString(), env, ...context, error: e }),
    )
  } catch {
    console.error('[report-error]', context.source, context.where, e.message)
  }

  const url = process.env.ALERT_WEBHOOK_URL?.trim()
  if (!url) return
  const key = `${context.source}|${context.where ?? ''}|${e.name}|${e.message.slice(0, 120)}`
  if (!shouldAlert(key, Date.now())) return

  const firstFrame = e.stack?.split('\n').find((l) => l.trim().startsWith('at '))?.trim()
  const text =
    `🚨 NeelamGhor ${env} — ${context.source}${context.where ? ` (${context.where})` : ''}\n` +
    `${e.name}: ${e.message.slice(0, 500)}` +
    (firstFrame ? `\n${firstFrame.slice(0, 300)}` : '') +
    (e.digest ? `\ndigest ${e.digest}` : '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    // `text` for Slack-style hooks, `content` for Discord.
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
      signal: controller.signal,
    })
  } catch {
    // Alerting must never break the caller.
  } finally {
    clearTimeout(timer)
  }
}
