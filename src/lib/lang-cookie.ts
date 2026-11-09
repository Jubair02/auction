// The UI language cookie, shared by the server render (page/layout read it so
// Bangla visitors get Bangla HTML) and the client (lib/i18n writes it).
// Plain module — no 'use client' — so server components can import it.

export type Lang = 'en' | 'bn'

export const LANG_COOKIE = 'ng_lang'

export function parseLang(value: string | null | undefined): Lang {
  return value === 'bn' ? 'bn' : 'en'
}

/** The language cookie as the browser sees it; null outside a browser or when unset. */
export function readLangCookie(): Lang | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)ng_lang=(en|bn)(?:;|$)/)
  return m ? (m[1] as Lang) : null
}
