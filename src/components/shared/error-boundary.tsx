'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { reportClientError } from '@/lib/client-error-report'
import { type Strings, useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STRINGS = {
  en: {
    title: 'Something went wrong',
    body: 'This part of the page hit an unexpected error. Try again, or reload the page if it keeps happening.',
    roomTitle: 'The live room hit a problem',
    roomBody: 'The auction itself carries on. Reload the room to get back to the live floor.',
    tryAgain: 'Try again',
    reload: 'Reload',
    reloadRoom: 'Reload room',
  },
  bn: {
    title: 'কিছু একটা সমস্যা হয়েছে',
    body: 'পেজের এই অংশে একটি অপ্রত্যাশিত সমস্যা হয়েছে। আবার চেষ্টা করুন, বারবার হলে পেজটি রিলোড করুন।',
    roomTitle: 'লাইভ রুমে একটি সমস্যা হয়েছে',
    roomBody: 'নিলাম নিজের মতো চলছে। লাইভ নিলামে ফিরতে রুমটি রিলোড করুন।',
    tryAgain: 'আবার চেষ্টা করুন',
    reload: 'রিলোড করুন',
    reloadRoom: 'রুম রিলোড করুন',
  },
} satisfies Strings<{
  title: string
  body: string
  roomTitle: string
  roomBody: string
  tryAgain: string
  reload: string
  reloadRoom: string
}>

type Variant = 'page' | 'room'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 'room' words the fallback for the live auction room. */
  variant?: Variant
  className?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render crashes below it and shows a friendly, localized fallback
 * instead of a blank page. Give it a `key` to reset it (e.g. on navigation).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] render error caught by boundary', error, info.componentStack)
    reportClientError(error, this.props.variant === 'room' ? 'room-boundary' : 'page-boundary')
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return <ErrorFallback variant={this.props.variant ?? 'page'} onReset={this.reset} className={this.props.className} />
    }
    return this.props.children
  }
}

function ErrorFallback({ variant, onReset, className }: { variant: Variant; onReset: () => void; className?: string }) {
  const t = useStrings(STRINGS)
  const room = variant === 'room'
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto my-8 flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="h-9 w-9 text-amber-500" aria-hidden />
      <div>
        <p className="font-semibold">{room ? t.roomTitle : t.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{room ? t.roomBody : t.body}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          {room ? t.reloadRoom : t.reload}
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          {t.tryAgain}
        </Button>
      </div>
    </div>
  )
}
