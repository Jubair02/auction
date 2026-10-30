// Run: npm test (node --test). Pure rules only — no DB, no sockets.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cheapestAvailable, maxBidFor, slotsStillNeeded, validateBid, type BidContext, type RuleTeam } from './rules.ts'

const player = (id: string, basePrice: number, status = 'AVAILABLE') => ({ id, basePrice, status })

const team = (over: Partial<RuleTeam> = {}): RuleTeam => ({
  id: 't1',
  name: 'Dhaka Warriors',
  budget: 1_000_000,
  spent: 0,
  squadCount: 0,
  minSquad: 0,
  maxSquad: 14,
  ...over,
})

const onBlock = player('p0', 50_000, 'LIVE')

const ctx = (over: Partial<BidContext> = {}): BidContext => ({
  players: [onBlock, player('p1', 20_000), player('p2', 30_000)],
  currentBid: null,
  minIncrement: 5_000,
  previousOwnerTeamId: null,
  allowPreviousOwnerRebid: true,
  ...over,
})

describe('purse maths', () => {
  it('cheapestAvailable ignores sold/live players and the excluded one', () => {
    const players = [player('a', 10_000, 'SOLD'), player('b', 40_000), player('c', 25_000, 'UNSOLD'), player('d', 5_000, 'LIVE')]
    assert.equal(cheapestAvailable(players), 25_000)
    assert.equal(cheapestAvailable(players, 'c'), 40_000)
    assert.equal(cheapestAvailable([player('x', 1, 'SOLD')]), 0)
  })

  it('slotsStillNeeded counts the player being bought and caps at the obtainable pool', () => {
    const players = [player('a', 1), player('b', 1)]
    assert.equal(slotsStillNeeded(players, team({ minSquad: 5, squadCount: 1 })), 2) // needs 3, only 2 exist
    assert.equal(slotsStillNeeded(players, team({ minSquad: 3, squadCount: 1 })), 1)
    assert.equal(slotsStillNeeded(players, team({ minSquad: 2, squadCount: 1 })), 0)
  })

  it('maxBidFor holds back enough purse to finish the minimum squad', () => {
    const players = [onBlock, player('p1', 20_000), player('p2', 30_000)]
    // needs 2 more after this one, cheapest obtainable is 20k → reserve 40k
    const t = team({ budget: 100_000, minSquad: 3 })
    assert.equal(maxBidFor(players, t, onBlock.id), 60_000)
    assert.equal(maxBidFor(players, team({ budget: 10_000, spent: 0, minSquad: 3 }), onBlock.id), 0)
  })
})

describe('validateBid', () => {
  it('first bid must be at least the base price', () => {
    assert.match(validateBid(ctx(), team(), onBlock, 45_000, { manual: false })!, /Minimum bid is ৳50,000/)
    assert.equal(validateBid(ctx(), team(), onBlock, 50_000, { manual: false }), null)
  })

  it('later bids must beat the current bid by the minimum increment', () => {
    const c = ctx({ currentBid: { amount: 60_000, teamId: 'other' } })
    assert.match(validateBid(c, team(), onBlock, 64_000, { manual: false })!, /Minimum bid is ৳65,000/)
    assert.equal(validateBid(c, team(), onBlock, 65_000, { manual: false }), null)
  })

  it('rejects non-integer, zero and negative amounts', () => {
    for (const amount of [Number.NaN, 0, -5_000, 50_000.5]) {
      assert.equal(validateBid(ctx(), team(), onBlock, amount, { manual: false }), 'Invalid bid amount')
    }
  })

  it('a team cannot outbid itself', () => {
    const c = ctx({ currentBid: { amount: 60_000, teamId: 't1' } })
    assert.equal(validateBid(c, team(), onBlock, 70_000, { manual: false }), 'You already hold the highest bid')
    assert.match(validateBid(c, team(), onBlock, 70_000, { manual: true })!, /Dhaka Warriors already holds/)
  })

  it('a full squad cannot bid', () => {
    assert.equal(validateBid(ctx(), team({ squadCount: 14 }), onBlock, 50_000, { manual: false }), 'Your squad is full')
  })

  it('cannot bid more than the remaining purse', () => {
    const t = team({ budget: 100_000, spent: 60_000 })
    assert.match(validateBid(ctx(), t, onBlock, 50_000, { manual: false })!, /exceeds your available budget \(৳40,000 left\)/)
  })

  it('cannot spend the reserve needed for the minimum squad', () => {
    const t = team({ budget: 100_000, minSquad: 3 })
    assert.match(validateBid(ctx(), t, onBlock, 65_000, { manual: false })!, /Maximum bid is ৳60,000/)
    assert.equal(validateBid(ctx(), t, onBlock, 60_000, { manual: false }), null)
  })

  it('previous-owner lockout only applies when the policy is off', () => {
    const locked = ctx({ previousOwnerTeamId: 't1', allowPreviousOwnerRebid: false })
    assert.match(validateBid(locked, team(), onBlock, 50_000, { manual: false })!, /blocked previous owners/)
    const open = ctx({ previousOwnerTeamId: 't1', allowPreviousOwnerRebid: true })
    assert.equal(validateBid(open, team(), onBlock, 50_000, { manual: false }), null)
  })
})
