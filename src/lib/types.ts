// ============================================================
// NeelamGhor — Shared contract types (single source of truth)
// Used by Next.js API routes, frontend components and the
// auction socket mini-service. DO NOT rename fields lightly —
// this is the frozen contract between Task 2-a/2-b/3-a/3-b.
// ============================================================

export type UserRole = 'ADMIN' | 'ORGANIZER' | 'MANAGER'
export type UserStatus = 'ACTIVE' | 'BLOCKED'
export type Sport = 'CRICKET' | 'FOOTBALL'
export type AuctionMode = 'CATEGORY' | 'NORMAL'
export type TournamentStatus = 'DRAFT' | 'READY' | 'LIVE' | 'COMPLETED'
export type PlayerStatus = 'AVAILABLE' | 'LIVE' | 'SOLD' | 'UNSOLD' | 'SKIPPED'
export type AuctionStatus = 'READY' | 'LIVE' | 'PAUSED' | 'ENDED'
export type RoomRole = 'ORGANIZER' | 'MANAGER' | 'VIEWER'

export const CRICKET_ROLES = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'] as const
export const FOOTBALL_ROLES = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const
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
  managerUserId: string | null
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
}

export interface JoinResult {
  socketToken: string
  identity: { role: RoomRole; name: string; teamId?: string; teamName?: string }
}

// ---------- Live auction room state (socket) ----------
export interface RoomPlayer {
  id: string
  playerNumber: number
  name: string
  role: string
  category: string | null
  basePrice: number
  photoUrl: string | null
  previousTeam: string | null
  phone: string | null
}

export interface RoomTeam {
  id: string
  name: string
  color: string | null
  logoUrl: string | null
  budget: number
  spent: number
  remaining: number
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
  participants: { name: string; role: RoomRole; teamId: string | null; online: boolean }[]
  players: RoomPlayerLite[] // full pool with statuses (for organizer selection / re-auction / pools)
  pool: { total: number; available: number; sold: number; unsold: number; skipped: number }
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
  bidTimerSeconds: number
  goingIntervalSeconds: number
}

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
