'use client'

import { toast } from 'sonner'
import { currentLang } from '@/lib/i18n'

const COPY_FAILED = {
  en: 'Could not copy — please copy manually',
  bn: 'কপি করা যায়নি — হাতে কপি করে নিন',
} as const

/** Copies text and confirms with a toast (or says to copy by hand when the browser refuses). */
export function copyText(text: string, successMessage: string): void {
  const fail = () => toast.error(COPY_FAILED[currentLang()])
  // No Clipboard API on plain-http pages (e.g. a LAN address) — say so instead of throwing.
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    fail()
    return
  }
  navigator.clipboard.writeText(text).then(() => toast.success(successMessage), fail)
}
