'use client'

import { CalendarClock, Copy, Trophy, Users } from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { formatAuctionWhen } from '@/lib/format'
import { isDone, isLive } from '@/lib/tournament-status'
import { cn } from '@/lib/utils'
import { sportLabel, type Plan, type TournamentSummary } from '@/lib/types'
import { type Lang, type Strings, useLang, useStrings } from '@/lib/i18n'
import { tournamentTypeLabel } from '@/lib/tournament-types'

const STRINGS = {
  en: {
    codeCopied: 'Room code copied',
    underWay: 'Auction under way',
    held: (when: string) => `Held ${when}`,
    wasDue: (when: string) => `Was due ${when}`,
    auctionAt: (when: string) => `Auction ${when}`,
    noTime: 'No auction time set',
    teams: (n: number) => `${n} team${n === 1 ? '' : 's'}`,
    noPlayers: 'No players yet',
    soldOf: (sold: number, total: number) => `${sold} of ${total} player${total === 1 ? '' : 's'} sold`,
    soldPct: (pct: number) => `${pct}% of players sold`,
    roomCode: 'Room code',
    copyCode: (code: string) => `Copy room code ${code}`,
    noRoom: 'No room yet — set up auction',
    plan: { FREE: 'Free', PRO: 'Pro' },
    staffRole: { CO_ORGANIZER: 'Co-organizer', AUCTIONEER: 'Auctioneer' },
    planAria: (plan: string) => `${plan} plan`,
  },
  bn: {
    codeCopied: 'রুম কোড কপি হয়েছে',
    underWay: 'নিলাম চলছে',
    held: (when: string) => `অনুষ্ঠিত: ${when}`,
    wasDue: (when: string) => `নির্ধারিত ছিল: ${when}`,
    auctionAt: (when: string) => `নিলাম: ${when}`,
    noTime: 'নিলামের সময় ঠিক হয়নি',
    teams: (n: number) => `${n}টি দল`,
    noPlayers: 'এখনো কোনো খেলোয়াড় নেই',
    soldOf: (sold: number, total: number) => `${total} জন খেলোয়াড়ের ${sold} জন বিক্রি`,
    soldPct: (pct: number) => `${pct}% খেলোয়াড় বিক্রি`,
    roomCode: 'রুম কোড',
    copyCode: (code: string) => `রুম কোড ${code} কপি করুন`,
    noRoom: 'এখনো রুম নেই — নিলাম সেট আপ করুন',
    plan: { FREE: 'ফ্রি', PRO: 'প্রো' },
    staffRole: { CO_ORGANIZER: 'সহ-আয়োজক', AUCTIONEER: 'নিলামকারী' },
    planAria: (plan: string) => `${plan} প্ল্যান`,
  },
} satisfies Strings<{
  codeCopied: string
  underWay: string
  held: (when: string) => string
  wasDue: (when: string) => string
  auctionAt: (when: string) => string
  noTime: string
  teams: (n: number) => string
  noPlayers: string
  soldOf: (sold: number, total: number) => string
  soldPct: (pct: number) => string
  roomCode: string
  copyCode: (code: string) => string
  noRoom: string
  plan: Record<Plan, string>
  staffRole: Record<'CO_ORGANIZER' | 'AUCTIONEER', string>
  planAria: (plan: string) => string
}>

export function copyRoomCode(code: string, lang: Lang = 'en') {
  copyText(code, STRINGS[lang].codeCopied)
}

export function TournamentCard({
  t,
  actions,
}: {
  t: TournamentSummary
  /** Primary row of buttons rendered at the bottom (e.g. Manage). */
  actions?: React.ReactNode
}) {
  const lang = useLang()
  const soldPct = t.playerCount > 0 ? Math.round((t.soldCount / t.playerCount) * 100) : 0
  const when = formatAuctionWhen(t.auctionAt, lang)
  const live = isLive(t)
  const done = isDone(t)
  // A date that has passed while the auction never ran needs the organizer's attention.
  const overdue = !!when?.past && !live && !done
  const s = useStrings(STRINGS)

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader className="gap-2 pb-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold leading-tight">{t.name}</h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {sportLabel(t.sport, lang, t.sportName)}
                {t.tournamentType ? ` · ${tournamentTypeLabel(t.tournamentType, lang)}` : ''}
                {t.location ? ` · ${t.location}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <Badge
                  variant="outline"
                  aria-label={s.planAria(s.plan[t.plan])}
                  className={cn(
                    'h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide',
                    t.plan === 'PRO' ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'text-muted-foreground',
                  )}
                >
                  {s.plan[t.plan]}
                </Badge>
                {t.staffRole ? (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">
                    {s.staffRole[t.staffRole]}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <TournamentStatusBadge status={live ? 'LIVE' : t.status} className="shrink-0" />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-amber-700 dark:text-amber-400')}>
            <CalendarClock className="h-3 w-3" aria-hidden />
            {live ? s.underWay : when ? (done ? s.held : overdue ? s.wasDue : s.auctionAt)(when.text) : s.noTime}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden /> {s.teams(t.teamCount)}
          </span>
        </div>

        {t.playerCount === 0 ? (
          <p className="text-xs text-muted-foreground">{s.noPlayers}</p>
        ) : (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{s.soldOf(t.soldCount, t.playerCount)}</span>
              <span className="font-semibold tabular-nums">{soldPct}%</span>
            </div>
            <Progress value={soldPct} aria-label={s.soldPct(soldPct)} />
          </div>
        )}

        {t.roomCode ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.roomCode}</p>
              <p className="truncate font-mono text-sm font-bold">{t.roomCode}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={s.copyCode(t.roomCode)}
              onClick={() => copyRoomCode(t.roomCode as string, lang)}
            >
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
            {s.noRoom}
          </Badge>
        )}
      </CardContent>

      {actions ? (
        <CardFooter className="gap-2 border-t pt-3">{actions}</CardFooter>
      ) : null}
    </Card>
  )
}
