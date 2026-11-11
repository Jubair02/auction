// ============================================================
// NeelamGhor — SMS outbox worker + hourly data maintenance.
// Runs inside the always-on auction service (index.ts starts it).
//
// Routes and the engine only INSERT rows into "Notification"; this worker
// delivers them. Claiming is atomic (UPDATE … WHERE id IN (SELECT … FOR UPDATE
// SKIP LOCKED)) and every claim pushes sendAfter forward as a lease, so two
// instances never send the same row, and a crash mid-send just lets the row
// come due again later (at-least-once delivery).
//
// Drivers (SMS_DRIVER):
//   log  (default) — prints a redacted line (last 3 digits only) and succeeds.
//   http           — any HTTP gateway (BulkSMSBD, SSL Wireless, …) configured by
//                    SMS_HTTP_URL / SMS_HTTP_METHOD / SMS_HTTP_BODY / SMS_HTTP_HEADERS.
// SMS_ENABLED=0 marks due rows SKIPPED instead of sending them.
//
// Daily quotas (rolling 24 h of SENT messages; over-quota rows are SKIPPED):
//   SMS_DAILY_LIMIT_PER_NUMBER     (default 5)    — nobody can be text-bombed
//                                                   through public registrations
//   SMS_DAILY_LIMIT_PER_TOURNAMENT (default 500)  — one tournament can't run up the bill
//   SMS_DAILY_LIMIT_TOTAL          (default 5000) — platform-wide spend ceiling
//
// Only type imports and .ts-suffixed pure modules here, so `node --test` can
// load this file for outbox.test.ts.
// ============================================================
import type { ResilientClient } from '../../src/lib/db-resilience'
import { smsSafeName } from '../../src/lib/sms-text.ts'
import { toSmsNumber } from '../../src/lib/phone.ts'

export const MAX_ATTEMPTS = 5
export const BATCH_SIZE = 20
/** A claimed row is invisible to other claimers for this long (crash safety). */
const LEASE_SECONDS = 300
const SEND_INTERVAL_MS = 10_000
const MAINTENANCE_INTERVAL_MS = 60 * 60_000
const FIRST_MAINTENANCE_DELAY_MS = 60_000
const HTTP_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/** "8801712345678" → "•••••••••••678": only the last 3 digits are ever logged or shown. */
export function maskNumber(to: string): string {
  const digits = to.replace(/\D/g, '')
  if (digits.length <= 3) return '•••'
  return '•'.repeat(digits.length - 3) + digits.slice(-3)
}

/** Delay before retry number `attempts + 1`: 1 min, 5 min, 15 min, 1 h. */
export function backoffMs(attempts: number): number {
  const steps = [60, 300, 900, 3600]
  return steps[Math.min(Math.max(attempts, 1), steps.length) - 1] * 1000
}

export type TemplateEncoding = 'json' | 'form' | 'raw'

/** Escapes a value for the place it is substituted into. */
function encodeValue(value: string, encoding: TemplateEncoding): string {
  if (encoding === 'json') return JSON.stringify(value).slice(1, -1)
  if (encoding === 'form') return encodeURIComponent(value)
  return value
}

/** Replaces {to}, {to_local} and {body} (any other {x} is left as is). */
export function renderTemplate(template: string, vars: Record<string, string>, encoding: TemplateEncoding): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? encodeValue(vars[key], encoding) : whole,
  )
}

export interface HttpDriverConfig {
  url: string
  method: 'GET' | 'POST'
  bodyTemplate: string | null
  headers: Record<string, string>
  /** Optional regex the response text must match (many BD gateways answer 200 with an error code). */
  success: RegExp | null
}

/** Reads the http driver's settings from the environment. Returns an error message when unusable. */
export function httpConfigFromEnv(env: Record<string, string | undefined>): HttpDriverConfig | string {
  const url = env.SMS_HTTP_URL?.trim()
  if (!url) return 'SMS_HTTP_URL is not set'
  if (!/^https?:\/\//i.test(url)) return 'SMS_HTTP_URL must start with http:// or https://'
  const method = (env.SMS_HTTP_METHOD?.trim().toUpperCase() || (env.SMS_HTTP_BODY ? 'POST' : 'GET')) as string
  if (method !== 'GET' && method !== 'POST') return 'SMS_HTTP_METHOD must be GET or POST'
  let headers: Record<string, string> = {}
  if (env.SMS_HTTP_HEADERS?.trim()) {
    try {
      const parsed: unknown = JSON.parse(env.SMS_HTTP_HEADERS)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'SMS_HTTP_HEADERS must be a JSON object'
      headers = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
    } catch {
      return 'SMS_HTTP_HEADERS is not valid JSON'
    }
  }
  let success: RegExp | null = null
  if (env.SMS_HTTP_SUCCESS?.trim()) {
    try {
      success = new RegExp(env.SMS_HTTP_SUCCESS)
    } catch {
      return 'SMS_HTTP_SUCCESS is not a valid regular expression'
    }
  }
  const bodyTemplate = method === 'POST' ? (env.SMS_HTTP_BODY ?? null) : null
  return { url, method, bodyTemplate, headers, success }
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name)
  return key ? headers[key] : undefined
}

