'use client'

// Installable app: service-worker registration and the "Install app" prompt.
//
// The service worker (public/sw.js) is registered in production builds only —
// in development it would cache hot-reloaded files. Chrome / Edge / Samsung
// Internet fire `beforeinstallprompt` when the app can be installed; we keep
// that event and replay it from our own "Install app" button. iOS Safari has
// no such event: there we show "Add to Home Screen" instructions instead.
import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'

/** Chromium's install event (not in the TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface PwaState {
  /** The saved install event — present while the browser offers installation. */
  deferred: BeforeInstallPromptEvent | null
  installed: boolean
}

export const usePwaStore = create<PwaState>(() => ({ deferred: null, installed: false }))

let listening = false

/** Starts listening for the install event. Safe to call repeatedly; no-op on the server. */
function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's own mini-infobar away; we offer installation in the menu.
    e.preventDefault()
    usePwaStore.setState({ deferred: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => usePwaStore.setState({ deferred: null, installed: true }))
}

// As early as possible: the event can fire before any component mounts.
listen()

/** Registers /sw.js once, after the page has loaded (never competes with first paint). */
export function useServiceWorker(): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((err: unknown) => {
        console.warn('[pwa] service worker registration failed:', (err as Error)?.message ?? err)
      })
    }
    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])
}

/** Running as an installed app (home-screen icon), not in a browser tab. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhone / iPad Safari, where installing means Share → Add to Home Screen. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  // In-app browsers and Chrome/Firefox on iOS can't add to the home screen.
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//.test(ua)
}

type Platform = 'unknown' | 'standalone' | 'ios' | 'other'
const noop = () => () => {}
const readPlatform = (): Platform => (isStandalone() ? 'standalone' : isIosSafari() ? 'ios' : 'other')
let platformCache: Platform | null = null
// Server render and hydration: 'unknown' (nothing install-related is shown), so the HTML matches.
const getPlatform = () => (platformCache ??= readPlatform())

export interface InstallPrompt {
  /** 'prompt' — the browser's install dialog; 'ios' — show Add to Home Screen steps; null — nothing to offer. */
  mode: 'prompt' | 'ios' | null
  /** Opens the browser's install dialog. Resolves true when the user accepted. */
  install: () => Promise<boolean>
}

export function useInstallPrompt(): InstallPrompt {
  const deferred = usePwaStore((s) => s.deferred)
  const installed = usePwaStore((s) => s.installed)
  const platform = useSyncExternalStore<Platform>(noop, getPlatform, () => 'unknown')

  const mode = installed || platform === 'standalone' || platform === 'unknown' ? null : deferred ? 'prompt' : platform === 'ios' ? 'ios' : null

  const install = async () => {
    const event = usePwaStore.getState().deferred
    if (!event) return false
    // The event can be used only once.
    usePwaStore.setState({ deferred: null })
    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') usePwaStore.setState({ installed: true })
      return outcome === 'accepted'
    } catch {
      return false
    }
  }

  return { mode, install }
}
