import { db } from '@/lib/db'
import { requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/admin/stats — ADMIN only
export async function GET() {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const [users, organizers, managers, tournaments, liveAuctions, players, bids, soldAgg] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: 'ORGANIZER' } }),
      db.user.count({ where: { role: 'MANAGER' } }),
      db.tournament.count(),
      db.auction.count({ where: { status: 'LIVE' } }),
      db.player.count(),
      db.bid.count(),
      db.player.aggregate({ where: { status: 'SOLD' }, _sum: { soldPrice: true } }),
    ])

  return Response.json({
    users,
    organizers,
    managers,
    tournaments,
    liveAuctions,
    players,
    bids,
    totalValue: soldAgg._sum.soldPrice ?? 0,
  })
}
