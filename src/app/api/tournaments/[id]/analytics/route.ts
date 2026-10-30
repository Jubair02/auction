import { db } from '@/lib/db'
import { loadTournamentForOwner, requireSession } from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const TOP_N = 10

// GET /api/tournaments/:id/analytics — owner/ADMIN. Post-auction insights over
// the complete bid history (the results page only carries the last 50 bids).
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const loaded = await loadTournamentForOwner(id, auth.user)
  if ('response' in loaded) return loaded.response
  const tournament = loaded.tournament

  const [players, teams, auction] = await Promise.all([
    db.player.findMany({
      where: { tournamentId: id },
      select: { id: true, name: true, playerNumber: true, category: true, basePrice: true, soldPrice: true, status: true, soldToTeamId: true },
    }),
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true, budget: true, spent: true, maxSquad: true, minSquad: true },
    }),
    db.auction.findUnique({ where: { tournamentId: id }, select: { id: true } }),
  ])

  const bidCounts = new Map<string, number>()
  let totalBids = 0
  if (auction) {
    const grouped = await db.bid.groupBy({ by: ['playerId'], where: { auctionId: auction.id }, _count: { _all: true } })
    for (const g of grouped) {
      bidCounts.set(g.playerId, g._count._all)
      totalBids += g._count._all
    }
  }

  const teamName = new Map(teams.map((t) => [t.id, t.name]))
  const sold = players.filter((p) => p.status === 'SOLD' && p.soldPrice != null)
  const dealt = players.filter((p) => p.status === 'SOLD' || p.status === 'UNSOLD' || p.status === 'SKIPPED').length
  const totalSpend = sold.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0)
  const top = [...sold].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))[0]

  const squad = new Map<string, number>()
  for (const p of sold) if (p.soldToTeamId) squad.set(p.soldToTeamId, (squad.get(p.soldToTeamId) ?? 0) + 1)

  const categories =
    tournament.auctionMode === 'CATEGORY'
      ? ['A', 'B', 'C', 'D', 'E']
          .map((code) => {
            const inCat = players.filter((p) => p.category === code)
            const soldInCat = sold.filter((p) => p.category === code)
            const spend = soldInCat.reduce((s, p) => s + (p.soldPrice ?? 0), 0)
            return {
              code,
              players: inCat.length,
              sold: soldInCat.length,
              spend,
              avgPrice: soldInCat.length ? Math.round(spend / soldInCat.length) : 0,
            }
          })
          .filter((c) => c.players > 0)
      : []

  const view = (p: (typeof players)[number]) => ({
    id: p.id,
    name: p.name,
    playerNumber: p.playerNumber,
    basePrice: p.basePrice,
    soldPrice: p.soldPrice,
    teamName: p.soldToTeamId ? (teamName.get(p.soldToTeamId) ?? null) : null,
    bids: bidCounts.get(p.id) ?? 0,
  })

  return Response.json({
    summary: {
      totalSpend,
      soldCount: sold.length,
      avgPrice: sold.length ? Math.round(totalSpend / sold.length) : 0,
      sellThrough: dealt ? sold.length / dealt : null,
      totalBids,
      topSale: top ? { name: top.name, price: top.soldPrice, teamName: top.soldToTeamId ? (teamName.get(top.soldToTeamId) ?? null) : null } : null,
    },
    teams: teams.map((t) => ({ ...t, squadCount: squad.get(t.id) ?? 0 })),
    categories,
    mostContested: players
      .filter((p) => (bidCounts.get(p.id) ?? 0) > 0)
      .sort((a, b) => (bidCounts.get(b.id) ?? 0) - (bidCounts.get(a.id) ?? 0))
      .slice(0, TOP_N)
      .map(view),
    biggestPremiums: sold
      .filter((p) => p.basePrice > 0)
      .sort((a, b) => (b.soldPrice ?? 0) / b.basePrice - (a.soldPrice ?? 0) / a.basePrice)
      .slice(0, TOP_N)
      .map(view),
  })
}