/** The exact request the http driver makes for one message. */
export function buildHttpRequest(
  config: HttpDriverConfig,
  to: string,
  body: string,
): { url: string; method: 'GET' | 'POST'; headers: Record<string, string>; body?: string } {
  const vars = { to, to_local: to.startsWith('880') ? to.slice(2) : to, body }
  const url = renderTemplate(config.url, vars, 'form')
  if (config.method === 'GET' || config.bodyTemplate === null) {
    return { url, method: config.method, headers: { ...config.headers } }
  }
  const headers = { ...config.headers }
  let contentType = headerValue(headers, 'content-type')
  if (!contentType) {
    contentType = config.bodyTemplate.trim().startsWith('{') ? 'application/json' : 'application/x-www-form-urlencoded'
    headers['Content-Type'] = contentType
  }
  const encoding: TemplateEncoding = /json/i.test(contentType) ? 'json' : /urlencoded/i.test(contentType) ? 'form' : 'raw'
  return { url, method: 'POST', headers, body: renderTemplate(config.bodyTemplate, vars, encoding) }
}

const EN_IN = new Intl.NumberFormat('en-IN')

/**
 * "You were sold" text, in the tournament's SMS language. Never includes the
 * player's name: for self-registered players that is text anyone could type
 * on the public form, and it must not be able to put words in our SMS.
 */
export function soldSmsBody(lang: string, v: { tournament: string; team: string; price: number }): string {
  const price = `৳${EN_IN.format(v.price)}`
  // Tournament and team names are organizer-written: cleaned of numbers and links (sms-text.ts).
  const en = lang === 'en'
  const tournament = smsSafeName(v.tournament, en ? 'the' : '')
  const team = smsSafeName(v.team, en ? 'A team' : 'একটি')
  return en
    ? `Congratulations! ${team} bought you for ${price} in the ${tournament} auction. — NeelamGhor`
    : `অভিনন্দন! ${tournament ? `${tournament} ` : ''}নিলামে ${team} দল আপনাকে ${price}-এ কিনেছে। — NeelamGhor`
}

export interface SmsLimits {
  perNumber: number
  perTournament: number
  total: number
}

export const SMS_LIMIT_DEFAULTS: SmsLimits = { perNumber: 5, perTournament: 500, total: 5000 }

/** Reads the daily SMS quotas from the environment (invalid values keep the default). */
export function smsLimitsFromEnv(env: Record<string, string | undefined>): SmsLimits {
  const read = (name: string, fallback: number) => {
    const n = Number(env[name])
    return Number.isInteger(n) && n > 0 ? n : fallback
  }
  return {
    perNumber: read('SMS_DAILY_LIMIT_PER_NUMBER', SMS_LIMIT_DEFAULTS.perNumber),
    perTournament: read('SMS_DAILY_LIMIT_PER_TOURNAMENT', SMS_LIMIT_DEFAULTS.perTournament),
    total: read('SMS_DAILY_LIMIT_TOTAL', SMS_LIMIT_DEFAULTS.total),
  }
}

/** Messages sent in the last 24 h, by number, by tournament and in total. */
export interface SmsUsage {
  byNumber: Map<string, number>
  byTournament: Map<string, number>
  total: number
}

/** Why this message must not be sent now (a quota is used up), or null. */
export function smsQuotaBlock(row: { to: string; tournamentId: string | null }, usage: SmsUsage, limits: SmsLimits): string | null {
  if (usage.total >= limits.total) return `Platform daily SMS limit reached (${limits.total})`
  if (row.tournamentId && (usage.byTournament.get(row.tournamentId) ?? 0) >= limits.perTournament) {
    return `Tournament daily SMS limit reached (${limits.perTournament})`
  }
  if ((usage.byNumber.get(row.to) ?? 0) >= limits.perNumber) return `Daily SMS limit for this number reached (${limits.perNumber})`
  return null
}

