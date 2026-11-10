// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeRoomState, outbidChange, seatBelongsTo } from './room-state.ts'
import type { RoomState, RoomStateWire } from './types.ts'

const full = (over: Partial<RoomState> = {}): RoomState =>
  ({
    status: 'LIVE',
    players: [{ id: 'p1', status: 'AVAILABLE' }],
    playersHash: 'P1',
    participants: [{ name: 'Rafiq', role: 'ORGANIZER', teamId: null, online: true }],
    participantsHash: 'Q1',
    viewersOnline: 3,
    ...over,
  }) as unknown as RoomState

const delta = (state: RoomState, drop: ('players' | 'participants')[]): RoomStateWire => {
  const wire: RoomStateWire = { ...state }
  for (const k of drop) delete wire[k]
  return wire
}

describe('mergeRoomState', () => {
  it('takes a full snapshot as is', () => {
    const next = full({ viewersOnline: 9 })
    assert.deepEqual(mergeRoomState(null, next), { state: next, needsResync: false })
  })

  it('fills omitted lists from the previous state when fingerprints match', () => {
    const prev = full()
    const next = full({ viewersOnline: 7 })
    const { state, needsResync } = mergeRoomState(prev, delta(next, ['players', 'participants']))
    assert.equal(needsResync, false)
    assert.equal(state!.viewersOnline, 7)
    assert.equal(state!.players, prev.players)
    assert.equal(state!.participants, prev.participants)
  })

  it('takes a list that was sent and keeps the one that was not', () => {
    const prev = full()
    const next = full({ players: [{ id: 'p1', status: 'SOLD' }] as RoomState['players'], playersHash: 'P2' })
    const { state } = mergeRoomState(prev, delta(next, ['participants']))
    assert.equal(state!.players[0].status, 'SOLD')
    assert.equal(state!.participants, prev.participants)
  })

  it('asks for a resync when an omitted list does not match our copy', () => {
    const prev = full()
    const next = full({ playersHash: 'P9' }) // server moved on; we missed the change
    const { state, needsResync } = mergeRoomState(prev, delta(next, ['players']))
    assert.equal(needsResync, true)
    assert.equal(state, prev) // keep showing the last good state meanwhile
  })

  it('ignores a delta that arrives before the first snapshot', () => {
    assert.deepEqual(mergeRoomState(null, delta(full(), ['players'])), { state: null, needsResync: false })
  })
})

describe('seatBelongsTo', () => {
  it('reuses a seat only for the account it was issued to', () => {
    assert.equal(seatBelongsTo({ role: 'MANAGER', userId: 'u1' }, 'u1'), true)
    assert.equal(seatBelongsTo({ role: 'MANAGER', userId: 'u1' }, 'u2'), false)
    assert.equal(seatBelongsTo({ role: 'ORGANIZER', userId: 'u1' }, null), false) // logged out
  })

  it('drops organizer/manager seats saved without an owner', () => {
    assert.equal(seatBelongsTo({ role: 'MANAGER' }, 'u1'), false)
    assert.equal(seatBelongsTo({ role: 'ORGANIZER', userId: null }, 'u1'), false)
  })

  it('keeps anonymous viewer seats usable', () => {
    assert.equal(seatBelongsTo({ role: 'VIEWER', userId: null }, null), true)
    assert.equal(seatBelongsTo({ role: 'VIEWER' }, 'u1'), true)
    assert.equal(seatBelongsTo({ role: 'VIEWER', userId: 'u1' }, 'u2'), false)
  })
})

describe('outbidChange', () => {
  const live = (playerId: string | null, bid: { teamId: string; amount: number } | null, status = 'LIVE') => ({
    status,
    playerId,
    bid: bid ? { ...bid, teamName: bid.teamId.toUpperCase() } : null,
  })

  it('alerts when another team bids over my lead on the same player', () => {
    assert.deepEqual(outbidChange(live('p1', { teamId: 'me', amount: 100 }), live('p1', { teamId: 'b', amount: 120 }), 'me', false), {
      type: 'outbid',
      byTeam: 'B',
      amount: 120,
    })
  })
  it('stays quiet for bidding wars my team is not leading', () => {
    assert.equal(outbidChange(live('p1', { teamId: 'a', amount: 100 }), live('p1', { teamId: 'b', amount: 120 }), 'me', false), null)
    assert.equal(outbidChange(null, live('p1', { teamId: 'b', amount: 120 }), 'me', false), null)
  })
  it('updates an active alert when the price keeps rising, without a new alarm', () => {
    assert.deepEqual(outbidChange(live('p1', { teamId: 'b', amount: 120 }), live('p1', { teamId: 'c', amount: 140 }), 'me', true), {
      type: 'raised',
      byTeam: 'C',
      amount: 140,
    })
  })
  it('clears when we lead again, the player changes or bidding stops', () => {
    const beaten = live('p1', { teamId: 'b', amount: 120 })
    assert.deepEqual(outbidChange(beaten, live('p1', { teamId: 'me', amount: 140 }), 'me', true), { type: 'clear' })
    assert.deepEqual(outbidChange(beaten, live('p2', null), 'me', true), { type: 'clear' })
    assert.deepEqual(outbidChange(beaten, live(null, null), 'me', true), { type: 'clear' })
    assert.deepEqual(outbidChange(beaten, live('p1', { teamId: 'b', amount: 120 }, 'PAUSED'), 'me', true), { type: 'clear' })
  })
  it('does nothing for viewers and unchanged broadcasts', () => {
    const s = live('p1', { teamId: 'me', amount: 100 })
    assert.equal(outbidChange(s, live('p1', { teamId: 'b', amount: 120 }), undefined, false), null)
    assert.equal(outbidChange(s, s, 'me', false), null)
  })
})
