'use client'

import { Plus, Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATEGORIES, type AuctionMode, type PlayerStatus } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedPlayersStrings } from './strings'

const ALL_STATUSES: PlayerStatus[] = ['AVAILABLE', 'LIVE', 'SOLD', 'UNSOLD', 'SKIPPED']

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    searchPlaceholder: 'Search players…',
    searchAria: 'Search players',
    filterCategory: 'Filter by category',
    allCats: 'All cats',
    filterStatus: 'Filter by status',
    status: 'Status',
    allStatuses: 'All statuses',
    statusLabel: {
      AVAILABLE: 'Available',
      LIVE: 'Live',
      SOLD: 'Sold',
      UNSOLD: 'Unsold',
      SKIPPED: 'Skipped',
    } as Record<PlayerStatus, string>,
    filterRole: 'Filter by role',
    allRoles: 'All roles',
    inPool: (n: number) => `${n} players in the pool`,
    shownOf: (shown: number, total: number) => `${shown} of ${total} players shown`,
    freeUsage: (used: number, max: number) => `${used} / ${max} players on the Free plan`,
  },
  bn: {
    ...SHARED_STRINGS.bn,
    searchPlaceholder: 'খেলোয়াড় খুঁজুন…',
    searchAria: 'খেলোয়াড় খুঁজুন',
    filterCategory: 'ক্যাটাগরি দিয়ে ফিল্টার',
    allCats: 'সব ক্যাটাগরি',
    filterStatus: 'স্ট্যাটাস দিয়ে ফিল্টার',
    status: 'স্ট্যাটাস',
    allStatuses: 'সব স্ট্যাটাস',
    statusLabel: {
      AVAILABLE: 'উপলব্ধ',
      LIVE: 'লাইভ',
      SOLD: 'বিক্রি',
      UNSOLD: 'অবিক্রিত',
      SKIPPED: 'বাদ',
    } as Record<PlayerStatus, string>,
    filterRole: 'রোল দিয়ে ফিল্টার',
    allRoles: 'সব রোল',
    inPool: (n: number) => `পুলে ${n} জন খেলোয়াড়`,
    shownOf: (shown: number, total: number) => `${total} জনের মধ্যে ${shown} জন দেখানো হচ্ছে`,
    freeUsage: (used: number, max: number) => `ফ্রি প্ল্যানে ${max} জনের মধ্যে ${used} জন খেলোয়াড়`,
  },
} satisfies Strings<
  SharedPlayersStrings & {
    searchPlaceholder: string
    searchAria: string
    filterCategory: string
    allCats: string
    filterStatus: string
    status: string
    allStatuses: string
    statusLabel: Record<PlayerStatus, string>
    filterRole: string
    allRoles: string
    inPool: (n: number) => string
    shownOf: (shown: number, total: number) => string
    freeUsage: (used: number, max: number) => string
  }
>

/** Search, filters, add/import buttons and the pool count line. */
export function PlayersToolbar({
  query,
  setQuery,
  catFilter,
  setCatFilter,
  statusFilter,
  setStatusFilter,
  roleFilter,
  setRoleFilter,
  auctionMode,
  roles,
  readOnly,
  shownCount,
  totalCount,
  freeMax,
  canUpgrade,
  onImport,
  onAdd,
  onUpgrade,
}: {
  query: string
  setQuery: (v: string) => void
  catFilter: string
  setCatFilter: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  roleFilter: string
  setRoleFilter: (v: string) => void
  auctionMode: AuctionMode
  roles: readonly string[]
  readOnly: boolean
  shownCount: number
  totalCount: number
  freeMax: number | null
  canUpgrade: boolean
  onImport: () => void
  onAdd: () => void
  onUpgrade: () => void
}) {
  const t = useStrings(STRINGS)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-56">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            className="h-10 pl-9"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex">
          {auctionMode === 'CATEGORY' ? (
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger size="sm" className="h-10 w-full lg:w-28" aria-label={t.filterCategory}>
                <SelectValue placeholder={t.category} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.allCats}</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t.catShort(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="h-10 w-full lg:w-32" aria-label={t.filterStatus}>
              <SelectValue placeholder={t.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.allStatuses}</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t.statusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger size="sm" className="h-10 w-full lg:w-36" aria-label={t.filterRole}>
              <SelectValue placeholder={t.role} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t.allRoles}</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {readOnly ? null : (
          <div className="flex gap-2 lg:ml-auto">
            <Button variant="outline" className="min-h-10 flex-1 lg:flex-none" onClick={onImport}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden /> {t.importCsv}
            </Button>
            <Button className="min-h-10 flex-1 lg:flex-none" onClick={onAdd}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t.addPlayer}
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          {shownCount === totalCount
            ? t.inPool(totalCount)
            : t.shownOf(shownCount, totalCount)}
        </p>
        {freeMax !== null && !readOnly ? (
          <p className={`flex items-center gap-2 ${totalCount >= freeMax ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`}>
            {t.freeUsage(totalCount, freeMax)}
            {canUpgrade && totalCount >= freeMax ? (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={onUpgrade}>
                {t.upgrade}
              </Button>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}
