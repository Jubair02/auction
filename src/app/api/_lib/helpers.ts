// ============================================================
// NeelamGhor — shared guards/serializers for API route handlers.
// Private folder (leading underscore) — never routed by Next.js.
// ============================================================
import { db, type DbTx } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import { assertWithinPlan, lockRoster } from '@/lib/plans'
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
  LeagueFormat,
} from '@/lib/types'
import { OTHER_SPORT_LIMITS } from '@/lib/types'
import { Prisma } from '@prisma/client'
import type { Auction, Player, Team, Tournament } from '@prisma/client'

// ---------- Body parsing ----------
/**
 * Parses a JSON object body. Requires `Content-Type: application/json`: a
 * cross-site HTML form can only send form/text content types without a CORS
 * preflight, so this check stops login CSRF and other forged form posts even
 * where the SameSite cookie would not (e.g. a login that has no cookie yet).
 * Returns null for any other content type, a non-object, or invalid JSON.
 */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) return null
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

/**
 * Archived tournaments (deleted by their organizer, kept for the audit trail)
 * behave as if they no longer exist for everyone except an ADMIN.
 */
export function hiddenByArchive(tournament: Pick<Tournament, 'archivedAt'>, user: SafeUser | null): boolean {
  return tournament.archivedAt !== null && user?.role !== 'ADMIN'
}

/** Staff access levels, see TournamentAccess in lib/types.ts. */
export type StaffAccess = 'OWNER' | 'ADMIN' | 'CO_ORGANIZER' | 'AUCTIONEER'
/**
 * What a route needs: 'owner' — billing, staff, deletion; 'manage' — edit teams,
 * players, settings; 'run' — view the tournament and run the live room.
 */
export type AccessNeed = 'owner' | 'manage' | 'run'

const ACCESS_RANK: Record<StaffAccess, number> = { AUCTIONEER: 1, CO_ORGANIZER: 2, OWNER: 3, ADMIN: 3 }
const NEED_RANK: Record<AccessNeed, number> = { run: 1, manage: 2, owner: 3 }

/** The user's staff-level access to a tournament, or null (none / only a manager). */
export async function tournamentAccess(
  tournament: Pick<Tournament, 'id' | 'organizerId'>,
  user: SafeUser,
): Promise<StaffAccess | null> {
  if (user.role === 'ADMIN') return 'ADMIN'
  if (tournament.organizerId === user.id) return 'OWNER'
  const staff = await db.tournamentStaff.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId: user.id } },
    select: { role: true },
  })
  return staff?.role === 'CO_ORGANIZER' || staff?.role === 'AUCTIONEER' ? staff.role : null
}

export function accessAllows(access: StaffAccess | null, need: AccessNeed): boolean {
  return access !== null && ACCESS_RANK[access] >= NEED_RANK[need]
}

/**
 * Loads a tournament and verifies the user's access: by default 'manage'
 * (owner, ADMIN or co-organizer). Use 'owner' for billing/staff/deletion and
 * 'run' for read + live room.
 */
export async function loadTournamentForOwner(
  tournamentId: string,
  user: SafeUser,
  need: AccessNeed = 'manage',
): Promise<{ tournament: Tournament; access: StaffAccess } | { response: Response }> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } })
  if (!tournament || hiddenByArchive(tournament, user)) return { response: jsonError('Tournament not found', 404) }
  const access = await tournamentAccess(tournament, user)
  if (!accessAllows(access, need)) {
    return { response: jsonError('You do not have permission to manage this tournament', 403) }
  }
  return { tournament, access: access! }
}

