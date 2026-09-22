import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  coerceInt,
  coercePositiveInt,
  loadTeamForOwner,
  readJson,
  requireSession,
  serializeTeam,
} from '../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// PATCH /api/teams/:id — owner/ADMIN; budget can be raised anytime, never below spent
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTeamForOwner(id, user)
  if ('response' in loaded) return loaded.response
  const team = loaded.team

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const data: {
    name?: string
    color?: string | null
    captainName?: string | null
    logoUrl?: string | null
    budget?: number
    maxSquad?: number
    minSquad?: number
    managerUserId?: string | null
  } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 60) return jsonError('Team name must be 2–60 characters', 400)
    data.name = name
  }

  if (body.budget !== undefined) {
    const budget = coercePositiveInt(body.budget)
    if (!budget) return jsonError('Budget must be a positive integer (taka)', 400)
    if (budget < team.spent) {
      return jsonError('Budget cannot be lower than the amount already spent on players', 409)
    }
    data.budget = budget
  }

  const effectiveMax = body.maxSquad !== undefined ? coercePositiveInt(body.maxSquad) : team.maxSquad
  if (body.maxSquad !== undefined && !effectiveMax) {
    return jsonError('maxSquad must be a positive integer', 400)
  }
  if (body.maxSquad !== undefined) {
    // A squad cap below the players already bought would leave the team in a
    // state the auction engine can never satisfy.
    const bought = await db.player.count({ where: { soldToTeamId: id, status: 'SOLD' } })
    if ((effectiveMax as number) < bought) {
      return jsonError(`maxSquad cannot be lower than the ${bought} player(s) already bought`, 409)
    }
  }

  let effectiveMin = team.minSquad
  if (body.minSquad !== undefined) {
    const minSquad = coerceInt(body.minSquad)
    if (minSquad === null || minSquad < 0) return jsonError('minSquad must be a non-negative integer', 400)
    effectiveMin = minSquad
  }
  if (effectiveMin > (effectiveMax as number)) {
    return jsonError('minSquad cannot be greater than maxSquad', 400)
  }
  if (body.maxSquad !== undefined) data.maxSquad = effectiveMax as number
  if (body.minSquad !== undefined) data.minSquad = effectiveMin

  if (body.color !== undefined) {
    data.color = typeof body.color === 'string' && body.color.trim() !== '' ? body.color.trim().slice(0, 20) : null
  }
  if (body.captainName !== undefined) {
    data.captainName =
      typeof body.captainName === 'string' && body.captainName.trim() !== ''
        ? body.captainName.trim().slice(0, 60)
        : null
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl =
      typeof body.logoUrl === 'string' && body.logoUrl.trim() !== '' ? body.logoUrl.trim().slice(0, 500) : null
  }

  if (body.managerUserId !== undefined) {
    if (body.managerUserId === null || body.managerUserId === '') {
      data.managerUserId = null
    } else if (typeof body.managerUserId === 'string') {
      const manager = await db.user.findUnique({ where: { id: body.managerUserId } })
      if (!manager) return jsonError('Manager user not found', 400)
      if (manager.role !== 'MANAGER') {
        return jsonError('Only accounts registered as a team manager can be linked to a team', 400)
      }
      if (manager.status !== 'ACTIVE') {
        return jsonError('That manager account is blocked', 400)
      }
      const alreadyManaging = await db.team.findFirst({
        where: { tournamentId: team.tournamentId, managerUserId: manager.id, id: { not: team.id } },
        select: { name: true },
      })
      if (alreadyManaging) {
        return jsonError(`${manager.name} already manages "${alreadyManaging.name}" in this tournament`, 409)
      }
      data.managerUserId = manager.id
    } else {
      return jsonError('managerUserId must be a user id or null', 400)
    }
  }

  if (Object.keys(data).length === 0) return jsonError('No valid fields to update', 400)

  const updated = await db.team.update({
    where: { id },
    data,
    include: {
      _count: { select: { players: { where: { status: 'SOLD' } } } },
      manager: { select: { name: true, email: true } },
    },
  })
  return Response.json({ team: serializeTeam(updated) })
}

// DELETE /api/teams/:id — blocked when the team has sold players
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTeamForOwner(id, user)
  if ('response' in loaded) return loaded.response

  const soldCount = await db.player.count({ where: { soldToTeamId: id, status: 'SOLD' } })
  if (soldCount > 0) {
    return jsonError('Cannot delete a team that has bought players', 409)
  }

  await db.team.delete({ where: { id } })
  return Response.json({ ok: true })
}
