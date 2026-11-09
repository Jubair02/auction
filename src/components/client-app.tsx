'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import AppRoot from '@/components/app-root'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { LangProvider } from '@/lib/i18n'
import type { Lang } from '@/lib/lang-cookie'
import { LowDataProvider, useLowData } from '@/lib/low-data'
import { AuthSeedContext } from '@/lib/store'
import { ThemeProvider } from '@/lib/theme'
import type { ThemePref } from '@/lib/theme-cookie'
import type { SafeUser } from '@/lib/types'

/**
 * Animations follow the OS "reduce motion" setting everywhere, and are off
 * entirely in low-data mode (cheap phones on slow connections).
 */
function Motion({ children }: { children: ReactNode }) {
  const lowData = useLowData()
  return <MotionConfig reducedMotion={lowData ? 'always' : 'user'}>{children}</MotionConfig>
}

/**
 * The app shell, rendered for every page path. Imported directly (not
 * code-split) so the server HTML already contains the page — the landing page,
 * privacy notice and page skeletons — in the visitor's language.
 */
export default function ClientApp({
  initialSegs,
  lang,
  lowData = false,
  initialUser,
  theme = 'system',
}: {
  initialSegs: string[]
  lang: Lang
  lowData?: boolean
  /** The signed-in user as the server saw it (undefined = not checked). */
  initialUser?: SafeUser | null
  /** Saved colour theme (cookie); "system" follows the device. */
  theme?: ThemePref
}) {
  // Last line of defence for a crash in the shell itself (header, router);
  // each page has its own boundary inside AppRoot.
  return (
    <ThemeProvider theme={theme}>
    <AuthSeedContext.Provider value={initialUser}>
      <LangProvider lang={lang}>
        <LowDataProvider lowData={lowData}>
          <Motion>
            <ErrorBoundary>
              <AppRoot initialSegs={initialSegs} />
            </ErrorBoundary>
          </Motion>
        </LowDataProvider>
      </LangProvider>
    </AuthSeedContext.Provider>
    </ThemeProvider>
  )
}
