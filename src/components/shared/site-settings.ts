'use client'

// The public admin settings (announcement, site name, support phone) the app
// shell shows on every page. The shell stays mounted, so dropping the cache
// alone would not update it — an admin save also tells mounted readers to refetch.
import { useEffect } from 'react'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'

const SITE_SETTINGS_URL = '/api/settings'
const CHANGED_EVENT = 'ng:site-settings-changed'

/** Call after the admin saves settings: the banner and footer refresh without a reload. */
export function siteSettingsChanged(): void {
  invalidateCached(SITE_SETTINGS_URL)
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

/** Public admin settings — one cached request for the shell, refreshed when an admin saves. */
export function useSiteSettings(): Record<string, string> {
  const { data, refetch } = useCachedGet<{ settings: Record<string, string> }>(SITE_SETTINGS_URL)
  useEffect(() => {
    const onChange = () => void refetch()
    window.addEventListener(CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CHANGED_EVENT, onChange)
  }, [refetch])
  return data?.settings ?? {}
}
