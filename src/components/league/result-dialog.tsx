'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { apiPatch } from '@/lib/api'
import { ballsToOvers, isKnockoutStage, MATCH_STATUSES, oversToBalls, RESULT_TYPES, type MatchStatus, type ResultType } from '@/lib/league'
import { type Strings, useStrings } from '@/lib/i18n'
import type { LeagueData, MatchDTO } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sideInfo, teamMap, useLeagueLabels } from './labels'

const STRINGS = {
  en: {
    title: (n: number) => `Result — match ${n}`,
    desc: 'Scores update the points table, and the knockout bracket fills in automatically.',
    status: 'Status',
    resultType: 'Result',
    runs: 'Runs',
    wickets: 'Wickets',
    overs: 'Overs',
    oversPh: 'e.g. 19.4',
    goals: 'Goals',
    points: 'Points',
    battedFirst: 'Batted first',
    notSure: 'Not sure',
    winner: 'Winner',
    winnerHint: 'Who went through (penalties / super over), or who got the walkover.',
    pom: 'Player of the match',
    none: 'None',
    note: 'Result note',
    notePh: 'Leave empty to write it automatically',
    save: 'Save result',
    cancel: 'Cancel',
    saved: 'Result saved',
    badOvers: 'Overs must look like 19.4 (0–5 balls after the dot)',
    outOf: (n: number) => `(max ${n} overs)`,
  },
  bn: {
    title: (n: number) => `ফলাফল — ম্যাচ ${n}`,
    desc: 'স্কোর দিলে পয়েন্ট টেবিল আপডেট হবে, নকআউটের দলও নিজে থেকে বসে যাবে।',
    status: 'অবস্থা',
    resultType: 'ফলাফল',
    runs: 'রান',
    wickets: 'উইকেট',
    overs: 'ওভার',
    oversPh: 'যেমন 19.4',
    goals: 'গোল',
    points: 'পয়েন্ট',
    battedFirst: 'আগে ব্যাট করেছে',
    notSure: 'জানা নেই',
    winner: 'বিজয়ী',
    winnerHint: 'কে পরের রাউন্ডে গেল (টাইব্রেকার / সুপার ওভার), বা কে ওয়াকওভার পেল।',
    pom: 'ম্যাচ সেরা',
    none: 'কেউ না',
    note: 'ফলাফলের লেখা',
    notePh: 'খালি রাখলে নিজে থেকে লেখা হবে',
    save: 'ফলাফল সেভ করুন',
    cancel: 'বাতিল',
    saved: 'ফলাফল সেভ হয়েছে',
    badOvers: 'ওভার লিখুন 19.4 এভাবে (দশমিকের পরে 0–5 বল)',
    outOf: (n: number) => `(সর্বোচ্চ ${n} ওভার)`,
  },
} satisfies Strings<{
  title: (n: number) => string
  desc: string
  status: string
  resultType: string
  runs: string
  wickets: string
  overs: string
  oversPh: string
  goals: string
  points: string
  battedFirst: string
  notSure: string
  winner: string
  winnerHint: string
  pom: string
  none: string
  note: string
  notePh: string
  save: string
  cancel: string
  saved: string
  badOvers: string
  outOf: (n: number) => string
}>

const NONE = '__none'
const str = (v: number | null) => (v === null ? '' : String(v))
const num = (v: string) => (v.trim() === '' ? null : Number(v))

