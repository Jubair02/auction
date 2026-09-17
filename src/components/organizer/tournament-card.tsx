'use client'

import { Copy, MapPin, Trophy, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { formatDate } from '@/lib/format'
import type { TournamentSummary } from '@/lib/types'

export const SPORT_LABELS: Record<string, string> = {
  CRICKET: 'Cricket',
  FOOTBALL: 'Football',
}

export const MODE_LABELS: Record<string, string> = {
  CATEGORY: 'Category A–E',
  NORMAL: 'Normal',
}

export function copyRoomCode(code: string) {
  void navigator.clipboard
    .writeText(code)
    .then(() => toast.success('Room code copied'))
    .catch(() => toast.error('Could not copy — please copy manually'))
}

export function TournamentCard({
  t,
  actions,
}: {
  t: TournamentSummary
  /** Primary row of buttons rendered at the bottom (e.g. Manage). */
  actions?: React.ReactNode
}) {
  const soldPct = t.playerCount > 0 ? Math.round((t.soldCount / t.playerCount) * 100) : 0

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold leading-tight">{t.name}</h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {SPORT_LABELS[t.sport] ?? t.sport}
                {t.tournamentType ? ` · ${t.tournamentType}` : ''}
                {t.location ? ` · ${t.location}` : ''}
              </p>
            </div>
          </div>
          <TournamentStatusBadge status={t.status} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Starts {formatDate(t.startDate)}</span>
          <span>Auction {formatDate(t.auctionAt, true)}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden /> {t.teamCount} teams
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t.soldCount} / {t.playerCount} players sold
            </span>
            <span className="font-semibold tabular-nums">{soldPct}%</span>
          </div>
          <Progress value={soldPct} aria-label={`${soldPct}% of players sold`} />
        </div>

        {t.roomCode ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Room code</p>
              <p className="truncate font-mono text-sm font-bold">{t.roomCode}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={`Copy room code ${t.roomCode}`}
              onClick={() => copyRoomCode(t.roomCode as string)}
            >
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
            No room yet — set up auction
          </Badge>
        )}
      </CardContent>

      {actions ? (
        <CardFooter className="gap-2 border-t pt-3">{actions}</CardFooter>
      ) : null}
    </Card>
  )
}
