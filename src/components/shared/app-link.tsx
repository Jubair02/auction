'use client'

// A real <a href> for in-app navigation: open in a new tab, long-press to share
// and "copy link" all work, while a plain click still navigates without a page
// load (client router). Use instead of <button onClick={() => navigate(...)}>.
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { navigate } from '@/lib/router'

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** In-app path, e.g. "/tournaments/abc". */
  href: string
  replace?: boolean
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, replace, onClick, target, ...rest },
  ref,
) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    // Let the browser handle new-tab / new-window / download clicks.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (target && target !== '_self')) return
    e.preventDefault()
    navigate(href, { replace })
  }
  return <a ref={ref} href={href} target={target} onClick={handleClick} {...rest} />
})
