import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isSport, type TournamentAccess } from '@/lib/types'
import { jsonError } from '@/lib/auth'
import { normalizeBdPhone } from '@/lib/phone'
import {
  coercePositiveInt,
  hiddenByArchive,
  accessAllows,
  isOwnerOrAdmin,
  loadTournamentForOwner,
  tournamentAccess,
  parseDateInput,
  parseOtherSportDetails,
  readJson,
  requireSession,
  serializeAuction,
  serializePlayer,
  serializeTeam,
  serializeTournamentFull,
  IMAGE_URL_ERROR,
  parseImageUrl,
} from '../../_lib/helpers'

/** Stands in for another manager's account id when the viewer may not see it (only "is linked" matters). */
const LINKED_MANAGER = 'linked'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/tournaments/:id — owner/ADMIN (full detail); MANAGER managing a team in it also allowed
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params

  // The session check and the tournament lookup don't depend on each other —
  // run them together. Nothing is returned before the permission check below.
  const [auth, tournament] = await Promise.all([requireSession(), db.tournament.findUnique({ where: { id } })])
  if ('response' in auth) return auth.response
  const { user } = auth
  if (!tournament || hiddenByArchive(tournament, user)) return jsonError('Tournament not found', 404)

  // Staff (owner, ADMIN, co-organizer, auctioneer) see organizer data.
  const staffAccess = await tournamentAccess(tournament, user)
  const canManage = staffAccess !== null
  if (!canManage) {
    // Managers of a team inside this tournament can view the detail (squad views)
    const managesTeam = await db.team.findFirst({
      where: { tournamentId: id, managerUserId: user.id },
      select: { id: true },
    })
    if (!managesTeam) return jsonError('You do not have permission to view this tournament', 403)
  }
  const myAccess: TournamentAccess = staffAccess ?? 'MANAGER'

  const [players, teams, auction] = await Promise.all([
    db.player.findMany({
      where: { tournamentId: id },
      orderBy: { playerNumber: 'asc' },
      include: { soldToTeam: { select: { name: true } } },
    }),
    db.team.findMany({
      where: { tournamentId: id },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { players: { where: { status: 'SOLD' } } } },
        manager: { select: { name: true, email: true } },
      },
    }),
    db.auction.findUnique({ where: { tournamentId: id } }),
  ])

  // Player phone numbers are organizer data — team managers and auctioneers
  // (who only run the room) get the squad, not the contacts.
  const seesContacts = staffAccess !== null && staffAccess !== 'AUCTIONEER'
  const toPlayer = seesContacts
    ? serializePlayer
    : (p: (typeof players)[number]) => ({ ...serializePlayer(p), phone: null })

  // Likewise other managers' accounts are organizer data: not their emails, and
  // not their account ids either (an id is enough to link that manager to a
  // team elsewhere and read their email back). A manager keeps their own id;
  // other linked teams only show that a manager is linked.
  const toTeam = seesContacts
    ? serializeTeam
    : (t: (typeof teams)[number]) => ({
        ...serializeTeam(t),
        managerEmail: null,
        managerUserId: t.managerUserId === null ? null : t.managerUserId === user.id ? user.id : LINKED_MANAGER,
      })

  return Response.json({
    tournament: serializeTournamentFull(tournament),
    myAccess,
    players: players.map(toPlayer),
    teams: teams.map(toTeam),
    auction: auction ? serializeAuction(auction) : null,
  })
}

