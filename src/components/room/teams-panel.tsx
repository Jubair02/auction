'use client'

import { TrendingUp } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import type { RoomState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TeamAvatar } from '@/components/shared/avatars'

/** Budget / squad board for every team — read-only, all roles. */
export function TeamsPanel({ state, compact = false }: { state: RoomState; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Teams</span>
          <Badge variant="secondary" className="tabular-nums">{state.teams.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn('space-y-3', compact && 'max-h-96 overflow-y-auto')}>
        {state.teams.map((t) => {
          const isTopBidder = state.currentBid?.teamId === t.id
          const spendPct = t.budget > 0 ? Math.min(100, (t.spent / t.budget) * 100) : 0
          return (
            <div
              key={t.id}
              className={cn(
                'rounded-xl border p-3 transition-shadow',
                isTopBidder ? 'border-primary shadow-[0_0_0_2px] shadow-primary/25' : 'bg-card'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <TeamAvatar name={t.name} color={t.color} logoUrl={t.logoUrl} className="h-9 w-9" />
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                      t.online ? 'bg-emerald-500' : 'bg-slate-300'
                    )}
                    aria-label={t.online ? 'Team manager online' : 'Team manager offline'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                    {t.name}
                    {isTopBidder ? (
                      <Badge className="bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
                        <TrendingUp className="mr-0.5 h-2.5 w-2.5" aria-hidden />
                        Highest bid
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Squad {t.squadCount}/{t.maxSquad} · min {t.minSquad}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums text-emerald-700">{formatBDT(t.remaining)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">remaining</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={spendPct} className="h-1.5" aria-label={`${t.name} budget used`} />
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {formatBDT(t.spent)}/{formatBDT(t.budget)}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
