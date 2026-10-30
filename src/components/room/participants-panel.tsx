'use client'

import { Activity, Crown, Eye, UserCog } from 'lucide-react'
import type { RoomNotification, RoomRole, RoomState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    roles: { ORGANIZER: 'Organizer', MANAGER: 'Manager', VIEWER: 'Viewer' },
    participants: 'Participants',
    onlineCount: (n: number) => `${n} online`,
    nobody: 'Nobody here yet',
    watching: (n: number) => `${n} ${n === 1 ? 'viewer' : 'viewers'} watching`,
    team: 'Team',
    online: 'online',
    offline: 'offline',
    activity: 'Activity',
    quiet: 'Quiet for now — actions will appear here',
  },
  bn: {
    roles: { ORGANIZER: 'আয়োজক', MANAGER: 'ম্যানেজার', VIEWER: 'দর্শক' },
    participants: 'অংশগ্রহণকারী',
    onlineCount: (n: number) => `${n} জন অনলাইন`,
    nobody: 'এখনো কেউ আসেনি',
    watching: (n: number) => `${n} জন দর্শক দেখছেন`,
    team: 'দল',
    online: 'অনলাইন',
    offline: 'অফলাইন',
    activity: 'অ্যাক্টিভিটি',
    quiet: 'এখনো কিছু ঘটেনি — সব আপডেট এখানে দেখা যাবে',
  },
} satisfies Strings<{
  roles: Record<RoomRole, string>
  participants: string
  onlineCount: (n: number) => string
  nobody: string
  watching: (n: number) => string
  team: string
  online: string
  offline: string
  activity: string
  quiet: string
}>

const ROLE_META: Record<RoomRole, { icon: typeof Crown; className: string }> = {
  ORGANIZER: { icon: Crown, className: 'bg-amber-100 text-amber-900' },
  MANAGER: { icon: UserCog, className: 'bg-teal-100 text-teal-900' },
  VIEWER: { icon: Eye, className: 'bg-slate-200 text-slate-700' },
}

/** Who is in the room right now. */
export function ParticipantsPanel({ state }: { state: RoomState }) {
  const t = useStrings(STRINGS)
  const onlineCount = state.participants.filter((p) => p.online).length + state.viewersOnline
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{t.participants}</span>
          <Badge variant="secondary" className="tabular-nums">{t.onlineCount(onlineCount)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-64 space-y-1.5 overflow-y-auto">
        {state.participants.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t.nobody}</p>
        ) : null}
        {state.participants.map((p, i) => {
          const meta = ROLE_META[p.role]
          const Icon = meta.icon
          return (
            <div key={`${p.role}-${p.name}-${i}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', meta.className)} aria-hidden>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                {p.teamId ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {state.teams.find((team) => team.id === p.teamId)?.name ?? t.team}
                  </p>
                ) : null}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t.roles[p.role]}</span>
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', p.online ? 'bg-emerald-500' : 'bg-slate-300')}
                aria-label={p.online ? t.online : t.offline}
              />
            </div>
          )
        })}
        {state.viewersOnline > 0 ? (
          <p className="flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" aria-hidden /> {t.watching(state.viewersOnline)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

const LEVEL_DOT: Record<RoomNotification['level'], string> = {
  info: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
}

/** Live gavel feed — newest first. */
export function ActivityFeed({ notifications }: { notifications: RoomNotification[] }) {
  const t = useStrings(STRINGS)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          {t.activity}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
          {notifications.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">{t.quiet}</li>
          ) : null}
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', LEVEL_DOT[n.level])} aria-hidden />
              <span className="min-w-0 flex-1 break-words">{n.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
