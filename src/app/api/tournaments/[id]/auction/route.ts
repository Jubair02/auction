import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { generateRoomCode } from '@/lib/crypto'
import {
  clampInt,
  loadTournamentForOwner,
  readJson,
  requireSession,
  serializeAuction,
} from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const TIMER = { min: 5, max: 120, fallback: 20 }
const GOING = { min: 3, max: 60, fallback: 8 }
const INCREMENT = { min: 500, max: 100000, fallback: 5000 }

// POST /api/tournaments/:id/auction — create auction (roomCode, READY) — owner/ADMIN
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user)
  if ('response' in loaded) return loaded.response
  const tournament = loaded.tournament

  const body = (await readJson(req)) ?? {}

  const teamCount = await db.team.count({ where: { tournamentId: id } })
  if (teamCount < 1) return jsonError('Add at least one team before setting up the auction', 400)

  const playerCount = await db.player.count({ where: { tournamentId: id } })
  if (playerCount < 1) return jsonError('Add at least one player before setting up the auction', 400)

  const existing = await db.auction.findUnique({ where: { tournamentId: id } })
  if (existing) return jsonError('An auction has already been created for this tournament', 409)

  const bidTimerSeconds = clampInt(body.bidTimerSeconds, TIMER.min, TIMER.max, TIMER.fallback)
  const goingIntervalSeconds = clampInt(body.goingIntervalSeconds, GOING.min, GOING.max, GOING.fallback)
  const minIncrement = clampInt(body.minIncrement, INCREMENT.min, INCREMENT.max, INCREMENT.fallback)

  let auction: Prisma.AuctionGetPayload<object> | null = null
  let lastError: unknown = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      auction = await db.auction.create({
        data: {
          tournamentId: id,
          roomCode: generateRoomCode(),
          status: 'READY',
          bidTimerSeconds,
          goingIntervalSeconds,
          minIncrement,
        },
      })
      break
    } catch (e) {
      lastError = e
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]) : []
        if (target.includes('tournamentId')) {
          return jsonError('An auction has already been created for this tournament', 409)
        }
        continue // roomCode collision — retry with a new code
      }
      return jsonError('Could not create the auction', 500)
    }
  }
  if (!auction) {
    console.error('roomCode generation failed after 5 attempts', lastError)
    return jsonError('Could not generate a unique room code, please try again', 500)
  }

  await db.tournament.update({ where: { id }, data: { status: 'READY' } })

  return Response.json({ auction: serializeAuction(auction) }, { status: 201 })
}

// PATCH /api/tournaments/:id/auction — update settings (only while auction is READY)
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user)
  if ('response' in loaded) return loaded.response

  const auction = await db.auction.findUnique({ where: { tournamentId: id } })
  if (!auction) return jsonError('No auction has been created for this tournament yet', 404)
  if (auction.status !== 'READY') {
    return jsonError('Auction settings can only be changed while the auction is READY', 409)
  }

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const data: { bidTimerSeconds?: number; goingIntervalSeconds?: number; minIncrement?: number } = {}
  if (body.bidTimerSeconds !== undefined) {
    data.bidTimerSeconds = clampInt(body.bidTimerSeconds, TIMER.min, TIMER.max, auction.bidTimerSeconds)
  }
  if (body.goingIntervalSeconds !== undefined) {
    data.goingIntervalSeconds = clampInt(
      body.goingIntervalSeconds,
      GOING.min,
      GOING.max,
      auction.goingIntervalSeconds,
    )
  }
  if (body.minIncrement !== undefined) {
    data.minIncrement = clampInt(body.minIncrement, INCREMENT.min, INCREMENT.max, auction.minIncrement)
  }

  if (Object.keys(data).length === 0) return jsonError('No valid fields to update', 400)

  const updated = await db.auction.update({ where: { id: auction.id }, data })
  return Response.json({ auction: serializeAuction(updated) })
}
