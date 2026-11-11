// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { smsSafeName } from './sms-text.ts'

describe('smsSafeName', () => {
  it('keeps ordinary tournament and team names', () => {
    assert.equal(smsSafeName('Dhaka Premier League 2026', 'x'), 'Dhaka Premier League 2026')
    assert.equal(smsSafeName('গাজীপুর ফুটবল লিগ', 'x'), 'গাজীপুর ফুটবল লিগ')
    assert.equal(smsSafeName('Tigers XI', 'x'), 'Tigers XI')
  })
  it('removes phone numbers, links and handles a scammer could hide in a name', () => {
    assert.equal(smsSafeName('WIN 50,000tk call 01712-345678', 'x'), 'WIN tk call')
    assert.equal(smsSafeName('Prize! ০১৭১২৩৪৫৬৭৮', 'x'), 'Prize!')
    assert.equal(smsSafeName('Claim at bit.ly/abc now', 'x'), 'Claim at now')
    assert.equal(smsSafeName('Visit https://evil.example/pay', 'x'), 'Visit')
    assert.equal(smsSafeName('www.win-now.com', 'your tournament'), 'your tournament')
    assert.equal(smsSafeName('Pay @bkash_agent', 'x'), 'Pay bkash_agent')
  })
  it('shortens long names and falls back when nothing is left', () => {
    assert.equal(smsSafeName('A'.repeat(60), 'x', 40).length, 40)
    assert.equal(smsSafeName('01712345678', 'your team'), 'your team')
    assert.equal(smsSafeName('   ', 'your team'), 'your team')
  })
})
