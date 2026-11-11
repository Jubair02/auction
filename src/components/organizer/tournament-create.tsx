'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Crown,
  Gavel,
  Goal,
  ListChecks,
  Loader2,
  MapPin,
  Medal,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { BackButton } from '@/components/shared/back-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost, ApiError } from '@/lib/api'
import { invalidateCached, seedCached } from '@/lib/api-cache'
import { TOURNAMENTS_URL, preloadTournamentPage, tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate } from '@/lib/format'
import { DEFAULT_CATEGORY_BASE_PRICES, isSport, rolesForSport, sportLabel, type Sport, type TournamentDetail } from '@/lib/types'
import {
  EMPTY_OTHER_SPORT,
  OtherSportFields,
  otherSportError,
  otherSportPayload,
  type OtherSportValue,
} from '@/components/organizer/other-sport-fields'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { usePlanNumbers } from '@/lib/plan-numbers'
import { TOURNAMENT_TYPES, tournamentTypeLabel } from '@/lib/tournament-types'

const SPORT_CHOICES: { value: Sport; icon: LucideIcon }[] = [
  { value: 'CRICKET', icon: Trophy },
  { value: 'FOOTBALL', icon: Goal },
  { value: 'OTHER', icon: Medal },
]

const STEPS = [
  { n: 1, icon: ClipboardList },
  { n: 2, icon: Gavel },
  { n: 3, icon: Check },
]

