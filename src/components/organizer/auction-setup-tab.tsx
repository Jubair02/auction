'use client'

import { useState } from 'react'
import { ExternalLink, Gavel, History, Info, Loader2, MessageCircle, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { apiPatch, apiPost, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { AuctionDTO } from '@/lib/types'

const BID_TIMER_OPTIONS = ['10', '15', '20', '30', '45', '60']
const GOING_OPTIONS = ['5', '8', '10', '15']
const INCREMENT_OPTIONS = ['1000', '2000', '5000', '10000']

const AUCTION_STATUS_TONES: Record<string, string> = {
  READY: 'bg-sky-100 text-sky-900 border-sky-200',
  LIVE: 'bg-amber-100 text-amber-900 border-amber-300',
  PAUSED: 'bg-slate-200 text-slate-700 border-slate-300',
  ENDED: 'bg-teal-100 text-teal-900 border-teal-300',
}

interface SettingsState {
  bidTimerSeconds: string
  goingIntervalSeconds: string
  minIncrement: string
}

export function AuctionSetupTab({
  tournamentId,
  tournamentName,
  auction,
  playerCount,
  teamCount,
  refetch,
}: {
  tournamentId: string
  tournamentName: string
  auction: AuctionDTO | null
  playerCount: number
  teamCount: number
  refetch: () => Promise<void>
}) {
  const [settings, setSettings] = useState<SettingsState>(() =>
    auction
      ? {
          bidTimerSeconds: String(auction.bidTimerSeconds),
          goingIntervalSeconds: String(auction.goingIntervalSeconds),
          minIncrement: String(auction.minIncrement),
        }
      : { bidTimerSeconds: '20', goingIntervalSeconds: '8', minIncrement: '5000' },
  )
  const [saving, setSaving] = useState(false)

  const readyToCreate = playerCount > 0 && teamCount > 0

  const createAuction = async () => {
    setSaving(true)
    try {
      await apiPost(`/api/tournaments/${tournamentId}/auction`, {
        bidTimerSeconds: parseInt(settings.bidTimerSeconds, 10),
        goingIntervalSeconds: parseInt(settings.goingIntervalSeconds, 10),
        minIncrement: parseInt(settings.minIncrement, 10),
      })
      toast.success('Auction room created — share the room code with your managers!')
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not create the auction')
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await apiPatch(`/api/tournaments/${tournamentId}/auction`, {
        bidTimerSeconds: parseInt(settings.bidTimerSeconds, 10),
        goingIntervalSeconds: parseInt(settings.goingIntervalSeconds, 10),
        minIncrement: parseInt(settings.minIncrement, 10),
      })
      toast.success('Auction settings updated')
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update settings')
    } finally {
      setSaving(false)
    }
  }

  const copyInvite = () => {
    if (!auction) return
    const joinUrl = `${window.location.origin}/#/room/${auction.roomCode}`
    const msg = `NeelamGhor Live Auction — ${tournamentName}. Room Code: ${auction.roomCode}. Join: ${joinUrl}`
    void navigator.clipboard
      .writeText(msg)
      .then(() => toast.success('Invite message copied'))
      .catch(() => toast.error('Could not copy — please copy manually'))
  }

  const copyCode = () => {
    if (!auction) return
    void navigator.clipboard
      .writeText(auction.roomCode)
      .then(() => toast.success('Room code copied'))
      .catch(() => toast.error('Could not copy — please copy manually'))
  }

  const form = (
    <SettingsForm
      settings={settings}
      onChange={setSettings}
      disabled={saving || (!!auction && auction.status !== 'READY')}
    />
  )

  /* ---------------- No auction yet ---------------- */
  if (!auction) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Gavel}
          title="No auction room yet"
          description="Create the auction room to generate a unique room code. Team managers join with that code and bid live while you run the show."
        />

        {!readyToCreate ? (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <p className="text-amber-900">
                You need at least <strong>1 player</strong> and <strong>1 team</strong> before creating the auction
                room. Currently: {playerCount} players, {teamCount} teams.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="space-y-5 p-6">
            <h3 className="font-bold">Auction settings</h3>
            {form}
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Settings can still be tweaked after creation — but not once the auction is live.
              </p>
              <Button
                className="min-h-11 sm:w-auto"
                disabled={!readyToCreate || saving}
                onClick={() => void createAuction()}
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Gavel className="mr-1.5 h-4 w-4" aria-hidden />}
                Create auction room
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------------- Auction exists ---------------- */
  const joinUrl = `${window.location.origin}/#/room/${auction.roomCode}`
  const waHref = `https://wa.me/?text=${encodeURIComponent(
    `NeelamGhor Live Auction — ${tournamentName}. Room Code: ${auction.roomCode}. Join: ${joinUrl}`,
  )}`
  const settingsLocked = auction.status !== 'READY'

  return (
    <div className="space-y-4">
      {/* Hero room-code panel */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-teal-700 to-emerald-800 px-6 py-8 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-200">Room code</p>
          <p className="mt-2 font-mono text-4xl font-extrabold tracking-wider sm:text-6xl">{auction.roomCode}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10 bg-white/95 text-teal-900 hover:bg-white"
              onClick={copyCode}
            >
              Copy code
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 border-white/40 text-white hover:bg-white/10 hover:text-white"
              onClick={copyInvite}
            >
              Copy invite message
            </Button>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-md bg-emerald-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> WhatsApp
            </a>
          </div>
        </div>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className={AUCTION_STATUS_TONES[auction.status] ?? ''}>
              {auction.status}
            </Badge>
            <span className="text-muted-foreground">{auction.bidCount} bids placed</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-10 flex-1 sm:flex-none" onClick={() => navigate(`/results/${tournamentId}`)}>
              <Trophy className="mr-1.5 h-4 w-4" aria-hidden /> Results
            </Button>
            <Button variant="outline" className="min-h-10 flex-1 sm:flex-none" onClick={() => navigate(`/tournaments/${tournamentId}/history`)}>
              <History className="mr-1.5 h-4 w-4" aria-hidden /> Bid history
            </Button>
            <Button className="min-h-10 flex-1 sm:flex-none" onClick={() => navigate(`/room/${auction.roomCode}`)}>
              <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> Open auction room
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">Auction settings</h3>
              <p className="mt-1 text-sm text-muted-foreground">Timing and minimum bid increment for the room.</p>
            </div>
          </div>
          {settingsLocked ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Settings are locked while the auction is <strong>{auction.status}</strong>. They can only be changed
                while the room is READY.
              </p>
            </div>
          ) : null}
          {form}
          <div className="flex justify-end">
            <Button className="min-h-10" onClick={() => void saveSettings()} disabled={saving || settingsLocked}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SettingsForm({
  settings,
  onChange,
  disabled,
}: {
  settings: SettingsState
  onChange: (s: SettingsState) => void
  disabled: boolean
}) {
  const set = (patch: Partial<SettingsState>) => onChange({ ...settings, ...patch })
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Bid timer</Label>
        <Select value={settings.bidTimerSeconds} onValueChange={(v) => set({ bidTimerSeconds: v })} disabled={disabled}>
          <SelectTrigger className="h-10 w-full" aria-label="Bid timer seconds">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BID_TIMER_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o} seconds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Reset on every new bid</p>
      </div>
      <div className="space-y-1.5">
        <Label>&ldquo;Going once&rdquo; interval</Label>
        <Select value={settings.goingIntervalSeconds} onValueChange={(v) => set({ goingIntervalSeconds: v })} disabled={disabled}>
          <SelectTrigger className="h-10 w-full" aria-label="Going once interval seconds">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GOING_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o} seconds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Pause between the final calls</p>
      </div>
      <div className="space-y-1.5">
        <Label>Min bid increment</Label>
        <Select value={settings.minIncrement} onValueChange={(v) => set({ minIncrement: v })} disabled={disabled}>
          <SelectTrigger className="h-10 w-full" aria-label="Minimum bid increment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCREMENT_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                ৳{new Intl.NumberFormat('en-IN').format(parseInt(o, 10))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Each bid must beat the last by this</p>
      </div>
    </div>
  )
}
