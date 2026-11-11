import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { telHref, validateSupportPhone, whatsappNumber } from './support-phone.ts'

describe('support phone', () => {
  it('accepts mobiles, landlines and hotlines as written', () => {
    assert.deepEqual(validateSupportPhone(' 01712-345678 '), { value: '01712-345678' })
    assert.deepEqual(validateSupportPhone('+880 1712 345678'), { value: '+880 1712 345678' })
    assert.deepEqual(validateSupportPhone('(02) 9876543'), { value: '(02) 9876543' })
    assert.deepEqual(validateSupportPhone('16247'), { value: '16247' })
  })

  it('treats empty as "no support number"', () => {
    assert.deepEqual(validateSupportPhone('   '), { value: '' })
  })

  it('rejects things that are not a phone number', () => {
    for (const bad of ['call us', '1234', '01712abc678', 'https://x.example', '0'.repeat(21)]) {
      assert.ok('error' in validateSupportPhone(bad), bad)
    }
  })

  it('builds tel: and WhatsApp links', () => {
    assert.equal(telHref('+880 1712-345678'), 'tel:+8801712345678')
    assert.equal(whatsappNumber('01712-345678'), '8801712345678')
    assert.equal(whatsappNumber('+8801712345678'), '8801712345678')
    assert.equal(whatsappNumber('16247'), null) // a hotline has no WhatsApp
  })
})
