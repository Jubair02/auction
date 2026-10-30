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
import { useEffect } from 'react'
import { create } from 'zustand'

export type Lang = 'en' | 'bn'

const STORAGE_KEY = 'ng_lang'

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLangStore = create<LangState>((set) => ({
  // Always 'en' for the first render (matches the server HTML); the saved or
  // browser language is applied right after mount by useLangBootstrap.
  lang: 'en',
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // storage unavailable — the choice lasts for this page view
    }
    set({ lang })
  },
}))

/** Mount once in the app shell: restores the saved choice and keeps <html lang> in sync. */
export function useLangBootstrap(): void {
  const lang = useLangStore((s) => s.lang)
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    const initial: Lang = saved === 'bn' || saved === 'en' ? saved : navigator.language?.startsWith('bn') ? 'bn' : 'en'
    if (initial !== useLangStore.getState().lang) useLangStore.setState({ lang: initial })
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang)
}

/** A component's string table: Bangla must define exactly the English keys. */
export type Strings<T> = { en: T; bn: T }

export function useStrings<T>(table: Strings<T>): T {
  return table[useLang()]
}