/** Loads a player and verifies the caller manages its tournament (owner or ADMIN). */
export async function loadPlayerForOwner(
  playerId: string,
  user: SafeUser,
): Promise<{ player: Player } | { response: Response }> {
  const player = await db.player.findUnique({ where: { id: playerId } })
  if (!player) return { response: jsonError('Player not found', 404) }
  const tournament = await db.tournament.findUnique({ where: { id: player.tournamentId } })
  if (!tournament || hiddenByArchive(tournament, user)) return { response: jsonError('Tournament not found', 404) }
  if (!accessAllows(await tournamentAccess(tournament, user), 'manage')) {
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
  if (!tournament || hiddenByArchive(tournament, user)) return { response: jsonError('Tournament not found', 404) }
  if (!accessAllows(await tournamentAccess(tournament, user), 'manage')) {
    return { response: jsonError('You do not have permission to manage this team', 403) }
  }
  return { team }
}

/**
 * True while the live engine owns this tournament's data (auction LIVE or
 * PAUSED). Destructive REST edits then race the engine's in-memory state —
 * e.g. deleting the team that holds the current bid wedges the sale.
 */
export async function auctionInProgress(tournamentId: string): Promise<boolean> {
  const auction = await db.auction.findUnique({ where: { tournamentId }, select: { status: true } })
  return auction?.status === 'LIVE' || auction?.status === 'PAUSED'
}

export type NewPlayerInput = Omit<Prisma.PlayerCreateManyInput, 'tournamentId' | 'playerNumber' | 'status'>

/** Ends a roster transaction with a ready-made response (rolls everything back). */
export class RosterRefusal extends Error {
  constructor(readonly response: Response) {
    super('roster change refused')
  }
}

/**
 * Inserts players with the next free player numbers, all or nothing, in ONE
 * transaction that holds the tournament's roster lock (lockRoster):
 *  - the Free-plan player limit is checked inside it, so parallel requests
 *    can't overshoot it, and numbering can't collide;
 *  - `rows` may be a function that prepares them inside the transaction (e.g.
 *    claiming registrations), and `after` runs before commit (e.g. linking
 *    registrations to the new players) — a failure anywhere undoes it all.
 * Throw RosterRefusal from `rows`/`after` to answer with that response.
 * Returns the players (in input order), or the response to send.
 */
export async function insertPlayersNumbered(
  tournament: { id: string; plan: string },
  rows: NewPlayerInput[] | ((tx: DbTx) => Promise<NewPlayerInput[]>),
  after?: (tx: DbTx, created: Player[]) => Promise<void>,
): Promise<Player[] | Response> {
  try {
    return await db.$transaction(
      async (tx) => {
        await lockRoster(tx, tournament.id)
        const list = typeof rows === 'function' ? await rows(tx) : rows
        if (list.length === 0) return []
        const overLimit = await assertWithinPlan(tournament, { players: list.length }, tx)
        if (overLimit) throw new RosterRefusal(overLimit)
        const maxAgg = await tx.player.aggregate({ where: { tournamentId: tournament.id }, _max: { playerNumber: true } })
        let nextNumber = (maxAgg._max.playerNumber ?? 0) + 1
        const created = (
          await tx.player.createManyAndReturn({
            data: list.map((p) => ({ ...p, tournamentId: tournament.id, playerNumber: nextNumber++, status: 'AVAILABLE' })),
          })
        ).sort((a, b) => a.playerNumber - b.playerNumber)
        if (after) await after(tx, created)
        return created
      },
      { timeout: 20_000 },
    )
  } catch (e) {
    if (e instanceof RosterRefusal) return e.response
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return jsonError(PLAYER_NUMBER_CONFLICT, 409)
    throw e
  }
}

export const PLAYER_NUMBER_CONFLICT = 'Another player upload for this tournament finished at the same moment. Please try again.'

/** A unique-constraint violation (P2002) — e.g. a second team for the same manager in one tournament. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export const ONE_TEAM_PER_MANAGER = 'You already manage a team in this tournament — a manager can run only one team.'

// ---------- Coercion / validation ----------
/** Strict integer coercion (number or numeric string). Returns null when not an integer. */
export function coerceInt(value: unknown): number | null {
  let n: number | null = null
  if (typeof value === 'number') n = Number.isInteger(value) ? value : null
  else if (typeof value === 'string') {
    const s = value.trim()
    if (/^-?\d+$/.test(s)) n = Number.parseInt(s, 10)
  }
  // Prisma Int columns are Postgres int4 (max 2,147,483,647): anything larger
  // used to crash the write with a 500 instead of a validation error.
  return n !== null && Math.abs(n) <= MAX_AMOUNT ? n : null
}

/** Our own uploaded images (re-encoded WebP, served from /api/uploads/:id). */
export const UPLOAD_URL_RE = /^\/api\/uploads\/[a-z0-9]{20,40}$/i
export const IMAGE_URL_ERROR = 'Upload the image here instead of pasting a link to another site'

/**
 * Image fields (logos, banners, player photos) are shown to anonymous room
 * viewers, so only our own uploads are accepted — an arbitrary URL could be a
 * tracking pixel that logs every viewer's IP address.
 * undefined = not provided · null = clear it · string = valid · false = rejected
 */
export function parseImageUrl(value: unknown): string | null | undefined | false {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return false
  const s = value.trim()
  if (s === '') return null
  return UPLOAD_URL_RE.test(s) ? s : false
}

/** Largest amount / count accepted from clients: ৳100 crore. */
export const MAX_AMOUNT = 1_000_000_000
export const MAX_AMOUNT_LABEL = '৳1,000,000,000'

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
    allowPreviousOwnerRebid: a.allowPreviousOwnerRebid,
    allowOpenClaim: a.allowOpenClaim,
    autoAdvance: a.autoAdvance,
  }
}

