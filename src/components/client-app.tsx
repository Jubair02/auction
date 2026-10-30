'use client'

import dynamic from 'next/dynamic'

const AppRoot = dynamic(() => import('@/components/app-root'), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading NeelamGhor…</p>
    </div>
  ),
})

/** The client-side app shell, rendered for every page path. */
export default function ClientApp() {
  return <AppRoot />
}
