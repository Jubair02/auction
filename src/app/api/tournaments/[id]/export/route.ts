import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { toCsv } from '@/lib/csv'
import { loadTournamentForOwner, requireSession } from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tournament'
  )
}

function csvResponse(filename: string, body: string): Response {
  // UTF-8 BOM so Excel opens Bangla/Unicode content correctly
  return new Response('\uFEFF' + body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// GET /api/tournaments/:id/export?type=players|sold|unsold|squads|bids|spending|template
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user)
  if ('response' in loaded) return loaded.response
  const tournament = loaded.tournament

  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? ''
  const fileBase = `neelamghor-${type}-${slugify(tournament.name)}`

  if (type === 'template') {
    const csv = toCsv(
      ['Name', 'Phone', 'Role', 'Category', 'Base Price', 'Previous Team'],
      [
        ['Shakib Hasan', '01712345678', 'Batsman', 'A', 50000, 'Mirpur Club'],
        ['Tanvir Ahmed', '01898765432', 'Forward', '', 8000, ''],
      ],
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'players') {
    const players = await db.player.findMany({
      where: { tournamentId: id },
      orderBy: { playerNumber: 'asc' },
      include: { soldToTeam: { select: { name: true } } },
    })
    const csv = toCsv(
      ['#', 'Name', 'Phone', 'Role', 'Category', 'Base Price', 'Status', 'Sold Price', 'Sold To'],
      players.map((p) => [
        p.playerNumber,
        p.name,
        p.phone ?? '',
        p.role,
        p.category ?? '',
        p.basePrice,
        p.status,
        p.soldPrice ?? '',
        p.soldToTeam?.name ?? '',
      ]),
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'sold') {
    const players = await db.player.findMany({
      where: { tournamentId: id, status: 'SOLD' },
      orderBy: { playerNumber: 'asc' },
      include: { soldToTeam: { select: { name: true } } },
    })
    const csv = toCsv(
      ['#', 'Name', 'Role', 'Category', 'Sold Price', 'Team'],
      players.map((p) => [
        p.playerNumber,
        p.name,
        p.role,
        p.category ?? '',
        p.soldPrice ?? '',
        p.soldToTeam?.name ?? '',
      ]),
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'unsold') {
    const players = await db.player.findMany({
      where: { tournamentId: id, status: 'UNSOLD' },
      orderBy: { playerNumber: 'asc' },
    })
    const csv = toCsv(
      ['#', 'Name', 'Role', 'Category', 'Base Price'],
      players.map((p) => [p.playerNumber, p.name, p.role, p.category ?? '', p.basePrice]),
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'squads') {
    const teams = await db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: {
        players: {
          where: { status: 'SOLD' },
          orderBy: { soldPrice: 'desc' },
        },
      },
    })
    const rows: (string | number)[][] = []
    for (const team of teams) {
      for (const p of team.players) {
        rows.push([team.name, p.name, p.role, p.category ?? '', p.soldPrice ?? 0])
      }
    }
    const csv = toCsv(['Team', 'Player', 'Role', 'Category', 'Price'], rows)
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'bids') {
    const auction = await db.auction.findUnique({ where: { tournamentId: id } })
    const bids = auction
      ? await db.bid.findMany({ where: { auctionId: auction.id }, orderBy: { createdAt: 'asc' } })
      : []
    const csv = toCsv(
      ['Time', 'Player', 'Team', 'Amount'],
      bids.map((b) => [b.createdAt.toISOString(), b.playerName, b.teamName, b.amount]),
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'audit') {
    const auction = await db.auction.findUnique({ where: { tournamentId: id }, select: { id: true } })
    const events = auction
      ? await db.auctionEvent.findMany({ where: { auctionId: auction.id }, orderBy: { createdAt: 'asc' } })
      : []
    const csv = toCsv(
      ['Time', 'Event', 'Round', '#', 'Player', 'Team', 'Amount', 'Refund', 'By', 'Reason'],
      events.map((e) => [
        e.createdAt.toISOString(),
        e.type,
        e.cycle + 1,
        e.playerNumber ?? '',
        e.playerName ?? '',
        e.teamName ?? '',
        e.amount ?? '',
        e.refundAmount ?? '',
        e.actorName ?? 'system',
        e.reason ?? '',
      ]),
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  if (type === 'spending') {
    const teams = await db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { players: { where: { status: 'SOLD' } } } } },
    })
    const csv = toCsv(
      ['Team', 'Budget', 'Spent', 'Remaining', 'Players Bought', 'Squad Max', 'Squad Min'],
      teams.map((t) => [
        t.name,
        t.budget,
        t.spent,
        t.budget - t.spent,
        t._count.players,
        t.maxSquad,
        t.minSquad,
      ]),
    )
    return csvResponse(`${fileBase}.csv`, csv)
  }

  return jsonError(
    'Unknown export type. Use type=players|sold|unsold|squads|bids|spending|audit|template',
    400,
  )
}
