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
import { ImageUpload } from '@/components/shared/image-upload'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiPatch, ApiError } from '@/lib/api'
import type { Sport, TournamentDetail } from '@/lib/types'
import { OtherSportFields, otherSportError, otherSportFrom, otherSportPayload, type OtherSportValue } from '@/components/organizer/other-sport-fields'
import { type Strings, useStrings } from '@/lib/i18n'

// Stored on the tournament and shown as-is elsewhere, so they stay in English.
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

const STRINGS = {
  en: {
    nameLength: 'Tournament name must be 2–80 characters.',
    basePriceAbove: 'Base price must be above ৳0.',
    updated: 'Tournament updated',
    updateFailed: 'Could not update tournament',
    title: 'Edit tournament',
    desc: 'Update the details shown to managers and viewers.',
    lockedNote: ' Auction mode and base price are locked once the auction has gone live.',
    name: 'Name',
    sport: 'Sport',
    cricket: 'Cricket',
    football: 'Football',
    others: 'Others',
    type: 'Type',
    noType: 'No type',
    location: 'Location',
    locationPlaceholder: 'e.g. Mirpur Indoor Stadium, Dhaka',
    startDate: 'Start date',
    auctionDateTime: 'Auction date & time',
    auctionMode: 'Auction mode',
    categoryModeValue: 'Category-Based (A–E)',
    normal: 'Normal',
    basePrice: 'Base price (৳)',
    basePriceHint: 'Used as the default in normal mode.',
    logo: 'Logo',
    banner: 'Banner',
    description: 'Description',
    cancel: 'Cancel',
    save: 'Save changes',
  },
  bn: {
    nameLength: 'টুর্নামেন্টের নাম 2–80 অক্ষরের মধ্যে হতে হবে।',
    basePriceAbove: 'বেস প্রাইস ৳0-এর বেশি হতে হবে।',
    updated: 'টুর্নামেন্ট আপডেট হয়েছে',
    updateFailed: 'টুর্নামেন্ট আপডেট করা যায়নি',
    title: 'টুর্নামেন্ট সম্পাদনা',
    desc: 'ম্যানেজার আর দর্শকরা যে তথ্য দেখেন, তা আপডেট করুন।',
    lockedNote: ' নিলাম লাইভ হওয়ার পর নিলামের ধরন আর বেস প্রাইস আর বদলানো যায় না।',
    name: 'নাম',
    sport: 'খেলা',
    cricket: 'ক্রিকেট',
    football: 'ফুটবল',
    others: 'অন্যান্য',
    type: 'ধরন',
    noType: 'ধরন নেই',
    location: 'স্থান',
    locationPlaceholder: 'যেমন: মিরপুর ইনডোর স্টেডিয়াম, ঢাকা',
    startDate: 'শুরুর তারিখ',
    auctionDateTime: 'নিলামের তারিখ ও সময়',
    auctionMode: 'নিলামের ধরন',
    categoryModeValue: 'ক্যাটাগরি ভিত্তিক (A–E)',
    normal: 'নরমাল',
    basePrice: 'বেস প্রাইস (৳)',
    basePriceHint: 'নরমাল মোডে এটাই ডিফল্ট হিসেবে ধরা হয়।',
    logo: 'লোগো',
    banner: 'ব্যানার',
    description: 'বিবরণ',
    cancel: 'বাতিল',
    save: 'পরিবর্তন সংরক্ষণ করুন',
  },
} satisfies Strings<{
  nameLength: string
  basePriceAbove: string
  updated: string
  updateFailed: string
  title: string
  desc: string
  lockedNote: string
  name: string
  sport: string
  cricket: string
  football: string
  others: string
  type: string
  noType: string
  location: string
  locationPlaceholder: string
  startDate: string
  auctionDateTime: string
  auctionMode: string
  categoryModeValue: string
  normal: string
  basePrice: string
  basePriceHint: string
  logo: string
  banner: string
  description: string
  cancel: string
  save: string
}>

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
  const s = useStrings(STRINGS)
  const [name, setName] = useState(tournament.name)
  const [sport, setSport] = useState<Sport>(tournament.sport)
  const [other, setOther] = useState<OtherSportValue>(() => otherSportFrom(tournament))
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
      toast.error(s.nameLength)
      return
    }
    const price = parseInt(basePrice, 10)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error(s.basePriceAbove)
      return
    }

    const otherError = sport === 'OTHER' ? otherSportError(other) : null
    if (otherError) {
      toast.error(otherError)
      return
    }

    setSaving(true)
    try {
      await apiPatch(`/api/tournaments/${tournament.id}`, {
        name: name.trim(),
        sport,
        ...(sport === 'OTHER' ? otherSportPayload(other) : {}),
        tournamentType: tournamentType === NO_TYPE ? null : tournamentType,
        location: location.trim() || null,
        description: description.trim() || null,
        logoUrl: logoUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        auctionAt: auctionAt ? new Date(auctionAt).toISOString() : null,
        ...(locked ? {} : { auctionMode, basePrice: price }),
      })
      toast.success(s.updated)
      onOpenChange(false)
      await onSaved()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>
            {s.desc}
            {locked ? s.lockedNote : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="te-name">
              {s.name} <span className="text-rose-600">*</span>
            </Label>
            <Input id="te-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-sport">{s.sport}</Label>
            {/* Player roles depend on the sport; the server locks it once the auction goes live. */}
            <Select value={sport} onValueChange={(v) => setSport(v as Sport)} disabled={locked}>
              <SelectTrigger id="te-sport" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRICKET">{s.cricket}</SelectItem>
                <SelectItem value="FOOTBALL">{s.football}</SelectItem>
                <SelectItem value="OTHER">{s.others}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sport === 'OTHER' ? (
            <div className="sm:col-span-2">
              <OtherSportFields value={other} onChange={setOther} idPrefix="te" />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="te-type">{s.type}</Label>
            <Select value={tournamentType} onValueChange={setTournamentType}>
              <SelectTrigger id="te-type" className="h-10 w-full">
                <SelectValue placeholder={s.noType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TYPE}>{s.noType}</SelectItem>
                {TOURNAMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="te-location">{s.location}</Label>
            <Input
              id="te-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder={s.locationPlaceholder}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-start">{s.startDate}</Label>
            <Input
              id="te-start"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-auction">{s.auctionDateTime}</Label>
            <Input
              id="te-auction"
              type="datetime-local"
              value={auctionAt}
              onChange={(e) => setAuctionAt(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-mode">{s.auctionMode}</Label>
            <Select
              value={auctionMode}
              onValueChange={(v) => setAuctionMode(v as 'CATEGORY' | 'NORMAL')}
              disabled={locked}
            >
              <SelectTrigger id="te-mode" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CATEGORY">{s.categoryModeValue}</SelectItem>
                <SelectItem value="NORMAL">{s.normal}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="te-base">{s.basePrice}</Label>
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
            <p className="text-xs text-muted-foreground">{s.basePriceHint}</p>
          </div>

          <ImageUpload label={s.logo} kind="LOGO" value={logoUrl || null} onChange={(url) => setLogoUrl(url ?? '')} />

          <ImageUpload
            className="sm:col-span-2"
            label={s.banner}
            kind="BANNER"
            value={bannerUrl || null}
            onChange={(url) => setBannerUrl(url ?? '')}
          />

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="te-desc">{s.description}</Label>
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
            {s.cancel}
          </Button>
          <Button className="min-h-10" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            {s.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
