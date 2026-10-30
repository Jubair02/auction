import { db } from '@/lib/db'

export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/uploads/:id — the stored WebP. Uploads are immutable (a new image
// gets a new id), so browsers and CDNs may cache them forever.
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response('Not found', { status: 404 })

  const row = await db.upload.findUnique({ where: { id }, select: { data: true, mime: true } })
  if (!row) return new Response('Not found', { status: 404 })

  return new Response(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  })
}
