import { db } from '@/lib/db'
import type { PaymentDTO, PaymentMethod, PaymentStatus } from '@/lib/types'
import { requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

// GET /api/admin/payments?status=PENDING|APPROVED|REJECTED|ALL — ADMIN only, newest first (max 200)
export async function GET(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const raw = new URL(req.url).searchParams.get('status')?.toUpperCase() ?? 'PENDING'
  const status = (STATUSES as readonly string[]).includes(raw) ? raw : null

  const [rows, pendingCount] = await Promise.all([
    db.payment.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tournament: { select: { plan: true } } },
    }),
    db.payment.count({ where: { status: 'PENDING' } }),
  ])

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
  return Response.json({ payments, pendingCount })
}
