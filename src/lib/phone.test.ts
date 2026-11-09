import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBdPhone, toSmsNumber } from './phone.ts'

describe('normalizeBdPhone', () => {
  it('accepts the forms people type', () => {
    assert.equal(normalizeBdPhone('01712345678'), '01712345678')
    assert.equal(normalizeBdPhone('01712-345678'), '01712345678')
    assert.equal(normalizeBdPhone('+8801712345678'), '01712345678')
    assert.equal(normalizeBdPhone('880 1712 345678'), '01712345678')
  })
  it('rejects non-mobile or malformed numbers', () => {
    assert.equal(normalizeBdPhone('0171234567'), null) // 10 digits
    assert.equal(normalizeBdPhone('01212345678'), null) // 012 is not a mobile prefix
    assert.equal(normalizeBdPhone('+14155552671'), null)
    assert.equal(normalizeBdPhone('abc'), null)
  })
  it('formats for SMS gateways', () => {
    assert.equal(toSmsNumber('01712345678'), '8801712345678')
    assert.equal(toSmsNumber('bad'), null)
  })
})
