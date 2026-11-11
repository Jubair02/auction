import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { SUPPORT_PHONE_KEY, validateSupportPhone } from '@/lib/support-phone'
import { readJson, requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

// The site's support number (see lib/support-phone.ts) — the same Setting row
// Admin → Settings edits; this route is what the admin's Edit profile dialog uses.

// GET /api/admin/support-phone — ADMIN only → { supportPhone } ('' when not set)
export async function GET() {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response
  const row = await db.setting.findUnique({ where: { key: SUPPORT_PHONE_KEY } })
  return Response.json({ supportPhone: row?.value ?? '' }, { headers: { 'Cache-Control': 'no-store' } })
}

// PUT /api/admin/support-phone {supportPhone} — ADMIN only. '' removes it. → { supportPhone }
export async function PUT(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const body = await readJson(req)
  if (!body || typeof body.supportPhone !== 'string') return jsonError('Provide "supportPhone" as a string', 400)
  const checked = validateSupportPhone(body.supportPhone)
  if ('error' in checked) return jsonError(checked.error, 400)

  if (checked.value === '') {
    await db.setting.deleteMany({ where: { key: SUPPORT_PHONE_KEY } })
  } else {
    await db.setting.upsert({
      where: { key: SUPPORT_PHONE_KEY },
      update: { value: checked.value },
      create: { key: SUPPORT_PHONE_KEY, value: checked.value },
    })
  }
  return Response.json({ supportPhone: checked.value })
}
