'use client'

import AppRoot from '@/components/app-root'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { LangProvider } from '@/lib/i18n'
import type { Lang } from '@/lib/lang-cookie'
import { LowDataProvider } from '@/lib/low-data'
import { type PlanNumbers, PlanSeedProvider } from '@/lib/plan-numbers'
import { AuthSeedContext } from '@/lib/store'
import { ThemeProvider } from '@/lib/theme'
import type { ThemePref } from '@/lib/theme-cookie'
import type { SafeUser } from '@/lib/types'

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
  plans,
}: {
  initialSegs: string[]
  lang: Lang
  lowData?: boolean
  /** The signed-in user as the server saw it (undefined = not checked). */
  initialUser?: SafeUser | null
  /** Saved colour theme (cookie); "system" follows the device. */
  theme?: ThemePref
  /** Free limits and Pro price for the landing page's pricing section. */
  plans?: PlanNumbers
}) {
  // Last line of defence for a crash in the shell itself (header, router);
  // each page has its own boundary inside AppRoot.
  return (
    <ThemeProvider theme={theme}>
    <AuthSeedContext.Provider value={initialUser}>
      <LangProvider lang={lang}>
        {/* framer-motion's reduced-motion / data-saver settings are applied by
            MotionScope inside each animated view, not here (bundle size). */}
        <LowDataProvider lowData={lowData}>
          <ErrorBoundary>
            <PlanSeedProvider plans={plans}>
              <AppRoot initialSegs={initialSegs} />
            </PlanSeedProvider>
          </ErrorBoundary>
        </LowDataProvider>
      </LangProvider>
    </AuthSeedContext.Provider>
    </ThemeProvider>
  )
}
