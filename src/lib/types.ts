// ============================================================
// NeelamGhor — Shared contract types (single source of truth)
// Used by Next.js API routes, frontend components and the
// auction socket mini-service. DO NOT rename fields lightly —
// this is the frozen contract between Task 2-a/2-b/3-a/3-b.
// ============================================================

export type UserRole = 'ADMIN' | 'ORGANIZER' | 'MANAGER'
export type UserStatus = 'ACTIVE' | 'BLOCKED'
export type Sport = 'CRICKET' | 'FOOTBALL' | 'OTHER'
export type AuctionMode = 'CATEGORY' | 'NORMAL'
export type TournamentStatus = 'DRAFT' | 'READY' | 'LIVE' | 'COMPLETED'
export type PlayerStatus = 'AVAILABLE' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'SKIPPED'
export type AuctionStatus = 'READY' | 'LIVE' | 'PAUSED' | 'ENDED'
export type RoomRole = 'ORGANIZER' | 'MANAGER' | 'VIEWER'

export const CRICKET_ROLES = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'] as const
export const FOOTBALL_ROLES = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const
// "Others" covers any other sport or game (kabaddi, volleyball, hockey…): roles generic enough for most.
export const OTHER_ROLES = ['Attacker', 'Defender', 'All-rounder', 'Player'] as const

export const SPORTS: readonly Sport[] = ['CRICKET', 'FOOTBALL', 'OTHER']

export function isSport(value: unknown): value is Sport {
  return value === 'CRICKET' || value === 'FOOTBALL' || value === 'OTHER'
}

/** Player roles offered for a sport. */
export function rolesForSport(sport: string): readonly string[] {
  return sport === 'FOOTBALL' ? FOOTBALL_ROLES : sport === 'OTHER' ? OTHER_ROLES : CRICKET_ROLES
}

/** Player roles for a tournament: an "Others" tournament's own roles when it set any. */
export function rolesForTournament(t: { sport: string; playerRoles?: readonly string[] | null }): readonly string[] {
  return t.sport === 'OTHER' && t.playerRoles && t.playerRoles.length > 0 ? t.playerRoles : rolesForSport(t.sport)
}

/** Limits for an "Others" tournament's details (shared by the form and the API). */
export const OTHER_SPORT_LIMITS = { nameMax: 40, roles: 12, roleMax: 30, teamMax: 100 } as const

const SPORT_LABELS: Record<'en' | 'bn', Record<Sport, string>> = {
  en: { CRICKET: 'Cricket', FOOTBALL: 'Football', OTHER: 'Others' },
  bn: { CRICKET: 'ক্রিকেট', FOOTBALL: 'ফুটবল', OTHER: 'অন্যান্য' },
}

/**
 * Display name of a sport ("Cricket", "Football", "Others"). Pass an "Others"
 * tournament's sportName to show the game itself ("Kabaddi").
 */
export function sportLabel(sport: string, lang: 'en' | 'bn' = 'en', sportName?: string | null): string {
  if (sport === 'OTHER' && sportName) return sportName
  return SPORT_LABELS[lang][sport as Sport] ?? sport
}
export const CATEGORIES = ['A', 'B', 'C', 'D', 'E'] as const
export const DEFAULT_CATEGORY_BASE_PRICES: Record<string, number> = { A: 50000, B: 30000, C: 20000, D: 10000, E: 5000 }

export interface SafeUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
}

// ---------- Socket token identity ----------
export interface SocketIdentity {
  auctionId: string
  roomCode: string
  role: RoomRole
  name: string
  userId?: string
  /** The account's session version when the pass was issued; a later password reset invalidates the pass. */
  sv?: number
  teamId?: string
  teamName?: string
  exp?: number
}

// ---------- REST shapes ----------
export interface TournamentSummary {
  id: string
  name: string
  sport: Sport
  tournamentType: string | null
  location: string | null
  startDate: string | null
  auctionAt: string | null
  auctionMode: AuctionMode
  basePrice: number
  status: TournamentStatus
  organizerId: string
  createdAt: string
  /** "Others" only: the game (e.g. Kabaddi), its roles and team sizes. */
  sportName: string | null
  playerRoles: string[]
  playersPerTeam: number | null
  playersOnField: number | null
  playerCount: number
  soldCount: number
  teamCount: number
  roomCode: string | null
  auctionStatus: AuctionStatus | null
}

