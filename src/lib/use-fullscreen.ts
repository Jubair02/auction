'use client'

import { useCallback, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

/** Browser full screen for the whole page — the auction room uses it for projectors and big screens. */
export function useFullscreen() {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => !!document.fullscreenElement,
    () => false,
  )
  const supported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [])

  return { isFullscreen, supported, toggle }
}
