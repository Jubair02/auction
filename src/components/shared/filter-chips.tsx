import { cn } from '@/lib/utils'

/** A row of toggle chips with counts — one active at a time. */
export function FilterChips<K extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: K
  onChange: (key: K) => void
  /** `count` left out while it isn't known yet (shown as nothing rather than a wrong 0). */
  options: { key: K; label: string; count?: number }[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            value === o.key
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
          )}
        >
          {o.label}
          {o.count === undefined ? null : <> <span className="tabular-nums opacity-75">{o.count}</span></>}
        </button>
      ))}
    </div>
  )
}
