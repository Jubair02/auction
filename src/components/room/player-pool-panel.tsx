'use client'

import { memo, type ReactNode, useMemo, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlayerStatusBadge } from '@/components/shared/status-badges'
import { type Strings, useStrings } from '@/lib/i18n'
import { PlayerRole } from '@/components/shared/player-role'

interface PlayerPoolPanelProps {
  state: RoomState
  /** Organizer + auction LIVE + nobody on the block → rows are selectable */
  canSelect: boolean
  /** Re-auctioning a sold player refunds the team: co-organizer and up (false for auctioneers). */
  canReauction?: boolean
  onAction: (action: OrganizerAction, payload?: Record<string, unknown>) => void
}

const FILTERS: ('ALL' | PlayerStatus)[] = ['ALL', 'AVAILABLE', 'SOLD', 'UNSOLD', 'SKIPPED']

const STRINGS = {
  en: {
    filters: { ALL: 'All', AVAILABLE: 'Available', SOLD: 'Sold', UNSOLD: 'Unsold', SKIPPED: 'Skipped' } as Record<
      'ALL' | PlayerStatus,
      string
    >,
    statusLower: {
      AVAILABLE: 'available',
      LIVE: 'live',
      SOLD: 'sold',
      UNSOLD: 'unsold',
      SKIPPED: 'skipped',
    } as Record<PlayerStatus, string>,
    reopenToReauction: 'Reopen the auction to re-auction a sold player',
    resumeToReauction: 'Resume the auction to re-auction a sold player',
    startToReauction: 'Start the auction to re-auction a sold player',
    playerOnBlock: 'the player on the block',
    finishFirst: (name: string) => `Finish ${name} first`,
    title: 'Player pool',
    shown: (n: number) => `${n} shown`,
    searchPlaceholder: 'Search name or number…',
    searchAria: 'Search players',
    filterCategory: 'Filter by category',
    allCategories: 'All categories',
    catShort: (c: string) => `Cat ${c}`,
    filterStatus: 'Filter by status',
    uncategorized: (n: number) =>
      `${n} player${n === 1 ? '' : 's'} have no category. Random picks skip them until every category is done — click one here to put them on the block.`,
    listAria: 'Player pool list',
    noMatch: 'No players match these filters',
    onBlock: 'on block',
    metaCat: (c: string) => ` · Cat ${c}`,
    metaBase: (amount: string) => ` · base ${amount}`,
    metaTo: (team: string) => ` · to ${team}`,
    metaRound: (n: number) => ` · round ${n}`,
    actionsAria: (name: string) => `Actions for ${name}`,
    reauction: 'Re-auction',
    selectTitle: (name: string) => `Put ${name} on the block?`,
    selectDesc: (num: string, base: string, category: string | null, current: string | null) =>
      `Player #${num} · base ${base}${category ? ` · category ${category}` : ''}${current ? ` · currently ${current}` : ''}. The bid timer starts immediately.`,
    cancel: 'Cancel',
    putOnBlock: 'Put on block',
    reauctionTitle: (name: string, round: number | null) =>
      `Re-auction ${name}${round !== null ? ` — round ${round}` : ''}?`,
    notUndo: 'This starts a brand new auction cycle for this player. It is not an undo:',
    theBuyingTeam: 'the buying team',
    refunded: (amount: ReactNode, team: string): ReactNode => (
      <>
        {amount} is refunded to {team}, and their squad slot is freed.
      </>
    ),
    restartsFrom: (amount: ReactNode): ReactNode => (
      <>
        Bidding restarts from the base price of {amount} — not from the old sale price.
      </>
    ),
    theOriginalTeam: 'The original team',
    blocked: (team: string, strong: (text: string) => ReactNode): ReactNode => (
      <>
        {team} is {strong('blocked from bidding')} in this round (organizer setting).
      </>
    ),
    mayBidAgain: (team: string) => `${team} may bid again and would pay the new price in full.`,
    historyStays: 'The original sale stays in the auction history permanently.',
    reason: 'Reason',
    reasonNote: '(optional, saved to the audit log)',
    reasonPlaceholder: 'e.g. bid entered for the wrong team',
    latestSales: 'Latest sales',
  },
  bn: {
    filters: { ALL: 'সব', AVAILABLE: 'উপলব্ধ', SOLD: 'বিক্রি', UNSOLD: 'অবিক্রিত', SKIPPED: 'বাদ' } as Record<
      'ALL' | PlayerStatus,
      string
    >,
    statusLower: {
      AVAILABLE: 'উপলব্ধ',
      LIVE: 'লাইভ',
      SOLD: 'বিক্রি',
      UNSOLD: 'অবিক্রিত',
      SKIPPED: 'বাদ',
    } as Record<PlayerStatus, string>,
    reopenToReauction: 'বিক্রি হওয়া খেলোয়াড়কে পুনরায় নিলামে তুলতে নিলাম আবার খুলুন',
    resumeToReauction: 'বিক্রি হওয়া খেলোয়াড়কে পুনরায় নিলামে তুলতে নিলাম আবার চালু করুন',
    startToReauction: 'বিক্রি হওয়া খেলোয়াড়কে পুনরায় নিলামে তুলতে আগে নিলাম শুরু করুন',
    playerOnBlock: 'নিলামে থাকা খেলোয়াড়',
    finishFirst: (name: string) => `আগে ${name}-এর নিলাম শেষ করুন`,
    title: 'খেলোয়াড় পুল',
    shown: (n: number) => `${n} জন দেখানো হচ্ছে`,
    searchPlaceholder: 'নাম বা নম্বর দিয়ে খুঁজুন…',
    searchAria: 'খেলোয়াড় খুঁজুন',
    filterCategory: 'ক্যাটাগরি দিয়ে ফিল্টার',
    allCategories: 'সব ক্যাটাগরি',
    catShort: (c: string) => `ক্যাট ${c}`,
    filterStatus: 'স্ট্যাটাস দিয়ে ফিল্টার',
    uncategorized: (n: number) =>
      `${n} জন খেলোয়াড়ের কোনো ক্যাটাগরি নেই। সব ক্যাটাগরি শেষ না হওয়া পর্যন্ত র‍্যান্ডম বাছাইয়ে তারা আসবে না — নিলামে তুলতে এখান থেকে কাউকে ক্লিক করুন।`,
    listAria: 'খেলোয়াড় পুলের তালিকা',
    noMatch: 'এই ফিল্টারে কোনো খেলোয়াড় নেই',
    onBlock: 'নিলামে',
    metaCat: (c: string) => ` · ক্যাট ${c}`,
    metaBase: (amount: string) => ` · বেস ${amount}`,
    metaTo: (team: string) => ` · ${team}`,
    metaRound: (n: number) => ` · রাউন্ড ${n}`,
    actionsAria: (name: string) => `${name}-এর অ্যাকশন`,
    reauction: 'পুনরায় নিলাম',
    selectTitle: (name: string) => `${name}-কে নিলামে তুলবেন?`,
    selectDesc: (num: string, base: string, category: string | null, current: string | null) =>
      `খেলোয়াড় #${num} · বেস ${base}${category ? ` · ক্যাটাগরি ${category}` : ''}${current ? ` · এখন ${current}` : ''}। বিডের টাইমার সঙ্গে সঙ্গে শুরু হবে।`,
    cancel: 'বাতিল',
    putOnBlock: 'নিলামে তুলুন',
    reauctionTitle: (name: string, round: number | null) =>
      `${name}-কে পুনরায় নিলাম${round !== null ? ` — রাউন্ড ${round}` : ''}?`,
    notUndo: 'এতে এই খেলোয়াড়ের জন্য একদম নতুন নিলাম শুরু হবে। এটি আগের বিক্রি ফিরিয়ে নেওয়া নয়:',
    theBuyingTeam: 'যে দল কিনেছিল',
    refunded: (amount: ReactNode, team: string): ReactNode => (
      <>
        {amount} {team}-কে ফেরত দেওয়া হবে, এবং তাদের স্কোয়াডের একটি জায়গা খালি হবে।
      </>
    ),
    restartsFrom: (amount: ReactNode): ReactNode => (
      <>
        বিড আবার শুরু হবে বেস প্রাইস {amount} থেকে — পুরোনো বিক্রির দাম থেকে নয়।
      </>
    ),
    theOriginalTeam: 'আগের দল',
    blocked: (team: string, strong: (text: string) => ReactNode): ReactNode => (
      <>
        এই রাউন্ডে {team} {strong('বিড করতে পারবে না')} (আয়োজকের সেটিং)।
      </>
    ),
    mayBidAgain: (team: string) => `${team} আবার বিড করতে পারবে এবং নতুন দাম পুরোটা দেবে।`,
    historyStays: 'আগের বিক্রির তথ্য নিলামের ইতিহাসে স্থায়ীভাবে থেকে যাবে।',
    reason: 'কারণ',
    reasonNote: '(ঐচ্ছিক, অডিট লগে সংরক্ষিত হবে)',
    reasonPlaceholder: 'যেমন: ভুল দলের নামে বিড লেখা হয়েছিল',
    latestSales: 'সাম্প্রতিক বিক্রি',
  },
} satisfies Strings<{
  filters: Record<'ALL' | PlayerStatus, string>
  statusLower: Record<PlayerStatus, string>
  reopenToReauction: string
  resumeToReauction: string
  startToReauction: string
  playerOnBlock: string
  finishFirst: (name: string) => string
  title: string
  shown: (n: number) => string
  searchPlaceholder: string
  searchAria: string
  filterCategory: string
  allCategories: string
  catShort: (c: string) => string
  filterStatus: string
  uncategorized: (n: number) => string
  listAria: string
  noMatch: string
  onBlock: string
  metaCat: (c: string) => string
  metaBase: (amount: string) => string
  metaTo: (team: string) => string
  metaRound: (n: number) => string
  actionsAria: (name: string) => string
  reauction: string
  selectTitle: (name: string) => string
  selectDesc: (num: string, base: string, category: string | null, current: string | null) => string
  cancel: string
  putOnBlock: string
  reauctionTitle: (name: string, round: number | null) => string
  notUndo: string
  theBuyingTeam: string
  refunded: (amount: ReactNode, team: string) => ReactNode
  restartsFrom: (amount: ReactNode) => ReactNode
  theOriginalTeam: string
  blocked: (team: string, strong: (text: string) => ReactNode) => ReactNode
  mayBidAgain: (team: string) => string
  historyStays: string
  reason: string
  reasonNote: string
  reasonPlaceholder: string
  latestSales: string
}>

