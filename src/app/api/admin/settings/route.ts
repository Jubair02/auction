import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { normalizeBdPhone } from '@/lib/phone'
import { PLAN_SETTING_KEYS } from '@/lib/plans'
import { SUPPORT_PHONE_KEY, validateSupportPhone } from '@/lib/support-phone'
import { coercePositiveInt, readJson, requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

const NUMBER_KEYS: Record<string, string> = {
  [PLAN_SETTING_KEYS.proPrice]: 'Pro price',
  [PLAN_SETTING_KEYS.freeMaxTeams]: 'Free plan team limit',
  [PLAN_SETTING_KEYS.freeMaxPlayers]: 'Free plan player limit',
}
const PHONE_KEYS: Record<string, string> = {
  [PLAN_SETTING_KEYS.bkashNumber]: 'bKash number',
  [PLAN_SETTING_KEYS.nagadNumber]: 'Nagad number',
}

/**
 * Pricing settings are read by getPlanSettings(), so they must be well formed.
 * Returns the value to store, undefined for a blank one (= the default), or an error.
 */
function validatePlanSetting(key: string, raw: string): string | undefined | { error: string } {
  const value = raw.trim()
  if (key in NUMBER_KEYS) {
    if (value === '') return undefined
    const n = coercePositiveInt(value)
    if (!n) return { error: `${NUMBER_KEYS[key]} must be a positive whole number` }
    return String(n)
  }
  if (key in PHONE_KEYS) {
    if (value === '') return undefined
    const phone = normalizeBdPhone(value)
    if (!phone) return { error: `${PHONE_KEYS[key]} must be a Bangladeshi mobile number, e.g. 01712345678` }
    return phone
  }
  // The site's support number: the same rules as the Edit profile route (lib/support-phone.ts).
  if (key === SUPPORT_PHONE_KEY) {
    const checked = validateSupportPhone(value)
    if ('error' in checked) return checked
    return checked.value === '' ? undefined : checked.value
  }
  if (key === PLAN_SETTING_KEYS.instructions) {
    if (value === '') return undefined
    if (value.length > 300) return { error: 'Payment instructions must be at most 300 characters' }
    return value
  }
  return raw
}

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ orderBy: { key: 'asc' } })
  const settings: Record<string, string> = {}
  for (const row of rows) settings[row.key] = row.value
  return settings
}

// GET /api/admin/settings — ADMIN only
export async function GET() {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  return Response.json({ settings: await getAllSettings() })
}

// PUT /api/admin/settings — {settings: Record<string,string>} — ADMIN only
export async function PUT(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const settings = body.settings
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return jsonError('Provide a "settings" object of key/value strings', 400)
  }

  const entries = Object.entries(settings as Record<string, unknown>)
  if (entries.length > 40) return jsonError('Cannot set more than 40 settings at once', 400)

  const validated: { key: string; value: string }[] = []
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().slice(0, 100)
    if (key === '') return jsonError('Setting keys cannot be empty', 400)
    if (typeof rawValue !== 'string') return jsonError(`Setting "${key}" must have a string value`, 400)
    if (rawValue.length > 500) return jsonError(`Setting "${key}" exceeds 500 characters`, 400)
    const value = validatePlanSetting(key, rawValue)
    if (value === undefined) continue // blank plan setting = use the built-in default
    if (typeof value === 'object') return jsonError(value.error, 400)
    validated.push({ key, value })
  }

  // PUT replaces the whole set, so keys the admin removed in the UI actually go away.
  const keptKeys = validated.map((v) => v.key)
  await db.$transaction([
    db.setting.deleteMany({ where: { key: { notIn: keptKeys } } }),
    ...validated.map(({ key, value }) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  ])

  return Response.json({ settings: await getAllSettings() })
}