// PATCH /api/tournaments/:id — owner/ADMIN; no auctionMode/status change once LIVE/COMPLETED
export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const loaded = await loadTournamentForOwner(id, user, 'manage')
  if ('response' in loaded) return loaded.response
  const { tournament } = loaded

  const body = await readJson(req)
  if (!body) return jsonError('Invalid request body', 400)

  const isLocked = tournament.status === 'LIVE' || tournament.status === 'COMPLETED'
  if (isLocked && body.auctionMode !== undefined && body.auctionMode !== tournament.auctionMode) {
    return jsonError('Auction mode cannot be changed once the tournament is live or completed', 409)
  }
  // Player roles are sport-specific; switching sport mid-auction orphans them.
  if (isLocked && body.sport !== undefined && body.sport !== tournament.sport) {
    return jsonError('Sport cannot be changed once the tournament is live or completed', 409)
  }

  const data: Partial<Prisma.TournamentUpdateInput> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 80) return jsonError('Tournament name must be 2–80 characters', 400)
    data.name = name
  }

  if (body.sport !== undefined) {
    if (!isSport(body.sport)) {
      return jsonError('Sport must be CRICKET, FOOTBALL or OTHER', 400)
    }
    data.sport = body.sport
  }

  // "Others" details: validated against the sport the tournament will have.
  // Switching to Others needs a game name; switching away clears them.
  const nextSport = (data.sport as string | undefined) ?? tournament.sport
  const otherFieldSent = ['sportName', 'playerRoles', 'playersPerTeam', 'playersOnField'].some((k) => body[k] !== undefined)
  if (otherFieldSent || nextSport !== tournament.sport) {
    const other = parseOtherSportDetails(nextSport, body, nextSport === 'OTHER' && tournament.sport !== 'OTHER')
    if (!other.ok) return jsonError(other.error, 400)
    const merged = { playersPerTeam: tournament.playersPerTeam, playersOnField: tournament.playersOnField, ...other.data }
    if (merged.playersPerTeam && merged.playersOnField && merged.playersOnField > merged.playersPerTeam) {
      return jsonError('Playing on field cannot be more than players per team', 400)
    }
    Object.assign(data, other.data)
  }

  if (body.auctionMode !== undefined) {
    if (body.auctionMode !== 'CATEGORY' && body.auctionMode !== 'NORMAL') {
      return jsonError('Auction mode must be CATEGORY or NORMAL', 400)
    }
    data.auctionMode = body.auctionMode
  }

  if (body.basePrice !== undefined) {
    const basePrice = coercePositiveInt(body.basePrice)
    if (!basePrice) return jsonError('Base price must be a whole amount from ৳1 to ৳1,000,000,000', 400)
    data.basePrice = basePrice
  }

  const nullableString = (key: string, max: number) => {
    if (body[key] === undefined) return
    if (body[key] === null || body[key] === '') {
      data[key] = null
      return
    }
    if (typeof body[key] !== 'string') {
      data[key] = null
      return
    }
    data[key] = (body[key] as string).trim().slice(0, max) || null
  }
  nullableString('tournamentType', 60)
  nullableString('description', 2000)
  for (const key of ['logoUrl', 'bannerUrl'] as const) {
    const url = parseImageUrl(body[key])
    // An old pasted link sent back unchanged is kept rather than blocking the save.
    if (url === false && body[key] !== tournament[key]) return jsonError(IMAGE_URL_ERROR, 400)
    if (url !== undefined && url !== false) data[key] = url
  }
  nullableString('location', 120)

  for (const key of ['startDate', 'auctionAt'] as const) {
    if (body[key] !== undefined) {
      const parsed = parseDateInput(body[key])
      if (!parsed.ok) return jsonError(`${key} must be a valid date (ISO string)`, 400)
      data[key] = parsed.date
    }
  }

  if (body.resultsPublic !== undefined) {
    if (typeof body.resultsPublic !== 'boolean') return jsonError('resultsPublic must be true or false', 400)
    data.resultsPublic = body.resultsPublic
  }

  // Registration fee: paid by players straight to the organizer's own numbers.
  if (body.registrationFee !== undefined) {
    if (body.registrationFee === null || body.registrationFee === '' || body.registrationFee === 0) {
      data.registrationFee = null
    } else {
      const fee = coercePositiveInt(body.registrationFee)
      if (!fee || fee > 100_000) return jsonError('Registration fee must be a whole amount from ৳1 to ৳100,000', 400)
      data.registrationFee = fee
    }
  }
  for (const key of ['feeBkashNumber', 'feeNagadNumber'] as const) {
    if (body[key] === undefined) continue
    if (body[key] === null || body[key] === '') {
      data[key] = null
      continue
    }
    const phone = typeof body[key] === 'string' ? normalizeBdPhone(body[key] as string) : null
    if (!phone) return jsonError('Enter a valid Bangladeshi mobile number, e.g. 01712345678', 400)
    data[key] = phone
  }
  nullableString('feeInstructions', 300)
  // Where players send their fee is money routing: only the owner (or an
  // ADMIN) may change it — a co-organizer could otherwise point every
  // registration fee at their own bKash number. Re-sending the same value is fine.
  if (!accessAllows(loaded.access, 'owner')) {
    for (const key of ['feeBkashNumber', 'feeNagadNumber', 'feeInstructions'] as const) {
      if (data[key] !== undefined && (data[key] ?? null) !== (tournament[key] ?? null)) {
        return jsonError('Only the tournament owner can change where registration fees are paid', 403)
      }
    }
  }
  const nextFee = data.registrationFee !== undefined ? (data.registrationFee as number | null) : tournament.registrationFee
  const nextBkash = data.feeBkashNumber !== undefined ? data.feeBkashNumber : tournament.feeBkashNumber
  const nextNagad = data.feeNagadNumber !== undefined ? data.feeNagadNumber : tournament.feeNagadNumber
  if (nextFee && !nextBkash && !nextNagad) {
    return jsonError('Add a bKash or Nagad number so players know where to pay the registration fee', 400)
  }

  // SMS costs money per message, so it is a Pro feature.
  if (body.smsEnabled !== undefined) {
    if (typeof body.smsEnabled !== 'boolean') return jsonError('smsEnabled must be true or false', 400)
    if (body.smsEnabled && tournament.plan !== 'PRO') {
      return jsonError('SMS notifications are a Pro feature — upgrade this tournament to turn them on', 402)
    }
    data.smsEnabled = body.smsEnabled
  }
  if (body.smsLang !== undefined) {
    if (body.smsLang !== 'bn' && body.smsLang !== 'en') return jsonError('smsLang must be bn or en', 400)
    data.smsLang = body.smsLang
  }

  // League settings (fixtures, points table).
  if (body.leagueFormat !== undefined) {
    const formats = ['ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'GROUPS_KNOCKOUT', 'KNOCKOUT']
    if (body.leagueFormat !== null && !formats.includes(body.leagueFormat as string)) {
      return jsonError('League format must be ROUND_ROBIN, DOUBLE_ROUND_ROBIN, GROUPS_KNOCKOUT or KNOCKOUT', 400)
    }
    data.leagueFormat = (body.leagueFormat as string | null) ?? null
  }
  for (const key of ['pointsWin', 'pointsDraw', 'pointsLoss'] as const) {
    if (body[key] === undefined) continue
    if (body[key] === null || body[key] === '') {
      data[key] = null
      continue
    }
    const n = Number(body[key])
    if (!Number.isInteger(n) || n < 0 || n > 10) return jsonError('Points must be a whole number from 0 to 10', 400)
    data[key] = n
  }
  if (body.oversPerInnings !== undefined) {
    if (body.oversPerInnings === null || body.oversPerInnings === '') {
      data.oversPerInnings = null
    } else {
      const n = Number(body.oversPerInnings)
      if (!Number.isInteger(n) || n < 1 || n > 50) return jsonError('Overs per innings must be from 1 to 50', 400)
      data.oversPerInnings = n
    }
  }

  // Branding (Pro): accent colour and hiding NeelamGhor branding on public surfaces.
  if (body.brandColor !== undefined) {
    if (body.brandColor === null || body.brandColor === '') {
      data.brandColor = null
    } else if (typeof body.brandColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.brandColor)) {
      return jsonError('Brand colour must be a hex colour like #0F766E', 400)
    } else {
      data.brandColor = body.brandColor.toUpperCase()
    }
  }
  if (body.brandHidePlatform !== undefined) {
    if (typeof body.brandHidePlatform !== 'boolean') return jsonError('brandHidePlatform must be true or false', 400)
    if (body.brandHidePlatform && tournament.plan !== 'PRO') {
      return jsonError('Custom branding is a Pro feature — upgrade this tournament to use it', 402)
    }
    data.brandHidePlatform = body.brandHidePlatform
  }

  if (Object.keys(data).length === 0) return jsonError('No valid fields to update', 400)

  try {
    const updated = await db.tournament.update({ where: { id }, data })
    return Response.json({ tournament: serializeTournamentFull(updated) })
  } catch {
    return jsonError('Could not update tournament', 400)
  }
}

