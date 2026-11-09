import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { normalizeBdPhone } from '@/lib/phone'
import { getPlanSettings } from '@/lib/plans'
import { rateLimit } from '@/lib/rate-limit-shared'
import type { Payment } from '@prisma/client'
import type { PaymentDTO, PaymentMethod, PaymentStatus } from '@/lib/types'
import { isUniqueViolation, loadTournamentForOwner, readJson, requireSession } from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const HOUR = 60 * 60 * 1000
const TRX_RE = /^[A-Z0-9]{6,20}$/

function serializePayment(p: Payment): PaymentDTO {
  return {
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
  }
}

// GET /api/tournaments/:id/payments — the owner's (or an ADMIN's) view of this tournament's Pro payments
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user, 'owner')
  if ('response' in loaded) return loaded.response

  const payments = await db.payment.findMany({
    where: { tournamentId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return Response.json({ payments: payments.map(serializePayment) })
}

// POST /api/tournaments/:id/payments {method: 'BKASH'|'NAGAD', trxId, senderNumber}
// The owner reports a manual bKash / Nagad payment for Pro; an admin verifies it.
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth
  const loaded = await loadTournamentForOwner(id, user, 'owner')
  if ('response' in loaded) return loaded.response
  const { tournament } = loaded

  const retryAfter = await rateLimit(`payment-submit:${user.id}`, 10, HOUR)
  if (retryAfter !== null) return jsonError(`Too many payment submissions. Please try again in ${retryAfter} seconds.`, 429)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const method = body.method
  if (method !== 'BKASH' && method !== 'NAGAD') return jsonError('Choose bKash or Nagad', 400)
  const trxId = typeof body.trxId === 'string' ? body.trxId.replace(/\s/g, '').toUpperCase() : ''
  if (!TRX_RE.test(trxId)) return jsonError('Enter the Transaction ID from your payment message (6–20 letters and numbers)', 400)
  const senderNumber = typeof body.senderNumber === 'string' ? normalizeBdPhone(body.senderNumber) : null
  if (!senderNumber) return jsonError('Enter the mobile number you paid from, e.g. 01712345678', 400)

  if (tournament.plan === 'PRO') return jsonError('This tournament is already on Pro', 409)

  const settings = await getPlanSettings()
  const payTo = method === 'BKASH' ? settings.bkashNumber : settings.nagadNumber
  if (!settings.bkashNumber && !settings.nagadNumber) {
    return jsonError('Pro payments are not set up yet. Please contact support.', 503)
  }
  if (!payTo) return jsonError(`${method === 'BKASH' ? 'bKash' : 'Nagad'} payments are not accepted right now`, 400)

  const pending = await db.payment.findFirst({ where: { tournamentId: id, status: 'PENDING' }, select: { id: true } })
  if (pending) return jsonError('A payment for this tournament is already waiting for review', 409)

  let payment: Payment
  try {
    payment = await db.payment.create({
      data: {
        kind: 'TOURNAMENT_PRO',
        tournamentId: id,
        tournamentName: tournament.name,
        userId: user.id,
        payerName: user.name,
        amount: settings.proPrice,
        method,
        trxId,
        senderNumber,
      },
    })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError('This Transaction ID was already submitted', 409)
    throw err
  }

  await track('payment_submitted', { userId: user.id, tournamentId: id, props: { method, amount: payment.amount } })
  return Response.json({ payment: serializePayment(payment) }, { status: 201 })
}
