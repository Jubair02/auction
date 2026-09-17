// ============================================================
// NeelamGhor — shared guards/serializers for API route handlers.
// Private folder (leading underscore) — never routed by Next.js.
// ============================================================
import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import type {
  AuctionDTO,
  AuctionMode,
  AuctionStatus,
  PlayerDTO,
  PlayerStatus,
  SafeUser,
  Sport,
  TeamDTO,
  TournamentStatus,
  TournamentSummary,
} from '@/lib/types'
import type { Auction, Player, Team, Tournament } from '@prisma/client'

// ---------- Body parsing ----------
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

// ---------- Auth guards ----------
export async function requireSession(): Promise<{ user: SafeUser } | { response: Response }> {
  const user = await getSessionUser()
  if (!user) return { response: jsonError('You must be logged in', 401) }
  return { user }
}

export async function requireSessionRole(
  ...roles: string[]
): Promise<{ user: SafeUser } | { response: Response }> {
  const result = await requireSession()
  if ('response' in result) return result
  if (!roles.includes(result.user.role)) {
    return { response: jsonError('You do not have permission for this action', 403) }
  }
  return result
}

export function isOwnerOrAdmin(tournament: Pick<Tournament, 'organizerId'>, user: SafeUser): boolean {
  return user.role === 'ADMIN' || tournament.organizerId === user.id
}

/** Loads a tournament and verifies the user is its organizer or an ADMIN. */
export async function loadTournamentForOwner(
  tournamentId: string,
  user: SafeUser,
): Promise<{ tournament: Tournament } | { response: Response }> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } })
  if (!tournament) return { response: jsonError('Tournament not found', 404) }
  if (!isOwnerOrAdmin(tournament, user)) {
    return { response: jsonError('You do not have permission to manage this tournament', 403) }
  }
  return { tournament }
}

/** Loads a player and verifies the caller manages its tournament (owner or ADMIN). */
export async function loadPlayerForOwner(
  playerId: string,
  user: SafeUser,
): Promise<{ player: Player } | { response: Response }> {
  const player = await db.player.findUnique({ where: { id: playerId } })
  if (!player) return { response: jsonError('Player not found', 404) }
  const tournament = await db.tournament.findUnique({ where: { id: player.tournamentId } })
  if (!tournament) return { response: jsonError('Tournament not found', 404) }
  if (!isOwnerOrAdmin(tournament, user)) {
    return { response: jsonError('You do not have permission to manage this player', 403) }
  }
  return { player }
}

/** Loads a team and verifies the caller manages its tournament (owner or ADMIN). */
export async function loadTeamForOwner(
  teamId: string,
  user: SafeUser,
): Promise<{ team: Team } | { response: Response }> {
  const team = await db.team.findUnique({ where: { id: teamId } })
  if (!team) return { response: jsonError('Team not found', 404) }
  const tournament = await db.tournament.findUnique({ where: { id: team.tournamentId } })
  if (!tournament) return { response: jsonError('Tournament not found', 404) }
  if (!isOwnerOrAdmin(tournament, user)) {
    return { response: jsonError('You do not have permission to manage this team', 403) }
  }
  return { team }
}

// ---------- Coercion / validation ----------
/** Strict integer coercion (number or numeric string). Returns null when not an integer. */
export function coerceInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null
  if (typeof value === 'string') {
    const s = value.trim()
    if (!/^-?\d+$/.test(s)) return null
    return Number.parseInt(s, 10)
  }
  return null
}

export function coercePositiveInt(value: unknown): number | null {
  const n = coerceInt(value)
  return n !== null && n > 0 ? n : null
}

