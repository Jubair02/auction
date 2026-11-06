'use client'

import { toast } from 'sonner'

/** Copies text and confirms with a toast (or says to copy by hand when the browser refuses). */
export function copyText(text: string, successMessage: string): void {
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(successMessage))
    .catch(() => toast.error('Could not copy — please copy manually'))
}
