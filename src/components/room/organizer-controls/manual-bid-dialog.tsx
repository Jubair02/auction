'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import type { RoomState, RoomTeam } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    manualBid: 'Manual bid',
    cancel: 'Cancel',
    errNoPlayer: 'No player on the block',
    errChooseTeam: 'Choose a team',
    errInvalidAmount: 'Enter a valid amount',
    errAlreadyHighest: (team: string) => `${team} already holds the highest bid`,
    errBlocked: (team: string) => `${team} lost this player in the re-auction and is blocked from bidding again`,
    errMinBid: (min: string) => `Minimum bid is ${min}`,
    errOnlyLeft: (team: string, left: string) => `${team} only has ${left} left`,
    errMaxBid: (team: string, max: string) =>
      `${team} can bid at most ${max} — the rest is reserved for their minimum squad`,
    errSquadFull: (team: string) => `${team} squad is full`,
    manualDesc: (player: string) => `Record an offline bid for ${player} on behalf of a team.`,
    manualMin: (min: string) => ` Minimum ${min}.`,
    team: 'Team',
    selectTeam: 'Select team',
    teamOption: (team: string, max: string) => `${team} · max ${max}`,
    optSquadFull: ' (squad full)',
    optHighest: ' (highest bidder)',
    optBlocked: ' (blocked — previous owner)',
    amount: 'Amount (৳)',
    placeBid: 'Place bid',
  },
  bn: {
    manualBid: 'ম্যানুয়াল বিড',
    cancel: 'বাতিল',
    errNoPlayer: 'এখন কোনো খেলোয়াড় নিলামে নেই',
    errChooseTeam: 'একটি দল বেছে নিন',
    errInvalidAmount: 'সঠিক অঙ্ক লিখুন',
    errAlreadyHighest: (team: string) => `সর্বোচ্চ বিড এখন ${team}-এর`,
    errBlocked: (team: string) => `পুনরায় নিলামে ${team} এই খেলোয়াড়কে হারিয়েছে, তাই আবার বিড করতে পারবে না`,
    errMinBid: (min: string) => `সর্বনিম্ন বিড ${min}`,
    errOnlyLeft: (team: string, left: string) => `${team}-এর বাকি আছে মাত্র ${left}`,
    errMaxBid: (team: string, max: string) =>
      `${team} সর্বোচ্চ ${max} বিড করতে পারবে — বাকিটা সর্বনিম্ন স্কোয়াডের জন্য রাখা`,
    errSquadFull: (team: string) => `${team}-এর স্কোয়াড পূর্ণ`,
    manualDesc: (player: string) => `কোনো দলের হয়ে ${player}-এর জন্য অফলাইন বিড লিখে রাখুন।`,
    manualMin: (min: string) => ` সর্বনিম্ন ${min}।`,
    team: 'দল',
    selectTeam: 'দল বেছে নিন',
    teamOption: (team: string, max: string) => `${team} · সর্বোচ্চ ${max}`,
    optSquadFull: ' (স্কোয়াড পূর্ণ)',
    optHighest: ' (সর্বোচ্চ বিডার)',
    optBlocked: ' (বন্ধ — আগের মালিক)',
    amount: 'অঙ্ক (৳)',
    placeBid: 'বিড করুন',
  },
} satisfies Strings<{
  manualBid: string
  cancel: string
  errNoPlayer: string
  errChooseTeam: string
  errInvalidAmount: string
  errAlreadyHighest: (team: string) => string
  errBlocked: (team: string) => string
  errMinBid: (min: string) => string
  errOnlyLeft: (team: string, left: string) => string
  errMaxBid: (team: string, max: string) => string
  errSquadFull: (team: string) => string
  manualDesc: (player: string) => string
  manualMin: (min: string) => string
  team: string
  selectTeam: string
  teamOption: (team: string, max: string) => string
  optSquadFull: string
  optHighest: string
  optBlocked: string
  amount: string
  placeBid: string
}>

export function ManualBidDialog({
  state,
  open,
  onOpenChange,
  onSubmit,
}: {
  state: RoomState
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Resolves true once the server accepted the bid (the dialog then closes). */
  onSubmit: (teamId: string, amount: number) => Promise<boolean>
}) {
  const tx = useStrings(STRINGS)
  const [teamId, setTeamId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const player = state.currentPlayer
  const minBid = player ? (state.currentBid ? state.currentBid.amount + state.minIncrement : player.basePrice) : 0
  const team: RoomTeam | undefined = state.teams.find((t) => t.id === teamId)
  const teamMax = team ? (team.maxBid ?? team.remaining) : 0

  async function submit() {
    if (sending) return
    if (!player) {
      setError(tx.errNoPlayer)
      return
    }
    if (!team) {
      setError(tx.errChooseTeam)
      return
    }
    const n = Number(amount.replace(/[^0-9]/g, ''))
    if (!amount.trim() || Number.isNaN(n) || n <= 0) {
      setError(tx.errInvalidAmount)
      return
    }
    if (state.currentBid?.teamId === team.id) {
      setError(tx.errAlreadyHighest(team.name))
      return
    }
    if (state.allowPreviousOwnerRebid === false && state.previousOwnerTeamId === team.id) {
      setError(tx.errBlocked(team.name))
      return
    }
    if (n < minBid) {
      setError(tx.errMinBid(formatBDT(minBid)))
      return
    }
    if (n > team.remaining) {
      setError(tx.errOnlyLeft(team.name, formatBDT(team.remaining)))
      return
    }
    if (n > teamMax) {
      setError(tx.errMaxBid(team.name, formatBDT(teamMax)))
      return
    }
    if (team.squadCount >= team.maxSquad) {
      setError(tx.errSquadFull(team.name))
      return
    }
    setError(null)
    setSending(true)
    try {
      if (await onSubmit(team.id, Math.round(n))) setAmount('')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tx.manualBid}</DialogTitle>
          <DialogDescription>
            {tx.manualDesc(player ? player.name : '—')}
            {player ? tx.manualMin(formatBDT(minBid)) : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="manual-team">{tx.team}</Label>
            <Select value={teamId} onValueChange={(v) => { setTeamId(v); setError(null) }}>
              <SelectTrigger id="manual-team" className="h-11 w-full">
                <SelectValue placeholder={tx.selectTeam} />
              </SelectTrigger>
              <SelectContent>
                {state.teams.map((t) => {
                  const cap = t.maxBid ?? t.remaining
                  const full = t.squadCount >= t.maxSquad
                  const leading = state.currentBid?.teamId === t.id
                  const blocked =
                    state.allowPreviousOwnerRebid === false && state.previousOwnerTeamId === t.id
                  return (
                    <SelectItem key={t.id} value={t.id} disabled={full || leading || blocked}>
                      {tx.teamOption(t.name, formatBDT(cap))}
                      {full
                        ? tx.optSquadFull
                        : leading
                          ? tx.optHighest
                          : blocked
                            ? tx.optBlocked
                            : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-amount">{tx.amount}</Label>
            <Input
              id="manual-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null) }}
              className="h-11 tabular-nums"
              placeholder={minBid ? String(minBid) : '0'}
            />
          </div>
          {error ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx.cancel}</Button>
          <Button onClick={() => void submit()} disabled={sending || !player || state.status !== 'LIVE'} aria-busy={sending || undefined}>
            {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-1.5 h-4 w-4" />}{' '}
            {tx.placeBid}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
