import { db } from '@/lib/db'
import { getSessionUser, jsonError } from '@/lib/auth'
import { InvalidImageError, MAX_UPLOAD_BYTES, isImageKind, processImage } from '@/lib/images'
import { clientKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/uploads — multipart form: file, kind (PHOTO | LOGO | BANNER)
//   Organizers/admins: any kind.
//   Anonymous: PHOTO only, and only with the `registrationCode` of a tournament
//   whose self-registration is open — so the endpoint is not free storage.
// → 201 {id, url}
export async function POST(req: Request) {
  const user = await getSessionUser()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return jsonError('Send the image as multipart form data', 400)
  }

  const kind = form.get('kind')
  if (!isImageKind(kind)) return jsonError('kind must be PHOTO, LOGO or BANNER', 400)

  const staff = user && (user.role === 'ORGANIZER' || user.role === 'ADMIN')
  if (!staff) {
    if (kind !== 'PHOTO') return jsonError('Log in as an organizer to upload logos and banners', 401)
    const code = form.get('registrationCode')
    const open =
      typeof code === 'string' && code !== ''
        ? await db.tournament.findFirst({ where: { registrationCode: code, registrationOpen: true }, select: { id: true } })
        : null
    if (!open) return jsonError('Uploads need an organizer login or an open registration link', 401)
  }

  const retryAfter = staff
    ? rateLimit(`upload:${user!.id}`, 120, 60 * 60 * 1000)
    : rateLimit(clientKey(req, 'upload-anon'), 10, 60 * 60 * 1000)
  if (retryAfter !== null) return jsonError(`Too many uploads. Please try again in ${retryAfter} seconds.`, 429)

  const file = form.get('file')
  if (!(file instanceof File)) return jsonError('Attach an image file', 400)
  if (file.size > MAX_UPLOAD_BYTES) return jsonError('Images must be 8 MB or smaller', 413)

  try {
    const image = await processImage(Buffer.from(await file.arrayBuffer()), kind)
    const row = await db.upload.create({
      data: {
        uploaderId: user?.id ?? null,
        kind,
        mime: image.mime,
        data: new Uint8Array(image.data),
        width: image.width,
        height: image.height,
        size: image.size,
      },
      select: { id: true },
    })
    return Response.json({ id: row.id, url: `/api/uploads/${row.id}` }, { status: 201 })
  } catch (err) {
    if (err instanceof InvalidImageError) return jsonError(err.message, 400)
    throw err
  }
}
