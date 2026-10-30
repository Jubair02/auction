// Run: npm test (node --test). fetch is stubbed — no email is ever sent.
import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EmailNotConfiguredError, passwordResetEmail, sendEmail } from './email.ts'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM
})

describe('passwordResetEmail', () => {
  it('escapes user-supplied names in the HTML body', () => {
    const msg = passwordResetEmail({ name: '<script>x</script> Hasan', link: 'https://a.test/#/reset-password/t', ttlMinutes: 30 })
    assert.ok(!msg.html.includes('<script>'))
    assert.ok(msg.html.includes('&lt;script&gt;'))
    assert.ok(msg.text.includes('https://a.test/#/reset-password/t'))
    assert.ok(msg.text.includes('30 minutes'))
  })
})

describe('sendEmail', () => {
  const message = { to: 'rakib@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' }

  it('refuses to send without an API key', async () => {
    await assert.rejects(sendEmail(message), EmailNotConfiguredError)
  })

  it('posts to Resend with the key as a bearer token', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    let captured: { url: string; init: RequestInit } | null = null
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      captured = { url, init }
      return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })
    }) as typeof fetch

    await sendEmail(message)

    assert.equal(captured!.url, 'https://api.resend.com/emails')
    assert.equal((captured!.init.headers as Record<string, string>).Authorization, 'Bearer re_test_key')
    const body = JSON.parse(String(captured!.init.body))
    assert.deepEqual(body.to, ['rakib@example.com'])
    assert.equal(body.from, 'NeelamGhor <onboarding@resend.dev>')
  })

  it("surfaces Resend's error message without leaking the key", async () => {
    process.env.RESEND_API_KEY = 're_secret_value'
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: 'The domain is not verified' }), { status: 403 })) as typeof fetch
    await assert.rejects(sendEmail(message), (err: Error) => {
      assert.match(err.message, /HTTP 403.*domain is not verified/)
      assert.ok(!err.message.includes('re_secret_value'))
      return true
    })
  })
})
