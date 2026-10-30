'use client'

import { create } from 'zustand'
import { apiGet, apiPost } from '@/lib/api'
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

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authLoading: true,
  authChecked: false,

  fetchMe: async () => {
    set({ authLoading: true })
    try {
      const res = await apiGet<{ user: SafeUser | null }>('/api/auth/me')
      set({ user: res.user, authLoading: false, authChecked: true })
      return res.user
    } catch {
      set({ user: null, authLoading: false, authChecked: true })
      return null
    }
  },

  setUser: (user) => set({ user, authLoading: false, authChecked: true }),

  logout: async () => {
    try {
      await apiPost('/api/auth/logout', {})
    } catch {
      // ignore
    }
    set({ user: null })
    if (typeof window !== 'undefined') navigate('/')
  },
}))