export function ResultDialog({
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
  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {match ? <ResultForm key={match.id} data={data} match={match} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ResultForm({
  data,
  match,
  onClose,
  onSaved,
}: {
  data: LeagueData
  match: MatchDTO
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const sport = data.tournament.sport
  const cricket = sport === 'CRICKET'
  const teams = teamMap(data)
  const home = sideInfo(match, 'home', teams, l)
  const away = sideInfo(match, 'away', teams, l)
  const knockout = isKnockoutStage(match.stage)

  const [status, setStatus] = useState<MatchStatus>(match.status === 'SCHEDULED' || match.status === 'POSTPONED' ? 'COMPLETED' : match.status)
  const [resultType, setResultType] = useState<ResultType>(match.resultType ?? 'NORMAL')
  const [hs, setHs] = useState(str(match.homeScore))
  const [as, setAs] = useState(str(match.awayScore))
  const [hw, setHw] = useState(str(match.homeWickets))
  const [aw, setAw] = useState(str(match.awayWickets))
  const [ho, setHo] = useState(match.homeBalls === null ? '' : ballsToOvers(match.homeBalls))
  const [ao, setAo] = useState(match.awayBalls === null ? '' : ballsToOvers(match.awayBalls))
  const [battedFirst, setBattedFirst] = useState<'HOME' | 'AWAY' | typeof NONE>(NONE)
  const [winner, setWinner] = useState(match.winnerTeamId ?? NONE)
  const [pom, setPom] = useState(match.playerOfMatchId ?? NONE)
  const [note, setNote] = useState(match.resultNote ?? '')
  const [noteTouched, setNoteTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  // Changing the result makes an automatic note stale: clear it unless typed by hand.
  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    if (!noteTouched) setNote('')
  }

  const completed = status === 'COMPLETED'
  const showScores = status !== 'ABANDONED' || hs !== '' || as !== ''
  const level = hs !== '' && hs === as
  const needWinner = completed && (resultType === 'WALKOVER' || (knockout && (resultType === 'TIE' || (resultType === 'NORMAL' && level))))
  const scoreLabel = cricket ? t.runs : sport === 'FOOTBALL' ? t.goals : t.points
  const squad = (teamId: string | null) => (teamId ? (data.squads.find((s) => s.teamId === teamId)?.players ?? []) : [])

  async function save() {
    if (cricket && ((ho && oversToBalls(ho) === null) || (ao && oversToBalls(ao) === null))) {
      toast.error(t.badOvers)
      return
    }
    setBusy(true)
    try {
      await apiPatch(`/api/matches/${match.id}`, {
        status,
        resultType: completed ? resultType : null,
        homeScore: num(hs),
        awayScore: num(as),
        ...(cricket ? { homeWickets: num(hw), awayWickets: num(aw), homeOvers: ho.trim() || null, awayOvers: ao.trim() || null } : {}),
        winnerTeamId: needWinner && winner !== NONE ? winner : null,
        playerOfMatchId: completed && pom !== NONE ? pom : null,
        resultNote: note.trim(),
        battedFirst: cricket && battedFirst !== NONE ? battedFirst : null,
      })
      toast.success(t.saved)
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const sideFields = (side: 'home' | 'away') => {
    const info = side === 'home' ? home : away
    const [score, setScore] = side === 'home' ? [hs, setHs] : [as, setAs]
    const [w, setW] = side === 'home' ? [hw, setHw] : [aw, setAw]
    const [o, setO] = side === 'home' ? [ho, setHo] : [ao, setAo]
    return (
      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-sm font-bold">{info.name}</legend>
        <div className={cricket ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-1'}>
          <div className="space-y-1">
            <Label htmlFor={`rs-${side}-score`} className="text-xs">{scoreLabel}</Label>
            <Input id={`rs-${side}-score`} type="number" inputMode="numeric" min={0} value={score} onChange={(e) => touch(setScore)(e.target.value)} />
          </div>
          {cricket ? (
            <>
              <div className="space-y-1">
                <Label htmlFor={`rs-${side}-w`} className="text-xs">{t.wickets}</Label>
                <Input id={`rs-${side}-w`} type="number" inputMode="numeric" min={0} max={10} value={w} onChange={(e) => touch(setW)(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`rs-${side}-o`} className="text-xs">{t.overs}</Label>
                <Input id={`rs-${side}-o`} inputMode="decimal" placeholder={t.oversPh} value={o} onChange={(e) => touch(setO)(e.target.value)} />
              </div>
            </>
          ) : null}
        </div>
      </fieldset>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.title(match.matchNumber)}</DialogTitle>
        <DialogDescription>
          {home.name} {l.vs} {away.name}. {t.desc}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t.status}</Label>
            <Select value={status} onValueChange={(v) => touch(setStatus)(v as MatchStatus)}>
              <SelectTrigger className="w-full" aria-label={t.status}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {l.status[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {completed ? (
            <div className="space-y-1.5">
              <Label>{t.resultType}</Label>
              <Select value={resultType} onValueChange={(v) => touch(setResultType)(v as ResultType)}>
                <SelectTrigger className="w-full" aria-label={t.resultType}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULT_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {l.resultType[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {(status === 'COMPLETED' || status === 'LIVE' || status === 'ABANDONED') && showScores ? (
          <div className="space-y-3">
            {sideFields('home')}
            {sideFields('away')}
            {cricket && data.settings.oversPerInnings ? (
              <p className="-mt-1 text-xs text-muted-foreground">{t.outOf(data.settings.oversPerInnings)}</p>
            ) : null}
          </div>
        ) : null}

        {cricket && completed && resultType === 'NORMAL' ? (
          <div className="space-y-1.5">
            <Label>{t.battedFirst}</Label>
            <Select value={battedFirst} onValueChange={(v) => touch(setBattedFirst)(v as typeof battedFirst)}>
              <SelectTrigger className="w-full" aria-label={t.battedFirst}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.notSure}</SelectItem>
                <SelectItem value="HOME">{home.name}</SelectItem>
                <SelectItem value="AWAY">{away.name}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {needWinner ? (
          <div className="space-y-1.5">
            <Label>{t.winner}</Label>
            <Select value={winner} onValueChange={(v) => touch(setWinner)(v)}>
              <SelectTrigger className="w-full" aria-label={t.winner}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {match.homeTeamId ? <SelectItem value={match.homeTeamId}>{home.name}</SelectItem> : null}
                {match.awayTeamId ? <SelectItem value={match.awayTeamId}>{away.name}</SelectItem> : null}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.winnerHint}</p>
          </div>
        ) : null}

        {completed ? (
          <div className="space-y-1.5">
            <Label>{t.pom}</Label>
            <Select value={pom} onValueChange={setPom}>
              <SelectTrigger className="w-full" aria-label={t.pom}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.none}</SelectItem>
                {([match.homeTeamId, match.awayTeamId] as const).map((teamId, i) =>
                  teamId && squad(teamId).length > 0 ? (
                    <SelectGroup key={teamId}>
                      <SelectLabel>{i === 0 ? home.name : away.name}</SelectLabel>
                      {squad(teamId).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.role}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {completed || status === 'ABANDONED' ? (
          <div className="space-y-1.5">
            <Label htmlFor="rs-note">{t.note}</Label>
            <Input
              id="rs-note"
              maxLength={160}
              placeholder={t.notePh}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteTouched(true)
              }}
            />
          </div>
        ) : null}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t.save}
        </Button>
      </DialogFooter>
    </>
  )
}
