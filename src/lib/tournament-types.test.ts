import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TOURNAMENT_TYPES, tournamentTypeLabel, tournamentTypeOptions } from './tournament-types.ts'

describe('tournament types', () => {
  it('offers a short, sport-neutral list', () => {
    assert.ok(TOURNAMENT_TYPES.length <= 6)
    for (const t of TOURNAMENT_TYPES) assert.ok(!/cricket|football/i.test(t), `${t} names a sport`)
  })
  it('translates known types and shows anything else as saved', () => {
    assert.equal(tournamentTypeLabel('Corporate', 'bn'), 'কর্পোরেট')
    assert.equal(tournamentTypeLabel('Corporate', 'en'), 'Corporate')
    assert.equal(tournamentTypeLabel('Indoor Cricket', 'bn'), 'ইনডোর ক্রিকেট') // older type
    assert.equal(tournamentTypeLabel('Ramadan Cup', 'bn'), 'Ramadan Cup')
    assert.equal(tournamentTypeLabel(null, 'bn'), null)
  })
  it('keeps an older saved type selectable when editing', () => {
    assert.deepEqual(tournamentTypeOptions(null), [...TOURNAMENT_TYPES])
    assert.equal(tournamentTypeOptions('Indoor Cricket').at(-1), 'Indoor Cricket')
    assert.equal(tournamentTypeOptions('School').length, TOURNAMENT_TYPES.length)
  })
})
