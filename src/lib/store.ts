'use client'

import { create } from 'zustand'
import { apiGet, apiPost } from '@/lib/api'
import { clearCached } from '@/lib/api-cache'
import { navigate } from '@/lib/router'
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
      if (typeof window !== 'undefined') navigate('/')
    },
  }
})
