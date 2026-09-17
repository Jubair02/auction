'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PLAYER_STATUS_COLORS, PLAYER_STATUS_LABELS, TOURNAMENT_STATUS_COLORS } from '@/lib/format'
import type { PlayerStatus } from '@/lib/types'

export function PlayerStatusBadge({ status, className }: { status: PlayerStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', PLAYER_STATUS_COLORS[status], className)}>
      {PLAYER_STATUS_LABELS[status]}
    </Badge>
  )
}

export function TournamentStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', TOURNAMENT_STATUS_COLORS[status] ?? '', className)}>
      {status}
    </Badge>
  )
}
