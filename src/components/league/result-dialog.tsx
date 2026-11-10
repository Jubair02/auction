'use client'

// Match result entry — a scoreboard-first dialog. The rules (who wins, what a
// level score means, what needs a named winner) come from resolveResult() in
// lib/league.ts, the same function the API uses, so what this previews and
// validates is exactly what gets stored. Saving updates the points table and
// refreshes knockout placeholders on the server (PATCH /api/matches/:id).

import { useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Loader2,
  MapPin,
  Minus,
  NotebookPen,
  Plus,
  Radio,
  Search,
  Star,
  X,
} from 'lucide-react'
import { apiPatch } from '@/lib/api'
import {
  ballsToOvers,
  describeResult,
  isAwardedResult,
  isKnockoutStage,
  oversToBalls,
  resolveResult,
  scoreLimit,
  type MatchStatus,
  type ResultType,
} from '@/lib/league'
import { formatDate } from '@/lib/format'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LeagueData, LeagueTeamDTO, MatchDTO } from '@/lib/types'
import { PlayerAvatar, TeamAvatar } from '@/components/shared/avatars'
import { PlayerRole } from '@/components/shared/player-role'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { sideInfo, teamMap, useLeagueLabels } from './labels'

type Side = 'home' | 'away'
/** The four states the organizer picks from; Upcoming covers SCHEDULED and POSTPONED. */
type Phase = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED'

interface ResultStrings {
  title: string
  desc: (home: string, away: string) => string
  matchNo: (n: number) => string
  home: string
  away: string
  status: string
  phase: Record<Phase, string>
  phaseHint: { UPCOMING: string; LIVE: string; COMPLETED: string; CANCELLED: (pts: number) => string }
  postponed: string
  postponedHint: string
  needTeams: string
  clearsResult: string
  resultType: string
  rt: { NORMAL: string; TIE: (cricket: boolean) => string; NO_RESULT: string; WALKOVER: string; FORFEIT: string }
  rtHint: {
    NORMAL: string
    TIE: (ko: boolean, pts: number) => string
    NO_RESULT: (pts: number) => string
    WALKOVER: (pts: number) => string
    FORFEIT: (pts: number) => string
  }
  levelLeague: (cricket: boolean) => string
  scoreLabel: Record<string, string>
  optional: string
  wickets: string
  overs: string
  oversPh: string
  maxOvers: (n: number) => string
  battedFirst: string
  leading: string
  winner: string
  level: string
  vs: string
  pickWinner: Record<string, string>
  markWinner: string
  decrease: (name: string) => string
  increase: (name: string) => string
  pom: string
  pomHint: string
  pomSearch: string
  pomAll: string
  pomEmpty: string
  pomNoSquads: string
  change: string
  clear: string
  note: string
  noteOptional: string
  noteAuto: string
  notePh: string
  noteCount: (n: number) => string
  errScore: (max: number) => string
  errScoreRequired: string
  errWickets: (max: number) => string
  errOvers: string
  errOversMax: (n: number) => string
  errTieLevel: string
  impact: Record<Phase, string>
  cancel: string
  save: string
  saving: string
  saved: string
  savedToast: string
  failed: string
  fixErrors: string
}

