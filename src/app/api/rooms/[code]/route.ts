import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { clientKey, rateLimit, rateLimitBlocked } from '@/lib/rate-limit'
import type { RoomInfo, RoomTeamInfo } from '@/lib/types'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ code: string }> }

// Limits are per IP and generous on purpose: a stadium or campus full of
// viewers can share one address (mobile carrier NAT). Wrong codes get a much
// tighter budget so the ~1M code space cannot be walked.
const LOOKUPS_PER_MINUTE = 300
const MISSES_PER_WINDOW = 30
const MISS_WINDOW_MS = 15 * 60 * 1000

const tooMany = (seconds: number) =>
  Response.json(
    { error: `Too many room lookups. Please try again in ${seconds} seconds.` },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  )

// GET /api/rooms/:code — public room info (no auth required)
export async function GET(req: Request, { params }: RouteParams) {
  const missKey = clientKey(req, 'room-miss')
  const blocked =
    rateLimitBlocked(missKey, MISSES_PER_WINDOW) ?? rateLimit(clientKey(req, 'room-lookup'), LOOKUPS_PER_MINUTE, 60 * 1000)
  if (blocked !== null) return tooMany(blocked)

  const { code } = await params
  const roomCode = code.trim().toUpperCase()

  const auction = await db.auction.findUnique({
    where: { roomCode },
    include: {
      tournament: { select: { id: true, name: true, sport: true, auctionMode: true, organizerId: true } },
    },
  })
  if (!auction) {
    rateLimit(missKey, MISSES_PER_WINDOW, MISS_WINDOW_MS)
    return Response.json({ error: 'Room not found. Check the code and try again.' }, { status: 404 })
  }

  const teams = await db.team.findMany({
    where: { tournamentId: auction.tournamentId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
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
    allowOpenClaim: auction.allowOpenClaim,
  }

  return Response.json(body)
}
