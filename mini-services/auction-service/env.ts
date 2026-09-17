// Bootstrap module — MUST be imported before anything that reads
// process.env (PrismaClient, src/lib/crypto). Bun only auto-loads the
// .env next to the closest package.json, which is THIS folder, so we
// manually load the parent project's .env (DATABASE_URL, AUCTION_SECRET).
// Values already present in the real environment are never overwritten.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

try {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url))
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!m || m[1].startsWith('#')) continue
    if (process.env[m[1]] === undefined || process.env[m[1]] === '') {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  }
} catch {
  // .env is optional — crypto.ts falls back to the dev secret and Prisma
  // relies on DATABASE_URL being present in the actual environment.
}
