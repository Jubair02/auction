import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  coercePositiveInt,
  loadTournamentForOwner,
  normalizeCategory,
  readJson,
  requireSession,
  serializePlayer,
} from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

interface ValidatedPlayer {
  name: string
  phone: string | null
  role: string
  category: string | null
  basePrice: number
  previousTeam: string | null
  photoUrl: string | null
}

function validatePlayerInput(raw: unknown, label: string): ValidatedPlayer | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return `${label}: each player must be an object`
  const p = raw as Record<string, unknown>

  const name = typeof p.name === 'string' ? p.name.trim() : ''
  if (name.length < 1 || name.length > 80) return `${label}: name is required (2–80 characters)`
  if (name.length < 2) return `${label}: name must be at least 2 characters`

  const role = typeof p.role === 'string' ? p.role.trim() : ''
  if (role === '') return `${label}: role is required`
  if (role.length > 40) return `${label}: role is too long`

  const category = normalizeCategory(p.category)
  if (category === false) return `${label}: category must be one of A, B, C, D, E`

  const basePrice = coercePositiveInt(p.basePrice)
  if (!basePrice) return `${label}: basePrice must be a positive integer (taka)`

  const str = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null
    const s = v.trim()
    return s === '' ? null : s.slice(0, max)
  }

  return {
    name: name.slice(0, 80),
    phone: str(p.phone, 20),
    role: role.slice(0, 40),
    category,
    basePrice,
    previousTeam: str(p.previousTeam, 80),
    photoUrl: str(p.photoUrl, 500),
  }
}

// POST /api/tournaments/:id/players — batch create (owner/ADMIN)
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user)
  if ('response' in loaded) return loaded.response

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const list = body.players
  if (!Array.isArray(list) || list.length === 0) {
    return jsonError('Provide a non-empty "players" array', 400)
  }
  if (list.length > 500) return jsonError('Cannot add more than 500 players at once', 400)

  const validated: ValidatedPlayer[] = []
  for (let i = 0; i < list.length; i++) {
    const result = validatePlayerInput(list[i], `Player ${i + 1}`)
    if (typeof result === 'string') return jsonError(result, 400)
    validated.push(result)
  }

  const maxAgg = await db.player.aggregate({
    where: { tournamentId: id },
    _max: { playerNumber: true },
  })
  let nextNumber = (maxAgg._max.playerNumber ?? 0) + 1

  const created: Awaited<ReturnType<typeof serializePlayer>>[] = []
  for (const p of validated) {
    const player = await db.player.create({
      data: { ...p, tournamentId: id, playerNumber: nextNumber, status: 'AVAILABLE' },
      include: { soldToTeam: { select: { name: true } } },
    })
    created.push(serializePlayer(player))
    nextNumber++
  }

  return Response.json({ created: created.length, players: created }, { status: 201 })
}
