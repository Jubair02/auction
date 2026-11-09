// Run by `npm run vercel-build` (Vercel uses that script instead of `build`).
// Applies database migrations ONLY for production deployments. Preview
// deployments (every branch / pull request) skip it, so an unmerged branch can
// never change the live database's schema. Local builds and CI use `build`,
// which never migrates — run `npm run db:deploy` yourself there.
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

if (env !== 'production') {
  console.log(`[vercel-migrate] VERCEL_ENV=${env ?? 'unset'} — skipping database migrations.`)
  process.exit(0)
}

console.log('[vercel-migrate] Production deployment — applying database migrations…')
// migrate.mjs runs over a direct (non-pooled) connection — see the note there.
const result = spawnSync('node', ['scripts/migrate.mjs'], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
