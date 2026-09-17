// Crypto helpers — NO Next.js imports (shared by Next API routes,
// seed script and the socket mini-service via relative import).
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto'

export const AUCTION_SECRET = process.env.AUCTION_SECRET || 'bd-auction-dev-secret-2026'

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
  const sig = createHmac('sha256', AUCTION_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  try {
    const [data, sig] = token.split('.')
    if (!data || !sig) return null
    const expected = createHmac('sha256', AUCTION_SECRET).update(data).digest('base64url')
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