const STRINGS = {
  en: {
    title: 'Match result',
    desc: (home: string, away: string) => `${home} vs ${away}`,
    matchNo: (n: number) => `Match ${n}`,
    home: 'Home',
    away: 'Away',
    status: 'Match status',
    phase: { UPCOMING: 'Upcoming', LIVE: 'Live', COMPLETED: 'Completed', CANCELLED: 'Cancelled' } as Record<Phase, string>,
    phaseHint: {
      UPCOMING: 'Not played yet. Saving clears any score and result.',
      LIVE: 'Live score only — the points table updates once the match is completed.',
      COMPLETED: 'Final result. Saving updates the points table and the knockout bracket.',
      CANCELLED: (pts: number) => `Abandoned with no result — both teams get ${pts} pt${pts === 1 ? '' : 's'}. A score at the time is optional.`,
    },
    postponed: 'Postponed',
    postponedHint: 'Shows as postponed on the fixtures list.',
    needTeams: 'Both teams must be known before a result can be entered.',
    clearsResult: 'This clears the result that is saved now.',
    resultType: 'Result type',
    rt: {
      NORMAL: 'Normal',
      TIE: (cricket: boolean) => (cricket ? 'Tie' : 'Draw'),
      NO_RESULT: 'No result',
      WALKOVER: 'Walkover',
      FORFEIT: 'Forfeit',
    },
    rtHint: {
      NORMAL: 'The score decides the winner.',
      TIE: (ko: boolean, pts: number) => (ko ? 'Level after full time — pick who went through.' : `Level — both teams get ${pts} pt${pts === 1 ? '' : 's'}.`),
      NO_RESULT: (pts: number) => `Not decided — both teams get ${pts} pt${pts === 1 ? '' : 's'}.`,
      WALKOVER: (pts: number) => `The opponent didn't turn up. The winner gets ${pts} pts; no score is recorded.`,
      FORFEIT: (pts: number) => `The opponent gave up or was disqualified. The winner gets ${pts} pts; a score is optional.`,
    },
    levelLeague: (cricket: boolean) => (cricket ? 'Scores are level — this is saved as a tie.' : 'Scores are level — this is saved as a draw.'),
    scoreLabel: { CRICKET: 'Runs', FOOTBALL: 'Goals', OTHER: 'Score' } as Record<string, string>,
    optional: 'optional',
    wickets: 'Wkts',
    overs: 'Overs',
    oversPh: '19.4',
    maxOvers: (n: number) => `max ${n}`,
    battedFirst: 'Batted first',
    leading: 'Leading',
    winner: 'Winner',
    level: 'Level',
    vs: 'VS',
    pickWinner: {
      awarded: 'Who gets the win?',
      CRICKET: 'Who won the super over?',
      FOOTBALL: 'Who won on penalties?',
      OTHER: 'Who won the tie-break?',
    } as Record<string, string>,
    markWinner: 'Winner',
    decrease: (name: string) => `Lower ${name} score`,
    increase: (name: string) => `Raise ${name} score`,
    pom: 'Player of the match',
    pomHint: 'Optional — from the two squads.',
    pomSearch: 'Search players',
    pomAll: 'Both teams',
    pomEmpty: 'No players match',
    pomNoSquads: 'No squads yet — players appear here once they are sold to these teams.',
    change: 'Change',
    clear: 'Clear',
    note: 'Result note',
    noteOptional: 'Optional',
    noteAuto: 'Written automatically:',
    notePh: 'Leave empty to write it automatically',
    noteCount: (n: number) => `${n}/160`,
    errScore: (max: number) => `Whole number from 0 to ${max}`,
    errScoreRequired: 'Enter both scores, or pick another result type.',
    errWickets: (max: number) => `0 to ${max}`,
    errOvers: 'Like 19.4 (0–5 balls after the dot)',
    errOversMax: (n: number) => `Max ${n} overs`,
    errTieLevel: 'For a draw / tie both scores must be level, or left empty.',
    impact: {
      COMPLETED: 'Updates the points table and the knockout bracket',
      LIVE: 'Shows the live score',
      UPCOMING: 'Clears the score and result',
      CANCELLED: 'Counts as no result in the points table',
    } as Record<Phase, string>,
    cancel: 'Cancel',
    save: 'Save result',
    saving: 'Saving…',
    saved: 'Saved',
    savedToast: 'Result saved',
    failed: 'Could not save the result',
    fixErrors: 'Fix the highlighted fields first.',
  },
  bn: {
    title: 'ম্যাচের ফলাফল',
    desc: (home: string, away: string) => `${home} বনাম ${away}`,
    matchNo: (n: number) => `ম্যাচ ${n}`,
    home: 'হোম',
    away: 'অ্যাওয়ে',
    status: 'ম্যাচের অবস্থা',
    phase: { UPCOMING: 'আসন্ন', LIVE: 'লাইভ', COMPLETED: 'শেষ', CANCELLED: 'বাতিল' } as Record<Phase, string>,
    phaseHint: {
      UPCOMING: 'এখনো খেলা হয়নি। সেভ করলে স্কোর ও ফলাফল মুছে যাবে।',
      LIVE: 'শুধু লাইভ স্কোর — ম্যাচ শেষ হলে পয়েন্ট টেবিল আপডেট হবে।',
      COMPLETED: 'চূড়ান্ত ফলাফল। সেভ করলে পয়েন্ট টেবিল ও নকআউট ব্র্যাকেট আপডেট হবে।',
      CANCELLED: (pts: number) => `ফলাফল ছাড়া পরিত্যক্ত — দুই দলই ${pts} পয়েন্ট পাবে। তখনকার স্কোর দেওয়া ঐচ্ছিক।`,
    },
    postponed: 'স্থগিত',
    postponedHint: 'ফিকশ্চার তালিকায় স্থগিত দেখাবে।',
    needTeams: 'ফলাফল দেওয়ার আগে দুই দলই ঠিক থাকতে হবে।',
    clearsResult: 'এতে এখন সেভ করা ফলাফল মুছে যাবে।',
    resultType: 'ফলাফলের ধরন',
    rt: {
      NORMAL: 'সাধারণ',
      TIE: (cricket: boolean) => (cricket ? 'টাই' : 'ড্র'),
      NO_RESULT: 'ফলাফল নেই',
      WALKOVER: 'ওয়াকওভার',
      FORFEIT: 'ফোরফিট',
    },
    rtHint: {
      NORMAL: 'স্কোর দেখে বিজয়ী ঠিক হবে।',
      TIE: (ko: boolean, pts: number) => (ko ? 'নির্ধারিত সময়ে সমান — কে পরের রাউন্ডে গেল বেছে নিন।' : `সমান — দুই দলই ${pts} পয়েন্ট পাবে।`),
      NO_RESULT: (pts: number) => `নিষ্পত্তি হয়নি — দুই দলই ${pts} পয়েন্ট পাবে।`,
      WALKOVER: (pts: number) => `প্রতিপক্ষ আসেনি। বিজয়ী ${pts} পয়েন্ট পাবে; কোনো স্কোর থাকবে না।`,
      FORFEIT: (pts: number) => `প্রতিপক্ষ সরে গেছে বা বাদ পড়েছে। বিজয়ী ${pts} পয়েন্ট পাবে; স্কোর ঐচ্ছিক।`,
    },
    levelLeague: (cricket: boolean) => (cricket ? 'স্কোর সমান — এটি টাই হিসেবে সেভ হবে।' : 'স্কোর সমান — এটি ড্র হিসেবে সেভ হবে।'),
    scoreLabel: { CRICKET: 'রান', FOOTBALL: 'গোল', OTHER: 'স্কোর' } as Record<string, string>,
    optional: 'ঐচ্ছিক',
    wickets: 'উইকেট',
    overs: 'ওভার',
    oversPh: '19.4',
    maxOvers: (n: number) => `সর্বোচ্চ ${n}`,
    battedFirst: 'আগে ব্যাট',
    leading: 'এগিয়ে',
    winner: 'বিজয়ী',
    level: 'সমান',
    vs: 'বনাম',
    pickWinner: {
      awarded: 'জয় কে পাবে?',
      CRICKET: 'সুপার ওভারে কে জিতেছে?',
      FOOTBALL: 'টাইব্রেকারে কে জিতেছে?',
      OTHER: 'টাই-ব্রেকে কে জিতেছে?',
    } as Record<string, string>,
    markWinner: 'বিজয়ী',
    decrease: (name: string) => `${name}-এর স্কোর কমান`,
    increase: (name: string) => `${name}-এর স্কোর বাড়ান`,
    pom: 'ম্যাচ সেরা',
    pomHint: 'ঐচ্ছিক — দুই দলের স্কোয়াড থেকে।',
    pomSearch: 'খেলোয়াড় খুঁজুন',
    pomAll: 'দুই দল',
    pomEmpty: 'কোনো খেলোয়াড় মেলেনি',
    pomNoSquads: 'এখনো স্কোয়াড নেই — এই দলে খেলোয়াড় বিক্রি হলে এখানে দেখাবে।',
    change: 'বদলান',
    clear: 'সরান',
    note: 'ফলাফলের লেখা',
    noteOptional: 'ঐচ্ছিক',
    noteAuto: 'নিজে থেকে লেখা হবে:',
    notePh: 'খালি রাখলে নিজে থেকে লেখা হবে',
    noteCount: (n: number) => `${n}/160`,
    errScore: (max: number) => `0 থেকে ${max} পর্যন্ত পূর্ণসংখ্যা`,
    errScoreRequired: 'দুই দলের স্কোর দিন, অথবা অন্য ফলাফলের ধরন বেছে নিন।',
    errWickets: (max: number) => `0 থেকে ${max}`,
    errOvers: '19.4 এভাবে (দশমিকের পরে 0–5 বল)',
    errOversMax: (n: number) => `সর্বোচ্চ ${n} ওভার`,
    errTieLevel: 'ড্র / টাই হলে দুই স্কোর সমান হতে হবে, অথবা খালি রাখুন।',
    impact: {
      COMPLETED: 'পয়েন্ট টেবিল ও নকআউট ব্র্যাকেট আপডেট হবে',
      LIVE: 'লাইভ স্কোর দেখাবে',
      UPCOMING: 'স্কোর ও ফলাফল মুছে যাবে',
      CANCELLED: 'পয়েন্ট টেবিলে ফলাফল নেই হিসেবে গণ্য হবে',
    } as Record<Phase, string>,
    cancel: 'বাতিল',
    save: 'ফলাফল সেভ করুন',
    saving: 'সেভ হচ্ছে…',
    saved: 'সেভ হয়েছে',
    savedToast: 'ফলাফল সেভ হয়েছে',
    failed: 'ফলাফল সেভ করা যায়নি',
    fixErrors: 'আগে চিহ্নিত ঘরগুলো ঠিক করুন।',
  },
} satisfies Strings<ResultStrings>

