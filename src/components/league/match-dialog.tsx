'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiPatch, apiPost } from '@/lib/api'
import { MATCH_STAGES, type MatchStage } from '@/lib/league'
import { type Strings, useStrings } from '@/lib/i18n'
import type { LeagueData, MatchDTO } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLeagueLabels } from './labels'

const STRINGS = {
  en: {
    editTitle: (n: number) => `Edit match ${n}`,
    addTitle: 'Add a match',
    desc: 'Change the date, venue or teams. Picking a team by hand replaces an automatic placeholder.',
    addDesc: 'For a play-off, a rescheduled game or a friendly. A side can be a placeholder such as "Winner M7" or "Winner League" — it fills in automatically.',
    stage: 'Stage',
    group: 'Group',
    round: 'Round',
    home: 'Home / team 1',
    away: 'Away / team 2',
    placeholder: 'Placeholder…',
    placeholderPh: 'e.g. Winner M7',
    when: 'Date & time',
    venue: 'Venue',
    save: 'Save',
    add: 'Add match',
    cancel: 'Cancel',
    saved: 'Match saved',
    added: 'Match added',
    sameTeam: 'Pick two different teams',
  },
  bn: {
    editTitle: (n: number) => `ম্যাচ ${n} সম্পাদনা`,
    addTitle: 'ম্যাচ যোগ করুন',
    desc: 'তারিখ, মাঠ বা দল বদলান। হাতে দল বাছলে স্বয়ংক্রিয় জায়গাটি বদলে যাবে।',
    addDesc: 'প্লে-অফ, পিছিয়ে যাওয়া খেলা বা প্রীতি ম্যাচের জন্য। কোনো পাশে "Winner M7" বা "Winner League" লিখে রাখলে দল নিজে থেকে বসবে।',
    stage: 'পর্ব',
    group: 'গ্রুপ',
    round: 'রাউন্ড',
    home: 'হোম / দল ১',
    away: 'অ্যাওয়ে / দল ২',
    placeholder: 'পরে ঠিক হবে…',
    placeholderPh: 'যেমন Winner M7',
    when: 'তারিখ ও সময়',
    venue: 'মাঠ',
    save: 'সেভ',
    add: 'ম্যাচ যোগ করুন',
    cancel: 'বাতিল',
    saved: 'ম্যাচ সেভ হয়েছে',
    added: 'ম্যাচ যোগ হয়েছে',
    sameTeam: 'দুটি আলাদা দল বেছে নিন',
  },
} satisfies Strings<{
  editTitle: (n: number) => string
  addTitle: string
  desc: string
  addDesc: string
  stage: string
  group: string
  round: string
  home: string
  away: string
  placeholder: string
  placeholderPh: string
  when: string
  venue: string
  save: string
  add: string
  cancel: string
  saved: string
  added: string
  sameTeam: string
}>

const LABEL = '__label'

