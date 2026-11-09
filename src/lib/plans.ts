// Per-tournament pricing. FREE tournaments are limited (teams, players) and the
// stream overlay carries a "Powered by NeelamGhor" watermark; PRO is unlocked
// once per tournament by an admin-approved bKash / Nagad payment.
//
// Every number lives in the Setting table so the admin can change it without a
// deploy. Server-only (uses the database).
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'

export const PLAN_SETTING_KEYS = {
  proPrice: 'pro_price',
  freeMaxTeams: 'free_max_teams',
  freeMaxPlayers: 'free_max_players',
  bkashNumber: 'pay_bkash_number',
  nagadNumber: 'pay_nagad_number',
  instructions: 'pay_instructions',
} as const

export const PLAN_DEFAULTS = { proPrice: 999, freeMaxTeams: 4, freeMaxPlayers: 60 }

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
 * Null when adding `add.teams` teams / `add.players` players keeps a FREE
 * tournament within its limits (PRO is unlimited); otherwise a 402 response
 * that tells the organizer to upgrade.
 */
export async function assertWithinPlan(
  tournament: { id: string; plan: string },
  add: { teams?: number; players?: number },
): Promise<Response | null> {
  if (tournament.plan === 'PRO') return null
  const settings = await getPlanSettings()
  if (add.teams) {
    const teams = await db.team.count({ where: { tournamentId: tournament.id } })
    if (teams + add.teams > settings.freeMaxTeams) {
      return jsonError(
        `The free plan allows up to ${settings.freeMaxTeams} teams. Upgrade this tournament to Pro for unlimited teams.`,
        402,
      )
    }
  }
  if (add.players) {
    const players = await db.player.count({ where: { tournamentId: tournament.id } })
    if (players + add.players > settings.freeMaxPlayers) {
      return jsonError(
        `The free plan allows up to ${settings.freeMaxPlayers} players. Upgrade this tournament to Pro for unlimited players.`,
        402,
      )
    }
  }
  return null
}
