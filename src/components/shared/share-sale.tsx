'use client'

import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const STRINGS = {
  en: {
    share: 'Share',
    shareAria: (player: string) => `Share ${player}'s sale`,
    text: (player: string, team: string, price: string) => `${player} SOLD to ${team} for ${price}!`,
    copied: 'Link copied — paste it in WhatsApp or Facebook',
    failed: 'Could not share the link',
  },
  bn: {
    share: 'শেয়ার',
    shareAria: (player: string) => `${player}-এর বিক্রি শেয়ার করুন`,
    text: (player: string, team: string, price: string) => `${player} বিক্রি হলেন ${team}-এর কাছে, ${price}-এ!`,
    copied: 'লিংক কপি হয়েছে — WhatsApp বা Facebook-এ পেস্ট করুন',
    failed: 'লিংক শেয়ার করা যায়নি',
  },
} satisfies Strings<{
  share: string
  shareAria: (player: string) => string
  text: (player: string, team: string, price: string) => string
  copied: string
  failed: string
}>

export interface SaleToShare {
  playerId: string
  playerName: string
  teamName: string
  price: number
}

/**
 * Shares one sale as a link that unfurls as the SOLD card (see the `?sold=`
 * metadata in app/[[...slug]]/page.tsx). `path` is the page the link opens —
 * the live room during the auction, the results page after it.
 */
export function ShareSaleButton({
  sale,
  path,
  size = 'sm',
  iconOnly = false,
  className,
}: {
  sale: SaleToShare
  path: string
  size?: 'sm' | 'default' | 'icon'
  iconOnly?: boolean
  className?: string
}) {
  const t = useStrings(STRINGS)

  async function share() {
    const url = `${window.location.origin}${path}${path.includes('?') ? '&' : '?'}sold=${encodeURIComponent(sale.playerId)}`
    const text = t.text(sale.playerName, sale.teamName, formatBDT(sale.price))
    // Phones: the system share sheet (WhatsApp, Messenger, …). Elsewhere: copy the link.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, url })
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success(t.copied)
    } catch {
      toast.error(t.failed)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? 'icon' : size}
      className={cn(iconOnly && 'h-8 w-8', className)}
      onClick={() => void share()}
      aria-label={t.shareAria(sale.playerName)}
    >
      <Share2 className={cn('h-4 w-4', !iconOnly && 'mr-1.5')} aria-hidden />
      {iconOnly ? null : t.share}
    </Button>
  )
}
