'use client'

import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TeamDTO } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS } from './strings'
import { TeamFormFields } from './team-form-fields'
import type { ManagerOption, TeamFormState } from './types'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    editTitle: (name: string) => `Edit ${name}`,
    editDesc:
      'Budget can be raised any time; lowering below spent is blocked. While the auction is running, budgets and squad caps can only go up.',
    teamManager: 'Team manager',
    unlinkAria: 'Unlink manager',
    unlink: 'Unlink',
    link: 'Link',
    linkedHelp: 'This account bids for the team from its own login and sees the squad under “My team”. Save to apply.',
    unlinkedHelp: 'No manager linked. Enter the email they registered with, or send an invite link from the team card.',
    saveChanges: 'Save changes',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    editTitle: (name: string) => `${name} সম্পাদনা`,
    editDesc:
      'বাজেট যেকোনো সময় বাড়ানো যায়; খরচের চেয়ে কমানো যায় না। নিলাম চলার সময় বাজেট ও স্কোয়াডের সীমা শুধু বাড়ানো যায়।',
    teamManager: 'টিম ম্যানেজার',
    unlinkAria: 'ম্যানেজারকে সরিয়ে দিন',
    unlink: 'সরিয়ে দিন',
    link: 'যুক্ত করুন',
    linkedHelp: 'এই অ্যাকাউন্ট নিজের লগইন থেকে দলের হয়ে বিড করবে এবং “আমার দল”-এ স্কোয়াড দেখতে পাবে। চালু করতে সংরক্ষণ করুন।',
    unlinkedHelp: 'কোনো ম্যানেজার যুক্ত নেই। তিনি যে ইমেইল দিয়ে নিবন্ধন করেছেন সেটি লিখুন, অথবা দলের কার্ড থেকে আমন্ত্রণ লিংক পাঠান।',
    saveChanges: 'পরিবর্তন সংরক্ষণ',
  },
} satisfies Strings<{
  addTeam: string
  cancel: string
  editTitle: (name: string) => string
  editDesc: string
  teamManager: string
  unlinkAria: string
  unlink: string
  link: string
  linkedHelp: string
  unlinkedHelp: string
  saveChanges: string
}>

/** Edit a team's details and link/unlink its manager (by exact login email). */
export function EditTeamDialog({
  editTarget,
  editForm,
  onFormChange,
  editManager,
  onManagerChange,
  managerEmail,
  onManagerEmailChange,
  findingManager,
  findManager,
  saving,
  onClose,
  onSave,
}: {
  editTarget: TeamDTO | null
  editForm: TeamFormState | null
  onFormChange: (f: TeamFormState) => void
  editManager: ManagerOption | null
  onManagerChange: (m: ManagerOption | null) => void
  managerEmail: string
  onManagerEmailChange: (email: string) => void
  findingManager: boolean
  findManager: () => Promise<void>
  saving: boolean
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const tx = useStrings(STRINGS)
  return (
    <Dialog open={!!editTarget} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx.editTitle(editTarget?.name ?? '')}</DialogTitle>
          <DialogDescription>
            {tx.editDesc}
          </DialogDescription>
        </DialogHeader>
        {editForm ? <TeamFormFields form={editForm} onChange={onFormChange} /> : null}

        <div className="space-y-1.5">
          <Label htmlFor="tm-manager" className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden /> {tx.teamManager}
          </Label>
          {editManager ? (
            <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span className="min-w-0 truncate text-sm">
                <span className="font-semibold">{editManager.name}</span>
                {editManager.email ? <span className="text-muted-foreground"> · {editManager.email}</span> : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => onManagerChange(null)}
                aria-label={tx.unlinkAria}
              >
                <X className="mr-1 h-3.5 w-3.5" aria-hidden /> {tx.unlink}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="tm-manager"
                type="email"
                value={managerEmail}
                onChange={(e) => onManagerEmailChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void findManager()
                  }
                }}
                placeholder="manager@example.com"
                className="h-10"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                disabled={findingManager || !managerEmail.trim()}
                onClick={() => void findManager()}
              >
                {findingManager ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                {tx.link}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {editManager
              ? tx.linkedHelp
              : tx.unlinkedHelp}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tx.cancel}
          </Button>
          <Button onClick={() => void onSave()} disabled={saving} className="min-h-10">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            {tx.saveChanges}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
