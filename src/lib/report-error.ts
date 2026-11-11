// Error reporting shared by the website (instrumentation.ts) and the auction
// service. Every report is one JSON line on stderr (searchable in Vercel /
// Render logs). When ALERT_WEBHOOK_URL is set, it is also posted there — a
// Slack, Discord or Telegram-bridge incoming webhook — so someone hears about
// a failure during a live auction instead of finding it in the logs later.
//
// Throttled: the same error is posted at most once per ALERT_REPEAT_MS, and at
// most ALERT_MAX_PER_HOUR alerts go out in total. Reports from browsers (which
// anyone can send) have their own smaller budget, so they can never use up the
// alerts real server failures need, and their text is posted inertly: inside a
// code block, with no mentions — never "@everyone" or a clickable link in the
// ops channel. No Next.js imports.

const ALERT_REPEAT_MS = 10 * 60_000
const ALERT_MAX_PER_HOUR = 30
const BROWSER_ALERT_MAX_PER_HOUR = 10
const WEBHOOK_TIMEOUT_MS = 4_000

const lastSent = new Map<string, number>()
let hourStart = 0
const sentThisHour = { server: 0, browser: 0 }

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

function shouldAlert(key: string, now: number, bucket: 'server' | 'browser'): boolean {
  if (now - hourStart > 60 * 60_000) {
    hourStart = now
    sentThisHour.server = 0
    sentThisHour.browser = 0
  }
  if (sentThisHour[bucket] >= (bucket === 'browser' ? BROWSER_ALERT_MAX_PER_HOUR : ALERT_MAX_PER_HOUR)) return false
  const prev = lastSent.get(key)
  if (prev && now - prev < ALERT_REPEAT_MS) return false
  if (lastSent.size > 500) lastSent.clear()
  lastSent.set(key, now)
  sentThisHour[bucket]++
  return true
}

/**
 * Error text for the chat: inside a code block (no formatting, mentions or
 * auto-links in Slack or Discord), with anything that could close the block
 * or form a mention neutralised. Exported for the unit tests.
 */
export function inertBlock(text: string): string {
  const safe = text
    .replace(/`/g, "'")
    .replace(/@/g, '@\u200b')
    .replace(/<(?=[!@#])/g, '<\u200b')
  return '```\n' + safe + '\n```'
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
  if (!shouldAlert(key, Date.now(), context.source === 'browser' ? 'browser' : 'server')) return

  const firstFrame = e.stack?.split('\n').find((l) => l.trim().startsWith('at '))?.trim()
  // Everything after the header line can come from a stranger (browser reports): inert.
  const where = context.where ? ` (${String(context.where).slice(0, 120)})` : ''
  const text =
    `🚨 NeelamGhor ${env} — ${context.source}\n` +
    inertBlock(
      `${where.trim()}\n${e.name}: ${e.message.slice(0, 500)}` +
        (firstFrame ? `\n${firstFrame.slice(0, 300)}` : '') +
        (e.digest ? `\ndigest ${e.digest}` : ''),
    )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    // `text` for Slack-style hooks, `content` for Discord.
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: Discord pings nobody, whatever the text says.
      body: JSON.stringify({ text, content: text, allowed_mentions: { parse: [] } }),
      signal: controller.signal,
    })
  } catch {
    // Alerting must never break the caller.
  } finally {
    clearTimeout(timer)
  }
}
