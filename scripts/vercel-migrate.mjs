// Run by `npm run vercel-build` (Vercel uses that script instead of `build`).
// Applies database migrations ONLY for production deployments. Preview
// deployments (every branch / pull request) skip it, so an unmerged branch can
// never change the live database's schema. Local builds and CI use `build`,
// which never migrates — run `npm run db:deploy` yourself there.
import { spawnSync } from 'node:child_process'

const env = process.env.VERCEL_ENV

if (env !== 'production') {
  console.log(`[vercel-migrate] VERCEL_ENV=${env ?? 'unset'} — skipping database migrations.`)
  process.exit(0)
}

console.log('[vercel-migrate] Production deployment — applying database migrations…')
// migrate.mjs runs over a direct (non-pooled) connection — see the note there.
const result = spawnSync('node', ['scripts/migrate.mjs'], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