/** Counts a sent message against the in-memory usage for the rest of the batch. */
export function recordSmsSent(row: { to: string; tournamentId: string | null }, usage: SmsUsage): void {
  usage.total++
  usage.byNumber.set(row.to, (usage.byNumber.get(row.to) ?? 0) + 1)
  if (row.tournamentId) usage.byTournament.set(row.tournamentId, (usage.byTournament.get(row.tournamentId) ?? 0) + 1)
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export interface SmsDriver {
  name: string
  send(to: string, body: string): Promise<void>
}

export function logDriver(): SmsDriver {
  const showBody = process.env.NODE_ENV !== 'production' || process.env.SMS_LOG_BODY === '1'
  return {
    name: 'log',
    async send(to, body) {
      console.log(`[sms:log] to ${maskNumber(to)} (${body.length} chars)${showBody ? `: ${body}` : ''}`)
    },
  }
}

export function httpDriver(config: HttpDriverConfig): SmsDriver {
  return {
    name: 'http',
    async send(to, body) {
      const req = buildHttpRequest(config, to, body)
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
      const text = await res.text().catch(() => '')
      // Never echo the URL (it usually carries the API key); a short reply snippet is enough.
      if (!res.ok) throw new Error(`gateway HTTP ${res.status}: ${text.slice(0, 160)}`)
      if (config.success && !config.success.test(text)) throw new Error(`gateway rejected: ${text.slice(0, 160)}`)
    },
  }
}

/** Picks the driver from SMS_DRIVER. A broken http config falls back to log (and says so). */
export function driverFromEnv(env: Record<string, string | undefined> = process.env): SmsDriver {
  const name = (env.SMS_DRIVER ?? 'log').trim().toLowerCase()
  if (name === 'http') {
    const config = httpConfigFromEnv(env)
    if (typeof config !== 'string') return httpDriver(config)
    console.error(`[outbox] SMS_DRIVER=http but ${config} — using the log driver instead`)
  } else if (name !== 'log') {
    console.error(`[outbox] unknown SMS_DRIVER "${name}" — using the log driver`)
  }
  return logDriver()
}

// ---------------------------------------------------------------------------
// Writers used by the engine (rows only; the worker delivers them)
// ---------------------------------------------------------------------------

/** Queues the "you were sold" SMS for a player. Never throws; a failure never touches the sale. */
export async function queuePlayerSoldSms(
  db: ResilientClient,
  sale: {
    tournamentId: string
    player: { id: string; name: string; phone: string | null; auctionCycle: number }
    teamName: string
    price: number
  },
): Promise<void> {
  try {
    const to = sale.player.phone ? toSmsNumber(sale.player.phone) : null
    if (!to) return
    // Fresh read: the organizer may have switched SMS on or off during the auction.
    const t = await db.tournament.findUnique({
      where: { id: sale.tournamentId },
      select: { name: true, plan: true, smsEnabled: true, smsLang: true },
    })
    if (!t || t.plan !== 'PRO' || !t.smsEnabled) return
    // Self-registered players decide for themselves; players the organizer
    // added directly are covered by the organizer's opt-in.
    const reg = await db.playerRegistration.findFirst({ where: { playerId: sale.player.id }, select: { smsConsent: true } })
    if (reg && !reg.smsConsent) return
    await db.notification.createMany({
      data: [
        {
          channel: 'SMS',
          to,
          body: soldSmsBody(t.smsLang, { tournament: t.name, team: sale.teamName, price: sale.price }).slice(0, 480),
          kind: 'PLAYER_SOLD',
          tournamentId: sale.tournamentId,
          dedupeKey: `sold:${sale.player.id}:${sale.player.auctionCycle}`,
        },
      ],
      skipDuplicates: true,
    })
  } catch (err) {
    console.error('[outbox] could not queue the sold SMS:', (err as Error).message)
  }
}

/** First-party analytics row from the service. Never throws. */
export async function trackServiceEvent(
  db: ResilientClient,
  name: 'auction_started' | 'auction_completed',
  opts: { userId?: string | null; tournamentId?: string | null; props?: Record<string, string | number | boolean | null> },
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: { name, userId: opts.userId ?? null, tournamentId: opts.tournamentId ?? null, props: opts.props ?? undefined },
    })
  } catch (err) {
    console.error('[analytics] track failed:', name, (err as Error).message)
  }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

