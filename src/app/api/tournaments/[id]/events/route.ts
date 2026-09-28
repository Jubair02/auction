import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { loadTournamentForOwner, requireSession } from '../../../_lib/helpers'
import type { AuctionEventDTO, PlayerSaleChain } from '@/lib/types'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tournaments/:id/events — immutable audit trail (owner/ADMIN).
// Returns the raw log plus a per-player sale chain built from it, so the
// history screen can show SALE → RE-AUCTION → REFUND → NEW SALE in order.
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTournamentForOwner(id, auth.user)
  if ('response' in loaded) return loaded.response

  const auction = await db.auction.findUnique({ where: { tournamentId: id }, select: { id: true } })
  if (!auction) return Response.json({ events: [], chains: [] })

  const [rows, players] = await Promise.all([
    db.auctionEvent.findMany({ where: { auctionId: auction.id }, orderBy: { createdAt: 'asc' } }),
    db.player.findMany({
      where: { tournamentId: id },
      select: { id: true, name: true, playerNumber: true, status: true, auctionCycle: true, soldPrice: true, soldToTeamId: true },
    }),
  ])

  const events: AuctionEventDTO[] = rows.map((e) => ({
    id: e.id,
    type: e.type as AuctionEventDTO['type'],
    cycle: e.cycle,
    playerId: e.playerId,
    playerName: e.playerName,
    playerNumber: e.playerNumber,
    teamId: e.teamId,
    teamName: e.teamName,
    amount: e.amount,
    refundAmount: e.refundAmount,
    actorName: e.actorName,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
  }))

  // Group into one chain per player, but only for players that actually have
  // a re-auction or a sale worth showing.
  const teamNames = new Map(
    (await db.team.findMany({ where: { tournamentId: id }, select: { id: true, name: true } })).map((t) => [t.id, t.name]),
  )
  const byPlayer = new Map<string, AuctionEventDTO[]>()
  for (const e of events) {
    if (!e.playerId) continue
    const list = byPlayer.get(e.playerId) ?? []
    list.push(e)
    byPlayer.set(e.playerId, list)
  }

  const chains: PlayerSaleChain[] = []
  for (const player of players) {
    const list = byPlayer.get(player.id)
    if (!list || list.length === 0) continue
    chains.push({
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.playerNumber,
      status: player.status,
      reauctions: list.filter((e) => e.type === 'RE_AUCTION').length,
      // Current ownership always comes from the player row — never from the log.
      currentTeamId: player.status === 'SOLD' ? player.soldToTeamId : null,
      currentTeamName:
        player.status === 'SOLD' && player.soldToTeamId ? (teamNames.get(player.soldToTeamId) ?? null) : null,
      currentPrice: player.status === 'SOLD' ? player.soldPrice : null,
      events: list,
    })
  }
  chains.sort((a, b) => b.reauctions - a.reauctions || a.playerNumber - b.playerNumber)

  return Response.json({ events, chains })
}
