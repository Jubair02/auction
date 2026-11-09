'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/shared/image-upload'
import { type Strings, useStrings } from '@/lib/i18n'
import type { TeamFormState } from './types'

const STRINGS = {
  en: {
    logoOptional: 'Team logo (optional)',
    teamName: 'Team name',
    teamNamePlaceholder: 'e.g. Dhaka Dominators',
    captainName: 'Captain name',
    captainPlaceholder: 'e.g. Rakib Hasan',
    teamColor: 'Team color',
    colorPickerAria: 'Team color picker',
    colorHexAria: 'Team color hex',
    budgetTaka: 'Budget (৳)',
    maxSquad: 'Max squad',
    minSquad: 'Min squad',
  },
  bn: {
    logoOptional: 'দলের লোগো (ঐচ্ছিক)',
    teamName: 'দলের নাম',
    teamNamePlaceholder: 'যেমন: Dhaka Dominators',
    captainName: 'অধিনায়কের নাম',
    captainPlaceholder: 'যেমন: Rakib Hasan',
    teamColor: 'দলের রং',
    colorPickerAria: 'দলের রং বাছাই',
    colorHexAria: 'দলের রঙের হেক্স কোড',
    budgetTaka: 'বাজেট (৳)',
    maxSquad: 'সর্বোচ্চ স্কোয়াড',
    minSquad: 'সর্বনিম্ন স্কোয়াড',
  },
} satisfies Strings<{
  logoOptional: string
  teamName: string
  teamNamePlaceholder: string
  captainName: string
  captainPlaceholder: string
  teamColor: string
  colorPickerAria: string
  colorHexAria: string
  budgetTaka: string
  maxSquad: string
  minSquad: string
}>

export function TeamFormFields({ form, onChange }: { form: TeamFormState; onChange: (f: TeamFormState) => void }) {
  const tx = useStrings(STRINGS)
  const set = (patch: Partial<TeamFormState>) => onChange({ ...form, ...patch })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ImageUpload
        className="sm:col-span-2"
        label={tx.logoOptional}
        kind="LOGO"
        value={form.logoUrl}
        onChange={(url) => set({ logoUrl: url })}
      />
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tm-name">
          {tx.teamName} <span className="text-rose-600 dark:text-rose-400">*</span>
        </Label>
        <Input
          id="tm-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={tx.teamNamePlaceholder}
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-captain">{tx.captainName}</Label>
        <Input
          id="tm-captain"
          value={form.captainName}
          onChange={(e) => set({ captainName: e.target.value })}
          placeholder={tx.captainPlaceholder}
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-color">{tx.teamColor}</Label>
        <div className="flex items-center gap-2">
          <input
            id="tm-color"
            type="color"
            value={form.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            aria-label={tx.colorPickerAria}
          />
          <Input value={form.color} onChange={(e) => set({ color: e.target.value })} className="h-10 font-mono text-xs" aria-label={tx.colorHexAria} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-budget">{tx.budgetTaka}</Label>
        <Input
          id="tm-budget"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.budget}
          onChange={(e) => set({ budget: e.target.value })}
          className="h-10"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tm-max">{tx.maxSquad}</Label>
          <Input
            id="tm-max"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.maxSquad}
            onChange={(e) => set({ maxSquad: e.target.value })}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tm-min">{tx.minSquad}</Label>
          <Input
            id="tm-min"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.minSquad}
            onChange={(e) => set({ minSquad: e.target.value })}
            className="h-10"
          />
        </div>
      </div>
    </div>
  )
}
