'use client'

import { BarChart3, CalendarClock, ClipboardEdit, MapPin, MoreVertical, Pencil, Star, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import type { LeagueData, MatchDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TeamAvatar } from '@/components/shared/avatars'
import { groupMatches, scoreText, sideInfo, STATUS_TONE, teamMap, useLeagueLabels, type TeamMap } from './labels'

const STRINGS = {
  en: {
    noDate: 'Date to be set',
    pom: 'Player of the match',
    actions: (n: number) => `Actions for match ${n}`,
    enterResult: 'Enter result',
    playerStats: 'Player stats',
    editMatch: 'Edit schedule & teams',
    deleteMatch: 'Delete match',
    statsSaved: (n: number) => `${n} stat line${n === 1 ? '' : 's'}`,
    winner: 'Winner',
  },
  bn: {
    noDate: 'তারিখ ঠিক হয়নি',
    pom: 'ম্যাচ সেরা',
    actions: (n: number) => `ম্যাচ ${n}-এর অপশন`,
    enterResult: 'ফলাফল দিন',
    playerStats: 'খেলোয়াড়ের পরিসংখ্যান',
    editMatch: 'সময়সূচি ও দল বদলান',
    deleteMatch: 'ম্যাচ মুছুন',
    statsSaved: (n: number) => `${n} জনের পরিসংখ্যান`,
    winner: 'বিজয়ী',
  },
} satisfies Strings<{
  noDate: string
  pom: string
  actions: (n: number) => string
  enterResult: string
  playerStats: string
  editMatch: string
  deleteMatch: string
  statsSaved: (n: number) => string
  winner: string
}>

export interface MatchActions {
  onResult: (m: MatchDTO) => void
  onStats: (m: MatchDTO) => void
  onEdit: (m: MatchDTO) => void
  onDelete: (m: MatchDTO) => void
}

/** Fixtures grouped by round / stage. `actions` = editable (League tab staff). */
export function FixturesList({
  data,
  matches,
  actions,
  accent,
}: {
  data: LeagueData
  matches: MatchDTO[]
  actions?: MatchActions | null
  /** Brand colour for section rules (public page). */
  accent?: string
}) {
  const l = useLeagueLabels()
  const teams = teamMap(data)
  const blocks = groupMatches(matches, l)
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <section key={block.key} aria-label={block.title}>
          <h3
            className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            style={accent ? { color: accent } : undefined}
          >
            <span>{block.title}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {block.matches.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} sport={data.tournament.sport} teams={teams} actions={actions} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function MatchCard({
  match,
  sport,
  teams,
  actions,
}: {
  match: MatchDTO
  sport: string
  teams: TeamMap
  actions?: MatchActions | null
}) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const lang = useLang()
  const done = match.status === 'COMPLETED'
  const showScore = done || match.status === 'LIVE' || match.status === 'ABANDONED'
  const canPlay = !!match.homeTeamId && !!match.awayTeamId

  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-3 shadow-sm">
      <header className="flex items-start gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold tabular-nums">{l.matchNo(match.matchNumber)}</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{match.scheduledAt ? formatDate(match.scheduledAt, true, lang) : t.noDate}</span>
            {match.groupName ? <span className="shrink-0">· {l.group(match.groupName)}</span> : null}
          </p>
          {match.venue ? (
            <p className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{match.venue}</span>
            </p>
          ) : null}
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[11px]', STATUS_TONE[match.status])}>
          {match.status === 'LIVE' ? <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-rose-600" aria-hidden /> : null}
          {l.status[match.status]}
        </Badge>
        {actions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-my-1 -mr-1 h-8 w-8 shrink-0" aria-label={t.actions(match.matchNumber)}>
                <MoreVertical className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled={!canPlay} onClick={() => actions.onResult(match)}>
                <ClipboardEdit className="mr-2 h-4 w-4" aria-hidden /> {t.enterResult}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canPlay} onClick={() => actions.onStats(match)}>
                <BarChart3 className="mr-2 h-4 w-4" aria-hidden /> {t.playerStats}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onEdit(match)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden /> {t.editMatch}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.onDelete(match)}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden /> {t.deleteMatch}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div className="mt-3 space-y-1.5">
        {(['home', 'away'] as const).map((side) => {
          const info = sideInfo(match, side, teams, l)
          const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId
          const won = done && !!teamId && match.winnerTeamId === teamId
          const lost = done && !!match.winnerTeamId && !!teamId && match.winnerTeamId !== teamId
          return (
            <div key={side} className="flex items-center gap-2.5">
              {info.team ? (
                <TeamAvatar name={info.team.name} color={info.team.color} logoUrl={info.team.logoUrl} className="h-7 w-7 text-[11px]" />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground">?</span>
              )}
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  info.team ? 'font-semibold' : 'italic text-muted-foreground',
                  won && 'font-black',
                  lost && 'text-muted-foreground',
                )}
              >
                {info.name}
                {won ? <span className="sr-only"> ({t.winner})</span> : null}
              </span>
              {showScore ? (
                <span className={cn('shrink-0 text-sm tabular-nums', won ? 'font-black' : 'font-semibold', lost && 'text-muted-foreground')}>
                  {scoreText(sport, match, side)}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {match.resultNote || match.playerOfMatchName || (actions && match.statsCount > 0) ? (
        <footer className="mt-3 space-y-1 border-t pt-2 text-xs">
          {match.resultNote ? <p className="font-semibold text-teal-800 dark:text-teal-300">{match.resultNote}</p> : null}
          {match.playerOfMatchName ? (
            <p className="flex items-center gap-1 text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
              {t.pom}: <span className="font-semibold text-foreground">{match.playerOfMatchName}</span>
            </p>
          ) : null}
          {actions && match.statsCount > 0 ? <p className="text-muted-foreground">{t.statsSaved(match.statsCount)}</p> : null}
        </footer>
      ) : null}
    </article>
  )
}
