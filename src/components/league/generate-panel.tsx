'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays, Loader2, Shuffle, Sparkles, Trophy } from 'lucide-react'
import { apiPatch, apiPost } from '@/lib/api'
import { groupLetter, LEAGUE_FORMATS } from '@/lib/league'
import { type Strings, useStrings } from '@/lib/i18n'
import type { LeagueData, LeagueFormat } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { TeamAvatar } from '@/components/shared/avatars'
import { useLeagueLabels } from './labels'

const STRINGS = {
  en: {
    title: 'Make the fixtures',
    titleAgain: 'Make the fixtures again',
    desc: 'Pick a format and NeelamGhor draws up every match. You can edit dates, venues and teams afterwards.',
    format: 'Format',
    groups: 'Groups',
    groupCount: 'Number of groups',
    qualifiers: 'Teams qualifying per group',
    assign: 'Group for each team',
    assignHint: 'Leave on "Auto" to spread teams evenly. Saved when you make the fixtures.',
    auto: 'Auto',
    thirdPlace: 'Third-place play-off',
    thirdPlaceHint: 'The two semi-final losers play for third.',
    shuffle: 'Random draw',
    shuffleHint: 'Shuffle the teams first (otherwise alphabetical order is used as the seeding).',
    schedule: 'Schedule (optional)',
    start: 'First match',
    interval: 'Days between rounds',
    perDay: 'Matches per day',
    perDayHint: 'Empty = a whole round on one day',
    venue: 'Venue',
    venuePh: 'e.g. Mirpur Indoor Stadium',
    generate: 'Generate fixtures',
    cancel: 'Cancel',
    needTeams: 'Add at least 2 teams first.',
    teams: (n: number) => `${n} teams`,
    created: (n: number) => `${n} matches created`,
    confirmTitle: 'Replace the current fixtures?',
    confirmDesc: 'Every existing match will be deleted and new fixtures made.',
    confirmResults: 'Some matches already have results or player stats — they will be deleted too. This cannot be undone.',
    confirm: 'Replace fixtures',
  },
  bn: {
    title: 'ফিকচার তৈরি করুন',
    titleAgain: 'আবার ফিকচার তৈরি করুন',
    desc: 'ফরম্যাট বেছে নিন, NeelamGhor সব ম্যাচ সাজিয়ে দেবে। পরে তারিখ, মাঠ ও দল বদলাতে পারবেন।',
    format: 'ফরম্যাট',
    groups: 'গ্রুপ',
    groupCount: 'কয়টি গ্রুপ',
    qualifiers: 'প্রতি গ্রুপ থেকে কয়টি দল যাবে',
    assign: 'কোন দল কোন গ্রুপে',
    assignHint: '"স্বয়ংক্রিয়" রাখলে দলগুলো সমানভাবে ভাগ হবে। ফিকচার তৈরির সময় সেভ হবে।',
    auto: 'স্বয়ংক্রিয়',
    thirdPlace: 'তৃতীয় স্থান নির্ধারণী ম্যাচ',
    thirdPlaceHint: 'সেমিফাইনালে হারা দুই দল তৃতীয় স্থানের জন্য খেলবে।',
    shuffle: 'লটারি করে সাজান',
    shuffleHint: 'আগে দলগুলো এলোমেলো করা হবে (না হলে নামের ক্রমে সিডিং হবে)।',
    schedule: 'সময়সূচি (ঐচ্ছিক)',
    start: 'প্রথম ম্যাচ',
    interval: 'রাউন্ডের মাঝে কত দিন',
    perDay: 'দিনে কয়টি ম্যাচ',
    perDayHint: 'খালি রাখলে পুরো রাউন্ড এক দিনে',
    venue: 'মাঠ',
    venuePh: 'যেমন: মিরপুর ইনডোর স্টেডিয়াম',
    generate: 'ফিকচার তৈরি করুন',
    cancel: 'বাতিল',
    needTeams: 'আগে অন্তত ২টি দল যোগ করুন।',
    teams: (n: number) => `${n}টি দল`,
    created: (n: number) => `${n}টি ম্যাচ তৈরি হয়েছে`,
    confirmTitle: 'বর্তমান ফিকচার বদলে দেবেন?',
    confirmDesc: 'এখনকার সব ম্যাচ মুছে নতুন ফিকচার তৈরি হবে।',
    confirmResults: 'কিছু ম্যাচের ফলাফল বা খেলোয়াড়ের পরিসংখ্যান আছে — সেগুলোও মুছে যাবে। এটা আর ফেরানো যাবে না।',
    confirm: 'ফিকচার বদলান',
  },
} satisfies Strings<{
  title: string
  titleAgain: string
  desc: string
  format: string
  groups: string
  groupCount: string
  qualifiers: string
  assign: string
  assignHint: string
  auto: string
  thirdPlace: string
  thirdPlaceHint: string
  shuffle: string
  shuffleHint: string
  schedule: string
  start: string
  interval: string
  perDay: string
  perDayHint: string
  venue: string
  venuePh: string
  generate: string
  cancel: string
  needTeams: string
  teams: (n: number) => string
  created: (n: number) => string
  confirmTitle: string
  confirmDesc: string
  confirmResults: string
  confirm: string
}>

