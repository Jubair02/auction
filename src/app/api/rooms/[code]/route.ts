import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import type { RoomInfo, RoomTeamInfo } from '@/lib/types'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ code: string }> }

// GET /api/rooms/:code — public room info (no auth required)
export async function GET(_req: Request, { params }: RouteParams) {
  const { code } = await params
  const roomCode = code.trim().toUpperCase()

  const auction = await db.auction.findUnique({
    where: { roomCode },
    include: {
      tournament: { select: { id: true, name: true, sport: true, auctionMode: true, organizerId: true } },
    },
  })
  if (!auction) {
    return Response.json({ error: 'Room not found. Check the code and try again.' }, { status: 404 })
  }

  const teams = await db.team.findMany({
    where: { tournamentId: auction.tournamentId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { players: true } } },
  })

  const sessionUser = await getSessionUser()
  const myRole: RoomInfo['myRole'] =
    sessionUser && (sessionUser.role === 'ADMIN' || sessionUser.id === auction.tournament.organizerId)
      ? 'organizer'
      : null

  const body: RoomInfo = {
    roomCode: auction.roomCode,
    auctionId: auction.id,
    tournamentId: auction.tournament.id,
    tournamentName: auction.tournament.name,
    sport: auction.tournament.sport as RoomInfo['sport'],
    mode: auction.tournament.auctionMode as RoomInfo['mode'],
    status: auction.status as RoomInfo['status'],
    teams: teams.map<RoomTeamInfo>((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      budget: t.budget,
      spent: t.spent,
      squadCount: t._count.players,
      maxSquad: t.maxSquad,
      minSquad: t.minSquad,
      captainName: t.captainName,
      managerUserId: t.managerUserId,
    })),
    myRole,
  }

  return Response.json(body)
}
