'use client'

// Light / dark / system colour theme. The server renders the saved choice
// (cookie, see theme-cookie.ts); this store keeps the <html> class in sync when
// the user changes it, and follows the device setting while on "system".
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { THEME_COOKIE, type ThemePref } from '@/lib/theme-cookie'

export type { ThemePref }
export type ResolvedTheme = 'light' | 'dark'

const ONE_YEAR = 60 * 60 * 24 * 365

const systemPrefersDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false

function resolve(pref: ThemePref): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

interface ThemeState {
  pref: ThemePref
  resolved: ResolvedTheme
  /** True once the store has read the browser (pref from the server, resolved from the device). */
  ready: boolean
  setPref: (pref: ThemePref) => void
  /** Internal: sync from the server's value and the device setting after mount. */
  init: (pref: ThemePref) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  pref: 'system',
  resolved: 'light',
  ready: false,
  setPref: (pref) => {
    try {
      document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=${ONE_YEAR}; samesite=lax`
    } catch {
      // cookies blocked — the choice lasts for this page only
    }
    const resolved = resolve(pref)
    apply(resolved)
    set({ pref, resolved, ready: true })
  },
  init: (pref) => {
    if (get().ready) return
    const resolved = resolve(pref)
    apply(resolved)
    set({ pref, resolved, ready: true })
  },
}))

/** The server's saved preference, so the first render (server + hydration) agrees. */
const ThemeSeedContext = createContext<ThemePref>('system')

export function ThemeProvider({ theme, children }: { theme: ThemePref; children: ReactNode }) {
  useEffect(() => {
    useThemeStore.getState().init(theme)
    // While on "system", follow the device switching between light and dark.
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    if (!mq) return
    const onChange = () => {
      const { pref } = useThemeStore.getState()
      if (pref !== 'system') return
      const resolved: ResolvedTheme = mq.matches ? 'dark' : 'light'
      apply(resolved)
      useThemeStore.setState({ resolved })
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])
  return createElement(ThemeSeedContext.Provider, { value: theme }, children)
}

/**
 * The current preference and the theme actually shown. Before mount it reports
 * the server's preference (and 'light' for an unresolved "system"), so it is
 * safe to render with — server and first client render match.
 */
export function useTheme(): { pref: ThemePref; resolved: ResolvedTheme; setPref: (p: ThemePref) => void; ready: boolean } {
  const seed = useContext(ThemeSeedContext)
  const pref = useThemeStore((s) => s.pref)
  const resolved = useThemeStore((s) => s.resolved)
  const ready = useThemeStore((s) => s.ready)
  const setPref = useThemeStore((s) => s.setPref)
  if (!ready) return { pref: seed, resolved: seed === 'dark' ? 'dark' : 'light', setPref, ready }
  return { pref, resolved, setPref, ready }
}

/** True after mount — for icons that depend on the device setting. */
export function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  return m
}
