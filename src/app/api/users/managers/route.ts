import { db } from '@/lib/db'
import { jsonError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { EMAIL_RE, requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

const LOOKUPS_PER_MINUTE = 30

// GET /api/users/managers?email=… — finds ONE manager account by exact email so
// an organizer can link it to a team. Deliberately not a search: organizers
// must already know the manager's login, so the endpoint cannot be used to
// list every manager's name and email on the platform.
export async function GET(req: Request) {
  const auth = await requireSessionRole('ORGANIZER', 'ADMIN')
  if ('response' in auth) return auth.response

  const retryAfter = rateLimit(`manager-lookup:${auth.user.id}`, LOOKUPS_PER_MINUTE, 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many lookups. Please try again in ${retryAfter} seconds.`, 429)

  const email = (new URL(req.url).searchParams.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return jsonError("Enter the manager's full login email", 400)

  const manager = await db.user.findFirst({
    where: { email, role: 'MANAGER', status: 'ACTIVE' },
    select: { id: true, name: true, email: true },
  })
  if (!manager) {
    return jsonError('No active team manager account uses that email. Ask them to register as a Team Manager first.', 404)
  }

  return Response.json({ manager })
}
