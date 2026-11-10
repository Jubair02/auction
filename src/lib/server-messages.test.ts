// CI guard: every message the API or the auction service can show a user has a
// Bangla version. Translation matches the server's English text (exactly, or by
// a pattern for messages with numbers and names), so rewording a message
// without updating server-messages.ts silently shows English to Bangla users —
// this test fails instead.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serverMessageBn } from './server-messages.ts'
import { ROOM_MSG_CODES, roomNoticeText, roomText } from './room-messages.ts'

const ROOT = join(import.meta.dirname, '..', '..')

/**
 * Messages only a broken or hand-made request can trigger (the app's own
 * screens never send these), or meant for whoever deploys the service. They
 * stay English on purpose.
 */
const ENGLISH_ONLY = new Set([
  // Request shape / field names: the app's forms never send these.
  'Role must be "organizer", "manager" or "viewer"',
  'roomCode and token are required',
  'enabled must be true or false',
  'brandHidePlatform must be true or false',
  'resultsPublic must be true or false',
  'smsEnabled must be true or false',
  'smsLang must be bn or en',
  'allowOpenClaim must be true or false',
  'allowPreviousOwnerRebid must be true or false',
  'open must be true or false',
  'note must be text',
  'userId is required',
  'managerUserId must be a user id or null',
  'kind must be PHOTO, LOGO or BANNER',
  'plan must be FREE or PRO',
  'action must be approve or reject',
  'action must be approve, reject, verify_payment or reject_payment',
  'ids must be a list of sponsor ids',
  'Sport must be CRICKET, FOOTBALL or OTHER',
  'Auction mode must be CATEGORY or NORMAL',
  'League format must be ROUND_ROBIN, DOUBLE_ROUND_ROBIN, GROUPS_KNOCKOUT or KNOCKOUT',
  'Status must be ACTIVE or BLOCKED',
  'Role must be CO_ORGANIZER or AUCTIONEER',
  'Send the image as multipart form data',
  'Provide a "settings" object of key/value strings',
  'Provide a "stats" array',
  'Provide a non-empty "players" array',
  'Provide a non-empty "teams" array',
  'Provide an "assignments" array',
  'Cannot set more than 40 settings at once',
  'Setting keys cannot be empty',
  'Setting "7" must have a string value',
  'Each stat line needs a playerId',
  'Each assignment needs a teamId and a groupName',
  'Each row must be an object',
  'Too many assignments',
  'Unknown action',
  'Unknown action: 7',
  'Unknown match stage',
  'Unknown match status',
  'Unknown result type',
  'Unknown notification kind',
  'Unknown export type. Use type=players|sold|unsold|squads|bids|spending|audit|template',
  // Machine-facing: share-card images and the service health check.
  'Not found',
  'database unreachable',
  // For whoever deploys the services, not for users.
  'AUCTION_SECRET mismatch: the website signed this pass with secret 7, but the auction service uses 7. Set the exact same AUCTION_SECRET on both hosts.',
])

