'use client'

// Lightweight i18n: English + Bangla. Each component keeps its own typed
// string table, so a missing Bangla string is a compile error, not a blank UI.
//
//   const STRINGS = {
//     en: { title: 'Welcome back', bidsFor: (team: string) => `${team} is bidding` },
//     bn: { title: 'আবার স্বাগতম', bidsFor: (team: string) => `${team} বিড করছে` },
//   } satisfies Strings<{ title: string; bidsFor: (team: string) => string }>
//   const t = useStrings(STRINGS)   →   t.title, t.bidsFor('Dhaka Warriors')
//
// Numbers and ৳ amounts keep Western digits (as BD apps and receipts do).
//
// The language lives in the `ng_lang` cookie so the server renders the page in
// it (no English flash for Bangla users): page.tsx reads the cookie and passes
// it down through <LangProvider>, and the client store starts from the same
// cookie — so the first client render matches the server HTML exactly.
import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { create } from 'zustand'
import { LANG_COOKIE, readLangCookie, type Lang } from '@/lib/lang-cookie'

export type { Lang }

const STORAGE_KEY = 'ng_lang'
const ONE_YEAR_S = 365 * 24 * 60 * 60

function persistLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // storage unavailable — the cookie still carries the choice
  }
  try {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${ONE_YEAR_S}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`
  } catch {
    // ignore
  }
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLangStore = create<LangState>((set) => ({
  // Browser: the cookie the server rendered with. Server: always 'en' — this
  // module-level store is shared by every request there and never written;
  // server renders take the request's language from <LangProvider> instead.
  lang: readLangCookie() ?? 'en',
  setLang: (lang) => {
    persistLang(lang)
    set({ lang })
  },
}))

/** The language of the page being server-rendered (and hydrated). */
const RenderLangContext = createContext<Lang>('en')

/** Wraps the app with the request's language (from the cookie, read on the server). */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return createElement(RenderLangContext.Provider, { value: lang }, children)
}

/** Current UI language without React — for error messages, API helpers, etc. */
export function currentLang(): Lang {
  return useLangStore.getState().lang
}

/**
 * Mount once in the app shell: for visitors without the cookie (first visit,
 * or a choice saved before the cookie existed) picks the saved / browser
 * language and stores it in the cookie; keeps <html lang> in sync.
 */
export function useLangBootstrap(): void {
  const lang = useLang()
  useEffect(() => {
    if (readLangCookie()) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    const initial: Lang = saved === 'bn' || saved === 'en' ? saved : navigator.language?.startsWith('bn') ? 'bn' : 'en'
    persistLang(initial)
    if (initial !== useLangStore.getState().lang) useLangStore.setState({ lang: initial })
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}

const subscribe = (onChange: () => void) => useLangStore.subscribe(onChange)
const getLang = () => useLangStore.getState().lang

export function useLang(): Lang {
  const renderLang = useContext(RenderLangContext)
  // Server render and hydration use the request's language; afterwards the store.
  return useSyncExternalStore(subscribe, getLang, () => renderLang)
}

/** A component's string table: Bangla must define exactly the English keys. */
export type Strings<T> = { en: T; bn: T }

export function useStrings<T>(table: Strings<T>): T {
  return table[useLang()]
}
