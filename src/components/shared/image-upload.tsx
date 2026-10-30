'use client'

import { useId, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    tooBig: 'Images must be 8 MB or smaller',
    uploadFailed: (status: number) => `Upload failed (${status})`,
    change: 'Change',
    upload: 'Upload',
    remove: 'Remove',
  },
  bn: {
    tooBig: 'ছবি সর্বোচ্চ 8 MB হতে পারবে',
    uploadFailed: (status: number) => `আপলোড হয়নি (${status})`,
    change: 'বদলান',
    upload: 'আপলোড করুন',
    remove: 'সরান',
  },
} satisfies Strings<{
  tooBig: string
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

const MAX_BYTES = 8 * 1024 * 1024

/** Pick → upload to /api/uploads (re-encoded server-side) → preview, with remove. */
export function ImageUpload({ label, kind, value, onChange, registrationCode, disabled, className }: ImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const t = useStrings(STRINGS)

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(t.tooBig)
      return
    }
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    if (registrationCode) form.append('registrationCode', registrationCode)
    setUploading(true)
    try {
      const res = await fetch('/api/uploads', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
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
