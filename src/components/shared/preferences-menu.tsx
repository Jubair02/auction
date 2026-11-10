'use client'

// Phones: language and theme in ONE header button, so the header fits on a
// 360–375px screen next to Login / Register (wider screens show the separate
// EN/বাং switch and theme button).
import { Check, Languages, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Lang, type Strings, useLang, useLangStore, useStrings } from '@/lib/i18n'
import { type ThemePref, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const STRINGS = {
  en: { menu: 'Language and theme', language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },
  bn: { menu: 'ভাষা ও থিম', language: 'ভাষা', theme: 'থিম', light: 'লাইট', dark: 'ডার্ক', system: 'ডিভাইসের মতো' },
} satisfies Strings<Record<'menu' | 'language' | 'theme' | 'light' | 'dark' | 'system', string>>

// Each language is named in itself, so it can be found whatever is showing now.
const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
]

const THEMES: { value: ThemePref; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

export function PreferencesMenu({ className }: { className?: string }) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const setLang = useLangStore((s) => s.setLang)
  const { pref, setPref } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('h-9 w-9 rounded-full', className)} aria-label={t.menu} title={t.menu}>
          <Languages className="h-4.5 w-4.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t.language}</DropdownMenuLabel>
        {LANGS.map(({ value, label }) => (
          <DropdownMenuItem key={value} onSelect={() => setLang(value)} role="menuitemradio" aria-checked={lang === value} lang={value}>
            <span className="flex-1">{label}</span>
            {lang === value ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t.theme}</DropdownMenuLabel>
        {THEMES.map(({ value, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setPref(value)} role="menuitemradio" aria-checked={pref === value}>
            <Icon className="mr-2 h-4 w-4" aria-hidden />
            <span className="flex-1">{t[value]}</span>
            {pref === value ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
