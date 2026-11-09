// Who may see a tournament's results without being part of it, and the data
// the public share cards (/api/og/*) and link previews show.
import { db } from '@/lib/db'

/**
 * Public results: the organizer left "results public" on (the default) and the
 * auction is over — the auction ENDED or the tournament is COMPLETED. Archived
 * (deleted) tournaments are never public.
 */
export function resultsArePublic(
  tournament: { resultsPublic: boolean; status: string; archivedAt: Date | null },
  auction: { status: string } | null,
): boolean {
  if (!tournament.resultsPublic || tournament.archivedAt) return false
  return auction?.status === 'ENDED' || tournament.status === 'COMPLETED'
}

export interface PublicResultsSummary {
  id: string
  name: string
  sport: string
  sportName: string | null
  location: string | null
  teamCount: number
  soldCount: number
  totalValue: number
  topBuys: { name: string; teamName: string | null; price: number }[]
}

/** Summary for a share card / link preview, or null when the results are not public. */
export async function loadPublicResultsSummary(tournamentId: string): Promise<PublicResultsSummary | null> {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      sport: true,
      sportName: true,
      location: true,
      status: true,
      resultsPublic: true,
      archivedAt: true,
      auction: { select: { status: true } },
    },
  })
  if (!tournament || !resultsArePublic(tournament, tournament.auction)) return null

  const [teamCount, sold, top] = await Promise.all([
    db.team.count({ where: { tournamentId } }),
    db.player.aggregate({ where: { tournamentId, status: 'SOLD' }, _count: true, _sum: { soldPrice: true } }),
    db.player.findMany({
      where: { tournamentId, status: 'SOLD', soldPrice: { not: null } },
      orderBy: [{ soldPrice: 'desc' }, { playerNumber: 'asc' }],
      take: 3,
      select: { name: true, soldPrice: true, soldToTeam: { select: { name: true } } },
    }),
  ])

  return {
    id: tournament.id,
    name: tournament.name,
    sport: tournament.sport,
    sportName: tournament.sportName,
    location: tournament.location,
    teamCount,
    soldCount: sold._count,
    totalValue: sold._sum.soldPrice ?? 0,
    topBuys: top.map((p) => ({ name: p.name, teamName: p.soldToTeam?.name ?? null, price: p.soldPrice ?? 0 })),
  }
}
