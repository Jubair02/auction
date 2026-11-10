'use client'

import type { MouseEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLink } from '@/components/shared/app-link'
import { DASHBOARD_PATH } from '@/lib/access'
import { type Strings, useStrings } from '@/lib/i18n'
import { canGoBackInApp } from '@/lib/router'
import { useAuthState } from '@/lib/store'
import { cn } from '@/lib/utils'

const STRINGS = {
  en: { back: 'Back' },
  bn: { back: 'ফিরে যান' },
} satisfies Strings<{ back: string }>

/**
 * "Back" for pages people reach from many places (legal pages): returns to the
 * page they came from inside the app, or — opened from a shared link or a new
 * tab — to the home page (their dashboard when signed in). A real link, so it
 * also works without JavaScript and in a new tab.
 */
export function BackButton({ className }: { className?: string }) {
  const t = useStrings(STRINGS)
  const { user } = useAuthState()
  const fallback = user ? DASHBOARD_PATH : '/'

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!canGoBackInApp()) return // AppLink goes to the fallback
    e.preventDefault()
    window.history.back()
  }

  return (
    <Button asChild variant="ghost" size="sm" className={cn('-ml-2 text-muted-foreground print:hidden', className)}>
      <AppLink href={fallback} onClick={onClick}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> {t.back}
      </AppLink>
    </Button>
  )
}
