'use client'

import { useLang } from '@/lib/i18n'
import { playerRoleLabel } from '@/lib/types'

/** A player's role (Batsman, Goalkeeper…) in the UI language. */
export function PlayerRole({ role }: { role: string }) {
  const lang = useLang()
  return <>{playerRoleLabel(role, lang)}</>
}
