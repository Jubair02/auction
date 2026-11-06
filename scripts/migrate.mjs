// `npm run db:deploy` (and production Vercel builds via vercel-migrate.mjs):
// applies Prisma migrations over a DIRECT database connection.
//
// Why: `prisma migrate deploy` holds a Postgres advisory lock for the whole
// run. Through Neon's pooler (PgBouncer, the "-pooler" host in DATABASE_URL)
// that lock can be left on a pooled server connection, and every later
// migration then times out with P1002 until the pooler recycles it.
//
// Uses DIRECT_URL when set; otherwise derives Neon's direct host from
// DATABASE_URL by dropping "-pooler" (and the pgbouncer flag).
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// Locally the URL lives in .env (Prisma reads it itself, plain Node doesn't).
// loadEnvFile never overrides variables already set, e.g. on Vercel.
if (existsSync('.env')) process.loadEnvFile('.env')

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  return url.replace('-pooler.', '.').replace(/([?&])pgbouncer=true(&|$)/, (_m, pre, post) => (post ? pre : ''))
}

const url = directUrl()
if (!url) {
  console.error('[migrate] DATABASE_URL (or DIRECT_URL) is not set.')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
})
process.exit(result.status ?? 1)
