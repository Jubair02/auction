'use client'

import { Crown, Link2, Loader2, Pencil, Trash2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TeamAvatar } from '@/components/shared/avatars'
import { formatBDT } from '@/lib/format'
import type { TeamDTO } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    noCaptain: 'No captain set',
    editAria: (name: string) => `Edit ${name}`,
    deleteAria: (name: string) => `Delete ${name}`,
    budget: 'Budget',
    remaining: 'Remaining',
    spent: (amount: string) => `Spent ${amount}`,
    spentAria: (name: string, pct: number) => `${name} has spent ${pct}% of budget`,
    squad: (count: number, max: number) => `Squad ${count} / ${max}`,
    managerLinked: 'Manager linked',
    noManagerYet: 'No manager yet',
    newInviteLink: 'New manager invite link',
    inviteManager: 'Invite manager',
  },
  bn: {
    noCaptain: 'অধিনায়ক ঠিক করা হয়নি',
    editAria: (name: string) => `${name} সম্পাদনা`,
    deleteAria: (name: string) => `${name} মুছুন`,
    budget: 'বাজেট',
    remaining: 'বাকি',
    spent: (amount: string) => `খরচ ${amount}`,
    spentAria: (name: string, pct: number) => `${name} বাজেটের ${pct}% খরচ করেছে`,
    squad: (count: number, max: number) => `স্কোয়াড ${count} / ${max}`,
    managerLinked: 'ম্যানেজার যুক্ত',
    noManagerYet: 'এখনো ম্যানেজার নেই',
    newInviteLink: 'ম্যানেজারের নতুন আমন্ত্রণ লিংক',
    inviteManager: 'ম্যানেজারকে আমন্ত্রণ',
  },
} satisfies Strings<{
  noCaptain: string
  editAria: (name: string) => string
  deleteAria: (name: string) => string
  budget: string
  remaining: string
  spent: (amount: string) => string
  spentAria: (name: string, pct: number) => string
  squad: (count: number, max: number) => string
  managerLinked: string
  noManagerYet: string
  newInviteLink: string
  inviteManager: string
}>

/** One team's card in the Teams grid: purse, spend, squad, manager and invite button. */
export function TeamCard({
  team: t,
  inviting,
  onEdit,
  onDelete,
  onInvite,
}: {
  team: TeamDTO
  inviting: boolean
  onEdit: () => void
  onDelete: () => void
  onInvite: () => void
}) {
  const tx = useStrings(STRINGS)
  const spentPct = t.budget > 0 ? Math.min(100, Math.round((t.spent / t.budget) * 100)) : 0
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <TeamAvatar name={t.name} color={t.color} logoUrl={t.logoUrl} />
            <div className="min-w-0">
              <p className="truncate font-bold">{t.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.captainName ? (
                  <span className="inline-flex items-center gap-1">
                    <Crown className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden /> {t.captainName}
                  </span>
                ) : (
                  tx.noCaptain
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={tx.editAria(t.name)} onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
              aria-label={tx.deleteAria(t.name)}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{tx.budget}</p>
            <p className="font-semibold tabular-nums">{formatBDT(t.budget)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{tx.remaining}</p>
            <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatBDT(t.remaining)}</p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{tx.spent(formatBDT(t.spent))}</span>
            <span className="font-semibold tabular-nums">{spentPct}%</span>
          </div>
          <Progress value={spentPct} aria-label={tx.spentAria(t.name, spentPct)} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-xs">
            {tx.squad(t.squadCount, t.maxSquad)}
          </Badge>
          {t.managerUserId ? (
            <Badge
              className="max-w-[60%] truncate bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/50"
              title={t.managerEmail ?? undefined}
            >
              <UserCheck className="mr-1 h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{t.managerName ?? tx.managerLinked}</span>
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              {tx.noManagerYet}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full"
          disabled={inviting}
          onClick={onInvite}
        >
          {inviting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {t.managerUserId ? tx.newInviteLink : tx.inviteManager}
        </Button>
      </CardContent>
    </Card>
  )
}
