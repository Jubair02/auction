'use client'

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p> : null}
        </div>
        {action}
      </CardContent>
    </Card>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  className,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'
  className?: string
}) {
  const toneClass = {
    default: 'text-foreground',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
    primary: 'text-primary',
  }[tone]
  return (
    <Card className={cn('py-4', className)}>
      <CardContent className="flex items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('mt-1 truncate text-2xl font-bold tabular-nums', toneClass)}>{value}</p>
          {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-lg bg-muted p-2.5">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
