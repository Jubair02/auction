'use client'

// A mascot whose head follows the cursor and who reacts when tapped.
//
// Adapted from the page-mascot skill's component (one file, React only). Each
// character is two 3x3 sprite atlases — nine head directions and nine
// reactions — and the component only moves `background-position`, so there is
// no per-frame JavaScript. Changes from the original:
//  - 'use client' (the landing page is server-rendered);
//  - `size` may be a CSS length, so a responsive wrapper can size it;
//  - `rest`: where it looks before the pointer moves, and always on touch
//    screens, which have no cursor to follow;
//  - `label` is the whole accessible name (translated; a default is built in);
//  - `look` lets the page take over the gaze (e.g. look away from a password);
//  - `ref.play(reaction)` lets the page trigger a reaction (wrong code, …);
//  - `decorative`: out of the tab order and hidden from screen readers, for
//    pages where it would sit between the user and a form;
//  - renders nothing in data-saver mode (the two sheets are ~150KB).
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, Ref } from 'react'
import { useLowData } from '@/lib/low-data'
import { useStrings } from '@/lib/i18n'

/** The site's mascot (a chibi boy in a red cap and green hoodie). */
export const CAP_KID = {
  directions: '/mascots/cap-kid-directions.webp',
  reactions: '/mascots/cap-kid-reactions.webp',
}

const LABEL = {
  en: 'Tap the NeelamGhor mascot',
  bn: 'NeelamGhor-এর মাসকটকে ট্যাপ করুন',
}

const DIRECTIONS = [
  'up-left',
  'up',
  'up-right',
  'left',
  'center',
  'right',
  'down-left',
  'down',
  'down-right',
] as const

const REACTIONS = [
  'blink',
  'heart',
  'sparkle',
  'surprised',
  'wink',
  'bashful',
  'sleepy',
  'dizzy',
  'delighted',
] as const

export type MascotDirection = (typeof DIRECTIONS)[number]
export type MascotReaction = (typeof REACTIONS)[number]
type Reaction = MascotReaction

export type MascotHandle = {
  /** Show one reaction (with the squash), then go back to looking around. */
  play: (reaction: MascotReaction, ms?: number) => void
}

// Clockwise from the right, matching atan2 with y pointing down.
const CLOCKWISE: MascotDirection[] = [
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
]
const SECTOR = (Math.PI * 2) / CLOCKWISE.length
const HYSTERESIS = 0.12
const DEAD_ZONE = 70

const PAYOFFS: Reaction[] = ['heart', 'sparkle', 'delighted']
const BOOP_PAYOFF = 120
const BOOP_END = 560
const SQUASH_MS = 420
const DIZZY_AFTER = 4
const DIZZY_WINDOW = 1600
const DIZZY_END = 1100
const PLAY_MS = 1000

const SQUASH: Keyframe[] = [
  { transform: 'scale(1, 1)', easing: 'ease-in' },
  { transform: 'scale(1.10, 0.86)', offset: 0.18, easing: 'ease-out' },
  { transform: 'scale(0.95, 1.08)', offset: 0.45, easing: 'ease-in-out' },
  { transform: 'scale(1.03, 0.97)', offset: 0.72, easing: 'ease-in-out' },
  { transform: 'scale(1, 1)' },
]

