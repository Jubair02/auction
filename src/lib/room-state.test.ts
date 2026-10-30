// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeRoomState } from './room-state.ts'
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
