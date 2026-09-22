'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiPatch, ApiError } from '@/lib/api'
import type { TournamentDetail } from '@/lib/types'

const TOURNAMENT_TYPES = [
  'Corporate Cricket',
  'University Tournament',
  'Local Club Tournament',
  'School Tournament',
  'Friends/Community Tournament',
  'Indoor Cricket',
  '6-a-side / 7-a-side Football',
]

/** Sentinel for "no type" — Radix Select cannot take an empty string value. */
const NO_TYPE = '__none__'

type T = TournamentDetail['tournament']

/** ISO timestamp → the `YYYY-MM-DDTHH:mm` shape a datetime-local input expects (local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TournamentEditDialog({
  tournament,
  open,
  onOpenChange,
  onSaved,
}: {
  tournament: T
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(tournament.name)
  const [sport, setSport] = useState<'CRICKET' | 'FOOTBALL'>(tournament.sport)
  const [tournamentType, setTournamentType] = useState(tournament.tournamentType ?? NO_TYPE)
  const [location, setLocation] = useState(tournament.location ?? '')
  const [description, setDescription] = useState(tournament.description ?? '')
  const [logoUrl, setLogoUrl] = useState(tournament.logoUrl ?? '')
  const [bannerUrl, setBannerUrl] = useState(tournament.bannerUrl ?? '')
  const [startDate, setStartDate] = useState(toLocalInput(tournament.startDate))
  const [auctionAt, setAuctionAt] = useState(toLocalInput(tournament.auctionAt))
  const [auctionMode, setAuctionMode] = useState(tournament.auctionMode)
  const [basePrice, setBasePrice] = useState(String(tournament.basePrice))
  const [saving, setSaving] = useState(false)

  // Mode and base price drive the live engine — frozen once the gavel is in play.
  const locked = tournament.status === 'LIVE' || tournament.status === 'COMPLETED'

  const save = async () => {
    if (name.trim().length < 2 || name.trim().length > 80) {
      toast.error('Tournament name must be 2–80 characters.')
      return
    }
    const price = parseInt(basePrice, 10)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Base price must be above ৳0.')
      return
    }

    setSaving(true)
    try {
      await apiPatch(`/api/tournaments/${tournament.id}`, {
        name: name.trim(),
        sport,
        tournamentType: tournamentType === NO_TYPE ? null : tournamentType,
        location: location.trim() || null,
        description: description.trim() || null,
        logoUrl: logoUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        auctionAt: auctionAt ? new Date(auctionAt).toISOString() : null,
        ...(locked ? {} : { auctionMode, basePrice: price }),
      })
      toast.success('Tournament updated')
      onOpenChange(false)
      await onSaved()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update tournament')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit tournament</DialogTitle>
          <DialogDescription>
            Update the details shown to managers and viewers.
            {locked ? ' Auction mode and base price are locked once the auction has gone live.' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="te-name">
              Name <span className="text-rose-600">*</span>
            </Label>
            <Input id="te-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-sport">Sport</Label>
            <Select value={sport} onValueChange={(v) => setSport(v as 'CRICKET' | 'FOOTBALL')}>
              <SelectTrigger id="te-sport" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRICKET">Cricket</SelectItem>
                <SelectItem value="FOOTBALL">Football</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-type">Type</Label>
            <Select value={tournamentType} onValueChange={setTournamentType}>
              <SelectTrigger id="te-type" className="h-10 w-full">
                <SelectValue placeholder="No type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TYPE}>No type</SelectItem>
                {TOURNAMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="te-location">Location</Label>
            <Input
              id="te-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder="e.g. Mirpur Indoor Stadium, Dhaka"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-start">Start date</Label>
            <Input
              id="te-start"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-auction">Auction date &amp; time</Label>
            <Input
              id="te-auction"
              type="datetime-local"
              value={auctionAt}
              onChange={(e) => setAuctionAt(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-mode">Auction mode</Label>
            <Select
              value={auctionMode}
              onValueChange={(v) => setAuctionMode(v as 'CATEGORY' | 'NORMAL')}
              disabled={locked}
            >
              <SelectTrigger id="te-mode" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CATEGORY">Category-Based (A–E)</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-base">Base price (৳)</Label>
            <Input
              id="te-base"
              type="number"
              inputMode="numeric"
              min={1}
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              disabled={locked}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">Used as the default in normal mode.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-logo">Logo URL</Label>
            <Input
              id="te-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              maxLength={500}
              placeholder="https://…"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-banner">Banner URL</Label>
            <Input
              id="te-banner"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              maxLength={500}
              placeholder="https://…"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="te-desc">Description</Label>
            <Textarea
              id="te-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-10" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
