'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS } from './strings'
import { TeamFormFields } from './team-form-fields'
import type { TeamFormState } from './types'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    addDesc: 'Every team gets a purse and squad limits — bids that break them are rejected automatically.',
    createTeam: 'Create team',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    addDesc: 'প্রতিটি দল একটি বাজেট ও স্কোয়াডের সীমা পায় — সীমা ভাঙে এমন বিড নিজে থেকেই বাতিল হয়।',
    createTeam: 'দল তৈরি করুন',
  },
} satisfies Strings<{
  addTeam: string
  cancel: string
  addDesc: string
  createTeam: string
}>

export function AddTeamDialog({
  onClose,
  suggestedColor,
  defaultMaxSquad,
  saving,
  onSubmit,
}: {
  onClose: () => void
  suggestedColor: string
  defaultMaxSquad?: number | null
  saving: boolean
  onSubmit: (f: TeamFormState) => Promise<void>
}) {
  const tx = useStrings(STRINGS)
  const [form, setForm] = useState<TeamFormState>(() => ({
    name: '',
    color: suggestedColor,
    captainName: '',
    logoUrl: null,
    budget: '200000',
    maxSquad: String(defaultMaxSquad ?? 12),
    minSquad: String(Math.min(9, defaultMaxSquad ?? 12)),
  }))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx.addTeam}</DialogTitle>
          <DialogDescription>
            {tx.addDesc}
          </DialogDescription>
        </DialogHeader>
        <TeamFormFields form={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tx.cancel}
          </Button>
          <Button onClick={() => void onSubmit(form)} disabled={saving} className="min-h-10">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
            {tx.createTeam}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
