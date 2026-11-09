'use client'

import { useId, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    tooBig: 'This image is too large to upload (over 4 MB even after shrinking). Pick a smaller photo or take a screenshot of it.',
    unreadable: 'That file could not be read as an image. Use a JPG, PNG, WebP or GIF.',
    uploadFailed: (status: number) => `Upload failed (${status})`,
    change: 'Change',
    upload: 'Upload',
    remove: 'Remove',
  },
  bn: {
    tooBig: 'ছবিটি আপলোডের জন্য খুব বড় (ছোট করার পরেও 4 MB-এর বেশি)। আরও ছোট একটি ছবি বেছে নিন বা ছবিটির স্ক্রিনশট নিন।',
    unreadable: 'ফাইলটি ছবি হিসেবে পড়া যায়নি। JPG, PNG, WebP বা GIF ব্যবহার করুন।',
    uploadFailed: (status: number) => `আপলোড হয়নি (${status})`,
    change: 'বদলান',
    upload: 'আপলোড করুন',
    remove: 'সরান',
  },
} satisfies Strings<{
  tooBig: string
  unreadable: string
  uploadFailed: (status: number) => string
  change: string
  upload: string
  remove: string
}>

type Kind = 'PHOTO' | 'LOGO' | 'BANNER'

interface ImageUploadProps {
  label: string
  kind: Kind
  value: string | null
  onChange: (url: string | null) => void
  /** Lets an anonymous player upload a photo through an open registration link. */
  registrationCode?: string
  disabled?: boolean
  className?: string
}

// The server's cap (src/lib/images.ts): Vercel rejects request bodies over 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024
// Longest side after shrinking. The server re-encodes to at most 1600 px
// (banners) anyway, so nothing visible is lost.
const MAX_EDGE = 1600
// Small files go up untouched — the server re-encodes everything regardless.
const SHRINK_ABOVE_BYTES = 1024 * 1024
const QUALITY = 0.85

class UnreadableImageError extends Error {}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new UnreadableImageError())
    }
    img.src = url
  })
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))

/**
 * Phone photos are often 5–15 MB, over what the host accepts in one request.
 * Draws big images onto a canvas at most MAX_EDGE px on the longest side and
 * re-encodes them (logos keep transparency as WebP/PNG; photos and banners
 * become JPEG). <img> applies the EXIF rotation, so portraits stay upright.
 * Animated GIFs become their first frame — the server stores a still anyway.
 */
async function shrinkForUpload(file: File, kind: Kind): Promise<Blob> {
  if (file.size <= SHRINK_ABOVE_BYTES) return file
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  let blob: Blob | null
  if (kind === 'LOGO') {
    ctx.drawImage(img, 0, 0, width, height)
    blob = await toBlob(canvas, 'image/webp')
    // Browsers without WebP encoding (older Safari) return PNG for any unknown type.
    if (blob && blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/png')
  } else {
    ctx.fillStyle = '#ffffff' // JPEG has no transparency
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    blob = await toBlob(canvas, 'image/jpeg')
  }
  return blob && blob.size < file.size ? blob : file
}

/** Pick → upload to /api/uploads (re-encoded server-side) → preview, with remove. */
export function ImageUpload({ label, kind, value, onChange, registrationCode, disabled, className }: ImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const t = useStrings(STRINGS)

  async function upload(file: File) {
    setUploading(true)
    try {
      let image: Blob
      try {
        image = await shrinkForUpload(file, kind)
      } catch (e) {
        if (!(e instanceof UnreadableImageError)) throw e
        // The browser cannot decode it (e.g. an exotic format): let the
        // server judge it if it is small enough to send.
        if (file.size > MAX_BYTES) throw new Error(t.unreadable)
        image = file
      }
      if (image.size > MAX_BYTES) throw new Error(t.tooBig)
      const form = new FormData()
      const ext = image === file ? '' : image.type === 'image/jpeg' ? '.jpg' : image.type === 'image/png' ? '.png' : '.webp'
      form.append('file', image, image === file ? file.name : `${file.name.replace(/\.[^.]*$/, '') || 'image'}${ext}`)
      form.append('kind', kind)
      if (registrationCode) form.append('registrationCode', registrationCode)
      const res = await fetch('/api/uploads', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      // 413 comes from our size check or from the host itself (no JSON body then).
      if (res.status === 413) throw new Error(t.tooBig)
      if (!res.ok || !data?.url) throw new Error(data?.error || t.uploadFailed(res.status))
      onChange(data.url)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const previewShape =
    kind === 'BANNER' ? 'h-20 w-full rounded-lg' : kind === 'LOGO' ? 'h-16 w-16 rounded-full' : 'h-16 w-16 rounded-xl'

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium leading-none">
        {label}
      </label>
      <div className={cn('flex gap-3', kind === 'BANNER' ? 'flex-col' : 'items-center')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden border bg-muted/50 text-muted-foreground',
            previewShape,
          )}
        >
          {value ? (
            <img src={value} alt="" className={cn('h-full w-full', kind === 'LOGO' ? 'object-contain' : 'object-cover')} />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />}
            {value ? t.change : t.upload}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" className="h-9" disabled={disabled || uploading} onClick={() => onChange(null)}>
              <X className="mr-1 h-4 w-4" aria-hidden /> {t.remove}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
