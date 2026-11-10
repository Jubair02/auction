// Fallback plan numbers, safe to import in the browser (plans.ts is
// server-only). The live values come from the admin's Setting rows via
// /api/plans; these are only shown when that lookup fails.
export const PLAN_DEFAULTS = { proPrice: 999, freeMaxTeams: 4, freeMaxPlayers: 60 }
