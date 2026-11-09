// `npm run db:backup`: a logical backup of the database with pg_dump.
//
// Writes ./backups/neelamghor-<timestamp>.dump (pg_dump custom format —
// compressed, restorable table by table with pg_restore). Connects over a
// DIRECT connection (DIRECT_URL, or DATABASE_URL with Neon's "-pooler"
// dropped, exactly like scripts/migrate.mjs): pg_dump does not work reliably
// through PgBouncer.
//
// Needs the PostgreSQL client tools (pg_dump) on PATH, at the same or a newer
// major version than the server (Neon runs Postgres 16/17).
//
// Restore (into an EMPTY database / Neon branch — see DEPLOY.md):
//   pg_restore --no-owner --no-privileges --dbname "<direct url>" backups/neelamghor-<timestamp>.dump
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

if (existsSync('.env')) process.loadEnvFile('.env')

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  return url.replace('-pooler.', '.').replace(/([?&])pgbouncer=true(&|$)/, (_m, pre, post) => (post ? pre : ''))
}

/**
 * Splits the URL into libpq environment variables (PGHOST, PGPASSWORD, …).
 * Passing them this way keeps the password out of argv / process listings, and
 * drops Prisma-only query parameters (pgbouncer, pool_timeout) that libpq rejects.
 */
function libpqEnv(urlString) {
  const url = new URL(urlString)
  const env = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  }
  const sslmode = url.searchParams.get('sslmode')
  if (sslmode) env.PGSSLMODE = sslmode
  const timeout = url.searchParams.get('connect_timeout')
  if (timeout) env.PGCONNECT_TIMEOUT = timeout
  return env
}

const raw = directUrl()
if (!raw) {
  console.error('[db:backup] DATABASE_URL (or DIRECT_URL) is not set.')
  process.exit(1)
}

const probe = spawnSync('pg_dump', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
if (probe.error || probe.status !== 0) {
  console.error('[db:backup] pg_dump was not found on PATH.')
  console.error('  Install the PostgreSQL client tools (same or newer major version as the database):')
  console.error('    macOS:   brew install libpq && brew link --force libpq')
  console.error('    Ubuntu:  sudo apt-get install postgresql-client-16   (or -17)')
  console.error('    Windows: install PostgreSQL from https://www.postgresql.org/download/windows/ and add its bin folder to PATH')
  process.exit(1)
}

const dir = 'backups'
mkdirSync(dir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = join(dir, `neelamghor-${stamp}.dump`)

console.log(`[db:backup] ${probe.stdout.trim()} → ${file}`)
const result = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', file], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...libpqEnv(raw) },
})

if (result.status !== 0) {
  if (existsSync(file)) unlinkSync(file)
  console.error('[db:backup] pg_dump failed — no backup was written.')
  process.exit(result.status ?? 1)
}
const mb = (statSync(file).size / (1024 * 1024)).toFixed(1)
console.log(`[db:backup] Done: ${file} (${mb} MB). Copy it off this machine (cloud storage) — a backup on the same disk is not a backup.`)