const STRINGS = {
  en: {
    sportChoices: {
      CRICKET: { label: 'Cricket', hint: 'Batsman · Bowler · All-rounder · WK' },
      FOOTBALL: { label: 'Football', hint: 'GK · Defender · Midfielder · Forward' },
      OTHER: { label: 'Others', hint: 'Kabaddi, badminton, volleyball…' },
    },
    steps: ['Basics', 'Auction mode', 'Review'],
    nameSportRequired: 'Tournament name (2+ characters) and sport are required.',
    basePriceRequired: 'Enter a base price above ৳0 for normal mode.',
    created: 'Tournament created — now add players and teams!',
    createFailed: 'Could not create tournament',
    title: 'Create tournament',
    intro: 'Three quick steps and your auction shell is ready.',
    progress: 'Progress',
    tournamentName: 'Tournament name',
    namePlaceholder: 'e.g. Mirpur Corporate League 2026',
    sport: 'Sport',
    tournamentType: 'Tournament type',
    chooseType: 'Choose a type (optional)',
    location: 'Location',
    locationPlaceholder: 'e.g. Mirpur Indoor Stadium, Dhaka',
    startDate: 'Start date',
    auctionDateTime: 'Auction date & time',
    description: 'Description',
    descPlaceholder: 'Anything teams should know — format, rules, entry fee…',
    categoryBased: 'Category-Based',
    categoryDesc:
      'Players are graded into categories A–E, each with its own base price. Best for cricket-style auctions where stars and newcomers cost differently.',
    recommended: 'Recommended default',
    normal: 'Normal',
    normalDesc: 'Every player starts from one base price. Simple and fast — great for football and small friendly auctions.',
    defaultPrices: 'Default base prices per category',
    defaultPricesHint:
      'One tap applies these when you add a player. Every player’s base price stays editable individually in the Players tab.',
    basePriceEvery: 'Base price for every player (৳)',
    basePriceHint: 'First bid on any player must be at least this amount.',
    current: (amount: string) => `Current: ${amount}`,
    reviewCreate: 'Review & create',
    rowName: 'Name',
    rowSport: 'Sport',
    rowRoles: 'Player roles',
    rowTeamSize: 'Team size',
    perTeam: (n: string) => `${n} per team`,
    onField: (n: string) => `${n} on field`,
    rowType: 'Type',
    rowLocation: 'Location',
    rowStart: 'Start date',
    rowAuctionAt: 'Auction at',
    rowMode: 'Auction mode',
    categoryModeValue: 'Category-Based (A–E)',
    rowBasePrice: 'Base price',
    setPerCategory: 'Set per category when adding players',
    rowDescription: 'Description',
    afterCreate: 'After creating, you’ll land in the tournament workspace to add players and teams.',
    planTitle: 'Starts on the Free plan',
    planNote: (teams: number, players: number, price: string) =>
      `Up to ${teams} teams and ${players} players. Need more? Upgrade this tournament to Pro for ${price} (one-time) from its Overview tab — any time before the auction.`,
    back: 'Back',
    cancel: 'Cancel',
    next: 'Next',
    createTournament: 'Create tournament',
    changeLater: 'You can change most details later from the tournament workspace.',
  },
  bn: {
    sportChoices: {
      CRICKET: { label: 'ক্রিকেট', hint: 'ব্যাটসম্যান · বোলার · অলরাউন্ডার · উইকেটকিপার' },
      FOOTBALL: { label: 'ফুটবল', hint: 'গোলকিপার · ডিফেন্ডার · মিডফিল্ডার · ফরোয়ার্ড' },
      OTHER: { label: 'অন্যান্য', hint: 'কাবাডি, ব্যাডমিন্টন, ভলিবল…' },
    },
    steps: ['মূল তথ্য', 'নিলামের ধরন', 'যাচাই'],
    nameSportRequired: 'টুর্নামেন্টের নাম (কমপক্ষে 2 অক্ষর) আর খেলা দিতে হবে।',
    basePriceRequired: 'নরমাল মোডের জন্য ৳0-এর বেশি বেস প্রাইস দিন।',
    created: 'টুর্নামেন্ট তৈরি হয়েছে — এবার খেলোয়াড় আর দল যোগ করুন!',
    createFailed: 'টুর্নামেন্ট তৈরি করা যায়নি',
    title: 'টুর্নামেন্ট তৈরি করুন',
    intro: 'তিনটি ছোট ধাপ, তারপরই আপনার নিলাম প্রস্তুত।',
    progress: 'অগ্রগতি',
    tournamentName: 'টুর্নামেন্টের নাম',
    namePlaceholder: 'যেমন: Mirpur Corporate League 2026',
    sport: 'খেলা',
    tournamentType: 'টুর্নামেন্টের ধরন',
    chooseType: 'ধরন বেছে নিন (ঐচ্ছিক)',
    location: 'স্থান',
    locationPlaceholder: 'যেমন: মিরপুর ইনডোর স্টেডিয়াম, ঢাকা',
    startDate: 'শুরুর তারিখ',
    auctionDateTime: 'নিলামের তারিখ ও সময়',
    description: 'বিবরণ',
    descPlaceholder: 'দলগুলোর যা জানা দরকার — ফরম্যাট, নিয়ম, এন্ট্রি ফি…',
    categoryBased: 'ক্যাটাগরি ভিত্তিক',
    categoryDesc:
      'খেলোয়াড়দের A–E ক্যাটাগরিতে ভাগ করা হয়, প্রতিটির আলাদা বেস প্রাইস। ক্রিকেট ধাঁচের নিলামের জন্য সেরা, যেখানে তারকা আর নতুনদের দাম আলাদা।',
    recommended: 'প্রস্তাবিত',
    normal: 'নরমাল',
    normalDesc: 'সব খেলোয়াড় একই বেস প্রাইস থেকে শুরু। সহজ আর দ্রুত — ফুটবল আর ছোট ফ্রেন্ডলি নিলামের জন্য দারুণ।',
    defaultPrices: 'ক্যাটাগরি অনুযায়ী ডিফল্ট বেস প্রাইস',
    defaultPricesHint:
      'খেলোয়াড় যোগ করার সময় এক ট্যাপেই এগুলো বসে যাবে। প্রতিটি খেলোয়াড়ের বেস প্রাইস খেলোয়াড় ট্যাবে আলাদাভাবে বদলানো যাবে।',
    basePriceEvery: 'সব খেলোয়াড়ের বেস প্রাইস (৳)',
    basePriceHint: 'যেকোনো খেলোয়াড়ের প্রথম বিড অন্তত এই অঙ্কের হতে হবে।',
    current: (amount: string) => `এখন: ${amount}`,
    reviewCreate: 'যাচাই করে তৈরি করুন',
    rowName: 'নাম',
    rowSport: 'খেলা',
    rowRoles: 'খেলোয়াড়ের রোল',
    rowTeamSize: 'দলের আকার',
    perTeam: (n: string) => `প্রতি দলে ${n} জন`,
    onField: (n: string) => `মাঠে ${n} জন`,
    rowType: 'ধরন',
    rowLocation: 'স্থান',
    rowStart: 'শুরুর তারিখ',
    rowAuctionAt: 'নিলামের সময়',
    rowMode: 'নিলামের ধরন',
    categoryModeValue: 'ক্যাটাগরি ভিত্তিক (A–E)',
    rowBasePrice: 'বেস প্রাইস',
    setPerCategory: 'খেলোয়াড় যোগ করার সময় ক্যাটাগরি অনুযায়ী ঠিক হবে',
    rowDescription: 'বিবরণ',
    afterCreate: 'তৈরির পর টুর্নামেন্ট পেজে যাবেন, সেখানে খেলোয়াড় আর দল যোগ করবেন।',
    planTitle: 'ফ্রি প্ল্যানে শুরু হবে',
    planNote: (teams: number, players: number, price: string) =>
      `সর্বোচ্চ ${teams}টি দল ও ${players} জন খেলোয়াড়। আরও লাগলে টুর্নামেন্টের ওভারভিউ ট্যাব থেকে ${price}-এ (এককালীন) Pro-তে আপগ্রেড করুন — নিলামের আগে যেকোনো সময়।`,
    back: 'পেছনে',
    cancel: 'বাতিল',
    next: 'পরের ধাপ',
    createTournament: 'টুর্নামেন্ট তৈরি করুন',
    changeLater: 'বেশিরভাগ তথ্য পরে টুর্নামেন্ট পেজ থেকে বদলানো যাবে।',
  },
} satisfies Strings<{
  sportChoices: Record<Sport, { label: string; hint: string }>
  steps: string[]
  nameSportRequired: string
  basePriceRequired: string
  created: string
  createFailed: string
  title: string
  intro: string
  progress: string
  tournamentName: string
  namePlaceholder: string
  sport: string
  tournamentType: string
  chooseType: string
  location: string
  locationPlaceholder: string
  startDate: string
  auctionDateTime: string
  description: string
  descPlaceholder: string
  categoryBased: string
  categoryDesc: string
  recommended: string
  normal: string
  normalDesc: string
  defaultPrices: string
  defaultPricesHint: string
  basePriceEvery: string
  basePriceHint: string
  current: (amount: string) => string
  reviewCreate: string
  rowName: string
  rowSport: string
  rowRoles: string
  rowTeamSize: string
  perTeam: (n: string) => string
  onField: (n: string) => string
  rowType: string
  rowLocation: string
  rowStart: string
  rowAuctionAt: string
  rowMode: string
  categoryModeValue: string
  rowBasePrice: string
  setPerCategory: string
  rowDescription: string
  afterCreate: string
  planTitle: string
  planNote: (teams: number, players: number, price: string) => string
  back: string
  cancel: string
  next: string
  createTournament: string
  changeLater: string
}>