export interface PlayerDTO {
  id: string
  tournamentId: string
  name: string
  photoUrl: string | null
  phone: string | null
  role: string
  category: string | null
  basePrice: number
  previousTeam: string | null
  status: PlayerStatus
  playerNumber: number
  soldPrice: number | null
  soldToTeamId: string | null
  soldToTeamName?: string | null
}

export interface TeamDTO {
  id: string
  tournamentId: string
  name: string
  logoUrl: string | null
  color: string | null
  captainName: string | null
  managerUserId: string | null
  managerName?: string | null
  managerEmail?: string | null
  budget: number
  maxSquad: number
  minSquad: number
  spent: number
  remaining: number
  squadCount: number
}

export interface AuctionDTO {
  id: string
  tournamentId: string
  roomCode: string
  status: AuctionStatus
  bidTimerSeconds: number
  goingIntervalSeconds: number
  minIncrement: number
  currentCategory: string | null
  bidCount: number
  /** false = the team that lost a re-auctioned player may not bid for them again. */
  allowPreviousOwnerRebid: boolean
  /** true = any logged-in manager may claim an unassigned team in the room. */
  allowOpenClaim: boolean
  /** Auto Auction: the next player comes up automatically after each lot. */
  autoAdvance: boolean
}

export interface TournamentDetail {
  tournament: Omit<TournamentSummary, 'playerCount' | 'soldCount' | 'teamCount' | 'roomCode' | 'auctionStatus'> & {
    description: string | null
    logoUrl: string | null
    bannerUrl: string | null
  }
  players: PlayerDTO[]
  teams: TeamDTO[]
  auction: AuctionDTO | null
}

export interface RoomTeamInfo {
  id: string
  name: string
  color: string | null
  budget: number
  spent: number
  squadCount: number
  maxSquad: number
  minSquad: number
  captainName: string | null
  /** A manager account is linked to this team. (The account id itself is never sent to the public.) */
  claimed: boolean
  /** The team is linked to the logged-in viewer of this response. */
  isMine: boolean
}

export interface RoomInfo {
  roomCode: string
  auctionId: string
  tournamentId: string
  tournamentName: string
  sport: Sport
  mode: AuctionMode
  status: AuctionStatus
  teams: RoomTeamInfo[]
  myRole: 'organizer' | null
  /** true = any logged-in manager may claim an unassigned team from the join card. */
  allowOpenClaim: boolean
}

export interface JoinResult {
  socketToken: string
  identity: { role: RoomRole; name: string; teamId?: string; teamName?: string }
}

// ---------- Live auction room state (socket) ----------
export interface RoomPlayer {
  id: string
  /** 0 on the first outing; incremented by every re-auction. */
  auctionCycle?: number
  playerNumber: number
  name: string
  role: string
  category: string | null
  basePrice: number
  photoUrl: string | null
  previousTeam: string | null
  // No phone: room state is broadcast to anonymous viewers.
}

export interface RoomTeam {
  id: string
  name: string
  color: string | null
  logoUrl: string | null
  budget: number
  spent: number
  remaining: number
  /** Highest legal bid for the player on the block: remaining purse minus the
   *  amount that must stay back to still reach `minSquad`.
   *  Optional: older socket-service builds omit it. */
  maxBid?: number
  squadCount: number
  maxSquad: number
  minSquad: number
  online: boolean
}

export interface RoomPlayerLite {
  id: string
  playerNumber: number
  name: string
  role: string
  category: string | null
  basePrice: number
  status: PlayerStatus
  soldPrice: number | null
  /** 0 on the first outing; incremented by every re-auction. */
  auctionCycle?: number
  /** optional: older socket-service builds omit this */
  teamId?: string | null
  teamName: string | null
}

