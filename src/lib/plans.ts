// Per-tournament pricing. FREE tournaments are limited (teams, players) and the
// stream overlay carries a "Powered by NeelamGhor" watermark; PRO is unlocked
// once per tournament by an admin-approved bKash / Nagad payment.
//
// Every number lives in the Setting table so the admin can change it without a
// deploy. Server-only (uses the database).
import type { DbTx } from '@/lib/db'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { PLAN_DEFAULTS } from '@/lib/plan-defaults'

export { PLAN_DEFAULTS }

export const PLAN_SETTING_KEYS = {
  proPrice: 'pro_price',
  freeMaxTeams: 'free_max_teams',
  freeMaxPlayers: 'free_max_players',
  bkashNumber: 'pay_bkash_number',
  nagadNumber: 'pay_nagad_number',
  instructions: 'pay_instructions',
} as const

export interface PlanSettings {
  proPrice: number
  freeMaxTeams: number
  freeMaxPlayers: number
  /** Where organizers send the Pro payment (the platform's own numbers). */
  bkashNumber: string | null
  nagadNumber: string | null
  instructions: string | null
}

const positive = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export async function getPlanSettings(): Promise<PlanSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(PLAN_SETTING_KEYS) } } })
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() || undefined
  return {
    proPrice: positive(get(PLAN_SETTING_KEYS.proPrice), PLAN_DEFAULTS.proPrice),
    freeMaxTeams: positive(get(PLAN_SETTING_KEYS.freeMaxTeams), PLAN_DEFAULTS.freeMaxTeams),
    freeMaxPlayers: positive(get(PLAN_SETTING_KEYS.freeMaxPlayers), PLAN_DEFAULTS.freeMaxPlayers),
    bkashNumber: get(PLAN_SETTING_KEYS.bkashNumber) ?? null,
    nagadNumber: get(PLAN_SETTING_KEYS.nagadNumber) ?? null,
    instructions: get(PLAN_SETTING_KEYS.instructions) ?? null,
  }
}

/**
 * Serializes every change to a tournament's roster (teams, players) for the
 * rest of the transaction `tx`: two requests can't both pass the Free-plan
 * count and then both insert. A transaction-scoped advisory lock — released at
 * commit/rollback, safe behind PgBouncer's transaction pooling.
 */
export async function lockRoster(tx: DbTx, tournamentId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`roster:${tournamentId}`}))`
}

/**
 * Null when adding `add.teams` teams / `add.players` players keeps a FREE
 * tournament within its limits (PRO is unlimited); otherwise a 402 response
 * that tells the organizer to upgrade. Pass the transaction (after lockRoster)
 * to make the check binding; without one it is only an early, friendly check.
 */
export async function assertWithinPlan(
  tournament: { id: string; plan: string },
  add: { teams?: number; players?: number },
  client: DbTx = db,
): Promise<Response | null> {
  if (tournament.plan === 'PRO') return null
  const settings = await getPlanSettings()
  if (add.teams) {
    const teams = await client.team.count({ where: { tournamentId: tournament.id } })
    if (teams + add.teams > settings.freeMaxTeams) {
      return jsonError(
        `The free plan allows up to ${settings.freeMaxTeams} teams. Upgrade this tournament to Pro for unlimited teams.`,
        402,
      )
    }
  }
  if (add.players) {
    const players = await client.player.count({ where: { tournamentId: tournament.id } })
    if (players + add.players > settings.freeMaxPlayers) {
      return jsonError(
        `The free plan allows up to ${settings.freeMaxPlayers} players. Upgrade this tournament to Pro for unlimited players.`,
        402,
      )
    }
  }
  return null
}
