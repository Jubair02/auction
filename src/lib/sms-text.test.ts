// Run: npm test (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { paymentDecisionSms, smsNote, smsSafeName } from './sms-text.ts'

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

describe('paymentDecisionSms', () => {
  const base = { name: 'Mirpur Cup', trxId: '9F7A6B5C4D', note: null as string | null }

  it('tells the organizer the payment was approved', () => {
    assert.equal(
      paymentDecisionSms({ ...base, decision: 'APPROVED', bn: false }),
      'Your Pro payment for Mirpur Cup (TrxID 9F7A6B5C4D) is approved — Pro is now on. — NeelamGhor',
    )
  })

  it('carries the admin note on a rejection, in one line', () => {
    const sms = paymentDecisionSms({ ...base, decision: 'REJECTED', note: 'Amount was ৳500,\n not ৳999.', bn: false })
    assert.equal(sms, 'Your Pro payment for Mirpur Cup (TrxID 9F7A6B5C4D) was not approved. Reason: Amount was ৳500, not ৳999. See the details on your tournament page. — NeelamGhor')
  })

  it('writes Bangla and shortens long notes', () => {
    const sms = paymentDecisionSms({ ...base, decision: 'REJECTED', note: 'ক'.repeat(400), bn: true })
    assert.ok(sms.startsWith('Mirpur Cup-এর Pro পেমেন্ট (TrxID 9F7A6B5C4D) অনুমোদিত হয়নি। কারণ: '))
    assert.ok(sms.includes('…'))
    assert.ok(smsNote('ক'.repeat(400)).length <= 140)
  })
})