// DELETE /api/tournaments/:id — owner/ADMIN; blocked while the auction is LIVE or PAUSED.
// A tournament whose auction has bids or audit events is ARCHIVED instead
// (hidden, links dead, money trail kept) → {ok, archived: true}. Otherwise it is
// deleted. An ADMIN can force a permanent delete with ?hard=1.
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response
  const { user } = auth

  const tournament = await db.tournament.findUnique({ where: { id }, include: { auction: true } })
  if (!tournament || hiddenByArchive(tournament, user)) return jsonError('Tournament not found', 404)
  // Only the owner (or an ADMIN) may delete — not co-organizers or auctioneers.
  if (!isOwnerOrAdmin(tournament, user)) {
    return jsonError('Only the tournament owner can delete this tournament', 403)
  }

  if (tournament.auction?.status === 'LIVE' || tournament.auction?.status === 'PAUSED') {
    return jsonError('Cannot delete a tournament while its auction is live or paused — end the auction first', 409)
  }

  const hard = user.role === 'ADMIN' && new URL(req.url).searchParams.get('hard') === '1'
  if (!hard && tournament.auction) {
    const auctionId = tournament.auction.id
    const [bids, events] = await Promise.all([
      db.bid.count({ where: { auctionId }, take: 1 }),
      db.auctionEvent.count({ where: { auctionId }, take: 1 }),
    ])
    if (bids > 0 || events > 0) {
      if (!tournament.archivedAt) {
        // Close the sign-up link too, so nothing new attaches to it.
        await db.tournament.update({ where: { id }, data: { archivedAt: new Date(), registrationOpen: false } })
      }
      return Response.json({ ok: true, archived: true })
    }
  }

  // RoomParticipant has no FK relation in the schema — clean up manually.
  if (tournament.auction) {
    await db.roomParticipant.deleteMany({ where: { auctionId: tournament.auction.id } })
  }
  // Players/Teams/Auction/Bids/AuctionEvents cascade via onDelete: Cascade.
  await db.tournament.delete({ where: { id } })

  return Response.json({ ok: true, archived: false })
}
