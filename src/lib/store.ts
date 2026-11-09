'use client'

import { createContext, useContext } from 'react'
import { create } from 'zustand'
import { apiGet, apiPost } from '@/lib/api'
import { clearCached } from '@/lib/api-cache'
import { navigate } from '@/lib/router'
import { clearAllRoomIdentities } from '@/lib/use-auction-socket'
import type { SafeUser } from '@/lib/types'

interface AppState {
  user: SafeUser | null
  authLoading: boolean
  authChecked: boolean
  fetchMe: () => Promise<SafeUser | null>
  setUser: (user: SafeUser | null) => void
  logout: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => {
  // Cached page data belongs to whoever was logged in when it was fetched.
  // Drop it whenever the account changes so the next user never sees it.
  const applyUser = (user: SafeUser | null) => {
    if ((get().user?.id ?? null) !== (user?.id ?? null)) clearCached()
    set({ user, authLoading: false, authChecked: true })
  }

  return {
    user: null,
    authLoading: true,
    authChecked: false,

    fetchMe: async () => {
      set({ authLoading: true })
      try {
        const res = await apiGet<{ user: SafeUser | null }>('/api/auth/me')
        applyUser(res.user)
        return res.user
      } catch {
        applyUser(null)
        return null
      }
    },

    setUser: (user) => applyUser(user),

    logout: async () => {
      try {
        await apiPost('/api/auth/logout', {})
      } catch {
        // ignore
      }
      applyUser(null)
      // Saved room seats belong to this account — never leave them for the next person in this tab.
      clearAllRoomIdentities()
      if (typeof window !== 'undefined') navigate('/')
    },
  }
})

/**
 * Who is signed in, as the server saw it when it rendered this page
 * (undefined = the server didn't check). Lets the very first render — the
 * server HTML and the browser's hydration — show the right header and page
 * instead of a signed-out header that flips a second later.
 *
 * The zustand store above is one per browser tab; on the server it always
 * reads its initial (signed-out) state, so the per-request answer travels in
 * this context instead and never leaks between visitors.
 */
export const AuthSeedContext = createContext<SafeUser | null | undefined>(undefined)

/**
 * The signed-in user for rendering: the live store once the browser has
 * checked the session, otherwise the server's answer. Use this instead of
 * reading `user` / `authChecked` from the store directly.
 */
export function useAuthState(): { user: SafeUser | null; authChecked: boolean; authLoading: boolean } {
  const seed = useContext(AuthSeedContext)
  const user = useAppStore((s) => s.user)
  const authChecked = useAppStore((s) => s.authChecked)
  const authLoading = useAppStore((s) => s.authLoading)
  if (!authChecked && seed !== undefined) return { user: seed, authChecked: true, authLoading: false }
  return { user, authChecked, authLoading }
}