/** ISO → the value a datetime-local input wants, in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `match` = edit it; `match === 'new'` = add one; null = closed. */
export function MatchDialog({
  data,
  match,
  onClose,
  onSaved,
}: {
  data: LeagueData
  match: MatchDTO | 'new' | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  return (
    <Dialog open={match !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {match !== null ? (
          <MatchForm key={match === 'new' ? 'new' : match.id} data={data} match={match === 'new' ? null : match} onClose={onClose} onSaved={onSaved} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MatchForm({
  data,
  match,
  onClose,
  onSaved,
}: {
  data: LeagueData
  match: MatchDTO | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const lastRound = data.matches.reduce((max, m) => Math.max(max, m.round), 1)
  const [stage, setStage] = useState<MatchStage>(match?.stage ?? (data.settings.format === 'KNOCKOUT' ? 'FINAL' : 'LEAGUE'))
  const [groupName, setGroupName] = useState(match?.groupName ?? '')
  const [round, setRound] = useState(String(match?.round ?? lastRound))
  const initialSide = (teamId: string | null | undefined, label: string | null | undefined) => (teamId ? teamId : label ? LABEL : '')
  const [home, setHome] = useState(initialSide(match?.homeTeamId, match?.homeLabel))
  const [away, setAway] = useState(initialSide(match?.awayTeamId, match?.awayLabel))
  const [homeLabel, setHomeLabel] = useState(match?.homeLabel ?? '')
  const [awayLabel, setAwayLabel] = useState(match?.awayLabel ?? '')
  const [when, setWhen] = useState(toLocalInput(match?.scheduledAt ?? null))
  const [venue, setVenue] = useState(match?.venue ?? '')
  const [busy, setBusy] = useState(false)

  const groupNames = [...new Set(data.teams.map((tm) => tm.groupName).filter((g): g is string => !!g))]

  async function save() {
    if (home && home !== LABEL && home === away) {
      toast.error(t.sameTeam)
      return
    }
    const sideBody = (side: 'home' | 'away', value: string, label: string) => {
      const teamKey = `${side}TeamId`
      const labelKey = `${side}Label`
      const origTeam = side === 'home' ? match?.homeTeamId : match?.awayTeamId
      const origLabel = side === 'home' ? match?.homeLabel : match?.awayLabel
      if (value === LABEL) {
        // Unchanged placeholder: leave it (and the team it already resolved to) alone.
        if (match && label.trim() === (origLabel ?? '')) return {}
        return { [teamKey]: null, [labelKey]: label.trim() || null }
      }
      if (match && value === (origTeam ?? '')) return {}
      return { [teamKey]: value || null, [labelKey]: null }
    }
    const body = {
      stage,
      groupName: stage === 'GROUP' ? groupName.trim() : null,
      round: Number.parseInt(round, 10) || 1,
      scheduledAt: when ? new Date(when).toISOString() : null,
      venue: venue.trim() || null,
      ...sideBody('home', home, homeLabel),
      ...sideBody('away', away, awayLabel),
    }
    setBusy(true)
    try {
      if (match) await apiPatch(`/api/matches/${match.id}`, body)
      else await apiPost(`/api/tournaments/${data.tournament.id}/league/matches`, body)
      toast.success(match ? t.saved : t.added)
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const sidePicker = (side: 'home' | 'away') => {
    const [value, setValue] = side === 'home' ? [home, setHome] : [away, setAway]
    const [label, setLabel] = side === 'home' ? [homeLabel, setHomeLabel] : [awayLabel, setAwayLabel]
    const title = side === 'home' ? t.home : t.away
    return (
      <div className="space-y-1.5">
        <Label>{title}</Label>
        <Select value={value || undefined} onValueChange={setValue}>
          <SelectTrigger className="w-full" aria-label={title}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {data.teams.map((tm) => (
              <SelectItem key={tm.id} value={tm.id}>
                {tm.name}
              </SelectItem>
            ))}
            <SelectItem value={LABEL}>{t.placeholder}</SelectItem>
          </SelectContent>
        </Select>
        {value === LABEL ? (
          <Input aria-label={`${title} — ${t.placeholder}`} maxLength={40} placeholder={t.placeholderPh} value={label} onChange={(e) => setLabel(e.target.value)} />
        ) : null}
      </div>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{match ? t.editTitle(match.matchNumber) : t.addTitle}</DialogTitle>
        <DialogDescription>{match ? t.desc : t.addDesc}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t.stage}</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as MatchStage)}>
              <SelectTrigger className="w-full" aria-label={t.stage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {l.stage[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-round">{t.round}</Label>
            <Input id="md-round" type="number" inputMode="numeric" min={1} max={200} value={round} onChange={(e) => setRound(e.target.value)} />
          </div>
        </div>
        {stage === 'GROUP' ? (
          <div className="space-y-1.5">
            <Label htmlFor="md-group">{t.group}</Label>
            <Input id="md-group" list="md-group-list" maxLength={20} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <datalist id="md-group-list">
              {groupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {sidePicker('home')}
          {sidePicker('away')}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="md-when">{t.when}</Label>
            <Input id="md-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-venue">{t.venue}</Label>
            <Input id="md-venue" maxLength={80} value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {match ? t.save : t.add}
        </Button>
      </DialogFooter>
    </>
  )
}
