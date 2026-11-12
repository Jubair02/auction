'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useLowData } from '@/lib/low-data'

/**
 * Animations follow the OS "reduce motion" setting, and are off entirely in
 * low-data mode (cheap phones on slow connections).
 *
 * Wrapped around each view that animates with framer-motion, rather than the
 * whole app: a provider in the app shell would put framer-motion (~40KB
 * gzipped) into every page's first download, including pages with no
 * framer-motion animation at all.
 */
export function MotionScope({ children }: { children: ReactNode }) {
  const lowData = useLowData()
  return <MotionConfig reducedMotion={lowData ? 'always' : 'user'}>{children}</MotionConfig>
}