/**
 * Every bid sends a new room state, but a bid never changes the pool. The list
 * can hold hundreds of rows, so it only re-renders when a field it shows changes.
 * `players` keeps its identity between broadcasts while unchanged (see mergeRoomState).
 */
function samePoolProps(a: PlayerPoolPanelProps, b: PlayerPoolPanelProps): boolean {
  const s = a.state
  const n = b.state
  return (
    a.canSelect === b.canSelect &&
    a.canReauction === b.canReauction &&
    a.onAction === b.onAction &&
    s.players === n.players &&
    s.mode === n.mode &&
    s.status === n.status &&
    s.allowPreviousOwnerRebid === n.allowPreviousOwnerRebid &&
    s.currentPlayer?.id === n.currentPlayer?.id &&
    s.currentPlayer?.name === n.currentPlayer?.name &&
    s.pool.uncategorized === n.pool.uncategorized &&
    JSON.stringify(s.categories) === JSON.stringify(n.categories) &&
    JSON.stringify(s.soldFeed) === JSON.stringify(n.soldFeed)
  )
}

/** Full player pool with filters, on-block selection and re-auction. */
export const PlayerPoolPanel = memo(PlayerPoolPanelView, samePoolProps)

function PlayerPoolPanelView({ state, canSelect, canReauction = true, onAction }: PlayerPoolPanelProps) {
  const t = useStrings(STRINGS)
  const [filter, setFilter] = useState<'ALL' | PlayerStatus>('ALL')
  const [category, setCategory] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [pendingSelect, setPendingSelect] = useState<RoomPlayerLite | null>(null)
  const [pendingReauction, setPendingReauction] = useState<RoomPlayerLite | null>(null)
  const [reauctionReason, setReauctionReason] = useState('')

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
  // Re-auction opens a NEW cycle for a completed sale. Unsold/skipped players
  // are not sales — they go straight back on the block via a normal pick.
  const blockFree = !state.currentPlayer
  const reauctionable = (p: RoomPlayerLite) => p.status === 'SOLD' && state.status === 'LIVE'
  const reauctionBlockedReason = (): string | null => {
    if (state.status === 'ENDED') return t.reopenToReauction
    if (state.status === 'PAUSED') return t.resumeToReauction
    if (state.status !== 'LIVE') return t.startToReauction
    if (!blockFree) return t.finishFirst(state.currentPlayer?.name ?? t.playerOnBlock)
    return null
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>{t.title}</span>
            <Badge variant="secondary" className="tabular-nums">{t.shown(rows.length)}</Badge>
          </CardTitle>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="h-9 pl-8"
                aria-label={t.searchAria}
              />
            </div>
            {state.mode === 'CATEGORY' ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-full sm:w-40" aria-label={t.filterCategory}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.allCategories}</SelectItem>
                  {state.categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{t.catShort(c.code)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5" role="tablist" aria-label={t.filterStatus}>
            {FILTERS.map((key) => {
              const count = key === 'ALL' ? state.players.length : state.players.filter((p) => p.status === key).length
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    filter === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {t.filters[key]} <span className="tabular-nums opacity-75">({count})</span>
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {state.mode === 'CATEGORY' && state.pool.uncategorized > 0 ? (
            <p className="flex items-start gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {t.uncategorized(state.pool.uncategorized)}
              </span>
            </p>
          ) : null}
          <ul className="max-h-[420px] divide-y overflow-y-auto" aria-label={t.listAria}>
            {rows.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">{t.noMatch}</li>
            ) : null}
            {rows.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 transition-colors sm:gap-3',
                  selectable(p) && 'cursor-pointer hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30',
                  p.status === 'LIVE' && 'bg-amber-50/80 dark:bg-amber-950/30'
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
                      <Badge className="ml-2 bg-amber-500 px-1.5 py-0 text-[10px] text-white">{t.onBlock}</Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <PlayerRole role={p.role} />
                    {p.category ? t.metaCat(p.category) : ''}{t.metaBase(formatBDT(p.basePrice))}
                    {p.status === 'SOLD' && p.teamName ? t.metaTo(p.teamName) : ''}
                    {p.auctionCycle ? t.metaRound(p.auctionCycle + 1) : ''}
                  </p>
                </div>
                {p.status === 'SOLD' && p.soldPrice !== null ? (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-teal-700 dark:text-teal-300">{formatBDT(p.soldPrice)}</span>
                ) : (
                  <PlayerStatusBadge status={p.status} className="hidden sm:inline-flex" />
                )}
                {p.status === 'SOLD' && canReauction ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={t.actionsAria(p.name)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        disabled={!reauctionable(p) || !blockFree}
                        onClick={() => setPendingReauction(p)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" /> {t.reauction}
                      </DropdownMenuItem>
                      {reauctionBlockedReason() ? (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">{reauctionBlockedReason()}</p>
                      ) : null}
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
            <AlertDialogTitle>{t.selectTitle(pendingSelect?.name ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.selectDesc(
                String(pendingSelect?.playerNumber ?? ''),
                formatBDT(pendingSelect?.basePrice ?? 0),
                pendingSelect?.category ?? null,
                pendingSelect && pendingSelect.status !== 'AVAILABLE' ? t.statusLower[pendingSelect.status] : null,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSelect) onAction('select_player', { playerId: pendingSelect.id })
                setPendingSelect(null)
              }}
            >
              {t.putOnBlock}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* re-auction confirm */}
      <AlertDialog
        open={!!pendingReauction}
        onOpenChange={(o) => {
          if (!o) {
            setPendingReauction(null)
            setReauctionReason('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.reauctionTitle(
                pendingReauction?.name ?? '',
                pendingReauction ? (pendingReauction.auctionCycle ?? 0) + 2 : null,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{t.notUndo}</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    {t.refunded(
                      <span className="font-semibold text-foreground">
                        {formatBDT(pendingReauction?.soldPrice ?? 0)}
                      </span>,
                      pendingReauction?.teamName ?? t.theBuyingTeam,
                    )}
                  </li>
                  <li>
                    {t.restartsFrom(
                      <span className="font-semibold text-foreground">
                        {formatBDT(pendingReauction?.basePrice ?? 0)}
                      </span>,
                    )}
                  </li>
                  <li>
                    {state.allowPreviousOwnerRebid === false ? (
                      t.blocked(pendingReauction?.teamName ?? t.theOriginalTeam, (text) => (
                        <span className="font-semibold text-foreground">{text}</span>
                      ))
                    ) : (
                      t.mayBidAgain(pendingReauction?.teamName ?? t.theOriginalTeam)
                    )}
                  </li>
                  <li>{t.historyStays}</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reauction-reason" className="text-xs">
              {t.reason} <span className="font-normal text-muted-foreground">{t.reasonNote}</span>
            </Label>
            <Input
              id="reauction-reason"
              value={reauctionReason}
              onChange={(e) => setReauctionReason(e.target.value)}
              placeholder={t.reasonPlaceholder}
              maxLength={200}
              className="h-10"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingReauction) {
                  onAction('reauction', {
                    playerId: pendingReauction.id,
                    ...(reauctionReason.trim() ? { reason: reauctionReason.trim() } : {}),
                  })
                }
                setPendingReauction(null)
                setReauctionReason('')
              }}
            >
              {t.reauction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Latest sales chips — reused by pool panel (organizer) and the viewer wall. */
export function SoldFeed({ feed, className }: { feed: RoomState['soldFeed']; className?: string }) {
  const t = useStrings(STRINGS)
  if (feed.length === 0) return null
  return (
    <Card className={cn('border-teal-200 bg-teal-50/50 dark:border-teal-900/60 dark:bg-teal-950/30', className)}>
      <CardContent className="p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-teal-800 dark:text-teal-300">
          <Gavel className="h-3.5 w-3.5" aria-hidden /> {t.latestSales}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {feed.slice(0, 5).map((s, i) => (
            <span
              key={`${s.playerName}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-background dark:border-teal-900/60 px-2.5 py-1 text-xs"
            >
              <span className="font-semibold">{s.playerName}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-teal-800 dark:text-teal-200">{s.teamName}</span>
              <span className="font-bold tabular-nums">{formatBDT(s.price)}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
