'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLowData } from '@/lib/low-data'

/**
 * Fades its content up into place the first time it scrolls into view
 * (24px rise, 0.5s ease-out, starting 60px inside the viewport).
 *
 * The same effect the landing page had with framer-motion's `whileInView`,
 * done with one IntersectionObserver and a CSS transition: the landing page is
 * the first page most visitors load, and framer-motion was most of its
 * JavaScript. With reduced motion or data saver it only fades (no movement),
 * as framer-motion's reduced-motion mode did.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const lowData = useLowData()
  const [shown, setShown] = useState(false)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (lowData || window.matchMedia('(prefers-reduced-motion: reduce)').matches) setStill(true)
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '-60px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [lowData])

  const transition = still
    ? `opacity 0.5s ease-out ${delay}s`
    : `opacity 0.5s ease-out ${delay}s, transform 0.5s ease-out ${delay}s`
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown || still ? 'none' : 'translateY(24px)',
        transition,
      }}
    >
      {children}
    </div>
  )
}
