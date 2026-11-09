'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    cancel: 'Cancel',
  },
  bn: {
    cancel: 'বাতিল',
  },
} satisfies Strings<{
  cancel: string
}>

export function ConfirmShell({
  title,
  description,
  actionLabel,
  onAction,
  destructive = false,
  pending = false,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  destructive?: boolean
  /** Awaiting the server: the dialog stays open and can't be submitted twice. */
  pending?: boolean
}) {
  const tx = useStrings(STRINGS)
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{tx.cancel}</AlertDialogCancel>
        <AlertDialogAction
          className={cn(destructive && 'bg-rose-600 text-white hover:bg-rose-700')}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={(e) => {
            // Keep the dialog open until the server confirms; the caller closes it.
            e.preventDefault()
            onAction()
          }}
        >
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          {actionLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}
