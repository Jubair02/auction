import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import { signToken } from '@/lib/crypto'
import { readJson } from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ code: string }> }

const SOCKET_TOKEN_TTL = 12 * 3600 // 12 hours

// POST /api/rooms/:code/join — public; returns a signed socket token + identity
export async function POST(req: Request, { params }: RouteParams) {
  const { code } = await params
  const roomCode = code.trim().toUpperCase()

  const auction = await db.auction.findUnique({
    where: { roomCode },
    include: { tournament: { select: { id: true, organizerId: true } } },
  })
  if (!auction) return jsonError('Room not found. Check the code and try again.', 404)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const role = body.role
  if (role !== 'organizer' && role !== 'manager' && role !== 'viewer') {
    return jsonError('Role must be "organizer", "manager" or "viewer"', 400)
  }

  const sessionUser = await getSessionUser()
  const isOrganizer =
    sessionUser && (sessionUser.role === 'ADMIN' || sessionUser.id === auction.tournament.organizerId)

  const upsertParticipant = async (data: {
    role: 'ORGANIZER' | 'MANAGER' | 'VIEWER'
    name: string
    teamId?: string | null
    userId?: string | null
  }) => {
    await db.roomParticipant.upsert({
      where: {
        auctionId_role_name: {
          auctionId: auction.id,
          role: data.role,
          name: data.name,
        },
      },
      update: { teamId: data.teamId ?? null, userId: data.userId ?? null, online: false, lastSeen: new Date() },
      create: {
        auctionId: auction.id,
        role: data.role,
        name: data.name,
        teamId: data.teamId ?? null,
        userId: data.userId ?? null,
        online: false,
      },
    })
  }

  if (role === 'organizer') {
    if (!sessionUser || !isOrganizer) {
      return jsonError('Only the tournament organizer can join as organizer', 403)
    }
    const token = signToken(
      {
        auctionId: auction.id,
        roomCode: auction.roomCode,
        role: 'ORGANIZER',
        name: sessionUser.name,
        userId: sessionUser.id,
      },
      SOCKET_TOKEN_TTL,
    )
    await upsertParticipant({ role: 'ORGANIZER', name: sessionUser.name, userId: sessionUser.id })
    return Response.json({ socketToken: token, identity: { role: 'ORGANIZER', name: sessionUser.name } })
  }

  if (role === 'manager') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 40) {
      return jsonError('Name must be 2–40 characters', 400)
    }
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : ''
    if (!teamId) return jsonError('Select the team you manage', 400)

    const team = await db.team.findFirst({ where: { id: teamId, tournamentId: auction.tournamentId } })
    if (!team) return jsonError('Team not found in this tournament', 404)

    if (team.managerUserId && (!sessionUser || sessionUser.id !== team.managerUserId)) {
      return jsonError('This team is registered to another manager. Please log in with that account.', 403)
    }

    // An unclaimed team is claimed by the first logged-in MANAGER who takes the seat.
    // Without this the team never gets a managerUserId, so "My teams" stays empty forever.
    if (!team.managerUserId && sessionUser && sessionUser.role === 'MANAGER') {
      const alreadyManaging = await db.team.findFirst({
        where: { tournamentId: auction.tournamentId, managerUserId: sessionUser.id },
        select: { id: true, name: true },
      })
      if (alreadyManaging) {
        return jsonError(`You already manage "${alreadyManaging.name}" in this tournament`, 409)
      }
      await db.team.update({ where: { id: team.id }, data: { managerUserId: sessionUser.id } })
      team.managerUserId = sessionUser.id
    }

    const token = signToken(
      {
        auctionId: auction.id,
        roomCode: auction.roomCode,
        role: 'MANAGER',
        name,
        teamId: team.id,
        teamName: team.name,
        ...(sessionUser ? { userId: sessionUser.id } : {}),
      },
      SOCKET_TOKEN_TTL,
    )
    await upsertParticipant({
      role: 'MANAGER',
      name,
      teamId: team.id,
      userId: sessionUser?.id ?? null,
    })
    return Response.json({
      socketToken: token,
      identity: { role: 'MANAGER', name, teamId: team.id, teamName: team.name },
    })
  }

  // viewer
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 40) {
    return jsonError('Name must be 2–40 characters', 400)
  }
  const token = signToken(
    {
      auctionId: auction.id,
      roomCode: auction.roomCode,
      role: 'VIEWER',
      name,
      ...(sessionUser ? { userId: sessionUser.id } : {}),
    },
    SOCKET_TOKEN_TTL,
  )
  await upsertParticipant({ role: 'VIEWER', name, userId: sessionUser?.id ?? null })
  return Response.json({ socketToken: token, identity: { role: 'VIEWER', name } })
}
