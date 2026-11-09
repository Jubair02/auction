'use client'

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
import type { TeamDTO } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS } from './strings'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    deleteTitle: 'Delete team?',
    deleteDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'This team'} will be removed. A team that has bought players or placed bids can’t be deleted — its bids are part of the auction record — and no team can be deleted while the auction is running.`,
    deleting: 'Deleting…',
    deleteTeam: 'Delete team',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    deleteTitle: 'দল মুছে ফেলবেন?',
    deleteDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'এই দল'} মুছে ফেলা হবে। যে দল খেলোয়াড় কিনেছে বা বিড করেছে তা মোছা যায় না — তার বিডগুলো নিলামের রেকর্ডের অংশ — আর নিলাম চলার সময় কোনো দলই মোছা যায় না।`,
    deleting: 'মুছে ফেলা হচ্ছে…',
    deleteTeam: 'দল মুছুন',
  },
} satisfies Strings<{
  addTeam: string
  cancel: string
  deleteTitle: string
  deleteDesc: (name: string | null) => string
  deleting: string
  deleteTeam: string
}>

export function DeleteTeamDialog({
  deleteTarget,
  deleting,
  onClose,
  onConfirm,
}: {
  deleteTarget: TeamDTO | null
  deleting: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const tx = useStrings(STRINGS)
  return (
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tx.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {tx.deleteDesc(deleteTarget?.name ?? null)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{tx.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
          >
            {deleting ? tx.deleting : tx.deleteTeam}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
