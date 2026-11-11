import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { parseCsvObjects } from '@/lib/csv'
import { normalizeBdPhone } from '@/lib/phone'
import { assertWithinPlan } from '@/lib/plans'
import { DEFAULT_CATEGORY_BASE_PRICES } from '@/lib/types'
import {
  coercePositiveInt,
  insertPlayersNumbered,
  loadTournamentForOwner,
  normalizeCategory,
  readJson,
  requireSession,
} from '../../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const MAX_ROWS = 2000

/** Returns the first non-empty value among the given header keys. */
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function strOrNull(v: string, max: number): string | null {
  const s = v.trim()
  return s === '' ? null : s.slice(0, max)
}

/** Same phone = same person: canonical BD mobile, else just the digits. */
function phoneKey(phone: string | null): string | null {
  if (!phone) return null
  const bd = normalizeBdPhone(phone)
  if (bd) return bd
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 6 ? digits : null
}

function nameRoleKey(name: string, role: string): string {
  return `${name.trim().replace(/\s+/g, ' ').toLowerCase()}|${role.trim().toLowerCase()}`
}

interface ImportData {
  name: string
  phone: string | null
  role: string
  category: string | null
  basePrice: number | null
  previousTeam: string | null
}

interface RowResult {
  /** Spreadsheet row number (the header is row 1). */
  row: number
  ok: boolean
  errors: string[]
  duplicateOf?: 'existing' | 'file'
  data: ImportData
}

