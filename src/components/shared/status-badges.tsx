'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PLAYER_STATUS_COLORS, PLAYER_STATUS_LABELS, TOURNAMENT_STATUS_COLORS } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'
import type { PlayerStatus, TournamentStatus } from '@/lib/types'

const STRINGS = {
  en: {
    player: PLAYER_STATUS_LABELS,
    tournament: { DRAFT: 'Draft', READY: 'Ready', LIVE: 'Live', COMPLETED: 'Completed' },
  },
  bn: {
    player: { AVAILABLE: 'বাকি আছে', LIVE: 'নিলামে', SOLD: 'বিক্রি', UNSOLD: 'অবিক্রিত', SKIPPED: 'বাদ' },
    tournament: { DRAFT: 'খসড়া', READY: 'প্রস্তুত', LIVE: 'লাইভ', COMPLETED: 'সম্পন্ন' },
  },
} satisfies Strings<{ player: Record<PlayerStatus, string>; tournament: Record<TournamentStatus, string> }>

export function PlayerStatusBadge({ status, className }: { status: PlayerStatus; className?: string }) {
  const t = useStrings(STRINGS)
  return (
    <Badge variant="outline" className={cn('font-medium', PLAYER_STATUS_COLORS[status], className)}>
      {t.player[status] ?? status}
    </Badge>
  )
}

export function TournamentStatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useStrings(STRINGS)
  return (
    <Badge variant="outline" className={cn('font-medium', TOURNAMENT_STATUS_COLORS[status] ?? '', className)}>
      {(t.tournament as Record<string, string>)[status] ?? status}
    </Badge>
  )
}
