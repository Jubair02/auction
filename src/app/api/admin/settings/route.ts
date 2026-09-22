import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { readJson, requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

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
  if (entries.length > 20) return jsonError('Cannot set more than 20 settings at once', 400)

  const validated: { key: string; value: string }[] = []
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().slice(0, 100)
    if (key === '') return jsonError('Setting keys cannot be empty', 400)
    if (typeof rawValue !== 'string') return jsonError(`Setting "${key}" must have a string value`, 400)
    if (rawValue.length > 500) return jsonError(`Setting "${key}" exceeds 500 characters`, 400)
    validated.push({ key, value: rawValue })
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
