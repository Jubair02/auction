// ============================================================
// NeelamGhor — pure auction rules (purse maths + bid legality).
// No I/O and no runtime imports, so the engine and the unit tests
// (node --test) share exactly the same logic.
// ============================================================

const EN_IN = new Intl.NumberFormat('en-IN')
export const bdt = (n: number) => `৳${EN_IN.format(n)}`

/** Statuses a player can still be bought from. */
const OBTAINABLE = new Set(['AVAILABLE', 'UNSOLD', 'SKIPPED'])

export interface RulePlayer {
  id: string
  status: string
  basePrice: number
}

export interface RuleTeam {
  id: string
  name: string
  budget: number
  spent: number
  squadCount: number
  minSquad: number
  maxSquad: number
}

export interface BidContext {
  players: RulePlayer[]
  /** Highest bid so far for the player on the block, if any. */
  currentBid: { amount: number; teamId: string } | null
  minIncrement: number
  /** Team that lost the player on the block in a re-auction; null on a first outing. */
  previousOwnerTeamId: string | null
  allowPreviousOwnerRebid: boolean
}

/** Cheapest base price still obtainable, used to reserve purse for the minimum squad. */
export function cheapestAvailable(players: RulePlayer[], excludePlayerId?: string): number {
  let min = Infinity
  for (const p of players) {
    if (p.id === excludePlayerId || !OBTAINABLE.has(p.status)) continue
    if (p.basePrice < min) min = p.basePrice
  }
  return min === Infinity ? 0 : min
}

/** How many more players a team still needs after winning the one on the block. */
export function slotsStillNeeded(players: RulePlayer[], team: RuleTeam, excludePlayerId?: string): number {
  const needed = team.minSquad - team.squadCount - 1
  if (needed <= 0) return 0
  // Never reserve for players that do not exist in the pool any more.
  let obtainable = 0
  for (const p of players) {
    if (p.id !== excludePlayerId && OBTAINABLE.has(p.status)) obtainable++
  }
  return Math.min(needed, obtainable)
}

/**
 * The highest bid a team may legally place for the player on the block.
 * Their remaining purse, minus the minimum they must keep back to still
 * complete the minimum squad size — otherwise a team can spend everything on
 * one player and end the auction with an illegal squad.
 */
export function maxBidFor(players: RulePlayer[], team: RuleTeam, excludePlayerId?: string): number {
  const remaining = team.budget - team.spent
  const reserve = slotsStillNeeded(players, team, excludePlayerId) * cheapestAvailable(players, excludePlayerId)
  return Math.max(0, remaining - reserve)
}

/** Shared bid legality check for manager bids and organizer manual bids. Null = legal. */
export function validateBid(
  ctx: BidContext,
  team: RuleTeam,
  player: RulePlayer,
  amount: number,
  opts: { manual: boolean },
): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return 'Invalid bid amount'

  const who = opts.manual ? `${team.name}'s` : 'your'
  if (team.squadCount >= team.maxSquad) {
    return opts.manual ? `${team.name}'s squad is already full` : 'Your squad is full'
  }
  // Bidding against yourself only inflates the price you pay.
  if (ctx.currentBid && ctx.currentBid.teamId === team.id) {
    return opts.manual ? `${team.name} already holds the highest bid` : 'You already hold the highest bid'
  }
  // Optional policy: lock the team that just lost this player out of the
  // round, so a re-auction cannot simply hand them back at a new price.
  if (!ctx.allowPreviousOwnerRebid && ctx.previousOwnerTeamId === team.id) {
    return opts.manual
      ? `${team.name} lost this player in the re-auction and is blocked from bidding for them again`
      : 'You lost this player in the re-auction — the organizer has blocked previous owners from bidding again'
  }
  const minBid = ctx.currentBid ? ctx.currentBid.amount + ctx.minIncrement : player.basePrice
  if (amount < minBid) return `Minimum bid is ${bdt(minBid)}`

  const remaining = team.budget - team.spent
  if (amount > remaining) {
    return opts.manual
      ? `${team.name} only has ${bdt(remaining)} left`
      : `Bid exceeds ${who} available budget (${bdt(remaining)} left)`
  }
  const maxBid = maxBidFor(ctx.players, team, player.id)
  if (amount > maxBid) {
    const slots = slotsStillNeeded(ctx.players, team, player.id)
    return `Maximum bid is ${bdt(maxBid)} — ${bdt(remaining - maxBid)} must stay back for ${slots} more player${slots === 1 ? '' : 's'} to reach the minimum squad of ${team.minSquad}`
  }
  return null
}
