// Run: npm test (node --test). Pure outbox helpers only — no DB, no network.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { backoffMs, buildHttpRequest, httpConfigFromEnv, maskNumber, renderTemplate, soldSmsBody, type HttpDriverConfig } from './outbox.ts'

describe('maskNumber', () => {
  it('keeps only the last 3 digits', () => {
    assert.equal(maskNumber('8801712345678'), '••••••••••678')
    assert.ok(!maskNumber('8801712345678').includes('1712'))
  })
  it('handles very short input', () => {
    assert.equal(maskNumber('12'), '•••')
  })
})

describe('backoffMs', () => {
  it('grows with attempts and caps at one hour', () => {
    assert.equal(backoffMs(1), 60_000)
    assert.equal(backoffMs(2), 300_000)
    assert.equal(backoffMs(4), 3_600_000)
    assert.equal(backoffMs(9), 3_600_000)
  })
})

describe('renderTemplate', () => {
  it('escapes per target', () => {
    const vars = { to: '8801712345678', body: 'Hi "A" & B' }
    assert.equal(renderTemplate('{"n":"{to}","m":"{body}"}', vars, 'json'), '{"n":"8801712345678","m":"Hi \\"A\\" & B"}')
    assert.equal(renderTemplate('n={to}&m={body}', vars, 'form'), 'n=8801712345678&m=Hi%20%22A%22%20%26%20B')
  })
  it('leaves unknown placeholders alone', () => {
    assert.equal(renderTemplate('{api_key}:{to}', { to: '1' }, 'raw'), '{api_key}:1')
  })
})

describe('httpConfigFromEnv', () => {
  it('requires a URL', () => {
    assert.equal(typeof httpConfigFromEnv({}), 'string')
  })
  it('defaults to POST when a body template is given, GET otherwise', () => {
    const post = httpConfigFromEnv({ SMS_HTTP_URL: 'https://gw.example/send', SMS_HTTP_BODY: 'a={to}' }) as HttpDriverConfig
    assert.equal(post.method, 'POST')
    const get = httpConfigFromEnv({ SMS_HTTP_URL: 'https://gw.example/send?to={to}' }) as HttpDriverConfig
    assert.equal(get.method, 'GET')
  })
  it('rejects bad headers JSON', () => {
    assert.equal(httpConfigFromEnv({ SMS_HTTP_URL: 'https://x', SMS_HTTP_HEADERS: '{bad' }), 'SMS_HTTP_HEADERS is not valid JSON')
  })
})

describe('buildHttpRequest', () => {
  it('fills a GET gateway URL with URL-encoded values', () => {
    const cfg = httpConfigFromEnv({ SMS_HTTP_URL: 'https://gw.example/api?key=K&number={to}&message={body}' }) as HttpDriverConfig
    const req = buildHttpRequest(cfg, '8801712345678', 'হ্যালো 1')
    assert.equal(req.method, 'GET')
    assert.equal(req.body, undefined)
    assert.ok(req.url.startsWith('https://gw.example/api?key=K&number=8801712345678&message='))
    assert.equal(decodeURIComponent(req.url.split('message=')[1]), 'হ্যালো 1')
  })
  it('JSON-escapes a JSON body and sets the content type', () => {
    const cfg = httpConfigFromEnv({
      SMS_HTTP_URL: 'https://gw.example/send',
      SMS_HTTP_BODY: '{"to":"{to}","local":"{to_local}","text":"{body}"}',
      SMS_HTTP_HEADERS: '{"Authorization":"Bearer T"}',
    }) as HttpDriverConfig
    const req = buildHttpRequest(cfg, '8801712345678', 'line1\n"q"')
    assert.equal(req.headers['Content-Type'], 'application/json')
    assert.equal(req.headers.Authorization, 'Bearer T')
    assert.deepEqual(JSON.parse(req.body!), { to: '8801712345678', local: '01712345678', text: 'line1\n"q"' })
  })
  it('form-encodes a form body', () => {
    const cfg = httpConfigFromEnv({ SMS_HTTP_URL: 'https://gw.example/send', SMS_HTTP_BODY: 'msisdn={to}&sms={body}' }) as HttpDriverConfig
    const req = buildHttpRequest(cfg, '8801712345678', 'a&b')
    assert.equal(req.headers['Content-Type'], 'application/x-www-form-urlencoded')
    assert.equal(req.body, 'msisdn=8801712345678&sms=a%26b')
  })
})

describe('soldSmsBody', () => {
  it('writes Bangla by default and English on request', () => {
    const v = { player: 'Rakib', tournament: 'Dhaka Cup', team: 'Tigers', price: 150000 }
    assert.match(soldSmsBody('bn', v), /অভিনন্দন Rakib!.*Tigers.*৳1,50,000/)
    assert.match(soldSmsBody('en', v), /^Congratulations Rakib! Tigers bought you for ৳1,50,000/)
  })
})