const AUTO = '__auto'

export function GeneratePanel({
  data,
  onDone,
  onCancel,
}: {
  data: LeagueData
  onDone: () => void | Promise<void>
  onCancel?: () => void
}) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const tournamentId = data.tournament.id
  const teamCount = data.teams.length
  const hasMatches = data.matches.length > 0
  const hasResults = data.matches.some((m) => m.status === 'COMPLETED' || m.status === 'ABANDONED' || m.statsCount > 0)

  const [format, setFormat] = useState<LeagueFormat>(data.settings.format ?? 'ROUND_ROBIN')
  const existingGroups = useMemo(
    () => [...new Set(data.teams.map((tm) => tm.groupName).filter((g): g is string => !!g))].sort(),
    [data.teams],
  )
  const [groupCount, setGroupCount] = useState(String(Math.max(existingGroups.length, teamCount >= 8 ? 2 : 1)))
  const [qualifiers, setQualifiers] = useState('2')
  const [assign, setAssign] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.teams.map((tm) => [tm.id, tm.groupName ?? AUTO])),
  )
  const [thirdPlace, setThirdPlace] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [start, setStart] = useState('')
  const [intervalDays, setIntervalDays] = useState('1')
  const [perDay, setPerDay] = useState('')
  const [venue, setVenue] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const groupsN = Math.min(16, Math.max(1, Number.parseInt(groupCount, 10) || 1))
  const groupOptions = [...new Set([...Array.from({ length: groupsN }, (_, i) => groupLetter(i)), ...existingGroups])]

  async function generate() {
    setBusy(true)
    try {
      if (format === 'GROUPS_KNOCKOUT') {
        const changed = data.teams.filter((tm) => (assign[tm.id] === AUTO ? null : assign[tm.id]) !== tm.groupName)
        if (changed.length > 0) {
          await apiPatch(`/api/tournaments/${tournamentId}/league/groups`, {
            assignments: data.teams.map((tm) => ({ teamId: tm.id, groupName: assign[tm.id] === AUTO ? null : assign[tm.id] })),
          })
        }
      }
      const res = await apiPost<{ created: number }>(`/api/tournaments/${tournamentId}/league/generate`, {
        format,
        groupCount: format === 'GROUPS_KNOCKOUT' ? groupsN : undefined,
        qualifiersPerGroup: format === 'GROUPS_KNOCKOUT' ? Number.parseInt(qualifiers, 10) || 1 : undefined,
        thirdPlace: format === 'GROUPS_KNOCKOUT' || format === 'KNOCKOUT' ? thirdPlace : false,
        shuffle,
        startDate: start ? new Date(start).toISOString() : null,
        intervalDays: intervalDays === '' ? undefined : Number.parseInt(intervalDays, 10),
        matchesPerDay: perDay === '' ? null : Number.parseInt(perDay, 10),
        venue: venue.trim() || null,
        replace: hasResults,
      })
      toast.success(t.created(res.created))
      await onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  const knockoutish = format === 'GROUPS_KNOCKOUT' || format === 'KNOCKOUT'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" aria-hidden />
          {hasMatches ? t.titleAgain : t.title}
        </CardTitle>
        <CardDescription>{t.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {teamCount < 2 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t.needTeams}</p> : null}

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">
            {t.format} <span className="font-normal text-muted-foreground">· {t.teams(teamCount)}</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {LEAGUE_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  format === f ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
                )}
              >
                <span className="block text-sm font-bold">{l.format[f]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{l.formatHelp[f]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {format === 'GROUPS_KNOCKOUT' ? (
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">{t.groups}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lg-groups">{t.groupCount}</Label>
                <Input id="lg-groups" type="number" inputMode="numeric" min={1} max={16} value={groupCount} onChange={(e) => setGroupCount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lg-qual">{t.qualifiers}</Label>
                <Input id="lg-qual" type="number" inputMode="numeric" min={1} max={8} value={qualifiers} onChange={(e) => setQualifiers(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">{t.assign}</p>
              <p className="mb-2 text-xs text-muted-foreground">{t.assignHint}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.teams.map((tm) => (
                  <li key={tm.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
                    <TeamAvatar name={tm.name} color={tm.color} logoUrl={tm.logoUrl} className="h-7 w-7 text-[10px]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{tm.name}</span>
                    <Select value={assign[tm.id] ?? AUTO} onValueChange={(v) => setAssign((a) => ({ ...a, [tm.id]: v }))}>
                      <SelectTrigger size="sm" className="h-9 w-28" aria-label={`${t.groups}: ${tm.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO}>{t.auto}</SelectItem>
                        {groupOptions.map((g) => (
                          <SelectItem key={g} value={g}>
                            {l.group(g)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
            </div>
          </fieldset>
        ) : null}

        <div className="space-y-3">
          {knockoutish ? (
            <SwitchRow id="lg-third" label={t.thirdPlace} hint={t.thirdPlaceHint} checked={thirdPlace} onChange={setThirdPlace} />
          ) : null}
          <SwitchRow
            id="lg-shuffle"
            label={
              <span className="flex items-center gap-1.5">
                <Shuffle className="h-4 w-4" aria-hidden /> {t.shuffle}
              </span>
            }
            hint={t.shuffleHint}
            checked={shuffle}
            onChange={setShuffle}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <CalendarDays className="h-4 w-4" aria-hidden /> {t.schedule}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lg-start">{t.start}</Label>
              <Input id="lg-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lg-venue">{t.venue}</Label>
              <Input id="lg-venue" maxLength={80} placeholder={t.venuePh} value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lg-interval">{t.interval}</Label>
              <Input id="lg-interval" type="number" inputMode="numeric" min={0} max={60} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} disabled={!start} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lg-perday">{t.perDay}</Label>
              <Input id="lg-perday" type="number" inputMode="numeric" min={1} max={20} placeholder={t.perDayHint} value={perDay} onChange={(e) => setPerDay(e.target.value)} disabled={!start} />
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              {t.cancel}
            </Button>
          ) : null}
          <Button
            disabled={busy || teamCount < 2}
            onClick={() => (hasMatches ? setConfirmOpen(true) : void generate())}
            className="min-h-11"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="mr-2 h-4 w-4" aria-hidden />}
            {t.generate}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmDesc} {hasResults ? <strong className="text-destructive">{t.confirmResults}</strong> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void generate()
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: React.ReactNode
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
