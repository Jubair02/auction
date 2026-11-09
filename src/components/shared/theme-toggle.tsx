'use client'

// Light / Dark / System switch in the header (visible signed in or out).
// State and persistence: lib/theme.ts.
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { type Strings, useStrings } from '@/lib/i18n'
import { type ThemePref, useTheme } from '@/lib/theme'

const STRINGS = {
  en: { theme: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  bn: { theme: 'থিম', light: 'লাইট', dark: 'ডার্ক', system: 'ডিভাইসের মতো' },
} satisfies Strings<Record<'theme' | 'light' | 'dark' | 'system', string>>

const OPTIONS: { value: ThemePref; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

export function ThemeToggle() {
  const t = useStrings(STRINGS)
  const { pref, resolved, setPref } = useTheme()
  // Both icons are rendered and swapped by the `dark` class, so the button is
  // right from the first paint even when the device decides ("system").
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`${t.theme}: ${t[pref]}`}>
          <Sun className="h-4.5 w-4.5 dark:hidden" aria-hidden />
          <Moon className="hidden h-4.5 w-4.5 dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {OPTIONS.map(({ value, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setPref(value)} aria-checked={pref === value} role="menuitemradio">
            <Icon className="mr-2 h-4 w-4" aria-hidden />
            <span className="flex-1">{t[value]}</span>
            {pref === value ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <span className="sr-only" aria-live="polite">
          {t.theme}: {t[resolved]}
        </span>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