type T = ResultStrings

const str = (v: number | null) => (v === null ? '' : String(v))
const phaseOf = (s: MatchStatus): Phase =>
  s === 'SCHEDULED' || s === 'POSTPONED' ? 'UPCOMING' : s === 'ABANDONED' ? 'CANCELLED' : (s as 'LIVE' | 'COMPLETED')

/** '' → null; a whole number in range → it; anything else → 'invalid'. */
function parseWhole(v: string, max: number): number | null | 'invalid' {
  const s = v.trim()
  if (s === '') return null
  if (!/^\d+$/.test(s)) return 'invalid'
  const n = Number(s)
  return n > max ? 'invalid' : n
}
const valueOf = (p: number | null | 'invalid') => (p === 'invalid' ? null : p)

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
  // While a save is in flight the dialog can't be dismissed (no half-saved state, no double submit).
  const [locked, setLocked] = useState(false)
  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && !locked && onClose()}>
      <DialogContent
        className={cn(
          'dark flex max-h-[min(94dvh,56rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden border-white/10 bg-[#0a1517] p-0 text-foreground shadow-2xl shadow-black/50 sm:max-w-[min(48rem,calc(100%-2rem))]',
          // Phones: a bottom sheet — full width, flush with the bottom edge, slides up.
          'max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[96dvh] max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:zoom-in-100',
          // Short landscape screens: use the whole height.
          '[@media(max-height:500px)]:max-h-[100dvh]',
          // The close button DialogContent renders: a 36px target in the corner.
          '[&>[data-slot=dialog-close]]:top-3.5 [&>[data-slot=dialog-close]]:right-3.5 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-9 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center [&>[data-slot=dialog-close]]:rounded-lg [&>[data-slot=dialog-close]]:hover:bg-white/10',
        )}
        onEscapeKeyDown={(e) => {
          // Mid-save, or Escape meant for an open list inside (it closes the list instead).
          const target = e.target as HTMLElement | null
          if (locked || target?.getAttribute('aria-expanded') === 'true') e.preventDefault()
        }}
      >
        {/* arena lighting, as on the live stage */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_10%_0%,rgba(45,212,191,0.13),transparent_60%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(245,158,11,0.07),transparent_70%)]"
          aria-hidden
        />
        {match ? <ResultForm key={match.id} data={data} match={match} onClose={onClose} onSaved={onSaved} onLock={setLocked} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ResultForm({
  data,
  match,
  onClose,
  onSaved,
  onLock,
}: {
  data: LeagueData
  match: MatchDTO
  onClose: () => void
  onSaved: () => void | Promise<void>
  onLock: (locked: boolean) => void
}) {
  const t = useStrings<ResultStrings>(STRINGS)
  const l = useLeagueLabels()
  const lang = useLang()
  const uid = useId()
  const sport = data.tournament.sport
  const cricket = sport === 'CRICKET'
  const teams = teamMap(data)
  const home = sideInfo(match, 'home', teams, l)
  const away = sideInfo(match, 'away', teams, l)
  const knockout = isKnockoutStage(match.stage)
  const teamsKnown = !!match.homeTeamId && !!match.awayTeamId
  const pts = data.settings.effectivePoints
  const maxScore = scoreLimit(sport)
  const allOut = data.settings.allOutWickets ?? 10
  const maxOvers = cricket ? data.settings.oversPerInnings : null

  // ---- state (same fields the API takes) ----
  const startPhase = phaseOf(match.status)
  const [phase, setPhase] = useState<Phase>(startPhase === 'UPCOMING' && teamsKnown ? 'COMPLETED' : startPhase)
  const [postponed, setPostponed] = useState(match.status === 'POSTPONED')
  const [resultType, setResultType] = useState<ResultType>(match.resultType ?? 'NORMAL')
  const [hs, setHs] = useState(str(match.homeScore))
  const [as, setAs] = useState(str(match.awayScore))
  const [hw, setHw] = useState(str(match.homeWickets))
  const [aw, setAw] = useState(str(match.awayWickets))
  const [ho, setHo] = useState(match.homeBalls === null ? '' : ballsToOvers(match.homeBalls))
  const [ao, setAo] = useState(match.awayBalls === null ? '' : ballsToOvers(match.awayBalls))
  const [battedFirst, setBattedFirst] = useState<'HOME' | 'AWAY' | null>(null)
  const [winner, setWinner] = useState<string | null>(match.winnerTeamId)
  const [pom, setPom] = useState<string | null>(match.playerOfMatchId)
  const [note, setNote] = useState(match.resultNote ?? '')
  const [noteTouched, setNoteTouched] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const inFlight = useRef(false)

  // Changing the result makes an automatic note stale: clear it unless typed by hand.
  const touch = <V,>(setter: (v: V) => void) => (v: V) => {
    setter(v)
    setServerError(null)
    if (!noteTouched) setNote('')
  }

  const status: MatchStatus =
    phase === 'UPCOMING' ? (postponed ? 'POSTPONED' : 'SCHEDULED') : phase === 'CANCELLED' ? 'ABANDONED' : phase
  const completed = phase === 'COMPLETED'
  const awarded = completed && isAwardedResult(resultType)
  const walkover = completed && resultType === 'WALKOVER'
  const showScores = phase === 'LIVE' || phase === 'CANCELLED' || (completed && !walkover)
  const scoresRequired = completed && resultType === 'NORMAL'
  const showCricketExtras = cricket && showScores

  // ---- parsing & validation ----
  const pHs = parseWhole(hs, maxScore)
  const pAs = parseWhole(as, maxScore)
  const pHw = parseWhole(hw, allOut)
  const pAw = parseWhole(aw, allOut)
  const ballsOf = (o: string) => (o.trim() === '' ? null : oversToBalls(o))
  const hb = ballsOf(ho)
  const ab = ballsOf(ao)
  const homeScore = valueOf(pHs)
  const awayScore = valueOf(pAs)
  const level = homeScore !== null && awayScore !== null && homeScore === awayScore
  const needWinner = completed && (awarded || (knockout && (resultType === 'TIE' || (resultType === 'NORMAL' && level))))

  const fieldErrors: Partial<Record<'hs' | 'as' | 'hw' | 'aw' | 'ho' | 'ao', string>> = {}
  if (showScores) {
    if (pHs === 'invalid') fieldErrors.hs = t.errScore(maxScore)
    if (pAs === 'invalid') fieldErrors.as = t.errScore(maxScore)
    if (scoresRequired && attempted) {
      if (pHs === null) fieldErrors.hs = t.errScoreRequired
      if (pAs === null) fieldErrors.as = t.errScoreRequired
    }
  }
  if (showCricketExtras) {
    if (pHw === 'invalid') fieldErrors.hw = t.errWickets(allOut)
    if (pAw === 'invalid') fieldErrors.aw = t.errWickets(allOut)
    for (const [key, raw, balls] of [['ho', ho, hb], ['ao', ao, ab]] as const) {
      if (raw.trim() && balls === null) fieldErrors[key] = t.errOvers
      else if (balls !== null && maxOvers && balls > maxOvers * 6) fieldErrors[key] = t.errOversMax(maxOvers)
    }
  }

  // What the server will store, from the same rules it runs.
  const resolved = completed && teamsKnown
    ? resolveResult({
        sport,
        knockout,
        resultType,
        homeTeamId: match.homeTeamId!,
        awayTeamId: match.awayTeamId!,
        homeScore: walkover ? null : homeScore,
        awayScore: walkover ? null : awayScore,
        winnerTeamId: needWinner ? winner : null,
        winnerSent: needWinner && !!winner,
      })
    : null
  let formError: string | null = null
  if (completed && !teamsKnown) formError = t.needTeams
  else if (completed && resultType === 'TIE' && homeScore !== null && awayScore !== null && homeScore !== awayScore) formError = t.errTieLevel
  else if (resolved && 'error' in resolved && attempted) formError = resultType === 'NORMAL' && (homeScore === null || awayScore === null) ? null : resolved.error
  const hasErrors = Object.keys(fieldErrors).length > 0 || (!!resolved && 'error' in resolved) || !!formError

  const winnerId = resolved && !('error' in resolved) ? resolved.winnerTeamId : null
  const winnerSide: Side | null = winnerId ? (winnerId === match.homeTeamId ? 'home' : 'away') : null
  const leaderSide: Side | null =
    homeScore !== null && awayScore !== null && homeScore !== awayScore ? (homeScore > awayScore ? 'home' : 'away') : null
  // Badge per card: the winner once completed; the leader while live.
  const badgeFor = (side: Side): 'winner' | 'leading' | 'level' | null => {
    if (completed) return winnerSide === side ? 'winner' : null
    if (phase === 'LIVE') return leaderSide === side ? 'leading' : level ? 'level' : null
    return null
  }

  // Auto note preview (the server writes the same text with the same function).
  const autoNote = (() => {
    if (phase === 'CANCELLED') return 'Match abandoned'
    if (!completed || !resolved || 'error' in resolved) return ''
    return describeResult({
      sport,
      stage: match.stage,
      homeName: home.name,
      awayName: away.name,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: walkover ? null : homeScore,
      awayScore: walkover ? null : awayScore,
      homeWickets: cricket ? valueOf(pHw) : null,
      awayWickets: cricket ? valueOf(pAw) : null,
      homeBalls: cricket ? hb : null,
      awayBalls: cricket ? ab : null,
      winnerTeamId: resolved.winnerTeamId,
      resultType: resolved.resultType,
      battedFirst: cricket && resultType === 'NORMAL' ? battedFirst : null,
      allOutWickets: allOut,
    })
  })()

  const resultTypes: ResultType[] = [
    'NORMAL',
    'TIE',
    ...(cricket || match.resultType === 'NO_RESULT' ? (['NO_RESULT'] as const) : []),
    'WALKOVER',
    'FORFEIT',
  ]
  const rtLabel = (r: ResultType) => (r === 'TIE' ? t.rt.TIE(cricket) : t.rt[r])
  const rtHint =
    resultType === 'NORMAL'
      ? t.rtHint.NORMAL
      : resultType === 'TIE'
        ? t.rtHint.TIE(knockout, pts.draw)
        : resultType === 'NO_RESULT'
          ? t.rtHint.NO_RESULT(pts.draw)
          : t.rtHint[resultType](pts.win)

  // ---- players for player of the match ----
  const pomPlayers = (() => {
    const out: PomPlayer[] = []
    for (const teamId of [match.homeTeamId, match.awayTeamId]) {
      if (!teamId) continue
      const team = teams.get(teamId)
      const squad = data.squads.find((s) => s.teamId === teamId)?.players ?? []
      for (const p of squad) out.push({ ...p, teamId, teamName: team?.name ?? '', teamColor: team?.color ?? null })
    }
    return out
  })()

  // ---- save ----
  async function save() {
    if (inFlight.current) return // a double click / double Enter sends once
    setAttempted(true)
    setServerError(null)
    if (hasErrors || (scoresRequired && (homeScore === null || awayScore === null))) {
      toast.error(t.fixErrors)
      return
    }
    inFlight.current = true
    onLock(true)
    setSaveState('saving')
    try {
      await apiPatch(`/api/matches/${match.id}`, {
        status,
        resultType: completed ? resultType : null,
        // A walkover records no score.
        homeScore: walkover ? null : homeScore,
        awayScore: walkover ? null : awayScore,
        ...(cricket
          ? {
              homeWickets: walkover ? null : valueOf(pHw),
              awayWickets: walkover ? null : valueOf(pAw),
              homeOvers: walkover ? null : ho.trim() || null,
              awayOvers: walkover ? null : ao.trim() || null,
            }
          : {}),
        winnerTeamId: needWinner && winner ? winner : null,
        playerOfMatchId: completed && !walkover && pom ? pom : null,
        resultNote: note.trim(),
        battedFirst: cricket && completed && resultType === 'NORMAL' ? battedFirst : null,
      })
      setSaveState('saved')
      toast.success(t.savedToast)
      await onSaved()
      onLock(false)
      onClose()
    } catch (e) {
      setSaveState('idle')
      setServerError(e instanceof Error ? e.message : t.failed)
      onLock(false)
      inFlight.current = false
    }
  }

  const busy = saveState !== 'idle'
  const stageBits = [
    l.matchNo(match.matchNumber),
    l.stage[match.stage] ?? match.stage,
    match.groupName ? l.group(match.groupName) : null,
    match.stage === 'LEAGUE' || match.stage === 'GROUP' ? l.round(match.round) : null,
  ].filter(Boolean) as string[]

  const cardProps = (side: Side) => {
    const info = side === 'home' ? home : away
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId
    return {
      side,
      name: info.name,
      team: info.team,
      sideLabel: side === 'home' ? t.home : t.away,
      badge: badgeFor(side),
      t,
      uid,
      busy,
      scoreLabel: t.scoreLabel[sport] ?? t.scoreLabel.OTHER,
      showScore: showScores,
      scoreOptional: showScores && !scoresRequired,
      score: side === 'home' ? hs : as,
      onScore: touch(side === 'home' ? setHs : setAs),
      scoreError: side === 'home' ? fieldErrors.hs : fieldErrors.as,
      maxScore,
      cricket: showCricketExtras,
      wickets: side === 'home' ? hw : aw,
      onWickets: touch(side === 'home' ? setHw : setAw),
      wicketsError: side === 'home' ? fieldErrors.hw : fieldErrors.aw,
      overs: side === 'home' ? ho : ao,
      onOvers: touch(side === 'home' ? setHo : setAo),
      oversError: side === 'home' ? fieldErrors.ho : fieldErrors.ao,
      maxOvers,
      battedFirst: cricket && completed && resultType === 'NORMAL' ? battedFirst === (side === 'home' ? 'HOME' : 'AWAY') : undefined,
      onBattedFirst: () => touch(setBattedFirst)(battedFirst === (side === 'home' ? 'HOME' : 'AWAY') ? null : side === 'home' ? 'HOME' : 'AWAY'),
      pickable: needWinner && !!teamId,
      picked: needWinner && !!teamId && winner === teamId,
      onPick: () => teamId && touch(setWinner)(teamId),
    }
  }

  return (
    <form
      className="relative flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {/* header */}
      <header className="border-b border-white/10 px-4 pb-3.5 pt-3 pr-14 sm:px-6 sm:pb-4 sm:pt-5">
        {/* bottom-sheet grabber (phones) */}
        <span className="mb-2.5 block h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200/80">
          {stageBits.map((bit, i) => (
            <span key={bit} className="flex items-center gap-2">
              {i > 0 ? <span className="h-1 w-1 rounded-full bg-white/25" aria-hidden /> : null}
              {bit}
            </span>
          ))}
        </p>
        <DialogTitle className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl">{t.title}</DialogTitle>
        <DialogDescription className="mt-1 flex min-w-0 items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex-wrap sm:text-sm">
          <span className="sr-only">{t.desc(home.name, away.name)}. </span>
          {match.scheduledAt ? (
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {formatDate(match.scheduledAt, true, lang)}
            </span>
          ) : null}
          {match.venue ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{match.venue}</span>
            </span>
          ) : null}
        </DialogDescription>
      </header>

      {/* body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
        {/* status */}
        <section aria-labelledby={`${uid}-status`}>
          <FieldLabel id={`${uid}-status`}>{t.status}</FieldLabel>
          <Segmented<Phase>
            label={t.status}
            value={phase}
            disabled={busy}
            onChange={(v) => touch(setPhase)(v)}
            className="grid-cols-4"
            options={[
              { value: 'UPCOMING', label: t.phase.UPCOMING, icon: CalendarClock },
              { value: 'LIVE', label: t.phase.LIVE, icon: Radio, tone: 'live' },
              { value: 'COMPLETED', label: t.phase.COMPLETED, icon: CheckCircle2, disabled: !teamsKnown },
              { value: 'CANCELLED', label: t.phase.CANCELLED, icon: Ban, tone: 'warn' },
            ]}
          />
          {/* Phones skip the purely informational line (the footer says it); warnings always show. */}
          <p className={cn('mt-2 text-xs leading-relaxed text-muted-foreground text-pretty', teamsKnown && phase !== 'CANCELLED' && 'max-sm:hidden')}>
            {!teamsKnown ? t.needTeams : phase === 'CANCELLED' ? t.phaseHint.CANCELLED(pts.draw) : t.phaseHint[phase]}
          </p>
          {phase === 'UPCOMING' ? (
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.05]">
              <span>
                <span className="block text-sm font-semibold">{t.postponed}</span>
                <span className="block text-xs text-muted-foreground">{t.postponedHint}</span>
              </span>
              <Switch checked={postponed} onCheckedChange={setPostponed} disabled={busy} aria-label={t.postponed} />
            </label>
          ) : null}
          {(phase === 'UPCOMING' || phase === 'LIVE') && match.status === 'COMPLETED' ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-300/20">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {t.clearsResult}
            </p>
          ) : null}
        </section>

        {/* result type */}
        {completed && teamsKnown ? (
          <section aria-labelledby={`${uid}-rt`}>
            <FieldLabel id={`${uid}-rt`}>{t.resultType}</FieldLabel>
            <Segmented<ResultType>
              label={t.resultType}
              value={resultType}
              disabled={busy}
              onChange={(v) => touch(setResultType)(v)}
              className={resultTypes.length === 5 ? 'grid-cols-3 min-[380px]:grid-cols-5' : 'grid-cols-4'}
              options={resultTypes.map((r) => ({ value: r, label: rtLabel(r) }))}
            />
            <p className={cn('mt-2 text-xs leading-relaxed text-muted-foreground text-pretty', resultType === 'NORMAL' && 'max-sm:hidden')}>{rtHint}</p>
          </section>
        ) : null}

        {/* scoreboard */}
        {phase !== 'UPCOMING' ? (
          <section aria-label={t.desc(home.name, away.name)}>
            {needWinner ? (
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Crown className="h-4 w-4" aria-hidden />
                {awarded ? t.pickWinner.awarded : (t.pickWinner[sport] ?? t.pickWinner.OTHER)}
              </p>
            ) : null}
            <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
              <TeamCard {...cardProps('home')} />
              <div className="flex items-center gap-3 sm:flex-col sm:justify-center" aria-hidden>
                <span className="h-px flex-1 bg-white/10 sm:h-auto sm:w-px" />
                <span className="font-mono text-xs font-black tracking-[0.2em] text-muted-foreground">{t.vs}</span>
                <span className="h-px flex-1 bg-white/10 sm:h-auto sm:w-px" />
              </div>
              <TeamCard {...cardProps('away')} />
            </div>
            {completed && resultType === 'NORMAL' && level && !knockout ? (
              <p className="mt-3 text-xs text-muted-foreground">{t.levelLeague(cricket)}</p>
            ) : null}
            {cricket && maxOvers && showScores ? (
              <p className="mt-2 text-xs text-muted-foreground">{t.maxOvers(maxOvers)} {t.overs.toLowerCase()}</p>
            ) : null}
          </section>
        ) : null}

        {formError ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200 ring-1 ring-rose-400/25">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {formError}
          </p>
        ) : null}

        {/* player of the match */}
        {completed && teamsKnown && !walkover ? (
          <section aria-labelledby={`${uid}-pom`}>
            <FieldLabel id={`${uid}-pom`} hint={t.pomHint}>
              <Star className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-amber-300" aria-hidden />
              {t.pom}
            </FieldLabel>
            <PlayerPicker
              t={t}
              players={pomPlayers}
              value={pom}
              onChange={setPom}
              disabled={busy}
              teams={[match.homeTeamId, match.awayTeamId].map((id) => (id ? teams.get(id) : undefined)).filter((x): x is LeagueTeamDTO => !!x)}
              labelledBy={`${uid}-pom`}
            />
          </section>
        ) : null}

        {/* result note */}
        {completed || phase === 'CANCELLED' ? (
          <Collapsible open={noteOpen || !!note} onOpenChange={setNoteOpen}>
            <CollapsibleTrigger
              className="group flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
              disabled={busy}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <NotebookPen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {t.note} <span className="font-normal text-muted-foreground">· {t.noteOptional}</span>
                  </span>
                  {!note && autoNote ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.noteAuto} <span className="text-foreground/85">“{autoNote}”</span>
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Input
                id={`${uid}-note`}
                aria-label={t.note}
                maxLength={160}
                placeholder={autoNote || t.notePh}
                value={note}
                disabled={busy}
                className="h-11 border-white/10 bg-black/30"
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteTouched(true)
                }}
              />
              <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
                <span>{t.notePh}</span>
                <span className="tabular-nums">{t.noteCount(note.length)}</span>
              </p>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      {/* footer — always visible */}
      {/* Bottom padding clears the iPhone home indicator when the sheet sits on the screen edge. */}
      <footer className="border-t border-white/10 bg-[#0a1517]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-[#0a1517]/80 sm:px-6 sm:pb-3">
        {serverError ? (
          <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/25">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {serverError}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-[11px] text-muted-foreground sm:text-left sm:text-xs">{t.impact[phase]}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="h-11 flex-1 sm:flex-none" disabled={busy} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              className={cn(
                'h-11 flex-[2] px-6 font-bold transition-[transform,background-color] active:scale-[0.98] sm:flex-none',
                saveState === 'saved' && 'bg-emerald-400 text-emerald-950 hover:bg-emerald-400',
              )}
              disabled={busy}
              aria-live="polite"
            >
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> {t.saving}
                </>
              ) : saveState === 'saved' ? (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden /> {t.saved}
                </>
              ) : (
                t.save
              )}
            </Button>
          </div>
        </div>
      </footer>
    </form>
  )
}

