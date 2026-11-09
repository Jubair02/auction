// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canOpen, postLoginPath } from './access.ts'

const path = (p: string) => p.split('/').filter(Boolean)

describe('page access', () => {
  it('keeps admin pages to admins', () => {
    assert.equal(canOpen(path('/admin'), 'ADMIN'), true)
    assert.equal(canOpen(path('/admin'), 'ORGANIZER'), false)
    assert.equal(canOpen(path('/admin'), 'MANAGER'), false)
    assert.equal(canOpen(path('/admin'), null), false)
  })

  it('keeps tournament management to organizers and admins', () => {
    for (const p of ['/tournaments', '/tournaments/new', '/tournaments/t1', '/tournaments/t1/history']) {
      assert.equal(canOpen(path(p), 'ORGANIZER'), true, p)
      assert.equal(canOpen(path(p), 'ADMIN'), true, p)
      assert.equal(canOpen(path(p), 'MANAGER'), false, p)
      assert.equal(canOpen(path(p), null), false, p)
    }
  })

  it('keeps my-team to managers', () => {
    assert.equal(canOpen(path('/my-team'), 'MANAGER'), true)
    assert.equal(canOpen(path('/my-team'), 'ORGANIZER'), false)
  })

  it('requires a login for the dashboard and account', () => {
    for (const p of ['/dashboard', '/account']) {
      assert.equal(canOpen(path(p), null), false, p)
      assert.equal(canOpen(path(p), 'MANAGER'), true, p)
    }
  })

  it('shows login/register only to logged-out visitors', () => {
    assert.equal(canOpen(path('/login'), null), true)
    assert.equal(canOpen(path('/login'), 'ORGANIZER'), false)
  })

  it('leaves public pages open to everyone', () => {
    for (const p of ['/', '/room/BD26-DEMO', '/join', '/register-player/abc', '/invite', '/reset-password', '/privacy', '/results/t1', '/league/t1']) {
      assert.equal(canOpen(path(p), null), true, p)
      assert.equal(canOpen(path(p), 'MANAGER'), true, p)
    }
  })
})

describe('public league page', () => {
  it('is open to every role and to logged-out visitors', () => {
    for (const role of [null, 'MANAGER', 'ORGANIZER', 'ADMIN'] as const) {
      assert.equal(canOpen(path('/league/t1'), role), true, String(role))
    }
  })
})

describe('post-login redirect', () => {
  it('goes to the dashboard without a saved page', () => {
    assert.equal(postLoginPath(null, 'ORGANIZER'), '/dashboard')
  })

  it('returns to the saved page when the role may open it', () => {
    assert.equal(postLoginPath('/room/BD26-DEMO', 'MANAGER'), '/room/BD26-DEMO')
    assert.equal(postLoginPath('/results/t1', 'MANAGER'), '/results/t1')
    assert.equal(postLoginPath('/league/t1', 'MANAGER'), '/league/t1')
    assert.equal(postLoginPath('/league/t1', 'ORGANIZER'), '/league/t1')
    assert.equal(postLoginPath('/account', 'ORGANIZER'), '/account')
    assert.equal(postLoginPath('/tournaments/t1', 'ORGANIZER'), '/tournaments/t1')
  })

  it("never lands a user on a page their role can't open", () => {
    assert.equal(postLoginPath('/admin', 'ORGANIZER'), '/dashboard')
    assert.equal(postLoginPath('/tournaments/t1', 'MANAGER'), '/dashboard')
    assert.equal(postLoginPath('/my-team', 'ADMIN'), '/dashboard')
    assert.equal(postLoginPath('/login', 'MANAGER'), '/dashboard')
  })
})
