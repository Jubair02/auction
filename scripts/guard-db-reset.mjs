// `npm run db:reset`: drops and recreates the database DATABASE_URL points at
// (`prisma migrate reset`). Every row is lost, so it only runs when
// ALLOW_DB_RESET=1 is set explicitly and never in a production environment.
//
//   ALLOW_DB_RESET=1 npm run db:reset          (bash)
//   $env:ALLOW_DB_RESET=1; npm run db:reset    (PowerShell)
import { spawnSync } from 'node:child_process'

function refuse(reason) {
  console.error(`[db:reset] Refusing to run: ${reason}`)
  console.error('[db:reset] This DROPS every table in the database DATABASE_URL points at.')
  console.error('[db:reset] Use a development / preview database branch and set ALLOW_DB_RESET=1.')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  refuse('this looks like a production environment (NODE_ENV or VERCEL_ENV is "production").')
}
if (process.env.ALLOW_DB_RESET !== '1') refuse('ALLOW_DB_RESET=1 is not set.')

const result = spawnSync('npx', ['prisma', 'migrate', 'reset', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
