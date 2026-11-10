'use client'

// The Free limits and Pro price for marketing copy (landing pricing, the
// create wizard). The server seeds them for the first render, so the HTML
// already shows the admin's real numbers; /api/plans keeps them current.
import { createContext, useContext, type ReactNode } from 'react'
import { useCachedGet } from '@/lib/api-cache'
import { PLAN_DEFAULTS } from '@/lib/plan-defaults'
import type { PlanInfo } from '@/lib/types'

export type PlanNumbers = Pick<PlanInfo, 'proPrice' | 'freeMaxTeams' | 'freeMaxPlayers'>

const PlanSeedContext = createContext<PlanNumbers | undefined>(undefined)

export function PlanSeedProvider({ plans, children }: { plans?: PlanNumbers; children: ReactNode }) {
  return <PlanSeedContext.Provider value={plans}>{children}</PlanSeedContext.Provider>
}

export function usePlanNumbers(): PlanNumbers {
  const seed = useContext(PlanSeedContext)
  const { data } = useCachedGet<PlanInfo>('/api/plans')
  return data ?? seed ?? PLAN_DEFAULTS
}
