'use client'

// Low-data ("Data saver") mode for slow 2G/3G connections and metered data.
//
// The choice is saved in localStorage `ng_low_data` ('on' | 'off'; unset =
// automatic). Automatic means ON when the browser asks to save data
// (navigator.connection.saveData — Chrome's Data Saver / Android's data saver)
// or the connection is 2G. What it changes:
//   - photos in PlayerAvatar / TeamAvatar become initials (no image download)
//   - animations are switched off (MotionConfig in client-app.tsx)
//   - the landing page drops its hero image
// Components read it with useLowData().
//
// Hydration: the server renders with the `ng_low_data` cookie (a mirror of an
// explicit choice) or the `Save-Data: on` request header, passed down through
// <LowDataProvider>; the first client render uses the same value, and storage
// is read after mount. The cookie also lets the server leave the hero image —
// and its preload — out of the HTML on the next visit.
import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { create } from 'zustand'

export const LOW_DATA_KEY = 'ng_low_data'
const ONE_YEAR_S = 365 * 24 * 60 * 60

export type LowDataPref = 'on' | 'off' | null

interface LowDataState {
  lowData: boolean
  /** The visitor's explicit choice; null = automatic. */
  pref: LowDataPref
  setLowData: (on: boolean) => void
}

type NetworkInformation = EventTarget & { saveData?: boolean; effectiveType?: string }
const connection = (): NetworkInformation | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: NetworkInformation }).connection

/** What "automatic" means right now: the browser's data-saver flag or a 2G connection. */
function detectLowData(): boolean {
  const c = connection()
  return c?.saveData === true || c?.effectiveType === 'slow-2g' || c?.effectiveType === '2g'
}

function readPref(): LowDataPref {
  try {
    const v = localStorage.getItem(LOW_DATA_KEY)
    return v === 'on' || v === 'off' ? v : null
  } catch {
    return null
  }
}

function persistPref(pref: LowDataPref): void {
  try {
    if (pref) localStorage.setItem(LOW_DATA_KEY, pref)
    else localStorage.removeItem(LOW_DATA_KEY)
  } catch {
    // storage unavailable — the choice lasts for this page only
  }
  try {
    const secure = location.protocol === 'https:' ? '; secure' : ''
    document.cookie = pref
      ? `${LOW_DATA_KEY}=${pref}; path=/; max-age=${ONE_YEAR_S}; samesite=lax${secure}`
      : `${LOW_DATA_KEY}=; path=/; max-age=0; samesite=lax${secure}`
  } catch {
    // ignore
  }
}

/** The cookie mirror as the browser sees it — what the server rendered with. */
function initialLowData(): boolean {
  if (typeof document === 'undefined') return false
  const m = document.cookie.match(/(?:^|;\s*)ng_low_data=(on|off)(?:;|$)/)
  // No cookie: the server went by the Save-Data header, which mirrors saveData.
  return m ? m[1] === 'on' : connection()?.saveData === true
}

export const useLowDataStore = create<LowDataState>((set) => ({
  // Starts from what the server rendered with (no flip after hydration);
  // useLowDataBootstrap() then applies the saved choice.
  lowData: initialLowData(),
  pref: null,
  setLowData: (on) => {
    const pref = on ? 'on' : 'off'
    persistPref(pref)
    set({ lowData: on, pref })
  },
}))

const RenderLowDataContext = createContext(false)

/** Wraps the app with the server-rendered low-data value (cookie / Save-Data header). */
export function LowDataProvider({ lowData, children }: { lowData: boolean; children: ReactNode }) {
  return createElement(RenderLowDataContext.Provider, { value: lowData }, children)
}

/**
 * Mount once in the app shell: reads the saved choice (or detects the
 * connection when there is none), keeps the cookie mirror in sync and follows
 * connection changes while on automatic.
 */
export function useLowDataBootstrap(): void {
  useEffect(() => {
    const apply = () => {
      const pref = readPref()
      useLowDataStore.setState({ pref, lowData: pref ? pref === 'on' : detectLowData() })
    }
    apply()
    // Mirror (or clear) the cookie so the next server render agrees.
    persistPref(readPref())
    const c = connection()
    const onChange = () => {
      if (!useLowDataStore.getState().pref) apply()
    }
    c?.addEventListener?.('change', onChange)
    return () => c?.removeEventListener?.('change', onChange)
  }, [])

  const lowData = useLowData()
  useEffect(() => {
    // A hook for CSS: html[data-low-data] { … }
    if (lowData) document.documentElement.dataset.lowData = ''
    else delete document.documentElement.dataset.lowData
  }, [lowData])
}

const subscribe = (onChange: () => void) => useLowDataStore.subscribe(onChange)
const getLowData = () => useLowDataStore.getState().lowData

/** True while low-data mode is on. Server render and hydration use the request's value. */
export function useLowData(): boolean {
  const renderValue = useContext(RenderLowDataContext)
  return useSyncExternalStore(subscribe, getLowData, () => renderValue)
}
