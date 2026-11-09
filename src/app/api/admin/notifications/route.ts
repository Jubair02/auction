import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { maskNumber } from '@/lib/notify'
import { clampInt, readJson, requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

const STATUSES = ['PENDING', 'SENT', 'FAILED', 'SKIPPED'] as const

// GET /api/admin/notifications?status=&limit= — ADMIN only. Recent SMS outbox
// rows (numbers masked to the last 3 digits) and counts by status.
export async function GET(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const params = new URL(req.url).searchParams
  const statusParam = params.get('status')?.toUpperCase() ?? ''
  const status = (STATUSES as readonly string[]).includes(statusParam) ? statusParam : null
  const limit = clampInt(params.get('limit'), 1, 200, 50)

  const [rows, groups] = await Promise.all([
    db.notification.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.notification.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const tournamentIds = [...new Set(rows.map((r) => r.tournamentId).filter((id): id is string => !!id))]
  const names = new Map(
    (await db.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true } })).map((t) => [
      t.id,
      t.name,
    ]),
  )
  const counts: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 }
  for (const g of groups) counts[g.status] = g._count._all

  return Response.json({
    counts,
    notifications: rows.map((r) => ({
      id: r.id,
      to: maskNumber(r.to),
      body: r.body,
      kind: r.kind,
      tournamentId: r.tournamentId,
      tournamentName: r.tournamentId ? (names.get(r.tournamentId) ?? null) : null,
      status: r.status,
      attempts: r.attempts,
      lastError: r.lastError,
      sendAfter: r.sendAfter.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
  })
}

// PATCH /api/admin/notifications {action:'retry_failed', id?} — ADMIN only.
// Puts FAILED messages (all, or one) back in the queue with fresh attempts.
export async function PATCH(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const body = await readJson(req)
  if (!body || body.action !== 'retry_failed') return jsonError('Unknown action', 400)
  const id = typeof body.id === 'string' && body.id ? body.id : null

  const result = await db.notification.updateMany({
    where: { status: 'FAILED', ...(id ? { id } : {}) },
    data: { status: 'PENDING', attempts: 0, lastError: null, sendAfter: new Date() },
  })
  return Response.json({ reset: result.count })
}