interface ClaimedRow {
  id: string
  to: string
  body: string
  kind: string
  attempts: number
  tournamentId: string | null
}

export interface OutboxWorkerOptions {
  intervalMs?: number
  maintenanceIntervalMs?: number
  driver?: SmsDriver
  env?: Record<string, string | undefined>
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500)

/** Atomically claims up to BATCH_SIZE due rows (safe with several instances). */
async function claimDue(db: ResilientClient): Promise<ClaimedRow[]> {
  return db.$queryRaw<ClaimedRow[]>`
    UPDATE "Notification"
    SET "attempts" = "attempts" + 1,
        "sendAfter" = now() + make_interval(secs => ${LEASE_SECONDS}::double precision)
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" = 'PENDING' AND "sendAfter" <= now()
      ORDER BY "sendAfter" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "to", "body", "kind", "attempts", "tournamentId"`
}

async function deliverBatch(db: ResilientClient, driver: SmsDriver, env: Record<string, string | undefined>): Promise<void> {
  if (env.SMS_ENABLED === '0' || env.SMS_ENABLED?.toLowerCase() === 'false') {
    const skipped = await db.notification.updateMany({
      where: { status: 'PENDING', sendAfter: { lte: new Date() } },
      data: { status: 'SKIPPED', lastError: 'SMS_ENABLED=0 on the auction service' },
    })
    if (skipped.count > 0) console.log(`[outbox] SMS disabled — ${skipped.count} message(s) marked SKIPPED`)
    return
  }

  const rows = await claimDue(db)
  if (rows.length === 0) return
  const limits = smsLimitsFromEnv(env)
  const usage = await usageForBatch(db, rows)
  let sent = 0
  let retrying = 0
  let failed = 0
  let overQuota = 0
  for (const row of rows) {
    if (row.attempts > MAX_ATTEMPTS) {
      // Leases kept expiring (crashes mid-send): stop trying.
      await db.notification.update({ where: { id: row.id }, data: { status: 'FAILED', lastError: 'Too many attempts' } })
      failed++
      continue
    }
    const blocked = smsQuotaBlock(row, usage, limits)
    if (blocked) {
      await db.notification.update({ where: { id: row.id }, data: { status: 'SKIPPED', lastError: blocked } })
      overQuota++
      console.warn(`[outbox] ${row.kind} to ${maskNumber(row.to)} skipped: ${blocked}`)
      continue
    }
    try {
      await driver.send(row.to, row.body)
      recordSmsSent(row, usage)
      await db.notification.update({ where: { id: row.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } })
      sent++
    } catch (err) {
      const lastError = errorText(err)
      if (row.attempts >= MAX_ATTEMPTS) {
        await db.notification.update({ where: { id: row.id }, data: { status: 'FAILED', lastError } })
        failed++
      } else {
        await db.notification.update({
          where: { id: row.id },
          data: { lastError, sendAfter: new Date(Date.now() + backoffMs(row.attempts)) },
        })
        retrying++
      }
      console.error(`[outbox] ${row.kind} to ${maskNumber(row.to)} failed (attempt ${row.attempts}/${MAX_ATTEMPTS}): ${lastError}`)
    }
  }
  console.log(`[outbox] driver=${driver.name}: sent ${sent}, retrying ${retrying}, failed ${failed}, over quota ${overQuota}`)
}

