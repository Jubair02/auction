import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { DEMO_ROOM_CODE } from '@/lib/demo'
import { clientKey, rateLimit, rateLimitBlocked } from '@/lib/rate-limit-shared'
import { getPublicBranding } from '@/lib/branding'
import type { PublicBranding, RoomInfo, RoomTeamInfo } from '@/lib/types'
import { tournamentAccess } from '../../_lib/helpers'

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
    await rateLimitBlocked(missKey, MISSES_PER_WINDOW) ?? await rateLimit(clientKey(req, 'room-lookup'), LOOKUPS_PER_MINUTE, 60 * 1000)
  if (blocked !== null) return tooMany(blocked)

  const { code } = await params
  const roomCode = code.trim().toUpperCase()

  const auction = await db.auction.findUnique({
    where: { roomCode },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          sport: true,
          sportName: true,
          auctionMode: true,
          organizerId: true,
          archivedAt: true,
          plan: true,
          logoUrl: true,
          brandColor: true,
          brandHidePlatform: true,
        },
      },
    },
  })
  // An archived (deleted) tournament's room is gone as far as visitors are concerned.
  if (!auction || auction.tournament.archivedAt) {
    // The join page asks for the demo room on every visit; in an unseeded
    // database that miss must not use up the visitor's wrong-code budget.
    if (roomCode !== DEMO_ROOM_CODE) await rateLimit(missKey, MISSES_PER_WINDOW, MISS_WINDOW_MS)
    return Response.json({ error: 'Room not found. Check the code and try again.' }, { status: 404 })
  }

  const [teams, branding] = await Promise.all([
    db.team.findMany({
      where: { tournamentId: auction.tournamentId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
    }),
    // Brand colour, logo and sponsors for the room, overlay and join card (PRO only).
    getPublicBranding(auction.tournament),
  ])

  const sessionUser = await getSessionUser()
  // Owner, ADMIN and tournament staff (co-organizer, auctioneer) run the room.
  const myRole: RoomInfo['myRole'] =
    sessionUser && (await tournamentAccess(auction.tournament, sessionUser)) !== null ? 'organizer' : null

  const body: RoomInfo & { branding: PublicBranding } = {
    roomCode: auction.roomCode,
    auctionId: auction.id,
    tournamentId: auction.tournament.id,
    tournamentName: auction.tournament.name,
    sport: auction.tournament.sport as RoomInfo['sport'],
    // An "Others" tournament's own game (Kabaddi, Volleyball…), shown instead of "Others".
    sportName: auction.tournament.sportName?.trim() || null,
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
      // Public endpoint: say whether a team is taken, never by which account.
      claimed: t.managerUserId !== null,
      isMine: !!sessionUser && t.managerUserId === sessionUser.id,
    })),
    myRole,
    allowOpenClaim: auction.allowOpenClaim,
    plan: auction.tournament.plan === 'PRO' ? 'PRO' : 'FREE',
    branding,
  }

  return Response.json(body)
}
