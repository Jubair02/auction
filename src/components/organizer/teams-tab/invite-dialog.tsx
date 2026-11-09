'use client'

import { Copy } from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const STRINGS = {
  en: {
    inviteCopied: 'Invite link copied',
    inviteTitle: (team: string) => `Invite a manager for ${team}`,
    inviteDesc:
      'Send this link to the team’s manager. They log in (or sign up) as a team manager and the team is linked to their account. It works once and expires in 7 days; making a new link cancels this one.',
    inviteReplaces: ' Accepting it replaces the current manager.',
    inviteLinkAria: 'Manager invite link',
    aTeam: 'a team',
    whatsappText: (team: string, url: string) => `You're invited to manage ${team} on NeelamGhor. Accept here: ${url}`,
    shareWhatsapp: 'Share on WhatsApp',
    copyLink: 'Copy link',
  },
  bn: {
    inviteCopied: 'আমন্ত্রণ লিংক কপি হয়েছে',
    inviteTitle: (team: string) => `${team}-এর জন্য ম্যানেজারকে আমন্ত্রণ`,
    inviteDesc:
      'এই লিংকটি দলের ম্যানেজারকে পাঠান। তিনি টিম ম্যানেজার হিসেবে লগইন (বা সাইন আপ) করলে দলটি তার অ্যাকাউন্টে যুক্ত হয়ে যাবে। লিংকটি একবারই কাজ করে এবং ৭ দিন পর মেয়াদ শেষ হয়; নতুন লিংক বানালে এটি বাতিল হয়ে যাবে।',
    inviteReplaces: ' এটি গ্রহণ করলে বর্তমান ম্যানেজার বদলে যাবে।',
    inviteLinkAria: 'ম্যানেজারের আমন্ত্রণ লিংক',
    aTeam: 'একটি দল',
    whatsappText: (team: string, url: string) =>
      `NeelamGhor-এ ${team} পরিচালনার জন্য আপনাকে আমন্ত্রণ জানানো হয়েছে। এখানে গ্রহণ করুন: ${url}`,
    shareWhatsapp: 'WhatsApp-এ শেয়ার করুন',
    copyLink: 'লিংক কপি করুন',
  },
} satisfies Strings<{
  inviteCopied: string
  inviteTitle: (team: string) => string
  inviteDesc: string
  inviteReplaces: string
  inviteLinkAria: string
  aTeam: string
  whatsappText: (team: string, url: string) => string
  shareWhatsapp: string
  copyLink: string
}>

export interface TeamInvite {
  team: TeamDTO
  url: string
  expiresAt: string
}

/** Manager invite link (single use, 7 days), shown to copy or share. */
export function InviteDialog({ invite, onClose }: { invite: TeamInvite | null; onClose: () => void }) {
  const tx = useStrings(STRINGS)

  const copyInvite = () => {
    if (invite) copyText(invite.url, tx.inviteCopied)
  }

  return (
    <Dialog open={!!invite} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx.inviteTitle(invite?.team.name ?? '')}</DialogTitle>
          <DialogDescription>
            {tx.inviteDesc}
            {invite?.team.managerUserId
              ? tx.inviteReplaces
              : ''}
          </DialogDescription>
        </DialogHeader>
        <Input readOnly aria-label={tx.inviteLinkAria} value={invite?.url ?? ''} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                tx.whatsappText(invite?.team.name ?? tx.aTeam, invite?.url ?? ''),
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {tx.shareWhatsapp}
            </a>
          </Button>
          <Button onClick={copyInvite}>
            <Copy className="mr-1.5 h-4 w-4" aria-hidden /> {tx.copyLink}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
