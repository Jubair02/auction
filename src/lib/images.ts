// Image normalisation for uploads. Every upload is decoded and re-encoded by
// sharp: EXIF (incl. GPS) is stripped, orientation applied, size bounded and
// the output is always WebP — so a file can never be served back as anything
// other than a small, clean image. No Next.js imports (unit-tested).
import sharp from 'sharp'

export type ImageKind = 'PHOTO' | 'LOGO' | 'BANNER'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // input size cap (phones shoot big JPEGs)

const PRESETS: Record<ImageKind, { width: number; height: number; fit: 'cover' | 'contain' }> = {
  PHOTO: { width: 512, height: 512, fit: 'cover' }, // square player portrait
  LOGO: { width: 256, height: 256, fit: 'contain' }, // whole mark, padded to a transparent square
  BANNER: { width: 1600, height: 600, fit: 'cover' },
}

export function isImageKind(v: unknown): v is ImageKind {
  return v === 'PHOTO' || v === 'LOGO' || v === 'BANNER'
}

export class InvalidImageError extends Error {}

export interface ProcessedImage {
  data: Buffer
  mime: 'image/webp'
  width: number
  height: number
  size: number
}

export async function processImage(input: Buffer, kind: ImageKind): Promise<ProcessedImage> {
  if (input.length === 0) throw new InvalidImageError('The file is empty')
  if (input.length > MAX_UPLOAD_BYTES) throw new InvalidImageError('Images must be 8 MB or smaller')

  const preset = PRESETS[kind]
  try {
    let pipeline = sharp(input, { limitInputPixels: 50_000_000, failOn: 'error' }).rotate() // honour EXIF orientation before it is stripped
    // Opaque inputs (JPEG) need an alpha channel or the padding comes out black.
    if (preset.fit === 'contain') pipeline = pipeline.ensureAlpha()
    const { data, info } = await pipeline
      .resize({
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        position: preset.fit === 'cover' ? 'attention' : 'centre',
        // Logos are padded with transparency to an exact square so they sit
        // whole and consistent inside the round team avatars.
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    return { data, mime: 'image/webp', width: info.width, height: info.height, size: info.size }
  } catch {
    throw new InvalidImageError('That file is not a supported image (use JPG, PNG, WebP or GIF)')
  }
}
