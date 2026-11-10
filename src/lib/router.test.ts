// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cameToBid } from './router.ts'

describe('cameToBid', () => {
  it('defaults sign-ups from a team invite or a room to a manager account', () => {
    assert.equal(cameToBid('/invite#abc123'), true)
    assert.equal(cameToBid('/invite/abc123'), true)
    assert.equal(cameToBid('/invite'), true)
    assert.equal(cameToBid('/room/BD26-K7QX'), true)
  })
  it('leaves everyone else on the organizer default', () => {
    assert.equal(cameToBid(null), false)
    assert.equal(cameToBid('/dashboard'), false)
    assert.equal(cameToBid('/invited-elsewhere'), false)
    assert.equal(cameToBid('/roomy'), false)
  })
})
