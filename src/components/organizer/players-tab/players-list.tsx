'use client'

import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlayerAvatar } from '@/components/shared/avatars'
import { PlayerStatusBadge } from '@/components/shared/status-badges'
import { formatBDT } from '@/lib/format'
import type { AuctionMode, PlayerDTO } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { PlayerRole } from '@/components/shared/player-role'
import { SHARED_STRINGS, type SharedPlayersStrings } from './strings'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    noPlayersYet: 'No players yet',
    noMatch: 'No players match these filters',
    emptyHelp: 'Add players one by one, or import a CSV with names, roles and base prices.',
    clearFilters: 'Try clearing the search or filters.',
    colPlayer: 'Player',
    colStatus: 'Status',
    colSold: 'Sold',
    colActions: 'Actions',
    exTeam: (team: string) => `ex ${team}`,
    editAria: (name: string) => `Edit ${name}`,
    deleteAria: (name: string) => `Delete ${name}`,
    soldNoDelete: 'Sold players can’t be deleted — re-auction them from the room first',
    liveNoDelete: 'This player is on the block right now',
    baseAmount: (amount: string) => `Base ${amount}`,
    soldAmount: (amount: string) => `Sold ${amount}`,
    edit: 'Edit',
    delete: 'Delete',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    noPlayersYet: 'এখনো কোনো খেলোয়াড় নেই',
    noMatch: 'এই ফিল্টারে কোনো খেলোয়াড় নেই',
    emptyHelp: 'একজন একজন করে খেলোয়াড় যোগ করুন, অথবা নাম, রোল ও বেস প্রাইসসহ একটি CSV ইমপোর্ট করুন।',
    clearFilters: 'সার্চ বা ফিল্টার মুছে আবার দেখুন।',
    colPlayer: 'খেলোয়াড়',
    colStatus: 'স্ট্যাটাস',
    colSold: 'বিক্রি',
    colActions: 'অ্যাকশন',
    exTeam: (team: string) => `সাবেক ${team}`,
    editAria: (name: string) => `${name} সম্পাদনা`,
    deleteAria: (name: string) => `${name} মুছুন`,
    soldNoDelete: 'বিক্রি হওয়া খেলোয়াড় মোছা যায় না — আগে রুম থেকে পুনরায় নিলাম করুন',
    liveNoDelete: 'এই খেলোয়াড় এখন নিলামে আছে',
    baseAmount: (amount: string) => `বেস ${amount}`,
    soldAmount: (amount: string) => `বিক্রি ${amount}`,
    edit: 'সম্পাদনা',
    delete: 'মুছুন',
  },
} satisfies Strings<
  SharedPlayersStrings & {
    noPlayersYet: string
    noMatch: string
    emptyHelp: string
    clearFilters: string
    colPlayer: string
    colStatus: string
    colSold: string
    colActions: string
    exTeam: (team: string) => string
    editAria: (name: string) => string
    deleteAria: (name: string) => string
    soldNoDelete: string
    liveNoDelete: string
    baseAmount: (amount: string) => string
    soldAmount: (amount: string) => string
    edit: string
    delete: string
  }
>

/** The pool: loading skeleton, empty state, desktop table and phone/tablet cards. */
export function PlayersList({
  loading,
  players,
  filtered,
  auctionMode,
  readOnly,
  onImport,
  importLocked = false,
  onAdd,
  onEdit,
  onDelete,
}: {
  loading: boolean
  players: PlayerDTO[]
  filtered: PlayerDTO[]
  auctionMode: AuctionMode
  readOnly: boolean
  onImport: () => void
  /** Free plan: CSV import is Pro-only. */
  importLocked?: boolean
  onAdd: () => void
  onEdit: (p: PlayerDTO) => void
  onDelete: (p: PlayerDTO) => void
}) {
  const t = useStrings(STRINGS)

  return loading ? (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  ) : filtered.length === 0 ? (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="font-semibold">{players.length === 0 ? t.noPlayersYet : t.noMatch}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {players.length === 0
            ? t.emptyHelp
            : t.clearFilters}
        </p>
        {players.length === 0 && !readOnly ? (
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={onImport}>
              <FileUp className="mr-1.5 h-4 w-4" aria-hidden /> {t.importCsv}
              {importLocked ? (
                <span className="ml-1.5 rounded-[4px] bg-amber-400/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
                  {t.proBadge}
                </span>
              ) : null}
            </Button>
            <Button onClick={onAdd}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t.addPlayer}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  ) : (
    <>
      {/* Desktop table — scrolls with the page; the header sticks under the site header.
          A plain <table>: the shared Table's overflow wrapper would stop the header sticking. */}
      <div className="hidden rounded-lg border lg:block">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>{t.colPlayer}</TableHead>
              <TableHead>{t.colRole}</TableHead>
              {auctionMode === 'CATEGORY' ? <TableHead>{t.colCat}</TableHead> : null}
              <TableHead>{t.colBase}</TableHead>
              <TableHead>{t.colStatus}</TableHead>
              <TableHead>{t.colSold}</TableHead>
              {readOnly ? null : <TableHead className="w-20 text-right">{t.colActions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="tabular-nums text-muted-foreground">{p.playerNumber}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      {p.previousTeam ? (
                        <p className="truncate text-xs text-muted-foreground">{t.exTeam(p.previousTeam)}</p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm"><PlayerRole role={p.role} /></TableCell>
                {auctionMode === 'CATEGORY' ? (
                  <TableCell>
                    {p.category ? <Badge variant="secondary">{p.category}</Badge> : <span>—</span>}
                  </TableCell>
                ) : null}
                <TableCell className="whitespace-nowrap tabular-nums">{formatBDT(p.basePrice)}</TableCell>
                <TableCell>
                  <PlayerStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {p.status === 'SOLD' ? (
                    <span>
                      <span className="font-semibold tabular-nums">{formatBDT(p.soldPrice)}</span>
                      {p.soldToTeamName ? <span className="text-muted-foreground"> · {p.soldToTeamName}</span> : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {readOnly ? null : (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t.editAria(p.name)} onClick={() => onEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                      aria-label={t.deleteAria(p.name)}
                      // Sold players and the one on the block can't be deleted (server-enforced).
                      disabled={p.status === 'SOLD' || p.status === 'LIVE'}
                      title={
                        p.status === 'SOLD'
                          ? t.soldNoDelete
                          : p.status === 'LIVE'
                            ? t.liveNoDelete
                            : undefined
                      }
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>

      {/* Phone & tablet cards */}
      <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
        {filtered.map((p) => (
          <Card key={p.id} className="py-0">
            <CardContent className="flex items-start gap-3 p-3">
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">
                    <span className="mr-1 text-xs text-muted-foreground">#{p.playerNumber}</span>
                    {p.name}
                  </p>
                  <PlayerStatusBadge status={p.status} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span><PlayerRole role={p.role} /></span>
                  {p.category ? <Badge variant="secondary" className="px-1.5 py-0">{t.catShort(p.category)}</Badge> : null}
                  <span>{t.baseAmount(formatBDT(p.basePrice))}</span>
                  {p.status === 'SOLD' ? (
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      {t.soldAmount(formatBDT(p.soldPrice))}{p.soldToTeamName ? ` · ${p.soldToTeamName}` : ''}
                    </span>
                  ) : null}
                </p>
                {readOnly ? null : (
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => onEdit(p)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden /> {t.edit}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                    onClick={() => onDelete(p)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> {t.delete}
                  </Button>
                </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