/* ------------------------------------------------------------------ parts */

function FieldLabel({ id, hint, children }: { id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h3 id={id} className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </h3>
      {hint ? <span className="text-xs text-muted-foreground/80 max-sm:hidden">{hint}</span> : null}
    </div>
  )
}

interface SegmentedOption<V extends string> {
  value: V
  label: string
  icon?: ComponentType<{ className?: string }>
  disabled?: boolean
  tone?: 'live' | 'warn'
}

/** A radio group drawn as one segmented control (arrow keys move, like native radios). */
function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string
  value: V
  options: SegmentedOption<V>[]
  onChange: (v: V) => void
  disabled?: boolean
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = options.filter((o) => !o.disabled)
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const at = enabled.findIndex((o) => o.value === options[i].value)
    const next = enabled[(at + dir + enabled.length) % enabled.length]
    onChange(next.value)
    refs.current[options.indexOf(next)]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/10', className)}>
      {options.map((o, i) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200',
              // Phones: every option stays on one row — icon over a small label.
              'max-sm:flex-col max-sm:gap-1 max-sm:px-1 max-sm:py-1.5 max-sm:text-[11px] max-sm:leading-tight max-sm:text-balance',
              'focus-visible:outline-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? cn(
                    'bg-white/[0.09] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1',
                    o.tone === 'live' ? 'ring-rose-400/40' : o.tone === 'warn' ? 'ring-amber-300/35' : 'ring-teal-300/40',
                  )
                : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
            )}
          >
            {o.tone === 'live' && active ? (
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
            ) : Icon ? (
              <Icon className={cn('h-4 w-4', active && (o.tone === 'warn' ? 'text-amber-300' : 'text-teal-300'))} />
            ) : null}
            <span className="text-center sm:truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface TeamCardProps {
  side: Side
  name: string
  team: LeagueTeamDTO | null
  sideLabel: string
  badge: 'winner' | 'leading' | 'level' | null
  t: T
  uid: string
  busy: boolean
  scoreLabel: string
  showScore: boolean
  scoreOptional: boolean
  score: string
  onScore: (v: string) => void
  scoreError?: string
  maxScore: number
  cricket: boolean
  wickets: string
  onWickets: (v: string) => void
  wicketsError?: string
  overs: string
  onOvers: (v: string) => void
  oversError?: string
  maxOvers: number | null
  battedFirst?: boolean
  onBattedFirst: () => void
  pickable: boolean
  picked: boolean
  onPick: () => void
}

