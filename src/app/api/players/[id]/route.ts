import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import {
  coercePositiveInt,
  loadPlayerForOwner,
  normalizeCategory,
  readJson,
  requireSession,
  serializePlayer,
} from '../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// PATCH /api/players/:id — owner/ADMIN; blocked while the player is on the block (LIVE)
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadPlayerForOwner(id, user)
  if ('response' in loaded) return loaded.response
  const player = loaded.player

  if (player.status === 'LIVE') return jsonError('Player is on the block right now', 409)

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const data: {
    name?: string
    phone?: string | null
    role?: string
    category?: string | null
    basePrice?: number
    previousTeam?: string | null
    photoUrl?: string | null
  } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 80) return jsonError('Name must be 2–80 characters', 400)
    data.name = name
  }

  if (body.role !== undefined) {
    const role = typeof body.role === 'string' ? body.role.trim() : ''
    if (role === '') return jsonError('Role is required', 400)
    data.role = role.slice(0, 40)
  }

  if (body.category !== undefined) {
    const category = normalizeCategory(body.category)
    if (category === false) return jsonError('Category must be one of A, B, C, D, E', 400)
    data.category = category
  }

  if (body.basePrice !== undefined) {
    const basePrice = coercePositiveInt(body.basePrice)
    if (!basePrice) return jsonError('Base price must be a positive integer (taka)', 400)
    data.basePrice = basePrice
  }

  const nullableString = (key: 'phone' | 'previousTeam' | 'photoUrl', max: number) => {
    if (body[key] === undefined) return
    if (body[key] === null) {
      data[key] = null
      return
    }
    if (typeof body[key] !== 'string') return
    const s = (body[key] as string).trim()
    data[key] = s === '' ? null : s.slice(0, max)
  }
  nullableString('phone', 20)
  nullableString('previousTeam', 80)
  nullableString('photoUrl', 500)

  if (Object.keys(data).length === 0) return jsonError('No valid fields to update', 400)

  const updated = await db.player.update({
    where: { id },
    data,
    include: { soldToTeam: { select: { name: true } } },
  })
  return Response.json({ player: serializePlayer(updated) })
}

// DELETE /api/players/:id — blocked when LIVE or SOLD
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadPlayerForOwner(id, user)
  if ('response' in loaded) return loaded.response
  const player = loaded.player

  if (player.status === 'LIVE') return jsonError('Player is on the block right now', 409)
  if (player.status === 'SOLD') return jsonError('Cannot delete a player who has been sold', 409)

  await db.player.delete({ where: { id } })
  return Response.json({ ok: true })
}
