// Colour theme preference, shared by the server render (layout/page read the
// cookie so the HTML already has the right theme — no light flash for dark
// users) and the client (lib/theme writes it).
// Plain module — no 'use client' — so server components can import it.

export type ThemePref = 'light' | 'dark' | 'system'

export const THEME_COOKIE = 'ng_theme'

export function parseTheme(value: string | null | undefined): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * Runs in <head> before the first paint when the preference is "system": the
 * server can't know the device setting, so this adds the `dark` class early.
 * Kept tiny and dependency-free; any failure just leaves the light theme.
 */
export const SYSTEM_THEME_SCRIPT =
  "(function(){try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){var d=document.documentElement;d.classList.add('dark');d.style.colorScheme='dark'}}catch(e){}})()"