/** Last-24-hour SENT counts for the numbers and tournaments in this batch, plus the platform total. */
async function usageForBatch(db: ResilientClient, rows: ClaimedRow[]): Promise<SmsUsage> {
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const tos = [...new Set(rows.map((r) => r.to))]
  const tournamentIds = [...new Set(rows.map((r) => r.tournamentId).filter((id): id is string => !!id))]
  const [byNumber, byTournament, total] = await Promise.all([
    db.notification.groupBy({ by: ['to'], where: { status: 'SENT', sentAt: { gte: since }, to: { in: tos } }, _count: { _all: true } }),
    tournamentIds.length
      ? db.notification.groupBy({
          by: ['tournamentId'],
          where: { status: 'SENT', sentAt: { gte: since }, tournamentId: { in: tournamentIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { tournamentId: string | null; _count: { _all: number } }[]),
    db.notification.count({ where: { status: 'SENT', sentAt: { gte: since } } }),
  ])
  return {
    byNumber: new Map(byNumber.map((g) => [g.to, g._count._all])),
    byTournament: new Map(byTournament.map((g) => [g.tournamentId as string, g._count._all])),
    total,
  }
}

/**
 * Hourly retention sweep — see the privacy notice for the promised periods.
 * Every statement is idempotent, so concurrent instances are harmless.
 */
export async function runMaintenance(db: ResilientClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  const step = async (label: string, run: () => Promise<number>) => {
    try {
      counts[label] = await run()
    } catch (err) {
      console.error(`[maintenance] ${label} failed:`, errorText(err))
    }
  }
  await step('rejectedRegistrations', () =>
    db.$executeRaw`DELETE FROM "PlayerRegistration" WHERE "status" = 'REJECTED' AND "createdAt" < now() - interval '90 days'`,
  )
  await step('notifications', () => db.$executeRaw`DELETE FROM "Notification" WHERE "createdAt" < now() - interval '180 days'`)
  await step('rateLimits', () => db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now()`)
  await step('sessions', () =>
    db.$executeRaw`
      DELETE FROM "Session"
      WHERE "expiresAt" < now() - interval '30 days'
         OR ("revokedAt" IS NOT NULL AND "revokedAt" < now() - interval '30 days')`,
  )
  // Uploads nothing points at any more (replaced photos, abandoned forms).
  // Referenced ids are collected once (linear), rather than a LIKE scan per upload.
  await step('orphanUploads', () =>
    db.$executeRaw`
      WITH urls AS (
        SELECT "photoUrl" AS url FROM "Player" WHERE "photoUrl" LIKE '%/api/uploads/%'
        UNION ALL SELECT "logoUrl" FROM "Team" WHERE "logoUrl" LIKE '%/api/uploads/%'
        UNION ALL SELECT "logoUrl" FROM "Tournament" WHERE "logoUrl" LIKE '%/api/uploads/%'
        UNION ALL SELECT "bannerUrl" FROM "Tournament" WHERE "bannerUrl" LIKE '%/api/uploads/%'
        UNION ALL SELECT "photoUrl" FROM "PlayerRegistration" WHERE "photoUrl" LIKE '%/api/uploads/%'
        UNION ALL SELECT "logoUrl" FROM "Sponsor" WHERE "logoUrl" LIKE '%/api/uploads/%'
        UNION ALL SELECT "value" FROM "Setting" WHERE "value" LIKE '%/api/uploads/%'
      ),
      refs AS (
        SELECT DISTINCT substring(url FROM '/api/uploads/([A-Za-z0-9_-]+)') AS id FROM urls
      )
      DELETE FROM "Upload" u
      WHERE u."createdAt" < now() - interval '7 days'
        AND NOT EXISTS (SELECT 1 FROM refs WHERE refs.id = u."id")`,
  )
  const summary = Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.log(`[maintenance] deleted ${summary || '(nothing — all steps failed)'}`)
  return counts
}

/** Starts delivery (every ~10 s) and maintenance (hourly). Returns a stop function. */
export function startOutboxWorker(db: ResilientClient, opts: OutboxWorkerOptions = {}): () => void {
  const env = opts.env ?? process.env
  const driver = opts.driver ?? driverFromEnv(env)
  const smsOff = env.SMS_ENABLED === '0' || env.SMS_ENABLED?.toLowerCase() === 'false'
  console.log(`[outbox] SMS worker started — driver=${driver.name}${smsOff ? ' (SMS_ENABLED=0: messages are skipped)' : ''}`)

  let stopped = false
  let sending = false
  let maintaining = false

  const sendTick = async () => {
    if (stopped || sending) return
    sending = true
    try {
      await deliverBatch(db, driver, env)
    } catch (err) {
      console.error('[outbox] delivery pass failed:', errorText(err))
    } finally {
      sending = false
    }
  }
  const maintenanceTick = async () => {
    if (stopped || maintaining) return
    maintaining = true
    try {
      await runMaintenance(db)
    } finally {
      maintaining = false
    }
  }

  const sendTimer = setInterval(() => void sendTick(), opts.intervalMs ?? SEND_INTERVAL_MS)
  const maintenanceTimer = setInterval(() => void maintenanceTick(), opts.maintenanceIntervalMs ?? MAINTENANCE_INTERVAL_MS)
  const firstMaintenance = setTimeout(() => void maintenanceTick(), FIRST_MAINTENANCE_DELAY_MS)
  void sendTick()

  return () => {
    stopped = true
    clearInterval(sendTimer)
    clearInterval(maintenanceTimer)
    clearTimeout(firstMaintenance)
  }
}
