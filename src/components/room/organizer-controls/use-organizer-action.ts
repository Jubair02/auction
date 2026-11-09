'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { type Strings, useStrings } from '@/lib/i18n'
import type { RunAction } from './types'

const STRINGS = {
  en: {
    actionOffline: 'You are offline — the action was not sent.',
    actionUnconfirmed: 'The server did not confirm this — check the room before trying again.',
    actionFailed: 'The action could not be completed.',
  },
  bn: {
    actionOffline: 'আপনি অফলাইনে আছেন — নির্দেশটি পাঠানো হয়নি।',
    actionUnconfirmed: 'সার্ভার এটি নিশ্চিত করেনি — আবার চেষ্টার আগে রুমের অবস্থা দেখে নিন।',
    actionFailed: 'কাজটি সম্পন্ন করা যায়নি।',
  },
} satisfies Strings<{
  actionOffline: string
  actionUnconfirmed: string
  actionFailed: string
}>

/** Wraps an organizer action so a refusal, an unconfirmed send or being offline is explained in a toast. */
export function useOrganizerAction(onAction: RunAction): RunAction {
  const tx = useStrings(STRINGS)
  return useCallback<RunAction>(
    async (action, payload) => {
      const res = await onAction(action, payload)
      if (!res.ok) {
        if (res.reason === 'offline') toast.error(tx.actionOffline)
        else if (res.reason === 'timeout') toast.warning(tx.actionUnconfirmed)
        else toast.error(res.error || tx.actionFailed)
      }
      return res
    },
    [onAction, tx],
  )
}
