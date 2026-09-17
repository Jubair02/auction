'use client'

import { Activity, Crown, Eye, UserCog } from 'lucide-react'
import type { RoomNotification, RoomRole, RoomState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ROLE_META: Record<RoomRole, { label: string; icon: typeof Crown; className: string }> = {
  ORGANIZER: { label: 'Organizer', icon: Crown, className: 'bg-amber-100 text-amber-900' },
  MANAGER: { label: 'Manager', icon: UserCog, className: 'bg-teal-100 text-teal-900' },
  VIEWER: { label: 'Viewer', icon: Eye, className: 'bg-slate-200 text-slate-700' },
}

/** Who is in the room right now. */
export function ParticipantsPanel({ state }: { state: RoomState }) {
  const onlineCount = state.participants.filter((p) => p.online).length
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Participants</span>
          <Badge variant="secondary" className="tabular-nums">{onlineCount} online</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-64 space-y-1.5 overflow-y-auto">
        {state.participants.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nobody here yet</p>
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
                    {state.teams.find((t) => t.id === p.teamId)?.name ?? 'Team'}
                  </p>
                ) : null}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
              <span
                className={cn('h-2 w-2 shrink-0 rounded-full', p.online ? 'bg-emerald-500' : 'bg-slate-300')}
                aria-label={p.online ? 'online' : 'offline'}
              />
            </div>
          )
        })}
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
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" aria-hidden />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-live="polite">
          {notifications.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">Quiet for now — actions will appear here</li>
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
