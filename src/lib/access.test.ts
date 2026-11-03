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

  it('requires a login for the dashboard and results', () => {
    for (const p of ['/dashboard', '/results/t1']) {
      assert.equal(canOpen(path(p), null), false, p)
      assert.equal(canOpen(path(p), 'MANAGER'), true, p)
    }
  })

  it('shows login/register only to logged-out visitors', () => {
    assert.equal(canOpen(path('/login'), null), true)
    assert.equal(canOpen(path('/login'), 'ORGANIZER'), false)
  })

  it('leaves public pages open to everyone', () => {
    for (const p of ['/', '/room/BD26-DEMO', '/join', '/register-player/abc', '/invite', '/reset-password']) {
      assert.equal(canOpen(path(p), null), true, p)
      assert.equal(canOpen(path(p), 'MANAGER'), true, p)
    }
  })
})

describe('post-login redirect', () => {
  it('goes to the dashboard without a saved page', () => {
    assert.equal(postLoginPath(null, 'ORGANIZER'), '/dashboard')
  })

  it('returns to the saved page when the role may open it', () => {
    assert.equal(postLoginPath('/room/BD26-DEMO', 'MANAGER'), '/room/BD26-DEMO')
    assert.equal(postLoginPath('/tournaments/t1', 'ORGANIZER'), '/tournaments/t1')
  })

  it("never lands a user on a page their role can't open", () => {
    assert.equal(postLoginPath('/admin', 'ORGANIZER'), '/dashboard')
    assert.equal(postLoginPath('/tournaments/t1', 'MANAGER'), '/dashboard')
    assert.equal(postLoginPath('/my-team', 'ADMIN'), '/dashboard')
    assert.equal(postLoginPath('/login', 'MANAGER'), '/dashboard')
  })
})