function TeamCard(p: TeamCardProps) {
  const color = p.team?.color ?? '#2dd4bf'
  const highlighted = p.badge === 'winner' || p.badge === 'leading'
  const scoreId = `${p.uid}-${p.side}-score`
  const step = (d: number) => {
    const n = /^\d+$/.test(p.score.trim()) ? Number(p.score) : 0
    p.onScore(String(Math.min(p.maxScore, Math.max(0, n + d))))
  }
  return (
    <article
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white/[0.035] p-3.5 ring-1 ring-white/10 transition-[box-shadow,background-color] duration-300 sm:p-5',
        highlighted && 'bg-white/[0.055]',
      )}
      style={highlighted ? { boxShadow: `0 0 0 1.5px ${color}, 0 18px 48px -20px ${color}` } : undefined}
    >
      {/* team colour edge */}
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} aria-hidden />

      {/* Phones: one scoreboard row — team on the left, score stepper on the right.
          Larger screens: team on top, a big score underneath. */}
      <div className="max-sm:min-[380px]:flex max-sm:min-[380px]:items-center max-sm:min-[380px]:gap-3">
        <div className="flex min-w-0 items-center gap-3 max-sm:min-[380px]:flex-1">
          <TeamAvatar
            name={p.name}
            color={p.team?.color}
            logoUrl={p.team?.logoUrl}
            className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-white/15 sm:h-11 sm:w-11 [&>*]:rounded-[inherit]"
          />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{p.sideLabel}</span>
              {p.badge ? (
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1',
                    p.badge === 'winner' && 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
                    p.badge === 'leading' && 'bg-teal-400/15 text-teal-200 ring-teal-300/30',
                    p.badge === 'level' && 'bg-white/5 text-muted-foreground ring-white/10',
                  )}
                >
                  {p.badge === 'winner' ? <Crown className="h-3 w-3" aria-hidden /> : null}
                  {p.badge === 'winner' ? p.t.winner : p.badge === 'leading' ? p.t.leading : p.t.level}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-tight sm:truncate sm:text-base" title={p.name}>
              {p.name}
            </p>
          </div>
        </div>

        {p.showScore ? (
          <div className="mt-3 max-sm:min-[380px]:mt-0 max-sm:min-[380px]:w-[9.75rem] max-sm:min-[380px]:shrink-0 sm:mt-4">
            <label htmlFor={scoreId} className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-muted-foreground max-sm:min-[380px]:sr-only">
              <span>{p.scoreLabel}</span>
              {p.scoreOptional ? <span className="text-[11px] text-muted-foreground/70">{p.t.optional}</span> : null}
            </label>
            <div className="flex items-stretch gap-1.5 sm:gap-2">
            <StepButton label={p.t.decrease(p.name)} onClick={() => step(-1)} disabled={p.busy} icon={Minus} />
            <input
              id={scoreId}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={5}
              placeholder="–"
              value={p.score}
              disabled={p.busy}
              onChange={(e) => p.onScore(e.target.value.replace(/[^\d]/g, ''))}
              aria-invalid={!!p.scoreError}
              aria-describedby={p.scoreError ? `${scoreId}-err` : undefined}
              className={cn(
                'h-12 w-full min-w-0 rounded-xl bg-black/35 text-center font-mono text-2xl font-black tabular-nums tracking-tight text-foreground ring-1 ring-white/10 transition-[box-shadow,background-color] placeholder:text-white/15 hover:bg-black/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-60 sm:h-[4.5rem] sm:text-5xl',
                p.scoreError && 'ring-2 ring-rose-400/70 focus-visible:ring-rose-400',
              )}
            />
            <StepButton label={p.t.increase(p.name)} onClick={() => step(1)} disabled={p.busy} icon={Plus} />
            </div>
          </div>
        ) : null}
      </div>

      {p.showScore ? (
        <div>
          {p.scoreError ? (
            <p id={`${scoreId}-err`} className="mt-2 text-xs text-rose-300 max-sm:text-right">
              {p.scoreError}
            </p>
          ) : null}

          {p.cricket ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SmallField
                id={`${p.uid}-${p.side}-w`}
                label={p.t.wickets}
                value={p.wickets}
                onChange={(v) => p.onWickets(v.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                maxLength={2}
                error={p.wicketsError}
                disabled={p.busy}
              />
              <SmallField
                id={`${p.uid}-${p.side}-o`}
                label={p.t.overs}
                value={p.overs}
                onChange={(v) => p.onOvers(v.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                maxLength={5}
                placeholder={p.t.oversPh}
                error={p.oversError}
                disabled={p.busy}
              />
            </div>
          ) : null}

          {p.battedFirst !== undefined ? (
            <button
              type="button"
              aria-pressed={p.battedFirst}
              onClick={p.onBattedFirst}
              disabled={p.busy}
              className={cn(
                'mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-300',
                p.battedFirst ? 'bg-teal-400/15 text-teal-100 ring-teal-300/40' : 'text-muted-foreground ring-white/10 hover:bg-white/5 hover:text-foreground',
              )}
            >
              {p.battedFirst ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              {p.t.battedFirst}
            </button>
          ) : null}
        </div>
      ) : null}

      {p.pickable ? (
        <button
          type="button"
          role="radio"
          aria-checked={p.picked}
          onClick={p.onPick}
          disabled={p.busy}
          className={cn(
            'mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold sm:mt-4 ring-1 transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:scale-[0.99]',
            p.picked
              ? 'bg-amber-400 text-amber-950 ring-amber-300 hover:bg-amber-300'
              : 'bg-white/[0.03] text-foreground/85 ring-white/15 hover:bg-white/[0.07] hover:ring-amber-300/40',
          )}
        >
          <Crown className="h-4 w-4" aria-hidden />
          {p.t.markWinner}
        </button>
      ) : null}
    </article>
  )
}

function StepButton({ label, onClick, disabled, icon: Icon }: { label: string; onClick: () => void; disabled?: boolean; icon: ComponentType<{ className?: string }> }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-muted-foreground ring-1 ring-white/10 transition-[background-color,color,transform] duration-150 hover:bg-white/[0.09] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-300 active:scale-95 disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function SmallField({
  id,
  label,
  error,
  ...input
}: {
  id: string
  label: string
  error?: string
  value: string
  onChange: (v: string) => void
  inputMode: 'numeric' | 'decimal'
  maxLength: number
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        autoComplete="off"
        inputMode={input.inputMode}
        maxLength={input.maxLength}
        placeholder={input.placeholder ?? '–'}
        value={input.value}
        disabled={input.disabled}
        onChange={(e) => input.onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          'h-11 w-full rounded-lg bg-black/30 px-3 text-center font-mono text-base font-bold tabular-nums ring-1 ring-white/10 transition-[box-shadow] placeholder:text-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-60',
          error && 'ring-2 ring-rose-400/70',
        )}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-[11px] leading-tight text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------ player of the match */

interface PomPlayer {
  id: string
  name: string
  role: string
  photoUrl: string | null
  teamId: string
  teamName: string
  teamColor: string | null
}

/**
 * Searchable list of the two squads (inline, so it never fights the dialog for
 * focus or layering). Arrow keys move, Enter picks, Escape closes.
 */
function PlayerPicker({
  t,
  players,
  teams,
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  t: T
  players: PomPlayer[]
  teams: LeagueTeamDTO[]
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  labelledBy: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = value ? players.find((p) => p.id === value) : undefined

  const q = query.trim().toLowerCase()
  const filtered = players.filter((p) => (!teamFilter || p.teamId === teamFilter) && (!q || p.name.toLowerCase().includes(q)))

  if (players.length === 0) {
    return <p className="rounded-xl bg-white/[0.03] px-3.5 py-3 text-sm text-muted-foreground ring-1 ring-white/10">{t.pomNoSquads}</p>
  }

  if (selected && !open) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-amber-400/[0.07] px-3.5 py-3 ring-1 ring-amber-300/25">
        <PlayerAvatar name={selected.name} photoUrl={selected.photoUrl} className="h-10 w-10 rounded-lg [&>*]:rounded-[inherit]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{selected.name}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selected.teamColor ?? '#2dd4bf' }} aria-hidden />
            {selected.teamName} · <PlayerRole role={selected.role} />
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          disabled={disabled}
          onClick={() => {
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
        >
          {t.change}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={t.clear} disabled={disabled} onClick={() => onChange(null)}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    )
  }

  const pick = (p: PomPlayer) => {
    onChange(p.id)
    setOpen(false)
    setQuery('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(filtered.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted player instead of submitting the form.
      if (open && filtered[active]) {
        e.preventDefault()
        pick(filtered[active])
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation() // close the list, not the dialog
      setOpen(false)
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10">
      <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-labelledby={labelledBy}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
            placeholder={t.pomSearch}
            value={query}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setOpen(true)
            }}
            onKeyDown={onKey}
            className="h-11 w-full rounded-lg bg-black/30 pl-9 pr-3 text-sm ring-1 ring-white/10 transition-[box-shadow] placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t.pomAll}>
          {[{ id: null as string | null, name: t.pomAll, color: null as string | null }, ...teams.map((tm) => ({ id: tm.id, name: tm.name, color: tm.color }))].map((f) => (
            <button
              key={f.id ?? 'all'}
              type="button"
              aria-pressed={teamFilter === f.id}
              disabled={disabled}
              onClick={() => {
                setTeamFilter(f.id)
                setActive(0)
                setOpen(true)
              }}
              className={cn(
                'inline-flex h-9 max-w-[10rem] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-teal-300',
                teamFilter === f.id ? 'bg-white/10 text-foreground ring-white/20' : 'text-muted-foreground ring-white/10 hover:bg-white/5 hover:text-foreground',
              )}
            >
              {f.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: f.color }} aria-hidden /> : null}
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
      {open ? (
        <ul id={listId} role="listbox" aria-labelledby={labelledBy} className="max-h-60 overflow-y-auto overscroll-contain border-t border-white/10 p-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t.pomEmpty}</li>
          ) : (
            filtered.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={p.id === value}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 transition-colors',
                  i === active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                )}
              >
                <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-8 w-8 rounded-md [&>*]:rounded-[inherit]" fallbackClassName="text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <PlayerRole role={p.role} />
                  </span>
                </span>
                <span className="inline-flex max-w-[40%] shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.teamColor ?? '#2dd4bf' }} aria-hidden />
                  <span className="truncate">{p.teamName}</span>
                </span>
                {p.id === value ? <Check className="h-4 w-4 shrink-0 text-amber-300" aria-hidden /> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
