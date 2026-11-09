'use client'

import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type Strings, useStrings } from '@/lib/i18n'
import type { OrganizerControlsProps } from './types'

const STRINGS = {
  en: {
    sellingOrder: 'Selling order — categories',
    catShort: (code: string) => `Cat ${code}`,
    catLine: (left: number, base: string) => `${left} left · base ${base}`,
  },
  bn: {
    sellingOrder: 'বিক্রির ক্রম — ক্যাটাগরি',
    catShort: (code: string) => `ক্যাট ${code}`,
    catLine: (left: number, base: string) => `${left} জন বাকি · বেস ${base}`,
  },
} satisfies Strings<{
  sellingOrder: string
  catShort: (code: string) => string
  catLine: (left: number, base: string) => string
}>

/** Category A–E chips with live available counts (category mode only) — a section of the controls card. */
export function CategoryChips({ state, onAction }: OrganizerControlsProps) {
  const tx = useStrings(STRINGS)
  if (state.mode !== 'CATEGORY' || state.categories.length === 0) return null
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tx.sellingOrder}</p>
      <div className="flex flex-wrap gap-2">
        {state.categories.map((c) => {
          const activeCat = state.currentCategory === c.code
          const depleted = c.available === 0
          return (
            <button
              key={c.code}
              type="button"
              disabled={depleted}
              onClick={() => onAction('set_category', { category: c.code })}
              aria-pressed={activeCat}
              className={cn(
                'flex min-h-11 flex-col items-center rounded-lg border-2 px-3 py-1.5 transition-colors',
                activeCat
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-primary/5',
                depleted && 'pointer-events-none opacity-40'
              )}
            >
              <span className="text-sm font-black">{tx.catShort(c.code)}</span>
              <span className={cn('text-[10px] font-semibold tabular-nums', activeCat ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {tx.catLine(c.available, formatBDT(c.basePrice))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
