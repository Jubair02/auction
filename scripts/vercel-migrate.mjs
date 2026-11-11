// Run by `npm run vercel-build` (Vercel uses that script instead of `build`),
// AFTER `next build`: a build that fails never touches the database, and a
// migration that fails fails the deployment, so the old version stays live.
//
// Production deployments always migrate. A preview deployment migrates its
// own database only when it can prove it is not production —
// PRODUCTION_DATABASE_URL is set and differs from its DATABASE_URL — so an
// unmerged branch never changes the live schema, and a preview of a PR with a
// new migration still works. Local builds and CI use `build`, which never
// migrates — run `npm run db:deploy` yourself there.
//
// Because the old deployment keeps serving until the new one is live, every
// migration must be backward compatible (add first; drop or rename only in a
// later release) — see "Migrations" in DEPLOY.md.
import { spawnSync } from 'node:child_process'

const env = process.env.VERCEL_ENV

// Cheap safety net: if PRODUCTION_DATABASE_URL (optional, any environment) is
// set and a preview build was given that same database, say so loudly —
// preview deployments must use their own Neon branch (see DEPLOY.md).
const prodUrl = process.env.PRODUCTION_DATABASE_URL?.trim()
if (env === 'preview' && prodUrl && process.env.DATABASE_URL?.trim() === prodUrl) {
  console.warn(
    '\n[vercel-migrate] WARNING: this PREVIEW deployment uses the PRODUCTION database (DATABASE_URL equals ' +
      'PRODUCTION_DATABASE_URL). Anything tested on this preview changes live data. Give Preview its own Neon ' +
      'branch — see "Separate databases per environment" in DEPLOY.md.\n',
  )
}

const ownPreviewDb = env === 'preview' && !!prodUrl && !!process.env.DATABASE_URL?.trim() && process.env.DATABASE_URL.trim() !== prodUrl

if (env !== 'production' && !ownPreviewDb) {
  console.log(
    `[vercel-migrate] VERCEL_ENV=${env ?? 'unset'} — skipping database migrations` +
      (env === 'preview' && !prodUrl
        ? ' (set PRODUCTION_DATABASE_URL so previews can prove they have their own database and migrate it).'
        : '.'),
  )
  process.exit(0)
}

console.log(
  env === 'production'
    ? '[vercel-migrate] Production deployment — applying database migrations…'
    : '[vercel-migrate] Preview deployment with its own database — applying database migrations…',
)
// migrate.mjs runs over a direct (non-pooled) connection — see the note there.
const result = spawnSync('node', ['scripts/migrate.mjs'], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
