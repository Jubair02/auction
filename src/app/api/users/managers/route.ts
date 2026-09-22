import { db } from '@/lib/db'
import { requireSessionRole } from '../../_lib/helpers'

export const runtime = 'nodejs'

// GET /api/users/managers?q=… — manager accounts an organizer can attach to a team.
// Organizers need this to link a team to a real manager login; only the minimum
// identifying fields are returned (no phone, no status history).
export async function GET(req: Request) {
  const auth = await requireSessionRole('ORGANIZER', 'ADMIN')
  if ('response' in auth) return auth.response

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()

  const users = await db.user.findMany({
    where: {
      role: 'MANAGER',
      status: 'ACTIVE',
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    take: 50,
    select: { id: true, name: true, email: true },
  })

  return Response.json({ managers: users })
}
