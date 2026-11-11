// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isKnownRoute, ROUTE_HEADS } from './routes.ts'

describe('routes', () => {
  it('knows every page the client router renders (add new ones to ROUTE_HEADS)', () => {
    const appRoot = readFileSync(join(import.meta.dirname, '..', 'components', 'app-root.tsx'), 'utf8')
    const heads = new Set([...appRoot.matchAll(/head === '([a-z-]*)'/g)].map((m) => m[1]))
    assert.ok(heads.size > 10, `expected to find the routes, found ${heads.size}`)
    const missing = [...heads].filter((h) => !ROUTE_HEADS.has(h))
    assert.deepEqual(missing, [], `Add to ROUTE_HEADS in src/lib/routes.ts: ${missing.join(', ')}`)
  })
  it('treats anything else as unknown', () => {
    assert.equal(isKnownRoute([]), true)
    assert.equal(isKnownRoute(['room', 'BD26-K7QX']), true)
    assert.equal(isKnownRoute(['does-not-exist']), false)
    assert.equal(isKnownRoute(['wp-admin', 'setup.php']), false)
  })
})
