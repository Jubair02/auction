'use client'

import { TrendingUp } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import type { RoomState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TeamAvatar } from '@/components/shared/avatars'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    teams: 'Teams',
    managerOnline: 'Team manager online',
    managerOffline: 'Team manager offline',
    highestBid: 'Highest bid',
    squadLine: (count: number, max: number, min: number) => `Squad ${count}/${max} · min ${min}`,
    remaining: 'remaining',
    budgetUsed: (team: string) => `${team} budget used`,
  },
  bn: {
    teams: 'দলসমূহ',
    managerOnline: 'টিম ম্যানেজার অনলাইনে',
    managerOffline: 'টিম ম্যানেজার অফলাইনে',
    highestBid: 'সর্বোচ্চ বিড',
    squadLine: (count: number, max: number, min: number) => `স্কোয়াড ${count}/${max} · সর্বনিম্ন ${min}`,
    remaining: 'বাকি',
    budgetUsed: (team: string) => `${team}-এর বাজেট খরচ`,
  },
} satisfies Strings<{
  teams: string
  managerOnline: string
  managerOffline: string
  highestBid: string
  squadLine: (count: number, max: number, min: number) => string
  remaining: string
  budgetUsed: (team: string) => string
}>

/** Budget / squad board for every team — read-only, all roles. */
export function TeamsPanel({ state, compact = false }: { state: RoomState; compact?: boolean }) {
  const s = useStrings(STRINGS)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{s.teams}</span>
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
                    aria-label={t.online ? s.managerOnline : s.managerOffline}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                    {t.name}
                    {isTopBidder ? (
                      <Badge className="bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
                        <TrendingUp className="mr-0.5 h-2.5 w-2.5" aria-hidden />
                        {s.highestBid}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {s.squadLine(t.squadCount, t.maxSquad, t.minSquad)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums text-emerald-700">{formatBDT(t.remaining)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.remaining}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={spendPct} className="h-1.5" aria-label={s.budgetUsed(t.name)} />
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
