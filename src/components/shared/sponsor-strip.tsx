'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { brandPalette, titleSponsor } from '@/lib/brand-color'
import type { SponsorDTO, SponsorTier } from '@/lib/types'
import { cn } from '@/lib/utils'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    sponsors: 'Sponsors',
    presentedBy: 'Presented by',
    inAssociation: 'In association with',
    supportedBy: 'Supported by',
    visit: (name: string) => `${name} (opens in a new tab)`,
  },
  bn: {
    sponsors: 'স্পনসর',
    presentedBy: 'পরিবেশনায়',
    inAssociation: 'সহযোগিতায়',
    supportedBy: 'সহায়তায়',
    visit: (name: string) => `${name} (নতুন ট্যাবে খুলবে)`,
  },
} satisfies Strings<{
  sponsors: string
  presentedBy: string
  inAssociation: string
  supportedBy: string
  visit: (name: string) => string
}>

export type SponsorStripVariant = 'overlay' | 'room' | 'page' | 'card'

/** Overlay: how long each sponsor stays on screen. */
const ROTATE_MS = 8000

interface SponsorStripProps {
  sponsors: SponsorDTO[]
  /**
   * overlay — OBS lower corner, vw-sized, rotates, no links ·
   * room — one compact line above the live room ·
   * page — results / public pages, grouped by tier ·
   * card — a small boxed version (previews, side columns)
   */
  variant: SponsorStripVariant
  brandColor?: string | null
  className?: string
}

/**
 * Tournament sponsors: the title sponsor larger ("Presented by …"), the rest
 * as a logo row. Sponsors without a logo show their name. Logos sit on white
 * chips so dark and light marks both stay visible in any theme.
 */
export function SponsorStrip({ sponsors, variant, brandColor, className }: SponsorStripProps) {
  if (sponsors.length === 0) return null
  if (variant === 'overlay') return <OverlayStrip sponsors={sponsors} brandColor={brandColor} className={className} />
  if (variant === 'room') return <RoomStrip sponsors={sponsors} brandColor={brandColor} className={className} />
  return <PageStrip sponsors={sponsors} brandColor={brandColor} compact={variant === 'card'} className={className} />
}

// ---------- pieces ----------

function SponsorMark({
  sponsor,
  size,
  link,
}: {
  sponsor: SponsorDTO
  /** Logo height class + name text size. */
  size: 'xs' | 'sm' | 'md' | 'lg'
  link: boolean
}) {
  const t = useStrings(STRINGS)
  const logoH = { xs: 'h-6', sm: 'h-8', md: 'h-10', lg: 'h-14 sm:h-16' }[size]
  const text = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg sm:text-xl' }[size]
  const body = sponsor.logoUrl ? (
    <span className={cn('inline-flex items-center justify-center rounded-md bg-white px-2 py-1 shadow-sm ring-1 ring-black/5', logoH)}>
      {/* Our own /api/uploads image (small, immutable WebP). */}
      <img src={sponsor.logoUrl} alt={sponsor.name} loading="lazy" className="h-full w-auto max-w-[9rem] object-contain" />
    </span>
  ) : (
    <span className={cn('font-extrabold tracking-tight text-foreground', text)}>{sponsor.name}</span>
  )
  if (!link || !sponsor.url) return <span title={sponsor.name}>{body}</span>
  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener sponsored"
      aria-label={t.visit(sponsor.name)}
      title={sponsor.name}
      className="inline-flex rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </a>
  )
}

const GROUPS: { key: 'associate' | 'support'; tiers: SponsorTier[] }[] = [
  // A second TITLE sponsor (only the first is "Presented by") joins the associates.
  { key: 'associate', tiers: ['TITLE', 'ASSOCIATE'] },
  { key: 'support', tiers: ['SPONSOR', 'PARTNER'] },
]