// background-size 300% makes each cell a clean 0/50/100% step on both axes.
function cell(index: number): CSSProperties {
  return { backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` }
}

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

const layer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundSize: '300% 300%',
  backgroundRepeat: 'no-repeat',
}

export type MascotProps = {
  /** The 3x3 sheet of head directions. A served path. Default: cap-kid. */
  directions?: string
  /** The 3x3 sheet of expressions. Default: cap-kid. */
  reactions?: string
  /** Pixels, or any CSS length (e.g. '100%' to fill a sized wrapper). */
  size?: number | string
  className?: string
  /** The button's accessible name. Default: "Tap the NeelamGhor mascot". */
  label?: string
  /** Where it looks until the pointer moves (and always on touch screens). */
  rest?: MascotDirection
  /** While set, it looks here whatever the pointer does. */
  look?: MascotDirection
  /** Not focusable and hidden from screen readers (taps still react). */
  decorative?: boolean
  ref?: Ref<MascotHandle>
}

export function Mascot(props: MascotProps) {
  const {
    directions = CAP_KID.directions,
    reactions = CAP_KID.reactions,
    size = 140,
    className,
    rest = 'center',
    look,
    decorative = false,
    ref,
  } = props
  const defaultLabel = useStrings(LABEL)
  const label = props.label ?? defaultLabel
  const lowData = useLowData()

  const buttonRef = useRef<HTMLButtonElement>(null)
  const squashRef = useRef<HTMLSpanElement>(null)
  const timersRef = useRef<number[]>([])
  const boopsRef = useRef({ count: 0, at: 0 })
  const [direction, setDirection] = useState<MascotDirection>(rest)
  const [reaction, setReaction] = useState<Reaction | null>(null)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return
    }

    let sector = -1
    let pointer: { x: number; y: number } | null = null

    const aim = () => {
      const button = buttonRef.current
      if (!button || !pointer) {
        return
      }

      const box = button.getBoundingClientRect()
      const dx = pointer.x - (box.left + box.width / 2)
      const dy = pointer.y - (box.top + box.height / 2)

      if (Math.hypot(dx, dy) < DEAD_ZONE) {
        sector = -1
        setDirection('center')
        return
      }

      // Hold the current sector until the pointer is well past its edge.
      const angle = Math.atan2(dy, dx)
      if (sector !== -1 && Math.abs(wrap(angle - sector * SECTOR)) < SECTOR / 2 + HYSTERESIS) {
        return
      }

      sector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length
      setDirection(CLOCKWISE[sector])
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      aim()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', aim, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', aim)
    }
  }, [])

  useEffect(() => {
    return () => {
      timersRef.current.forEach(window.clearTimeout)
    }
  }, [])

  const later = (ms: number, next: Reaction | null) => {
    timersRef.current.push(window.setTimeout(() => setReaction(next), ms))
  }

  const squash = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    // Per-keyframe easing with the effect itself linear: an easing on the effect
    // would reinterpret every offset and front-load the whole bounce.
    squashRef.current?.animate(SQUASH, { duration: SQUASH_MS, easing: 'linear' })
  }

  useImperativeHandle(ref, () => ({
    play: (next, ms = PLAY_MS) => {
      timersRef.current.forEach(window.clearTimeout)
      timersRef.current = []
      setReaction(next)
      later(ms, null)
      squash()
    },
  }))

  const boop = () => {
    timersRef.current.forEach(window.clearTimeout)
    timersRef.current = []

    const now = Date.now()
    const boops = boopsRef.current
    boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1
    boops.at = now

    if (boops.count >= DIZZY_AFTER) {
      boops.count = 0
      setReaction('dizzy')
      later(DIZZY_END, null)
    } else {
      setReaction('blink')
      later(BOOP_PAYOFF, PAYOFFS[(boops.count - 1) % PAYOFFS.length])
      later(BOOP_END, null)
    }

    squash()
  }

  if (lowData) {
    return null
  }

  // Inline styles so the component works without any CSS framework.
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={boop}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      className={className}
      style={{
        position: 'relative',
        display: 'block',
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: 0,
        background: 'transparent',
        appearance: 'none',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        ref={squashRef}
        style={{ position: 'relative', display: 'block', width: '100%', height: '100%', transformOrigin: '50% 78%' }}
      >
        <span
          style={{
            ...layer,
            backgroundImage: `url(${directions})`,
            ...cell(DIRECTIONS.indexOf(look ?? direction)),
            opacity: reaction ? 0 : 1,
          }}
        />
        {/* Always mounted so the sheet is fetched up front, never on the first click. */}
        <span
          style={{
            ...layer,
            backgroundImage: `url(${reactions})`,
            ...cell(REACTIONS.indexOf(reaction ?? 'blink')),
            opacity: reaction ? 1 : 0,
          }}
        />
      </span>
    </button>
  )
}

/**
 * Wraps a card so the mascot peeks over its top-right corner, standing behind
 * it: the card's top edge hides the faded bottom of his hoodie (82% of each
 * frame, where the hoodie is still solid). The card must have a background.
 * In data-saver mode it is just the card, without the extra top margin.
 */
export function MascotPeek({
  children,
  className,
  rest = 'down-left',
  ...mascot
}: Omit<MascotProps, 'size' | 'className' | 'decorative'> & {
  children: React.ReactNode
  className?: string
}) {
  const lowData = useLowData()
  if (lowData) {
    return <div className={className}>{children}</div>
  }
  return (
    <div className={['relative mt-12 sm:mt-14', className].filter(Boolean).join(' ')}>
      <div className="absolute right-3 top-0 z-0 aspect-square w-[96px] -translate-y-[82%] sm:right-5 sm:w-[112px]">
        <Mascot
          {...mascot}
          rest={rest}
          size="100%"
          decorative
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700 motion-safe:ease-out motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:both]"
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
