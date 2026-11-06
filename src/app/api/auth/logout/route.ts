import { endCurrentSession } from '@/lib/auth'

export const runtime = 'nodejs'

// POST /api/auth/logout — revokes this session server-side (a copied cookie
// stops working) and clears the cookie. Other devices stay signed in.
export async function POST() {
  await endCurrentSession()
  return Response.json({ ok: true })
}
