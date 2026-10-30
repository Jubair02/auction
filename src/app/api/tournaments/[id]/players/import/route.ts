import { jsonError } from '@/lib/auth'
import { parseCsvObjects } from '@/lib/csv'
import { DEFAULT_CATEGORY_BASE_PRICES } from '@/lib/types'
import {
  coercePositiveInt,
  insertPlayersNumbered,
  loadTournamentForOwner,
  PLAYER_NUMBER_CONFLICT,
  normalizeCategory,
  readJson,
  requireSession,
} from '../../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

/** Returns the first non-empty value among the given header keys. */
function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return ''
}

function strOrNull(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s === '' ? null : s.slice(0, max)
}

// POST /api/tournaments/:id/players/import — CSV bulk import (owner/ADMIN)
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user)
  if ('response' in loaded) return loaded.response
  const tournament = loaded.tournament

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  if (typeof body.csv !== 'string' || body.csv.trim() === '') {
    return jsonError('Provide a "csv" string with your player data', 400)
  }

  const { rows } = parseCsvObjects(body.csv)
  if (rows.length === 0) return Response.json({ created: 0, errors: [] })

  if (rows.length > 2000) return jsonError('CSV cannot contain more than 2000 data rows', 400)

  const errors: { row: number; error: string }[] = []
  interface ValidRow {
    name: string
    phone: string | null
    role: string
    category: string | null
    basePrice: number
    previousTeam: string | null
  }
  const valid: ValidRow[] = []

  rows.forEach((row, i) => {
    const rowNumber = i + 2 // header is row 1
    const name = (row['name'] ?? '').trim()
    const role = (row['role'] ?? '').trim()
    const phone = strOrNull(row['phone'], 20)
    const previousTeam = strOrNull(pick(row, ['previousteam', 'previous_team']), 80)
    const rawCategory = (row['category'] ?? '').trim()
    const rawBasePrice = pick(row, ['baseprice', 'base_price'])

    if (name === '' && role === '' && rawCategory === '' && rawBasePrice === '' && phone === null) {
      return // skip fully empty rows silently
    }
    if (name === '') {
      errors.push({ row: rowNumber, error: 'Missing name' })
      return
    }
    if (role === '') {
      errors.push({ row: rowNumber, error: 'Missing role' })
      return
    }

    const category = normalizeCategory(rawCategory)
    if (category === false) {
      errors.push({ row: rowNumber, error: 'Category must be one of A, B, C, D, E' })
      return
    }

    let basePrice: number
    if (rawBasePrice === '') {
      // Fallback: category price in CATEGORY mode, otherwise tournament default
      if (tournament.auctionMode === 'CATEGORY' && category && DEFAULT_CATEGORY_BASE_PRICES[category]) {
        basePrice = DEFAULT_CATEGORY_BASE_PRICES[category]
      } else {
        basePrice = tournament.basePrice
      }
    } else {
      const parsed = coercePositiveInt(rawBasePrice)
      if (!parsed) {
        errors.push({ row: rowNumber, error: `Invalid base price "${rawBasePrice}"` })
        return
      }
      basePrice = parsed
    }

    valid.push({
      name: name.slice(0, 80),
      phone,
      role: role.slice(0, 40),
      category,
      basePrice,
      previousTeam,
    })
  })

  if (valid.length > 0) {
    // All valid rows land together or not at all — no half-imported sheet.
    const inserted = await insertPlayersNumbered(id, valid)
    if (!inserted) return jsonError(PLAYER_NUMBER_CONFLICT, 409)
  }

  return Response.json({ created: valid.length, errors })
}