export interface RoomState {
  auctionId: string
  roomCode: string
  tournamentId: string
  tournamentName: string
  sport: Sport
  mode: AuctionMode
  status: 'READY' | 'LIVE' | 'PAUSED' | 'ENDED'
  currentCategory: string | null
  categories: { code: string; total: number; available: number; basePrice: number }[]
  currentPlayer: RoomPlayer | null
  currentBid: { amount: number; teamId: string; teamName: string; teamColor: string | null } | null
  currentBidHistory: { teamId: string; teamName: string; amount: number; createdAt: string }[]
  stage: 0 | 1 | 2 // 0 = bidding, 1 = GOING ONCE, 2 = GOING TWICE
  timerEndsAt: number | null
  serverTime: number
  pausedRemainingMs: number | null
  teams: RoomTeam[]
  /** Seats only — organizer and managers. Viewers are counted in viewersOnline. */
  participants: { name: string; role: RoomRole; teamId: string | null; online: boolean }[]
  /** Fingerprint of `participants`; broadcasts omit the list when it is unchanged. */
  participantsHash: string
  viewersOnline: number
  players: RoomPlayerLite[] // full pool with statuses (for organizer selection / re-auction / pools)
  /** Fingerprint of `players`; broadcasts omit the pool when it is unchanged. */
  playersHash: string
  pool: {
    total: number
    available: number
    sold: number
    unsold: number
    skipped: number
    /** Available players with no A–E category (CATEGORY mode only concern). */
    uncategorized: number
  }
  lastResult: {
    playerName: string
    playerNumber: number
    teamId: string | null
    teamName: string | null
    price: number | null
    type: 'SOLD' | 'UNSOLD'
    at: string
  } | null
  soldFeed: { playerName: string; teamName: string; price: number; at: string }[]
  minIncrement: number
  /** Configured bidding duration — applied to each NEW player's session. */
  bidTimerSeconds: number
  /** The duration locked in for the player on the block (bids reset the timer to this). */
  sessionTimerSeconds: number
  goingIntervalSeconds: number
  /** Auto Auction: the next player is brought to the block automatically. */
  autoAdvance: boolean
  /** 1 = the main auction; +1 for every "Re-Auction Unsold & Skipped Players" round. */
  round: number
  /** Epoch ms when Auto Auction will bring the next player up; null when nothing is scheduled. */
  nextPlayerAt: number | null
  /** Team locked out of the current cycle by the re-auction policy, if any. */
  previousOwnerTeamId?: string | null
  /** false = the team that lost a re-auctioned player may not bid for them again. */
  allowPreviousOwnerRebid?: boolean
}

/**
 * What `room_state` broadcasts carry: the full state, except that `players`
 * and `participants` are left out when unchanged (see the *Hash fields).
 * The join ack always carries the full RoomState.
 */
export type RoomStateWire = Omit<RoomState, 'players' | 'participants'> &
  Partial<Pick<RoomState, 'players' | 'participants'>>

export interface RoomNotification {
  id: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  at: string
}

export type OrganizerAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'next_player'
  | 'select_player'
  | 'set_category'
  | 'skip'
  | 'force_sell'
  | 'force_unsold'
  | 'reauction'
  | 'manual_bid'
  | 'end'
  | 'reopen'
  /** payload {enabled: boolean} — Auto Auction on/off; applies from the next transition */
  | 'set_auto_advance'
  /** payload {seconds: number} — bidding duration; applies from the next player */
  | 'set_bid_timer'
  /** Start the next round with only the UNSOLD and SKIPPED players (current round must be complete). */
  | 'reauction_unsold'

export interface ResultsSummary {
  totalPlayers: number
  sold: number
  unsold: number
  available: number
  skipped: number
  teams: number
  totalBids: number
  totalValue: number
}

export interface ResultsData {
  tournament: { id: string; name: string; sport: Sport; location: string | null; startDate: string | null; status: TournamentStatus; roomCode: string | null }
  summary: ResultsSummary
  teams: (TeamDTO & { players: PlayerDTO[] })[]
  recentBids: { playerName: string; teamName: string; amount: number; createdAt: string }[]
  /** The viewer is the organizer (or an admin) — may export CSVs. Team managers see results only. */
  canManage: boolean
}

// ---------- Audit trail ----------
export type AuctionEventType = 'SALE' | 'RE_AUCTION' | 'REFUND' | 'UNSOLD' | 'SKIPPED'

export interface AuctionEventDTO {
  id: string
  type: AuctionEventType
  /** Which auction cycle of the player this row belongs to (0 = first outing). */
  cycle: number
  playerId: string | null
  playerName: string | null
  playerNumber: number | null
  teamId: string | null
  teamName: string | null
  amount: number | null
  refundAmount: number | null
  actorName: string | null
  reason: string | null
  createdAt: string
}

/** Full SALE → RE-AUCTION → REFUND → NEW SALE chain for one player. */
export interface PlayerSaleChain {
  playerId: string
  playerName: string
  playerNumber: number
  status: string
  reauctions: number
  /** Current owner, read from the player row — historical sales never count. */
  currentTeamId: string | null
  currentTeamName: string | null
  currentPrice: number | null
  events: AuctionEventDTO[]
}

// ---------- Admin ----------
export interface AdminStats {
  users: number
  organizers: number
  managers: number
  tournaments: number
  liveAuctions: number
  players: number
  bids: number
  totalValue: number
}
