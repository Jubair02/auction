// Crypto helpers — NO Next.js imports (shared by Next API routes,
// seed script and the socket mini-service via relative import).
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto'

// Signs every session cookie and socket token. There is deliberately NO
// fallback: a default baked into the source would let anyone who has read it
// forge an organizer or admin identity. Read lazily so `next build` can import
// this module without the secret; the first sign/verify fails loudly instead.
const MIN_SECRET_LENGTH = 32

let cachedSecret: string | null = null

export function getAuctionSecret(): string {
  if (cachedSecret) return cachedSecret
  const secret = process.env.AUCTION_SECRET ?? ''
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUCTION_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters ` +
        '(e.g. `openssl rand -base64 48`). Refusing to sign or verify tokens without it.',
    )
  }
  cachedSecret = secret
  return secret
}

// ---------- Passwords (scrypt) ----------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// ---------- HMAC tokens (session + socket) ----------
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = { ...payload, exp: Date.now() + ttlSeconds * 1000 }
  const data = b64url(JSON.stringify(body))
  const sig = createHmac('sha256', getAuctionSecret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  // Outside the try: a missing secret is a deployment error, not an invalid token.
  const secret = getAuctionSecret()
  try {
    const [data, sig] = token.split('.')
    if (!data || !sig) return null
    const expected = createHmac('sha256', secret).update(data).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { exp?: number }
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload as unknown as T
  } catch {
    return null
  }
}

// ---------- One-time tokens (password reset links) ----------
/** 256-bit random, URL-safe. Sent to the user; never stored. */
export function generateOneTimeToken(): string {
  return randomBytes(32).toString('base64url')
}

/** What the database stores instead of the token itself. */
export function hashOneTimeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ---------- Random helpers ----------
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no confusing 0/O/1/L/I

export function generateRoomCode(): string {
  const year = String(new Date().getFullYear()).slice(-2)
  let suffix = ''
  for (let i = 0; i < 4; i++) suffix += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]
  return `BD${year}-${suffix}`
}

export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[randomInt(arr.length)]
}