/**
 * POST /api/tournaments/:id/players/import — CSV bulk import (owner/ADMIN/co-organizer), Pro tournaments only (402 on Free).
 *
 * Body: `{ csv }` (CSV text) or `{ rows }` (objects keyed by lower-cased header —
 * name, phone, role, category, baseprice, previousteam — plus an optional `row`
 * number), and optionally:
 *   - `dryRun: true` → validate only: `{ dryRun, results: RowResult[], counts }`
 *     where a duplicate is the same phone, or the same name + role, as a player
 *     already in the tournament ('existing') or an earlier row ('file').
 *   - `skipDuplicates: true` → leave duplicate rows out of a real import.
 * A real import returns `{ created, skipped, errors: [{row, error}] }`; all
 * valid rows land together or not at all. 402 when it would pass the Free plan.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user, 'manage')
  if ('response' in loaded) return loaded.response
  const tournament = loaded.tournament

  // CSV import (preview included) is a Pro feature. Free tournaments add players one by one.
  if (tournament.plan !== 'PRO') {
    return jsonError('CSV import is not available on the Free plan. Upgrade this tournament to Pro to import players from a CSV file.', 402)
  }

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)
  const dryRun = body.dryRun === true
  const skipDuplicates = body.skipDuplicates === true

  // Normalize both input shapes to [{ row, fields }].
  let input: { row: number; fields: Record<string, unknown> }[]
  if (Array.isArray(body.rows)) {
    if (body.rows.length > MAX_ROWS) return jsonError(`CSV cannot contain more than ${MAX_ROWS} data rows`, 400)
    input = []
    for (let i = 0; i < body.rows.length; i++) {
      const r: unknown = body.rows[i]
      if (!r || typeof r !== 'object' || Array.isArray(r)) return jsonError('Each row must be an object', 400)
      const fields = r as Record<string, unknown>
      const n = typeof fields.row === 'number' && Number.isInteger(fields.row) && fields.row > 0 ? fields.row : i + 2
      input.push({ row: n, fields })
    }
  } else if (typeof body.csv === 'string' && body.csv.trim() !== '') {
    const { rows } = parseCsvObjects(body.csv)
    if (rows.length > MAX_ROWS) return jsonError(`CSV cannot contain more than ${MAX_ROWS} data rows`, 400)
    input = rows.map((fields, i) => ({ row: i + 2, fields })) // header is row 1
  } else {
    return jsonError('Provide a "csv" string or "rows" with your player data', 400)
  }

  // ---------- validate ----------
  const results: RowResult[] = []
  for (const { row, fields } of input) {
    const name = pick(fields, ['name'])
    const role = pick(fields, ['role'])
    const phone = strOrNull(pick(fields, ['phone']), 20)
    const previousTeam = strOrNull(pick(fields, ['previousteam', 'previous_team']), 80)
    const rawCategory = pick(fields, ['category'])
    const rawBasePrice = pick(fields, ['baseprice', 'base_price'])

    // Fully empty rows are skipped silently.
    if (name === '' && role === '' && rawCategory === '' && rawBasePrice === '' && phone === null && previousTeam === null) {
      continue
    }

    const errors: string[] = []
    if (name === '') errors.push('Missing name')
    if (role === '') errors.push('Missing role')

    const category = normalizeCategory(rawCategory)
    if (category === false) errors.push('Category must be one of A, B, C, D, E')

    let basePrice: number | null
    if (rawBasePrice === '') {
      // Fallback: category price in CATEGORY mode, otherwise tournament default
      basePrice =
        tournament.auctionMode === 'CATEGORY' && category && DEFAULT_CATEGORY_BASE_PRICES[category]
          ? DEFAULT_CATEGORY_BASE_PRICES[category]
          : tournament.basePrice
    } else {
      basePrice = coercePositiveInt(rawBasePrice)
      if (!basePrice) errors.push(`Invalid base price "${rawBasePrice.slice(0, 20)}"`)
    }

    results.push({
      row,
      ok: errors.length === 0,
      errors,
      data: {
        name: name.slice(0, 80),
        phone,
        role: role.slice(0, 40),
        category: category === false ? null : category,
        basePrice,
        previousTeam,
      },
    })
  }

  // ---------- duplicates ----------
  if (dryRun || skipDuplicates) {
    const existing = await db.player.findMany({ where: { tournamentId: id }, select: { name: true, role: true, phone: true } })
    const existingPhones = new Set(existing.map((p) => phoneKey(p.phone)).filter((k): k is string => k !== null))
    const existingNames = new Set(existing.map((p) => nameRoleKey(p.name, p.role)))
    const filePhones = new Set<string>()
    const fileNames = new Set<string>()
    for (const r of results) {
      if (!r.ok) continue
      const pk = phoneKey(r.data.phone)
      const nk = nameRoleKey(r.data.name, r.data.role)
      if ((pk && existingPhones.has(pk)) || existingNames.has(nk)) r.duplicateOf = 'existing'
      else if ((pk && filePhones.has(pk)) || fileNames.has(nk)) r.duplicateOf = 'file'
      if (pk) filePhones.add(pk)
      fileNames.add(nk)
    }
  }

  if (dryRun) {
    const counts = {
      total: results.length,
      ready: results.filter((r) => r.ok && !r.duplicateOf).length,
      withErrors: results.filter((r) => !r.ok).length,
      duplicates: results.filter((r) => r.duplicateOf).length,
    }
    return Response.json({ dryRun: true, results, counts })
  }

  // ---------- import ----------
  const errors = results.filter((r) => !r.ok).map((r) => ({ row: r.row, error: r.errors.join('; ') }))
  const toInsert = results.filter((r) => r.ok && !(skipDuplicates && r.duplicateOf))
  const skipped = results.length - errors.length - toInsert.length

  if (toInsert.length > 0) {
    const overPlan = await assertWithinPlan(tournament, { players: toInsert.length })
    if (overPlan) return overPlan
    // All valid rows land together or not at all — no half-imported sheet.
    const inserted = await insertPlayersNumbered(
      tournament,
      toInsert.map((r) => ({ ...r.data, basePrice: r.data.basePrice! })),
    )
    if (inserted instanceof Response) return inserted
  }

  return Response.json({ created: toInsert.length, skipped, errors })
}
