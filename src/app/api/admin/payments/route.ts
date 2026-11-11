import { db } from '@/lib/db'
import type { PaymentCounts, PaymentDTO, PaymentMethod, PaymentStatus } from '@/lib/types'
import { requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

// GET /api/admin/payments?status=PENDING|APPROVED|REJECTED|ALL — ADMIN only, newest first (max 200)
// → { payments, pendingCount, counts }
export async function GET(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const raw = new URL(req.url).searchParams.get('status')?.toUpperCase() ?? 'PENDING'
  const status = (STATUSES as readonly string[]).includes(raw) ? raw : null

  const [rows, grouped] = await Promise.all([
    db.payment.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tournament: { select: { plan: true } } },
    }),
    // Every tab's count, from the database — whichever list was asked for (and
    // not capped at the 200 rows the list returns).
    db.payment.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const counts: PaymentCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0, ALL: 0 }
  for (const g of grouped) {
    if ((STATUSES as readonly string[]).includes(g.status)) counts[g.status as (typeof STATUSES)[number]] = g._count._all
    counts.ALL += g._count._all
  }
  const pendingCount = counts.PENDING

  const payments: (PaymentDTO & { tournamentPlan: 'FREE' | 'PRO' | null })[] = rows.map((p) => ({
    id: p.id,
    tournamentId: p.tournamentId,
    tournamentName: p.tournamentName,
    payerName: p.payerName,
    amount: p.amount,
    method: p.method as PaymentMethod,
    trxId: p.trxId,
    senderNumber: p.senderNumber,
    status: p.status as PaymentStatus,
    reviewNote: p.reviewNote,
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    tournamentPlan: p.tournament ? (p.tournament.plan === 'PRO' ? 'PRO' : 'FREE') : null,
  }))
  // pendingCount stays for the admin header's Payments badge.
  return Response.json({ payments, pendingCount, counts })
}