/** Clamps an integer-ish input into [min, max]; falls back when unparseable. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  let n: number
  if (typeof value === 'number') n = Math.round(value)
  else if (typeof value === 'string' && value.trim() !== '') n = Number.parseInt(value.trim(), 10)
  else return fallback
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Accepts ISO strings / Date-ish input → Date; null/'' clears; invalid → error flag. */
export function parseDateInput(value: unknown): { ok: true; date: Date | null } | { ok: false } {
  if (value === undefined || value === null || value === '') return { ok: true, date: null }
  if (typeof value !== 'string' && !(value instanceof Date)) return { ok: false }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return { ok: false }
  return { ok: true, date: d }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const CATEGORY_RE = /^[A-E]$/

/** false = provided but invalid; null = absent; 'A'-'E' = valid. */
export function normalizeCategory(value: unknown): string | null | false {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return false
  const s = value.trim().toUpperCase()
  if (!CATEGORY_RE.test(s)) return false
  return s
}

// ---------- Serializers ----------
export function toSafeUser(u: {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  status: string
  createdAt: Date
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }
}

export function serializeAuction(a: Auction): AuctionDTO {
  return {
    id: a.id,
    tournamentId: a.tournamentId,
    roomCode: a.roomCode,
    status: a.status as AuctionStatus,
    bidTimerSeconds: a.bidTimerSeconds,
    goingIntervalSeconds: a.goingIntervalSeconds,
    minIncrement: a.minIncrement,
    currentCategory: a.currentCategory,
    bidCount: a.bidCount,
  }
}

export function serializeTeam(t: Team & { _count?: { players: number } }): TeamDTO {
  const squadCount = t._count?.players ?? 0
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    name: t.name,
    logoUrl: t.logoUrl,
    color: t.color,
    captainName: t.captainName,
    managerUserId: t.managerUserId,
    budget: t.budget,
    maxSquad: t.maxSquad,
    minSquad: t.minSquad,
    spent: t.spent,
    remaining: t.budget - t.spent,
    squadCount,
  }
}

export function serializePlayer(p: Player & { soldToTeam?: { name: string } | null }): PlayerDTO {
  return {
    id: p.id,
    tournamentId: p.tournamentId,
    name: p.name,
    photoUrl: p.photoUrl,
    phone: p.phone,
    role: p.role,
    category: p.category,
    basePrice: p.basePrice,
    previousTeam: p.previousTeam,
    status: p.status as PlayerStatus,
    playerNumber: p.playerNumber,
    soldPrice: p.soldPrice,
    soldToTeamId: p.soldToTeamId,
    soldToTeamName: p.soldToTeam?.name ?? null,
  }
}

/** Tournament row (+ optional auction/_count/soldCount) → TournamentSummary DTO. */
export function serializeTournamentSummary(
  t: Tournament & {
    auction?: { roomCode: string; status: string } | null
    _count?: { players: number; teams: number }
    soldCount?: number
  },
): TournamentSummary {
  return {
    id: t.id,
    name: t.name,
    sport: t.sport as Sport,
    tournamentType: t.tournamentType,
    location: t.location,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    auctionAt: t.auctionAt ? t.auctionAt.toISOString() : null,
    auctionMode: t.auctionMode as AuctionMode,
    basePrice: t.basePrice,
    status: t.status as TournamentStatus,
    organizerId: t.organizerId,
    createdAt: t.createdAt.toISOString(),
    playerCount: t._count?.players ?? 0,
    soldCount: t.soldCount ?? 0,
    teamCount: t._count?.teams ?? 0,
    roomCode: t.auction?.roomCode ?? null,
    auctionStatus: (t.auction?.status as AuctionStatus) ?? null,
  }
}

/** Full tournament object for detail endpoints (includes description/logo/banner). */
export function serializeTournamentFull(t: Tournament) {
  return {
    id: t.id,
    name: t.name,
    sport: t.sport as Sport,
    tournamentType: t.tournamentType,
    description: t.description,
    logoUrl: t.logoUrl,
    bannerUrl: t.bannerUrl,
    location: t.location,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    auctionAt: t.auctionAt ? t.auctionAt.toISOString() : null,
    auctionMode: t.auctionMode as AuctionMode,
    basePrice: t.basePrice,
    status: t.status as TournamentStatus,
    organizerId: t.organizerId,
    createdAt: t.createdAt.toISOString(),
  }
}

/** Sold counts per tournament id (single groupBy query instead of N queries). */
export async function soldCountsByTournament(tournamentIds: string[]): Promise<Map<string, number>> {
  if (tournamentIds.length === 0) return new Map()
  const grouped = await db.player.groupBy({
    by: ['tournamentId'],
    where: { status: 'SOLD', tournamentId: { in: tournamentIds } },
    _count: { _all: true },
  })
  const map = new Map<string, number>()
  for (const g of grouped) map.set(g.tournamentId, g._count._all)
  return map
}
