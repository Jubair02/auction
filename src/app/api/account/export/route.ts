import { after } from 'next/server'
import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { track } from '@/lib/analytics'
import { rateLimit } from '@/lib/rate-limit-shared'
import { requireSession } from '../../_lib/helpers'

export const runtime = 'nodejs'

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

// GET /api/account/export — the caller's own data as a JSON download:
// profile, tournaments they own (with their teams and players, exactly what
// they already see as organizer), teams they manage, staff roles and payments.
export async function GET() {
  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const retryAfter = await rateLimit(`account-export:${user.id}`, 10, 60 * 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many exports. Please try again in ${retryAfter} seconds.`, 429)

  const [tournaments, managedTeams, staffRoles, payments] = await Promise.all([
    db.tournament.findMany({
      where: { organizerId: user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        auction: { select: { roomCode: true, status: true, createdAt: true } },
        teams: {
          orderBy: { name: 'asc' },
          include: { manager: { select: { name: true, email: true } } },
        },
        players: { orderBy: { playerNumber: 'asc' }, include: { soldToTeam: { select: { name: true } } } },
      },
    }),
    db.team.findMany({
      where: { managerUserId: user.id },
      include: {
        tournament: { select: { name: true, sport: true } },
        players: { select: { name: true, role: true, soldPrice: true }, orderBy: { name: 'asc' } },
      },
    }),
    db.tournamentStaff.findMany({ where: { userId: user.id }, include: { tournament: { select: { name: true } } } }),
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
  ])

  const data = {
    exportedAt: new Date().toISOString(),
    service: 'NeelamGhor',
    profile: { ...user },
    tournamentsOwned: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      sportName: t.sportName,
      tournamentType: t.tournamentType,
      description: t.description,
      location: t.location,
      startDate: iso(t.startDate),
      auctionAt: iso(t.auctionAt),
      status: t.status,
      plan: t.plan,
      archivedAt: iso(t.archivedAt),
      createdAt: iso(t.createdAt),
      smsEnabled: t.smsEnabled,
      smsLang: t.smsLang,
      registrationFee: t.registrationFee,
      feeBkashNumber: t.feeBkashNumber,
      feeNagadNumber: t.feeNagadNumber,
      auction: t.auction ? { ...t.auction, createdAt: iso(t.auction.createdAt) } : null,
      teams: t.teams.map((team) => ({
        name: team.name,
        captainName: team.captainName,
        managerName: team.manager?.name ?? null,
        managerEmail: team.manager?.email ?? null,
        budget: team.budget,
        spent: team.spent,
        minSquad: team.minSquad,
        maxSquad: team.maxSquad,
      })),
      players: t.players.map((p) => ({
        playerNumber: p.playerNumber,
        name: p.name,
        phone: p.phone,
        role: p.role,
        category: p.category,
        basePrice: p.basePrice,
        previousTeam: p.previousTeam,
        status: p.status,
        soldPrice: p.soldPrice,
        soldTo: p.soldToTeam?.name ?? null,
      })),
    })),
    teamsManaged: managedTeams.map((team) => ({
      tournament: team.tournament.name,
      sport: team.tournament.sport,
      team: team.name,
      budget: team.budget,
      spent: team.spent,
      squad: team.players,
    })),
    staffRoles: staffRoles.map((s) => ({ tournament: s.tournament.name, role: s.role, since: iso(s.createdAt) })),
    payments: payments.map((p) => ({
      tournamentName: p.tournamentName,
      amount: p.amount,
      method: p.method,
      trxId: p.trxId,
      senderNumber: p.senderNumber,
      status: p.status,
      reviewNote: p.reviewNote,
      createdAt: iso(p.createdAt),
      reviewedAt: iso(p.reviewedAt),
    })),
  }

  after(() => track('data_exported', { userId: user.id }))
  const day = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="neelamghor-my-data-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
