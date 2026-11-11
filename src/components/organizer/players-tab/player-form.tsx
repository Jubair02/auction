'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/shared/image-upload'
import { formatBDT } from '@/lib/format'
import { CATEGORIES, DEFAULT_CATEGORY_BASE_PRICES, playerRoleLabel, type AuctionMode } from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedPlayersStrings } from './strings'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    photoOptional: 'Photo (optional)',
    namePlaceholder: 'e.g. Shakib Hasan',
    roleAria: 'Player role',
    pickRolePlaceholder: 'Pick a role',
    categoryAria: 'Player category',
    categoryN: (c: string) => `Category ${c}`,
    basePrice: 'Base price (৳)',
    lockedPrice: 'Locked — this player is sold. Re-auction them from the room to change the price.',
    optional: '(optional)',
    previousTeam: 'Previous team',
    prevPlaceholder: 'e.g. Mirpur Club',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    photoOptional: 'ছবি (ঐচ্ছিক)',
    namePlaceholder: 'যেমন: Shakib Hasan',
    roleAria: 'খেলোয়াড়ের রোল',
    pickRolePlaceholder: 'রোল বেছে নিন',
    categoryAria: 'খেলোয়াড়ের ক্যাটাগরি',
    categoryN: (c: string) => `ক্যাটাগরি ${c}`,
    basePrice: 'বেস প্রাইস (৳)',
    lockedPrice: 'লক করা — এই খেলোয়াড় বিক্রি হয়ে গেছে। দাম বদলাতে রুম থেকে পুনরায় নিলাম করুন।',
    optional: '(ঐচ্ছিক)',
    previousTeam: 'আগের দল',
    prevPlaceholder: 'যেমন: Mirpur Club',
  },
} satisfies Strings<
  SharedPlayersStrings & {
    photoOptional: string
    namePlaceholder: string
    roleAria: string
    pickRolePlaceholder: string
    categoryAria: string
    categoryN: (c: string) => string
    basePrice: string
    lockedPrice: string
    optional: string
    previousTeam: string
    prevPlaceholder: string
  }
>

export interface PlayerFormState {
  name: string
  phone: string
  role: string
  category: string
  basePrice: string
  previousTeam: string
  photoUrl: string | null
}

export function emptyForm(mode: AuctionMode, basePrice: number): PlayerFormState {
  return {
    name: '',
    phone: '',
    role: '',
    category: mode === 'CATEGORY' ? 'A' : '',
    basePrice: String(mode === 'CATEGORY' ? DEFAULT_CATEGORY_BASE_PRICES.A : basePrice || 5000),
    previousTeam: '',
    photoUrl: null,
  }
}

export function PlayerFormFields({
  form,
  onChange,
  roles,
  auctionMode,
  quickPicks,
  pricingLocked = false,
}: {
  form: PlayerFormState
  onChange: (f: PlayerFormState) => void
  roles: readonly string[]
  auctionMode: AuctionMode
  quickPicks: { label: string; value: number }[]
  /** true for a SOLD player — base price and category are settled by the sale */
  pricingLocked?: boolean
}) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const set = (patch: Partial<PlayerFormState>) => onChange({ ...form, ...patch })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ImageUpload
        className="sm:col-span-2"
        label={t.photoOptional}
        kind="PHOTO"
        value={form.photoUrl}
        onChange={(url) => set({ photoUrl: url })}
      />

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-name">
          {t.name} <span className="text-rose-600 dark:text-rose-400">*</span>
        </Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t.namePlaceholder}
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t.role}</Label>
        <Select value={form.role} onValueChange={(v) => set({ role: v })}>
          <SelectTrigger className="h-10 w-full" aria-label={t.roleAria}>
            <SelectValue placeholder={t.pickRolePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {playerRoleLabel(r, lang)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auctionMode === 'CATEGORY' ? (
        <div className="space-y-1.5">
          <Label>{t.category}</Label>
          <Select value={form.category} onValueChange={(v) => set({ category: v })} disabled={pricingLocked}>
            <SelectTrigger className="h-10 w-full" aria-label={t.categoryAria}>
              <SelectValue placeholder={t.category} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t.categoryN(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="p-base">{t.basePrice}</Label>
        <Input
          id="p-base"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.basePrice}
          onChange={(e) => set({ basePrice: e.target.value })}
          disabled={pricingLocked}
          className="h-10"
        />
        {pricingLocked ? (
          <p className="pt-0.5 text-xs text-muted-foreground">
            {t.lockedPrice}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {quickPicks.map((q) => (
              <Button
                key={q.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => set({ basePrice: String(q.value) })}
              >
                {q.label} · {formatBDT(q.value)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-phone">
          {t.phone} <span className="font-normal text-muted-foreground">{t.optional}</span>
        </Label>
        <Input
          id="p-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set({ phone: e.target.value })}
          placeholder="01XXXXXXXXX"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-prev">
          {t.previousTeam} <span className="font-normal text-muted-foreground">{t.optional}</span>
        </Label>
        <Input
          id="p-prev"
          value={form.previousTeam}
          onChange={(e) => set({ previousTeam: e.target.value })}
          placeholder={t.prevPlaceholder}
          className="h-10"
        />
      </div>
    </div>
  )
}
