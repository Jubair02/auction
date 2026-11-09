'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, ExternalLink, Globe, Loader2, Lock, Save } from 'lucide-react'
import { apiPatch } from '@/lib/api'
import { invalidateCached } from '@/lib/api-cache'
import { copyText } from '@/lib/clipboard'
import { defaultPoints } from '@/lib/league'
import { tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { type Strings, useStrings } from '@/lib/i18n'
import type { LeagueData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLeagueLabels } from './labels'

const STRINGS = {
  en: {
    pointsTitle: 'Points',
    pointsDesc: 'Leave a box empty to use the sport default (shown in grey).',
    win: 'Win',
    draw: 'Draw',
    tie: 'Tie / no result',
    loss: 'Loss',
    overs: 'Overs per innings',
    oversHint: 'Used for net run rate: a side bowled out counts the full quota of overs.',
    save: 'Save settings',
    saved: 'League settings saved',
    format: 'Format',
    noFormat: 'Not chosen yet',
    publicTitle: 'Public league page',
    publicDesc: 'Fixtures, results, points table and top performers — share it on Facebook or WhatsApp.',
    publicOn: 'Public: anyone with the link can see it. It follows the "Public results page" setting in Edit tournament.',
    publicOff: 'Private: only staff and team managers can open it. Turn on "Public results page" in Edit tournament to share it.',
    copy: 'Copy link',
    copied: 'Link copied',
    open: 'Open',
    readOnly: 'Only the organizer and co-organizers can change these settings.',
  },
  bn: {
    pointsTitle: 'পয়েন্ট',
    pointsDesc: 'খেলার সাধারণ নিয়ম (ধূসর লেখা) রাখতে ঘর খালি রাখুন।',
    win: 'জয়',
    draw: 'ড্র',
    tie: 'টাই / ফলহীন',
    loss: 'হার',
    overs: 'প্রতি ইনিংসে ওভার',
    oversHint: 'নেট রান রেটের জন্য: অলআউট হলে পুরো কোটার ওভার ধরা হবে।',
    save: 'সেটিংস সেভ করুন',
    saved: 'লিগ সেটিংস সেভ হয়েছে',
    format: 'ফরম্যাট',
    noFormat: 'এখনো বাছাই হয়নি',
    publicTitle: 'লিগের পাবলিক পেজ',
    publicDesc: 'ফিকচার, ফলাফল, পয়েন্ট টেবিল আর সেরা খেলোয়াড় — ফেসবুক বা হোয়াটসঅ্যাপে শেয়ার করুন।',
    publicOn: 'পাবলিক: লিংক থাকলে যে কেউ দেখতে পারবেন। এটি "টুর্নামেন্ট সম্পাদনা"-র "ফলাফলের পাবলিক পেজ" সেটিং মেনে চলে।',
    publicOff: 'প্রাইভেট: শুধু স্টাফ ও টিম ম্যানেজাররা খুলতে পারবেন। শেয়ার করতে "টুর্নামেন্ট সম্পাদনা"-য় "ফলাফলের পাবলিক পেজ" চালু করুন।',
    copy: 'লিংক কপি',
    copied: 'লিংক কপি হয়েছে',
    open: 'খুলুন',
    readOnly: 'শুধু আয়োজক ও সহ-আয়োজকরা এই সেটিংস বদলাতে পারেন।',
  },
} satisfies Strings<{
  pointsTitle: string
  pointsDesc: string
  win: string
  draw: string
  tie: string
  loss: string
  overs: string
  oversHint: string
  save: string
  saved: string
  format: string
  noFormat: string
  publicTitle: string
  publicDesc: string
  publicOn: string
  publicOff: string
  copy: string
  copied: string
  open: string
  readOnly: string
}>

const str = (v: number | null) => (v === null ? '' : String(v))

export function LeagueSettings({ data, canEdit, onSaved }: { data: LeagueData; canEdit: boolean; onSaved: () => void | Promise<void> }) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const sport = data.tournament.sport
  const cricket = sport === 'CRICKET'
  const defaults = defaultPoints(sport)
  const s = data.settings
  const [win, setWin] = useState(str(s.pointsWin))
  const [draw, setDraw] = useState(str(s.pointsDraw))
  const [loss, setLoss] = useState(str(s.pointsLoss))
  const [overs, setOvers] = useState(str(s.oversPerInnings))
  const [busy, setBusy] = useState(false)

  const path = `/league/${data.tournament.id}`
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`

  async function save() {
    setBusy(true)
    try {
      await apiPatch(`/api/tournaments/${data.tournament.id}`, {
        pointsWin: win.trim() === '' ? null : Number(win),
        pointsDraw: draw.trim() === '' ? null : Number(draw),
        pointsLoss: loss.trim() === '' ? null : Number(loss),
        ...(cricket ? { oversPerInnings: overs.trim() === '' ? null : Number(overs) } : {}),
      })
      invalidateCached(tournamentDetailUrl(data.tournament.id))
      toast.success(t.saved)
      await onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const numberField = (id: string, label: string, value: string, set: (v: string) => void, placeholder: number, max: number) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        placeholder={String(placeholder)}
        value={value}
        disabled={!canEdit}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t.pointsTitle}</CardTitle>
          <CardDescription>
            {t.format}: <span className="font-semibold text-foreground">{s.format ? l.format[s.format] : t.noFormat}</span>
            <br />
            {canEdit ? t.pointsDesc : t.readOnly}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {numberField('ls-win', t.win, win, setWin, defaults.win, 10)}
            {numberField('ls-draw', cricket ? t.tie : t.draw, draw, setDraw, defaults.draw, 10)}
            {numberField('ls-loss', t.loss, loss, setLoss, defaults.loss, 10)}
          </div>
          {cricket ? (
            <div className="space-y-1.5">
              <Label htmlFor="ls-overs">{t.overs}</Label>
              <Input
                id="ls-overs"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                placeholder="20"
                className="max-w-32"
                value={overs}
                disabled={!canEdit}
                onChange={(e) => setOvers(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.oversHint}</p>
            </div>
          ) : null}
          {canEdit ? (
            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
                {t.save}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {s.resultsPublic ? <Globe className="h-5 w-5 text-primary" aria-hidden /> : <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />}
            {t.publicTitle}
          </CardTitle>
          <CardDescription>{t.publicDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label={t.publicTitle} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyText(url, t.copied)} aria-label={t.copy}>
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0" asChild>
              <a href={path} target="_blank" rel="noopener noreferrer" aria-label={t.open}>
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{s.resultsPublic ? t.publicOn : t.publicOff}</p>
        </CardContent>
      </Card>
    </div>
  )
}
