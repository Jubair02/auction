'use client'

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { AuctionMode, PlayerDTO } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { PlayerFormFields, type PlayerFormState } from './player-form'
import { SHARED_STRINGS, type SharedPlayersStrings } from './strings'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    addDesc: 'New players join the pool with the next free number.',
    editTitle: (name: string) => `Edit ${name}`,
    editDesc: 'Players can be edited any time before they go under the hammer.',
    saveChanges: 'Save changes',
    removeTitle: 'Remove player?',
    removeDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'This player'} will be permanently removed from the pool. Players that are live on the block or already sold cannot be deleted.`,
    removing: 'Removing…',
    removePlayer: 'Remove player',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    addDesc: 'নতুন খেলোয়াড় পরের খালি নম্বর নিয়ে পুলে যোগ হবে।',
    editTitle: (name: string) => `${name} সম্পাদনা`,
    editDesc: 'নিলামে ওঠার আগে যেকোনো সময় খেলোয়াড়ের তথ্য বদলানো যায়।',
    saveChanges: 'পরিবর্তন সংরক্ষণ',
    removeTitle: 'খেলোয়াড় বাদ দেবেন?',
    removeDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'এই খেলোয়াড়'} পুল থেকে স্থায়ীভাবে মুছে যাবে। নিলামে থাকা বা বিক্রি হয়ে যাওয়া খেলোয়াড় মোছা যায় না।`,
    removing: 'বাদ দেওয়া হচ্ছে…',
    removePlayer: 'খেলোয়াড় বাদ দিন',
  },
} satisfies Strings<
  SharedPlayersStrings & {
    addDesc: string
    editTitle: (name: string) => string
    editDesc: string
    saveChanges: string
    removeTitle: string
    removeDesc: (name: string | null) => string
    removing: string
    removePlayer: string
  }
>

type FormProps = {
  roles: readonly string[]
  auctionMode: AuctionMode
  quickPicks: { label: string; value: number }[]
}

export function AddPlayerDialog({
  open,
  onOpenChange,
  form,
  onChange,
  saving,
  onSubmit,
  roles,
  auctionMode,
  quickPicks,
}: FormProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: PlayerFormState
  onChange: (f: PlayerFormState) => void
  saving: boolean
  onSubmit: () => void
}) {
  const t = useStrings(STRINGS)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.addPlayer}</DialogTitle>
          <DialogDescription>{t.addDesc}</DialogDescription>
        </DialogHeader>
        <PlayerFormFields
          form={form}
          onChange={onChange}
          roles={roles}
          auctionMode={auctionMode}
          quickPicks={quickPicks}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="min-h-10">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
            {t.addPlayer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditPlayerDialog({
  target,
  onClose,
  form,
  onChange,
  saving,
  onSubmit,
  roles,
  auctionMode,
  quickPicks,
}: FormProps & {
  target: PlayerDTO | null
  onClose: () => void
  form: PlayerFormState | null
  onChange: (f: PlayerFormState) => void
  saving: boolean
  onSubmit: () => void
}) {
  const t = useStrings(STRINGS)

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.editTitle(target?.name ?? '')}</DialogTitle>
          <DialogDescription>{t.editDesc}</DialogDescription>
        </DialogHeader>
        {form ? (
          <PlayerFormFields
            form={form}
            onChange={onChange}
            roles={roles}
            auctionMode={auctionMode}
            quickPicks={quickPicks}
            pricingLocked={target?.status === 'SOLD'}
          />
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={saving} className="min-h-10">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t.saveChanges}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeletePlayerDialog({
  target,
  onClose,
  deleting,
  onConfirm,
}: {
  target: PlayerDTO | null
  onClose: () => void
  deleting: boolean
  onConfirm: () => void
}) {
  const t = useStrings(STRINGS)

  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.removeTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.removeDesc(target?.name ?? null)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {deleting ? t.removing : t.removePlayer}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