/** String literal (', " or `) starting at `open` → its text, with each ${…} replaced by a sample value. */
function literalAt(src: string, open: number): string | null {
  const q = src[open]
  if (q !== "'" && q !== '"' && q !== '`') return null
  let out = ''
  for (let i = open + 1; i < src.length; i++) {
    const c = src[i]
    if (c === '\\') {
      out += src[++i]
      continue
    }
    if (c === q) return out
    if (q === '`' && c === '$' && src[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      const start = j
      for (; j < src.length && depth > 0; j++) {
        if (src[j] === '{') depth++
        else if (src[j] === '}') depth--
      }
      const expr = src.slice(start, j - 1)
      // Amounts render as "৳1,23,456"; anything else as a plain sample.
      out += /\bbdt\(|formatBDT\(/.test(expr) ? '৳7' : '7'
      i = j - 1
      continue
    }
    out += c
  }
  return null
}

/** Every literal passed as the first argument of `call(` (e.g. "jsonError(") in `src`. */
function literalsAfter(src: string, marker: RegExp): string[] {
  const found: string[] = []
  for (const m of src.matchAll(marker)) {
    let i = m.index + m[0].length
    while (/\s/.test(src[i])) i++
    const text = literalAt(src, i)
    if (text !== null) found.push(text)
  }
  return found
}

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(ROOT, dir, f))
}

const read = (path: string) => readFileSync(path, 'utf8')

function userFacingMessages(): Map<string, string> {
  const messages = new Map<string, string>() // message → where it was found
  const add = (list: string[], where: string) => {
    for (const m of list) if (m.trim() && !messages.has(m)) messages.set(m, where)
  }

  // Web API: jsonError('…') and Response.json({ error: '…' }).
  for (const file of [...filesUnder('src/app/api'), join(ROOT, 'src/lib/plans.ts'), join(ROOT, 'src/lib/auth.ts')]) {
    const src = read(file)
    add(literalsAfter(src, /\bjsonError\(/g), file)
    add(literalsAfter(src, /\{\s*error:/g), file)
  }
  // Shared constants used as API errors (e.g. ONE_TEAM_PER_MANAGER).
  add(literalsAfter(read(join(ROOT, 'src/app/api/_lib/helpers.ts')), /export const [A-Z_]+ =/g), 'helpers.ts')

  // Auction service: refusals sent back on bids, organizer actions and joins.
  const service = 'mini-services/auction-service'
  const engine = read(join(ROOT, service, 'engine.ts'))
  add(literalsAfter(engine, /\bthis\.fail\(/g), 'engine.ts')
  add(literalsAfter(engine, /\breturn (?=['"`][A-Z])/g), 'engine.ts')
  add(literalsAfter(engine, /\bexport const [A-Z_]+ =/g), 'engine.ts')
  const index = read(join(ROOT, service, 'index.ts'))
  add(literalsAfter(index, /\berror:/g), 'index.ts')
  add(literalsAfter(index, /\bconst (?:RESTARTING|SEAT_REVOKED|MANAGER_SEAT_GONE) =/g), 'index.ts')
  // reply(socket, ack, '…') and reply(socket, ack, ack ? '…' : `…`) refusals.
  add(literalsAfter(index, /\breply\(socket, ack, (?:ack \? )?/g), 'index.ts')
  add(literalsAfter(index, /\back \? '[^']*' : /g), 'index.ts')
  // Bid legality (rules.ts): every message literal in validateBid.
  const rules = read(join(ROOT, service, 'rules.ts'))
  const validate = rules.slice(rules.indexOf('export function validateBid'))
  add(literalsAfter(validate, /(?:return|\?|:)\s*(?=['"]|`[A-Z$])/g), 'rules.ts')
  // Seat-pass failures shown when a room join is refused.
  const crypto = read(join(ROOT, 'src/lib/crypto.ts'))
  const explain = crypto.slice(crypto.indexOf('export function explainTokenFailure'), crypto.indexOf('export function signToken'))
  add(literalsAfter(explain, /\breturn (?=['"`])/g), 'crypto.ts')

  // Status words and internal identifiers are not messages.
  for (const m of [...messages.keys()]) if (!/\s/.test(m)) messages.delete(m)
  return messages
}

test('every user-facing server and live-room message has a Bangla translation', () => {
  const messages = userFacingMessages()
  assert.ok(messages.size > 150, `expected to find the server messages, found ${messages.size}`)
  const missing = [...messages]
    .filter(([m]) => !ENGLISH_ONLY.has(m) && serverMessageBn(m) === m)
    .map(([m, where]) => `  ${JSON.stringify(m)}  (${where.replace(ROOT, '').replace(/\\/g, '/')})`)
  assert.deepEqual(missing, [], `Add these to src/lib/server-messages.ts:\n${missing.join('\n')}`)
})

test('live-room notices render in both languages, with a fallback for unknown codes', () => {
  for (const code of ROOM_MSG_CODES) {
    const params = { player: 'Rakib', team: 'Tigers', amount: 125000, round: 2, left: 3, count: 1, seconds: 30, category: 'B', number: 7, refund: 50000, base: 10000, by: 'Organizer', blocked: 1, auto: 1 }
    const en = roomText({ code, params }, 'en')
    const bn = roomText({ code, params }, 'bn')
    assert.ok(en.length > 0 && bn.length > 0, code)
    assert.notEqual(bn, en, `${code} has no Bangla`)
    assert.doesNotMatch(en + bn, /undefined|NaN|\[object/, code)
  }
  assert.equal(roomText({ code: 'sold', params: { player: 'Rakib', team: 'Tigers', amount: 125000 } }, 'en'), 'Rakib SOLD to Tigers for ৳1,25,000!')
  assert.equal(roomNoticeText({ code: 'from-a-newer-service', message: 'Hello' }, 'bn'), 'Hello')
  assert.equal(roomNoticeText({ message: 'Plain' }, 'bn'), 'Plain')
})
