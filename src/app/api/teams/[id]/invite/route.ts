import { db } from '@/lib/db'
import { generateOneTimeToken, hashOneTimeToken } from '@/lib/crypto'
import { loadTeamForOwner, requireSession } from '../../../_lib/helpers'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const INVITE_TTL_DAYS = 7

// POST /api/teams/:id/invite — owner/ADMIN; issues a fresh single-use manager
// invite link for this team. Any previous link for the team stops working.
export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params

  const auth = await requireSession()
  if ('response' in auth) return auth.response

  const loaded = await loadTeamForOwner(id, auth.user)
  if ('response' in loaded) return loaded.response

  const token = generateOneTimeToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000)
  await db.team.update({
    where: { id },
    data: { inviteTokenHash: hashOneTimeToken(token), inviteExpiresAt: expiresAt },
  })

  // The client builds the URL from its own origin: /invite#<token>
  return Response.json({ token, expiresAt: expiresAt.toISOString() })
}
