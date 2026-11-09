'use client'

// "Data saver" (low-data mode) switches: one in the header's account menu, one
// in the footer (so logged-out visitors have it too). State: lib/low-data.ts.
import { Leaf } from 'lucide-react'
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { type Strings, useStrings } from '@/lib/i18n'
import { useLowData, useLowDataStore } from '@/lib/low-data'

const STRINGS = {
  en: {
    dataSaver: 'Data saver',
    description: 'No photos or animations — for slow or costly data',
  },
  bn: {
    dataSaver: 'ডেটা সেভার',
    description: 'ছবি ও অ্যানিমেশন বন্ধ — ধীর বা দামি ইন্টারনেটে কাজে লাগে',
  },
} satisfies Strings<Record<'dataSaver' | 'description', string>>

export function DataSaverMenuItem() {
  const t = useStrings(STRINGS)
  const lowData = useLowData()
  const setLowData = useLowDataStore((s) => s.setLowData)
  return (
    <DropdownMenuCheckboxItem
      checked={lowData}
      onCheckedChange={(on) => setLowData(on === true)}
      // Keep the menu open so the tick visibly changes.
      onSelect={(e) => e.preventDefault()}
    >
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5">
          <Leaf className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.dataSaver}
        </span>
        <span className="text-xs text-muted-foreground">{t.description}</span>
      </span>
    </DropdownMenuCheckboxItem>
  )
}

export function DataSaverToggle() {
  const t = useStrings(STRINGS)
  const lowData = useLowData()
  const setLowData = useLowDataStore((s) => s.setLowData)
  return (
    <label className="inline-flex min-h-8 cursor-pointer items-center gap-2" title={t.description}>
      <Switch checked={lowData} onCheckedChange={setLowData} aria-describedby="data-saver-desc" />
      <span className="font-medium text-foreground">{t.dataSaver}</span>
      <span id="data-saver-desc" className="sr-only">
        {t.description}
      </span>
    </label>
  )
}
