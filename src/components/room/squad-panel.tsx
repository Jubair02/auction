'use client'

import { ChevronUp, Trophy } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import type { RoomState, RoomTeam } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlayerAvatar } from '@/components/shared/avatars'

/** Manager's left-column extras — their own squad + the live bid ladder for the player on the block. */
export function SquadPanel({ state, myTeam }: { state: RoomState; myTeam: RoomTeam | undefined }) {
  // Match on team id; fall back to the name for a socket service that has not
  // been restarted yet and is still sending the older payload shape.
  const squad = myTeam
    ? state.players.filter(
        (p) =>
          p.status === 'SOLD' && (p.teamId ? p.teamId === myTeam.id : p.teamName === myTeam.name),
      )
    : []

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
              Your squad
            </span>
            <Badge variant="secondary" className="tabular-nums">
              {squad.length}/{myTeam?.maxSquad ?? '—'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1" aria-label="Your squad">
            {squad.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No players yet — get bidding when the auction goes live
              </li>
            ) : null}
            {squad.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                <PlayerAvatar name={p.name} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.role}
                    {p.category ? ` · Cat ${p.category}` : ''}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-teal-700">{formatBDT(p.soldPrice ?? p.basePrice)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Bid ladder</span>
            <span className="text-xs font-normal text-muted-foreground">current player</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1" aria-label="Bid history for the current player">
            {state.currentBidHistory.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No bids yet for this player</li>
            ) : null}
            {[...state.currentBidHistory].reverse().map((b, i) => (
              <li
                key={`${b.createdAt}-${b.teamId}-${i}`}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                  i === 0 ? 'border border-primary/40 bg-primary/10 font-bold' : 'text-muted-foreground'
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {i === 0 ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : null}
                  <span className="truncate">{b.teamName}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatBDT(b.amount)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
