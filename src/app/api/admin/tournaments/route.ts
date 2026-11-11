import { db } from '@/lib/db'
import { requireSessionRole, serializeTournamentSummary, soldCountsByTournament } from '../../_lib/helpers'

export const runtime = 'nodejs'

/** The admin list shows the newest this many; ?q= searches every tournament. */
const LIST_LIMIT = 500

// GET /api/admin/tournaments[?q=] — ADMIN only; includes archived tournaments (with archivedAt) → { tournaments, total }
export async function GET(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100) ?? ''
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { organizer: { name: { contains: q, mode: 'insensitive' as const } } },
          { auction: { roomCode: { contains: q.toUpperCase() } } },
        ],
      }
    : {}
  const total = await db.tournament.count({ where })
  const tournaments = await db.tournament.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
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
    total,
  })
}
