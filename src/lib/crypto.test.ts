// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Must be set before the first sign/verify (the secret is read lazily and cached).
process.env.AUCTION_SECRET = 'test-secret-'.padEnd(48, 'x')

const { generateOneTimeToken, hashOneTimeToken, hashPassword, signToken, verifyPassword, verifyToken } = await import(
  './crypto.ts'
)

describe('one-time tokens', () => {
  it('are unique, URL-safe and stored only as a stable hash', () => {
    const a = generateOneTimeToken()
    assert.notEqual(a, generateOneTimeToken())
    assert.match(a, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(hashOneTimeToken(a), hashOneTimeToken(a))
    assert.notEqual(hashOneTimeToken(a), a)
  })
})

describe('tokens', () => {
  it('round-trips a signed payload', () => {
    const token = signToken({ sub: 'u1', role: 'ORGANIZER' }, 60)
    assert.deepEqual({ ...verifyToken<{ sub: string; role: string }>(token), exp: undefined }, {
      sub: 'u1',
      role: 'ORGANIZER',
      exp: undefined,
    })
  })

  it('rejects a tampered payload or signature', () => {
    const token = signToken({ role: 'VIEWER' }, 60)
    const [data, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ role: 'ORGANIZER', exp: Date.now() + 60_000 })).toString('base64url')
    assert.equal(verifyToken(`${forged}.${sig}`), null)
    assert.equal(verifyToken(`${data}.${sig.slice(0, -2)}AA`), null)
    assert.equal(verifyToken('garbage'), null)
  })

  it('rejects an expired token', () => {
    assert.equal(verifyToken(signToken({ a: 1 }, -1)), null)
  })
})

describe('passwords', () => {
  it('verifies the right password only', () => {
    const stored = hashPassword('demo1234')
    assert.equal(verifyPassword('demo1234', stored), true)
    assert.equal(verifyPassword('demo12345', stored), false)
    assert.equal(verifyPassword('demo1234', 'not-a-hash'), false)
  })
})
