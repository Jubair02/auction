'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Gavel, MoreHorizontal, RotateCcw, Search } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import type { OrganizerAction, PlayerStatus, RoomState, RoomPlayerLite } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlayerStatusBadge } from '@/components/shared/status-badges'

interface PlayerPoolPanelProps {
  state: RoomState
  /** Organizer + auction LIVE + nobody on the block → rows are selectable */
  canSelect: boolean
  onAction: (action: OrganizerAction, payload?: Record<string, unknown>) => void
}

const FILTERS: { key: 'ALL' | PlayerStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'SOLD', label: 'Sold' },
  { key: 'UNSOLD', label: 'Unsold' },
  { key: 'SKIPPED', label: 'Skipped' },
]

/** Full player pool with filters, on-block selection and re-auction. */
export function PlayerPoolPanel({ state, canSelect, onAction }: PlayerPoolPanelProps) {
  const [filter, setFilter] = useState<'ALL' | PlayerStatus>('ALL')
  const [category, setCategory] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [pendingSelect, setPendingSelect] = useState<RoomPlayerLite | null>(null)
  const [pendingReauction, setPendingReauction] = useState<RoomPlayerLite | null>(null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.players.filter((p) => {
      if (filter !== 'ALL' && p.status !== filter) return false
      if (state.mode === 'CATEGORY' && category !== 'ALL' && p.category !== category) return false
      if (q && !p.name.toLowerCase().includes(q) && String(p.playerNumber) !== q) return false
      return true
    })
  }, [state.players, state.mode, filter, category, search])

  const selectable = (p: RoomPlayerLite) =>
    canSelect && (p.status === 'AVAILABLE' || p.status === 'UNSOLD' || p.status === 'SKIPPED')
  const reauctionable = (p: RoomPlayerLite) =>
    (p.status === 'UNSOLD' || p.status === 'SKIPPED' || p.status === 'SOLD') && state.status !== 'ENDED'

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>Player pool</span>
            <Badge variant="secondary" className="tabular-nums">{rows.length} shown</Badge>
          </CardTitle>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or number…"
                className="h-9 pl-8"
                aria-label="Search players"
              />
            </div>
            {state.mode === 'CATEGORY' ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filter by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {state.categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>Cat {c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => {
              const count = f.key === 'ALL' ? state.players.length : state.players.filter((p) => p.status === f.key).length
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    filter === f.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {f.label} <span className="tabular-nums opacity-75">({count})</span>
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {state.mode === 'CATEGORY' && state.pool.uncategorized > 0 ? (
            <p className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {state.pool.uncategorized} player{state.pool.uncategorized === 1 ? '' : 's'} have no category.
                Random picks skip them until every category is done — click one here to put them on the block.
              </span>
            </p>
          ) : null}
          <ul className="max-h-[420px] divide-y overflow-y-auto" aria-label="Player pool list">
            {rows.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">No players match these filters</li>
            ) : null}
            {rows.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 transition-colors sm:gap-3',
                  selectable(p) && 'cursor-pointer hover:bg-emerald-50/70',
                  p.status === 'LIVE' && 'bg-amber-50/80'
                )}
                onClick={() => {
                  if (selectable(p)) setPendingSelect(p)
                }}
              >
                <span className="w-9 shrink-0 font-mono text-xs font-bold tabular-nums text-muted-foreground">
                  #{String(p.playerNumber).padStart(3, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.name}
                    {p.status === 'LIVE' ? (
                      <Badge className="ml-2 bg-amber-500 px-1.5 py-0 text-[10px] text-white">on block</Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.role}
                    {p.category ? ` · Cat ${p.category}` : ''} · base {formatBDT(p.basePrice)}
                    {p.status === 'SOLD' && p.teamName ? ` · to ${p.teamName}` : ''}
                  </p>
                </div>
                {p.status === 'SOLD' && p.soldPrice !== null ? (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700">{formatBDT(p.soldPrice)}</span>
                ) : (
                  <PlayerStatusBadge status={p.status} className="hidden sm:inline-flex" />
                )}
                {reauctionable(p) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={`Actions for ${p.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => setPendingReauction(p)}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Re-auction
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="w-8 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* sold feed strip */}
      <SoldFeed feed={state.soldFeed} />

      {/* select confirm */}
      <AlertDialog open={!!pendingSelect} onOpenChange={(o) => !o && setPendingSelect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Put {pendingSelect?.name} on the block?</AlertDialogTitle>
            <AlertDialogDescription>
              Player #{pendingSelect?.playerNumber} · base {formatBDT(pendingSelect?.basePrice ?? 0)}
              {pendingSelect?.category ? ` · category ${pendingSelect.category}` : ''}
              {pendingSelect && pendingSelect.status !== 'AVAILABLE'
                ? ` · currently ${pendingSelect.status.toLowerCase()}`
                : ''}
              . The bid timer starts immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSelect) onAction('select_player', { playerId: pendingSelect.id })
                setPendingSelect(null)
              }}
            >
              Put on block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* re-auction confirm */}
      <AlertDialog open={!!pendingReauction} onOpenChange={(o) => !o && setPendingReauction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-auction {pendingReauction?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReauction?.status === 'SOLD'
                ? `This undoes the sale to ${pendingReauction.teamName} and refunds ${formatBDT(pendingReauction.soldPrice ?? 0)} to their budget. `
                : 'This clears the current status and puts the player straight onto the block. '}
              The bid timer restarts from zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingReauction) onAction('reauction', { playerId: pendingReauction.id })
                setPendingReauction(null)
              }}
            >
              Re-auction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Latest sales chips — reused by pool panel (organizer) and the viewer wall. */
export function SoldFeed({ feed, className }: { feed: RoomState['soldFeed']; className?: string }) {
  if (feed.length === 0) return null
  return (
    <Card className={cn('border-teal-200 bg-teal-50/50', className)}>
      <CardContent className="p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-teal-800">
          <Gavel className="h-3.5 w-3.5" aria-hidden /> Latest sales
        </p>
        <div className="flex flex-wrap gap-1.5">
          {feed.slice(0, 5).map((s, i) => (
            <span
              key={`${s.playerName}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-background px-2.5 py-1 text-xs"
            >
              <span className="font-semibold">{s.playerName}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-teal-800">{s.teamName}</span>
              <span className="font-bold tabular-nums">{formatBDT(s.price)}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
