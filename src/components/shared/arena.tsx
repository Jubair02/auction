import { cn } from '@/lib/utils'

/**
 * The dark "arena" surface the live auction stage is built on, reused wherever
 * the app shows an auction moment (e.g. the dashboard spotlight). It opts its
 * subtree into the dark tokens, so shadcn parts inside render dark too.
 */
export function Arena({
  as: Tag = 'section',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' }) {
  return (
    <Tag
      className={cn(
        'dark relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#0a1517] text-foreground shadow-xl shadow-teal-950/25',
        className
      )}
      {...props}
    >
      {/* arena lighting */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_70%_at_15%_0%,rgba(45,212,191,0.16),transparent_60%),radial-gradient(ellipse_60%_55%_at_100%_100%,rgba(245,158,11,0.09),transparent_70%)]"
        aria-hidden
      />
      {children}
    </Tag>
  )
}
