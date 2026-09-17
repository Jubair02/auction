import { db } from '@/lib/db'
import { requireSession, serializeTeam } from '../../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/my/teams — teams managed by the logged-in user
export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const teams = await db.team.findMany({
    where: { managerUserId: user.id },
    orderBy: { name: 'asc' },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          status: true,
          auction: { select: { roomCode: true, status: true } },
        },
      },
      _count: { select: { players: true } },
    },
  })

  return Response.json({
    teams: teams.map((t) => ({
      ...serializeTeam(t),
      tournamentId: t.tournament.id,
      tournamentName: t.tournament.name,
      tournamentStatus: t.tournament.status,
      roomCode: t.tournament.auction?.roomCode ?? null,
      auctionStatus: t.tournament.auction?.status ?? null,
    })),
  })
}
