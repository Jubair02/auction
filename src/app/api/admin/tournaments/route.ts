import { db } from '@/lib/db'
import { requireSessionRole, serializeTournamentSummary, soldCountsByTournament } from '../../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/admin/tournaments — ADMIN only; includes archived tournaments (with archivedAt)
export async function GET() {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const tournaments = await db.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      organizer: { select: { name: true } },
      _count: { select: { players: true, teams: true } },
      auction: { select: { roomCode: true, status: true } },
    },
  })

  const soldMap = await soldCountsByTournament(tournaments.map((t) => t.id))

  return Response.json({
    tournaments: tournaments.map((t) => ({
      ...serializeTournamentSummary({ ...t, soldCount: soldMap.get(t.id) ?? 0 }),
      organizerName: t.organizer.name,
      // Archived = "deleted" by the organizer but kept for its bid/audit trail.
      archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
    })),
  })
}