// The category base prices the Players tab offers as one-tap quick picks.
// They are platform defaults, not per-tournament settings — each player's base
// price is still editable individually when you add or edit them.
const SUGGESTED_CATEGORY_PRICES = { ...DEFAULT_CATEGORY_BASE_PRICES }

// An unfinished wizard survives leaving the page (or a reload) for the rest of
// the tab's session; Create and Cancel discard it. Only what the form shows.
const DRAFT_KEY = 'ng_tournament_create_draft'

interface Draft {
  step: number
  name: string
  sport: Sport | ''
  other: OtherSportValue
  tournamentType: string
  location: string
  description: string
  startDate: string
  auctionAt: string
  auctionMode: 'CATEGORY' | 'NORMAL'
  basePrice: string
}

const EMPTY_DRAFT: Draft = {
  step: 1,
  name: '',
  sport: '',
  other: EMPTY_OTHER_SPORT,
  tournamentType: '',
  location: '',
  description: '',
  startDate: '',
  auctionAt: '',
  auctionMode: 'CATEGORY',
  basePrice: '10000',
}

function loadDraft(): Draft {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY_DRAFT
    const d = raw as Record<string, unknown>
    const o = (d.other && typeof d.other === 'object' ? d.other : {}) as Record<string, unknown>
    const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
    return {
      step: d.step === 2 || d.step === 3 ? d.step : 1,
      name: text(d.name),
      sport: isSport(d.sport) ? d.sport : '',
      other: {
        sportName: text(o.sportName),
        playerRoles: Array.isArray(o.playerRoles) ? o.playerRoles.filter((r): r is string => typeof r === 'string') : [],
        playersPerTeam: text(o.playersPerTeam),
        playersOnField: text(o.playersOnField),
      },
      tournamentType: text(d.tournamentType),
      location: text(d.location),
      description: text(d.description),
      startDate: text(d.startDate),
      auctionAt: text(d.auctionAt),
      auctionMode: d.auctionMode === 'NORMAL' ? 'NORMAL' : 'CATEGORY',
      basePrice: text(d.basePrice, EMPTY_DRAFT.basePrice),
    }
  } catch {
    return EMPTY_DRAFT
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // storage unavailable — nothing was saved
  }
}