/** Results and other public pages: title sponsor big, then grouped logo rows. */
function PageStrip({
  sponsors,
  brandColor,
  compact,
  className,
}: {
  sponsors: SponsorDTO[]
  brandColor?: string | null
  compact: boolean
  className?: string
}) {
  const t = useStrings(STRINGS)
  const palette = brandPalette(brandColor)
  const title = titleSponsor(sponsors)
  const rest = sponsors.filter((s) => s !== title)
  const label = { associate: t.inAssociation, support: title ? t.supportedBy : t.sponsors }
  return (
    <section
      aria-label={t.sponsors}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm',
        compact ? 'px-3 py-3' : 'px-4 py-4 sm:px-6',
        className,
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: palette.bg }} />
      <div className={cn('flex flex-col gap-4', !compact && 'sm:flex-row sm:items-center sm:gap-8')}>
        {title ? (
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t.presentedBy}</p>
            <SponsorMark sponsor={title} size={compact ? 'md' : 'lg'} link />
          </div>
        ) : null}
        {rest.length > 0 ? (
          <div className={cn('flex min-w-0 flex-1 flex-col gap-3', title && !compact && 'sm:border-l sm:pl-8')}>
            {GROUPS.map((g) => {
              const list = rest.filter((s) => g.tiers.includes(s.tier))
              if (list.length === 0) return null
              return (
                <div key={g.key} className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label[g.key]}</p>
                  <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {list.map((s) => (
                      <li key={s.id}>
                        <SponsorMark sponsor={s} size={compact ? 'xs' : g.key === 'associate' ? 'md' : 'sm'} link />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** Live room: one slim line that scrolls sideways on phones instead of wrapping. */
function RoomStrip({ sponsors, brandColor, className }: { sponsors: SponsorDTO[]; brandColor?: string | null; className?: string }) {
  const t = useStrings(STRINGS)
  const palette = brandPalette(brandColor)
  const title = titleSponsor(sponsors)
  const rest = sponsors.filter((s) => s !== title)
  return (
    <section
      aria-label={t.sponsors}
      className={cn('relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card py-1.5 pl-4 pr-2', className)}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: palette.bg }} />
      {title ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:inline">{t.presentedBy}</span>
          <SponsorMark sponsor={title} size="sm" link />
        </div>
      ) : (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{t.sponsors}</span>
      )}
      {rest.length > 0 ? (
        <ul className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {title ? <li aria-hidden className="h-5 w-px shrink-0 bg-border" /> : null}
          {rest.map((s) => (
            <li key={s.id} className="shrink-0">
              <SponsorMark sponsor={s} size="xs" link />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * Stream overlay (top-left, under nothing): the title sponsor stays, the
 * others rotate every 8 s. With reduced motion they are shown together and
 * never animate. Never links — it is a video picture.
 */
function OverlayStrip({ sponsors, brandColor, className }: { sponsors: SponsorDTO[]; brandColor?: string | null; className?: string }) {
  const t = useStrings(STRINGS)
  const reduce = useReducedMotion() ?? false
  const palette = brandPalette(brandColor)
  const title = titleSponsor(sponsors)
  const rest = sponsors.filter((s) => s !== title)
  const [tick, setTick] = useState(0)

  const rotating = !reduce && rest.length > 1
  useEffect(() => {
    if (!rotating) return
    const timer = setInterval(() => setTick((n) => n + 1), ROTATE_MS)
    return () => clearInterval(timer)
  }, [rotating])

  const current = rest.length > 0 ? rest[tick % rest.length] : null
  // Reduced motion: no rotation — up to 6 logos side by side.
  const shown = reduce ? rest.slice(0, 6) : current ? [current] : []

  return (
    <div
      className={cn(
        'pointer-events-none flex items-center gap-[calc(1*var(--u,1vw))] rounded-[calc(0.6*var(--u,1vw))] bg-slate-950/85 py-[calc(0.5*var(--u,1vw))] pl-[calc(1*var(--u,1vw))] pr-[calc(0.8*var(--u,1vw))] text-white shadow-2xl',
        className,
      )}
      style={{ borderLeft: `calc(0.3*var(--u,1vw)) solid ${palette.bg}` }}
      aria-label={t.sponsors}
    >
      {title ? (
        <div className="flex items-center gap-[calc(0.6*var(--u,1vw))]">
          <span className="text-[calc(0.75*var(--u,1vw))] font-bold uppercase tracking-[0.15em] text-white/70">{t.presentedBy}</span>
          <OverlayMark sponsor={title} big />
        </div>
      ) : (
        <span className="text-[calc(0.75*var(--u,1vw))] font-bold uppercase tracking-[0.15em] text-white/70">{t.sponsors}</span>
      )}
      {shown.length > 0 ? (
        <>
          {title ? <span aria-hidden className="h-[calc(2*var(--u,1vw))] w-px bg-white/25" /> : null}
          {reduce ? (
            <div className="flex items-center gap-[calc(0.8*var(--u,1vw))]">
              {shown.map((s) => (
                <OverlayMark key={s.id} sponsor={s} />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${shown[0].id}-${tick}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="flex items-center"
              >
                <OverlayMark sponsor={shown[0]} />
              </motion.div>
            </AnimatePresence>
          )}
        </>
      ) : null}
    </div>
  )
}

function OverlayMark({ sponsor, big }: { sponsor: SponsorDTO; big?: boolean }) {
  if (sponsor.logoUrl) {
    return (
      <span className={cn('flex items-center rounded-[calc(0.35*var(--u,1vw))] bg-white px-[calc(0.4*var(--u,1vw))] py-[calc(0.2*var(--u,1vw))]', big ? 'h-[calc(2.8*var(--u,1vw))]' : 'h-[calc(2.2*var(--u,1vw))]')}>
        <img src={sponsor.logoUrl} alt={sponsor.name} className="h-full w-auto max-w-[calc(10*var(--u,1vw))] object-contain" />
      </span>
    )
  }
  return <span className={cn('max-w-[calc(16*var(--u,1vw))] truncate font-extrabold', big ? 'text-[calc(1.4*var(--u,1vw))]' : 'text-[calc(1.1*var(--u,1vw))]')}>{sponsor.name}</span>
}
