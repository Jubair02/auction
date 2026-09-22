import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import type { TeamDTO } from '@/lib/types'
import {
  coercePositiveInt,
  loadTournamentForOwner,
  readJson,
  requireSession,
  serializeTeam,
} from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/tournaments/:id/teams — batch create (owner/ADMIN)
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user)
  if ('response' in loaded) return loaded.response

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const list = body.teams
  if (!Array.isArray(list) || list.length === 0) {
    return jsonError('Provide a non-empty "teams" array', 400)
  }
  if (list.length > 50) return jsonError('Cannot add more than 50 teams at once', 400)

  interface ValidTeam {
    name: string
    color: string | null
    captainName: string | null
    logoUrl: string | null
    budget: number
    maxSquad: number
    minSquad: number
  }
  const valid: ValidTeam[] = []

  for (let i = 0; i < list.length; i++) {
    const raw = list[i]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return jsonError(`Team ${i + 1}: must be an object`, 400)
    }
    const t = raw as Record<string, unknown>

    const name = typeof t.name === 'string' ? t.name.trim() : ''
    if (name.length < 2 || name.length > 60) {
      return jsonError(`Team ${i + 1}: name must be 2–60 characters`, 400)
    }

    const budget = coercePositiveInt(t.budget)
    if (!budget) return jsonError(`Team ${i + 1}: budget must be a positive integer (taka)`, 400)

    const maxSquad = coercePositiveInt(t.maxSquad)
    if (!maxSquad) return jsonError(`Team ${i + 1}: maxSquad must be a positive integer`, 400)

    const minSquad = coerceIntNonNegative(t.minSquad)
    if (minSquad === null) return jsonError(`Team ${i + 1}: minSquad must be a non-negative integer`, 400)
    if (minSquad > maxSquad) return jsonError(`Team ${i + 1}: minSquad cannot be greater than maxSquad`, 400)

    const color = typeof t.color === 'string' && t.color.trim() !== '' ? t.color.trim().slice(0, 20) : null
    const captainName =
      typeof t.captainName === 'string' && t.captainName.trim() !== ''
        ? t.captainName.trim().slice(0, 60)
        : null
    const logoUrl =
      typeof t.logoUrl === 'string' && t.logoUrl.trim() !== '' ? t.logoUrl.trim().slice(0, 500) : null

    valid.push({ name: name.slice(0, 60), color, captainName, logoUrl, budget, maxSquad, minSquad })
  }

  const created: TeamDTO[] = []
  for (const t of valid) {
    const team = await db.team.create({
      data: { ...t, tournamentId: id, spent: 0 },
      include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
    })
    created.push(serializeTeam(team))
  }

  return Response.json({ created: created.length, teams: created }, { status: 201 })
}

function coerceIntNonNegative(value: unknown): number | null {
  const n = coercePositiveInt(value)
  if (n !== null) return n
  // allow explicit zero
  if (value === 0 || value === '0' || value === '00') return 0
  return null
}
