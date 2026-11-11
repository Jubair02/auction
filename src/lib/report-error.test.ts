// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inertBlock } from './report-error.ts'

describe('inertBlock (alert text from strangers)', () => {
  it('wraps the text in a code block nobody can close early', () => {
    const out = inertBlock('evil ``` @everyone')
    assert.ok(out.startsWith('```\n') && out.endsWith('\n```'))
    assert.equal(out.slice(4, -4).includes('```'), false)
  })
  it('breaks @everyone / @here and Slack <!channel> / <@U123> mentions', () => {
    const out = inertBlock('@everyone @here <!channel> <@U123> <#C1>')
    assert.doesNotMatch(out, /@everyone|@here|<!channel>|<@U123>|<#C1>/)
  })
  it('leaves ordinary error text readable', () => {
    assert.equal(inertBlock('TypeError: x is undefined'), '```\nTypeError: x is undefined\n```')
  })
})
