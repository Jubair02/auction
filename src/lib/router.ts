'use client'

// Tiny hash router — the app is a single Next.js route (/) with hash-based views.
import { useEffect, useState } from 'react'

export function useHashRoute(): { segs: string[]; raw: string } {
  const [hash, setHash] = useState('')

  useEffect(() => {
    const update = () => setHash(window.location.hash)
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  const segs = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { segs, raw: hash }
}

/** Navigate to a hash route, e.g. navigate('/tournaments') → #/tournaments */
export function navigate(to: string) {
  const clean = to.startsWith('/') ? to : `/${to}`
  if (window.location.hash === `#${clean}`) return
  window.location.hash = clean
}