export function serializeTeam(
  t: Team & { _count?: { players: number }; manager?: { name: string; email: string } | null },
): TeamDTO {
  const squadCount = t._count?.players ?? 0
  return {
    id: t.id,
    tournamentId: t.tournamentId,
    name: t.name,
    logoUrl: t.logoUrl,
    color: t.color,
    captainName: t.captainName,
    managerUserId: t.managerUserId,
    managerName: t.manager?.name ?? null,
    managerEmail: t.manager?.email ?? null,
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
    ...otherSportDetails(t),
    playerCount: t._count?.players ?? 0,
    soldCount: t.soldCount ?? 0,
    teamCount: t._count?.teams ?? 0,
    roomCode: t.auction?.roomCode ?? null,
    auctionStatus: (t.auction?.status as AuctionStatus) ?? null,
    plan: t.plan === 'PRO' ? 'PRO' : 'FREE',
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
    ...otherSportDetails(t),
    plan: (t.plan === 'PRO' ? 'PRO' : 'FREE') as 'FREE' | 'PRO',
    proSince: t.proSince ? t.proSince.toISOString() : null,
    resultsPublic: t.resultsPublic,
    registrationFee: t.registrationFee,
    feeBkashNumber: t.feeBkashNumber,
    feeNagadNumber: t.feeNagadNumber,
    feeInstructions: t.feeInstructions,
    smsEnabled: t.smsEnabled,
    smsLang: (t.smsLang === 'en' ? 'en' : 'bn') as 'bn' | 'en',
    leagueFormat: (t.leagueFormat ?? null) as LeagueFormat | null,
    pointsWin: t.pointsWin,
    pointsDraw: t.pointsDraw,
    pointsLoss: t.pointsLoss,
    oversPerInnings: t.oversPerInnings,
    brandColor: t.brandColor,
    brandHidePlatform: t.brandHidePlatform,
  }
}

/** The "Others" fields every tournament DTO carries (empty for cricket/football). */
function otherSportDetails(t: Tournament) {
  return {
    sportName: t.sportName,
    playerRoles: t.playerRoles ?? [],
    playersPerTeam: t.playersPerTeam,
    playersOnField: t.playersOnField,
  }
}

/**
 * Validates an "Others" tournament's details from a request body. Returns the
 * database fields, or an error message. For cricket/football it clears them.
 * `requireName`: creating needs the game's name; an edit may leave it as is.
 */
export function parseOtherSportDetails(
  sport: string,
  body: Record<string, unknown>,
  requireName: boolean,
):
  | { ok: true; data: { sportName?: string | null; playerRoles?: string[]; playersPerTeam?: number | null; playersOnField?: number | null } }
  | { ok: false; error: string } {
  if (sport !== 'OTHER') {
    return { ok: true, data: { sportName: null, playerRoles: [], playersPerTeam: null, playersOnField: null } }
  }
  const data: { sportName?: string | null; playerRoles?: string[]; playersPerTeam?: number | null; playersOnField?: number | null } = {}

  if (body.sportName !== undefined || requireName) {
    const name = typeof body.sportName === 'string' ? body.sportName.trim() : ''
    if (name.length < 2 || name.length > OTHER_SPORT_LIMITS.nameMax) {
      return { ok: false, error: `Sport name must be 2–${OTHER_SPORT_LIMITS.nameMax} characters` }
    }
    data.sportName = name
  }

  if (body.playerRoles !== undefined) {
    if (!Array.isArray(body.playerRoles)) return { ok: false, error: 'Player roles must be a list' }
    const roles: string[] = []
    for (const r of body.playerRoles) {
      const role = typeof r === 'string' ? r.trim() : ''
      if (!role) continue
      if (role.length > OTHER_SPORT_LIMITS.roleMax) {
        return { ok: false, error: `Each role must be at most ${OTHER_SPORT_LIMITS.roleMax} characters` }
      }
      if (!roles.some((x) => x.toLowerCase() === role.toLowerCase())) roles.push(role)
    }
    if (roles.length > OTHER_SPORT_LIMITS.roles) return { ok: false, error: `At most ${OTHER_SPORT_LIMITS.roles} player roles` }
    data.playerRoles = roles
  }

  const size = (v: unknown, label: string): number | null | string => {
    if (v === undefined || v === null || v === '') return null
    const n = coercePositiveInt(v)
    if (!n || n > OTHER_SPORT_LIMITS.teamMax) return `${label} must be between 1 and ${OTHER_SPORT_LIMITS.teamMax}`
    return n
  }
  if (body.playersPerTeam !== undefined) {
    const n = size(body.playersPerTeam, 'Players per team')
    if (typeof n === 'string') return { ok: false, error: n }
    data.playersPerTeam = n
  }
  if (body.playersOnField !== undefined) {
    const n = size(body.playersOnField, 'Playing on field')
    if (typeof n === 'string') return { ok: false, error: n }
    data.playersOnField = n
  }
  if (data.playersPerTeam && data.playersOnField && data.playersOnField > data.playersPerTeam) {
    return { ok: false, error: 'Playing on field cannot be more than players per team' }
  }
  return { ok: true, data }
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
