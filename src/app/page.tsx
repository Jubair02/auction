'use client'

import dynamic from 'next/dynamic'

const AppRoot = dynamic(() => import('@/components/app-root'), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading NeelamGhor…</p>
    </div>
  ),
})

export default function Home() {
  return <AppRoot />
}
