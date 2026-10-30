import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import { hashOneTimeToken } from '@/lib/crypto'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ token: string }> }

const INVALID = 'This invite link is invalid or has expired. Ask the organizer for a new one.'

async function findInvite(req: Request, token: string) {
  const retryAfter = rateLimit(clientKey(req, 'invite'), 60, 10 * 60 * 1000)
  if (retryAfter !== null) return { response: jsonError(`Too many attempts. Please try again in ${retryAfter} seconds.`, 429) }
  if (token.length < 20 || token.length > 200) return { response: jsonError(INVALID, 404) }

  const team = await db.team.findUnique({
    where: { inviteTokenHash: hashOneTimeToken(token) },
    include: { tournament: { include: { auction: { select: { roomCode: true } } } } },
  })
  if (!team || !team.inviteExpiresAt || team.inviteExpiresAt <= new Date()) {
    return { response: jsonError(INVALID, 404) }
  }
  return { team }
}

// GET /api/invites/:token — what the invite is for (the token itself is the secret)
export async function GET(req: Request, { params }: RouteParams) {
  const { token } = await params
  const found = await findInvite(req, token)
  if ('response' in found) return found.response
  const { team } = found

  return Response.json({
    teamName: team.name,
    teamColor: team.color,
    tournamentName: team.tournament.name,
    sport: team.tournament.sport,
    budget: team.budget,
    expiresAt: team.inviteExpiresAt!.toISOString(),
  })
}

// POST /api/invites/:token — a logged-in MANAGER accepts and becomes the team's manager
export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params

  const user = await getSessionUser()
  if (!user) return jsonError('Log in with your team manager account to accept this invite.', 401)
  if (user.role !== 'MANAGER') {
    return jsonError('Invites are for team manager accounts. Log out and use (or create) a manager account.', 403)
  }

  const found = await findInvite(req, token)
  if ('response' in found) return found.response
  const { team } = found

  const other = await db.team.findFirst({
    where: { tournamentId: team.tournamentId, managerUserId: user.id, id: { not: team.id } },
    select: { name: true },
  })
  if (other) return jsonError(`You already manage "${other.name}" in this tournament.`, 409)

  // Single use, and the organizer's invite wins over any earlier claim — the
  // previous manager's seat is revoked by the socket service on their next bid.
  const accepted = await db.team.updateMany({
    where: { id: team.id, inviteTokenHash: hashOneTimeToken(token) },
    data: { managerUserId: user.id, inviteTokenHash: null, inviteExpiresAt: null },
  })
  if (accepted.count !== 1) return jsonError(INVALID, 404)

  return Response.json({
    teamId: team.id,
    teamName: team.name,
    tournamentId: team.tournamentId,
    roomCode: team.tournament.auction?.roomCode ?? null,
  })
}
