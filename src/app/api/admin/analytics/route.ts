import { db } from '@/lib/db'
import { clampInt, requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD in Bangladesh time for each day of the window, oldest first. */
function dayKeys(days: number): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' })
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) keys.push(fmt.format(new Date(Date.now() - i * DAY_MS)))
  return keys
}

type DayRow = { day: string; n: number }

// GET /api/admin/analytics?days=30 — ADMIN only.
//  events:  count per event name in the window (AnalyticsEvent)
//  series:  daily sign-ups and new tournaments (from the User / Tournament
//           tables, so history before tracking began is included) and
//           completed auctions (auction_completed events)
//  funnel:  organizers who signed up in the window → created a tournament →
//           created an auction → completed one → went Pro (distinct users)
//  tournamentFunnel: tournaments created in the window → auction → completed → Pro
//  totals:  all-time platform totals plus SMS outcomes in the window
export async function GET(req: Request) {
  const auth = await requireSessionRole('ADMIN')
  if ('response' in auth) return auth.response

  const days = clampInt(new URL(req.url).searchParams.get('days'), 1, 365, 30)
  const keys = dayKeys(days)
  // Start of the first day in Dhaka (UTC+6, no DST).
  const since = new Date(`${keys[0]}T00:00:00+06:00`)

  const cohort = { role: 'ORGANIZER', createdAt: { gte: since } }
  const newTournaments = { createdAt: { gte: since } }

  const [
    eventGroups,
    signupDays,
    tournamentDays,
    completedDays,
    fSignedUp,
    fTournament,
    fAuction,
    fCompleted,
    fPro,
    tCreated,
    tAuction,
    tCompleted,
    tPro,
    users,
    organizers,
    managers,
    tournaments,
    auctions,
    completedAuctions,
    proTournaments,
    smsGroups,
  ] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ['name'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM "Tournament" WHERE "createdAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM "AnalyticsEvent" WHERE "name" = 'auction_completed' AND "createdAt" >= ${since} GROUP BY 1`,
    db.user.count({ where: cohort }),
    db.user.count({ where: { ...cohort, tournaments: { some: {} } } }),
    db.user.count({ where: { ...cohort, tournaments: { some: { auction: { isNot: null } } } } }),
    db.user.count({ where: { ...cohort, tournaments: { some: { auction: { is: { status: 'ENDED' } } } } } }),
    db.user.count({ where: { ...cohort, tournaments: { some: { plan: 'PRO' } } } }),
    db.tournament.count({ where: newTournaments }),
    db.tournament.count({ where: { ...newTournaments, auction: { isNot: null } } }),
    db.tournament.count({ where: { ...newTournaments, auction: { is: { status: 'ENDED' } } } }),
    db.tournament.count({ where: { ...newTournaments, plan: 'PRO' } }),
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, role: 'ORGANIZER' } }),
    db.user.count({ where: { deletedAt: null, role: 'MANAGER' } }),
    db.tournament.count({ where: { archivedAt: null } }),
    db.auction.count(),
    db.auction.count({ where: { status: 'ENDED' } }),
    db.tournament.count({ where: { plan: 'PRO' } }),
    db.notification.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ])

  const toSeries = (rows: DayRow[]) => {
    const byDay = new Map(rows.map((r) => [r.day, Number(r.n)]))
    return keys.map((day) => ({ day, count: byDay.get(day) ?? 0 }))
  }
  const sms: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 }
  for (const g of smsGroups) sms[g.status] = g._count._all

  return Response.json({
    days,
    since: since.toISOString(),
    events: Object.fromEntries(eventGroups.map((g) => [g.name, g._count._all])),
    series: {
      signup: toSeries(signupDays),
      tournament_created: toSeries(tournamentDays),
      auction_completed: toSeries(completedDays),
    },
    funnel: [
      { step: 'signed_up', count: fSignedUp },
      { step: 'created_tournament', count: fTournament },
      { step: 'created_auction', count: fAuction },
      { step: 'completed_auction', count: fCompleted },
      { step: 'went_pro', count: fPro },
    ],
    tournamentFunnel: [
      { step: 'created_tournament', count: tCreated },
      { step: 'created_auction', count: tAuction },
      { step: 'completed_auction', count: tCompleted },
      { step: 'went_pro', count: tPro },
    ],
    totals: { users, organizers, managers, tournaments, auctions, completedAuctions, proTournaments, sms },
  })
}