export default function TournamentCreate() {
  const lang = useLang()
  const s = useStrings(STRINGS)
  const plans = usePlanNumbers()
  // Signed-in pages render after mount, so the tab's storage can be read here.
  const [draft] = useState(loadDraft)
  // A restored draft reopens on its step — unless step 1 is somehow incomplete.
  const [step, setStep] = useState(() => (draft.name.trim().length >= 2 && draft.sport ? draft.step : 1))

  // Creating always ends on the new tournament's Manage page: fetch its code
  // while the organizer fills in the form, not after they click Create.
  useEffect(() => preloadTournamentPage(), [])

  // Step 1 — basics
  const [name, setName] = useState(draft.name)
  const [sport, setSport] = useState<Sport | ''>(draft.sport)
  const [other, setOther] = useState<OtherSportValue>(draft.other)
  const [tournamentType, setTournamentType] = useState(draft.tournamentType)
  const [location, setLocation] = useState(draft.location)
  const [description, setDescription] = useState(draft.description)
  const [startDate, setStartDate] = useState(draft.startDate) // datetime-local
  const [auctionAt, setAuctionAt] = useState(draft.auctionAt) // datetime-local

  // Step 2 — auction mode
  const [auctionMode, setAuctionMode] = useState<'CATEGORY' | 'NORMAL'>(draft.auctionMode)
  const [basePrice, setBasePrice] = useState(draft.basePrice)

  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const current: Draft = { step, name, sport, other, tournamentType, location, description, startDate, auctionAt, auctionMode, basePrice }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(current))
    } catch {
      // storage full or blocked — the form still works, it just isn't kept
    }
  }, [step, name, sport, other, tournamentType, location, description, startDate, auctionAt, auctionMode, basePrice])

  const otherError = sport === 'OTHER' ? otherSportError(other, lang) : null
  const step1Valid = name.trim().length >= 2 && isSport(sport) && !otherError

  const parsedBasePrice = useMemo(() => {
    const n = parseInt(basePrice, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [basePrice])

  const step2Valid = auctionMode === 'CATEGORY' || parsedBasePrice > 0

  const next = () => {
    if (step === 1 && !step1Valid) {
      toast.error(otherError ?? s.nameSportRequired)
      return
    }
    if (step === 2 && !step2Valid) {
      toast.error(s.basePriceRequired)
      return
    }
    setStep((n) => Math.min(3, n + 1))
  }

  const back = () => setStep((n) => Math.max(1, n - 1))

  const cancel = () => {
    clearDraft()
    navigate('/tournaments')
  }

  const create = async () => {
    setCreating(true)
    try {
      const res = await apiPost<{ tournament: { id: string }; detail?: TournamentDetail }>('/api/tournaments', {
        name: name.trim(),
        sport,
        ...(sport === 'OTHER' ? otherSportPayload(other) : {}),
        tournamentType: tournamentType || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        auctionAt: auctionAt ? new Date(auctionAt).toISOString() : undefined,
        auctionMode,
        basePrice: auctionMode === 'NORMAL' ? parsedBasePrice : undefined,
      })
      invalidateCached(TOURNAMENTS_URL)
      // The response already holds the new tournament's full page data: the
      // Manage page renders from it at once (and refreshes in the background).
      if (res.detail) seedCached(tournamentDetailUrl(res.tournament.id), res.detail)
      clearDraft()
      toast.success(s.created)
      navigate(`/tournaments/${res.tournament.id}`)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : s.createFailed)
      setCreating(false)
    }
  }

  // Enter in a text field moves on (or creates, on the last step), like the button.
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (creating) return
    if (step < 3) next()
    else void create()
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Leaves the page (the wizard's own Back only moves between steps). */}
      <BackButton className="mb-1" />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{s.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{s.intro}</p>
      </div>

      {/* Stepper */}
      <ol className="mt-6 grid grid-cols-3 gap-2" aria-label={s.progress}>
        {STEPS.map((st, i) => {
          const active = step === st.n
          const done = step > st.n
          return (
            <li key={st.n}>
              <button
                type="button"
                onClick={() => (st.n < step ? setStep(st.n) : undefined)}
                className={`flex w-full min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 transition-colors sm:flex-row sm:gap-2 sm:py-3 ${
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-border bg-background text-muted-foreground'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : <st.icon className="h-4 w-4" aria-hidden />}
                <span className="text-xs font-bold sm:text-sm">
                  {st.n}. {s.steps[i]}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* A held-down Enter must not race through the steps (the old step's field
          stays focused while it animates out). Validation is the wizard's own. */}
      <form onSubmit={submit} onKeyDown={(e) => e.key === 'Enter' && e.repeat && e.preventDefault()} noValidate>
        <AnimatePresence mode="wait">
          {/* ---------------- STEP 1: BASICS ---------------- */}
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="mt-6">
                <CardContent className="space-y-5 p-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-name">
                      {s.tournamentName} <span className="text-rose-600 dark:text-rose-400">*</span>
                    </Label>
                    <Input
                      id="t-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={s.namePlaceholder}
                      className="h-11"
                      maxLength={80}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>
                      {s.sport} <span className="text-rose-600 dark:text-rose-400">*</span>
                    </Label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {SPORT_CHOICES.map((choice) => {
                        const selected = sport === choice.value
                        const copy = s.sportChoices[choice.value]
                        return (
                          <button
                            key={choice.value}
                            type="button"
                            onClick={() => setSport(choice.value)}
                            aria-pressed={selected}
                            className={`relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                              selected ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background hover:bg-accent'
                            }`}
                          >
                            {selected ? (
                              <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
                                <Check className="h-3.5 w-3.5" aria-hidden />
                              </span>
                            ) : null}
                            <choice.icon className="h-6 w-6" aria-hidden />
                            <span className="text-base font-bold">{copy.label}</span>
                            <span className={`text-xs ${selected ? 'text-primary/80' : 'text-muted-foreground'}`}>{copy.hint}</span>
                          </button>
                        )
                      })}
                    </div>

                    {sport === 'OTHER' ? <OtherSportFields value={other} onChange={setOther} idPrefix="t" /> : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label>{s.tournamentType}</Label>
                    <Select value={tournamentType} onValueChange={setTournamentType}>
                      <SelectTrigger className="h-11 w-full" aria-label={s.tournamentType}>
                        <SelectValue placeholder={s.chooseType} />
                      </SelectTrigger>
                      <SelectContent>
                        {TOURNAMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {tournamentTypeLabel(t, lang)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="t-location">
                      <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {s.location}
                    </Label>
                    <Input
                      id="t-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder={s.locationPlaceholder}
                      className="h-11"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="t-start">
                        <CalendarDays className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {s.startDate}
                      </Label>
                      <Input
                        id="t-start"
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="t-auction">
                        <Gavel className="mr-1 inline h-3.5 w-3.5" aria-hidden /> {s.auctionDateTime}
                      </Label>
                      <Input
                        id="t-auction"
                        type="datetime-local"
                        value={auctionAt}
                        onChange={(e) => setAuctionAt(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="t-desc">{s.description}</Label>
                    <Textarea
                      id="t-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={s.descPlaceholder}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}

          {/* ---------------- STEP 2: AUCTION MODE ---------------- */}
          {step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="mt-6">
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAuctionMode('CATEGORY')}
                      aria-pressed={auctionMode === 'CATEGORY'}
                      className={`rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        auctionMode === 'CATEGORY'
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <ListChecks className="h-4.5 w-4.5 text-primary" aria-hidden /> {s.categoryBased}
                      </span>
                      <p className="mt-1.5 text-sm text-muted-foreground">{s.categoryDesc}</p>
                      <Badge variant="secondary" className="mt-2">
                        {s.recommended}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuctionMode('NORMAL')}
                      aria-pressed={auctionMode === 'NORMAL'}
                      className={`rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        auctionMode === 'NORMAL'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <Gavel className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" aria-hidden /> {s.normal}
                      </span>
                      <p className="mt-1.5 text-sm text-muted-foreground">{s.normalDesc}</p>
                    </button>
                  </div>

                  {auctionMode === 'CATEGORY' ? (
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <Wallet className="h-4 w-4 text-primary" aria-hidden /> {s.defaultPrices}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{s.defaultPricesHint}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {Object.entries(SUGGESTED_CATEGORY_PRICES).map(([cat, price]) => (
                          <div
                            key={cat}
                            className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2"
                          >
                            <Badge className="w-8 justify-center bg-primary/10 text-primary hover:bg-primary/10">
                              {cat}
                            </Badge>
                            <span className="text-sm font-semibold tabular-nums">{formatBDT(price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                      <Label htmlFor="t-base" className="flex items-center gap-1.5">
                        <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden /> {s.basePriceEvery}
                      </Label>
                      <Input
                        id="t-base"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)}
                        className="mt-2 h-11 max-w-56"
                        aria-describedby="t-base-hint"
                      />
                      <p id="t-base-hint" className="mt-1.5 text-xs text-muted-foreground">
                        {s.basePriceHint} {parsedBasePrice > 0 ? s.current(formatBDT(parsedBasePrice)) : ''}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : null}

          {/* ---------------- STEP 3: REVIEW ---------------- */}
          {step === 3 ? (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="mt-6">
                <CardContent className="space-y-4 p-6">
                  <h2 className="font-bold">{s.reviewCreate}</h2>
                  <dl className="divide-y rounded-xl border">
                    {[
                      { k: s.rowName, v: name },
                      { k: s.rowSport, v: sport ? sportLabel(sport, lang, other.sportName.trim()) : '—' },
                      ...(sport === 'OTHER'
                        ? [
                            { k: s.rowRoles, v: other.playerRoles.length > 0 ? other.playerRoles.join(' · ') : rolesForSport('OTHER').join(' · ') },
                            {
                              k: s.rowTeamSize,
                              v:
                                [other.playersPerTeam && s.perTeam(other.playersPerTeam), other.playersOnField && s.onField(other.playersOnField)]
                                  .filter(Boolean)
                                  .join(' · ') || '—',
                            },
                          ]
                        : []),
                      { k: s.rowType, v: tournamentTypeLabel(tournamentType, lang) ?? '—' },
                      { k: s.rowLocation, v: location || '—' },
                      { k: s.rowStart, v: formatDate(startDate, true, lang) },
                      { k: s.rowAuctionAt, v: formatDate(auctionAt, true, lang) },
                      { k: s.rowMode, v: auctionMode === 'CATEGORY' ? s.categoryModeValue : s.normal },
                      {
                        k: s.rowBasePrice,
                        v:
                          auctionMode === 'NORMAL'
                            ? parsedBasePrice > 0
                              ? formatBDT(parsedBasePrice)
                              : '—'
                            : s.setPerCategory,
                      },
                      { k: s.rowDescription, v: description.trim() || '—' },
                    ].map((row) => (
                      <div key={row.k} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-muted-foreground">{row.k}</dt>
                        <dd className="text-right font-semibold">{row.v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                    <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    <div>
                      <p className="font-semibold">{s.planTitle}</p>
                      <p className="text-muted-foreground">
                        {s.planNote(plans.freeMaxTeams, plans.freeMaxPlayers, formatBDT(plans.proPrice))}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.afterCreate}</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Nav buttons. On the first step there is nothing to go back to: Cancel
            discards the draft and returns to the tournament list instead. */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {step === 1 ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={cancel} disabled={creating}>
              {s.cancel}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="min-h-11" onClick={back} disabled={creating}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> {s.back}
            </Button>
          )}
          {step < 3 ? (
            <Button key="next" type="submit" className="min-h-11" disabled={creating}>
              {s.next} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button key="create" type="submit" className="min-h-11" disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-1.5 h-4 w-4" aria-hidden />}
              {s.createTournament}
            </Button>
          )}
        </div>
      </form>

      <Separator className="mt-8" />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {s.changeLater}
      </p>
    </div>
  )
}
