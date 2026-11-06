'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Strings, useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STRINGS = {
  en: {
    couldntLoad: (what: string) => `Couldn't load ${what}`,
    checkConnection: 'Check your connection and try again.',
    tryAgain: 'Try again',
  },
  bn: {
    couldntLoad: (what: string) => `${what} লোড করা যায়নি`,
    checkConnection: 'ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।',
    tryAgain: 'আবার চেষ্টা করুন',
  },
} satisfies Strings<{ couldntLoad: (what: string) => string; checkConnection: string; tryAgain: string }>

/**
 * Shown when data failed to load — instead of an empty state ("no tournaments
 * yet") or a loading skeleton that never ends, which both look like real data.
 */
export function LoadError({
  what,
  error,
  onRetry,
  className,
}: {
  /** e.g. "your tournaments" */
  what: string
  error?: Error | null
  onRetry: () => Promise<void> | void
  className?: string
}) {
  const [retrying, setRetrying] = useState(false)
  const t = useStrings(STRINGS)
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center', className)}
    >
      <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-semibold">{t.couldntLoad(what)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message ? `${error.message}. ` : ''}{t.checkConnection}
        </p>
      </div>
      <Button
        variant="outline"
        disabled={retrying}
        onClick={async () => {
          setRetrying(true)
          try {
            await onRetry()
          } finally {
            setRetrying(false)
          }
        }}
      >
        {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
        {t.tryAgain}
      </Button>
    </div>
  )
}
