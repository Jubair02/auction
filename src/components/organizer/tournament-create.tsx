'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Gavel,
  ListChecks,
  Loader2,
  MapPin,
  Trophy,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiPost, ApiError } from '@/lib/api'
import { invalidateCached } from '@/lib/api-cache'
import { TOURNAMENTS_URL } from '@/lib/tournament-prefetch'
import { navigate } from '@/lib/router'
import { formatBDT } from '@/lib/format'
import { DEFAULT_CATEGORY_BASE_PRICES, type Sport } from '@/lib/types'

const TOURNAMENT_TYPES = [
  'Corporate Cricket',
  'University Tournament',
  'Local Club Tournament',
  'School Tournament',
  'Friends/Community Tournament',
  'Indoor Cricket',
  '6-a-side / 7-a-side Football',
]

const STEPS = [
  { n: 1, label: 'Basics', icon: ClipboardList },
  { n: 2, label: 'Auction mode', icon: Gavel },
  { n: 3, label: 'Review', icon: Check },
]

// The category base prices the Players tab offers as one-tap quick picks.
// They are platform defaults, not per-tournament settings — each player's base
// price is still editable individually when you add or edit them.
const SUGGESTED_CATEGORY_PRICES = { ...DEFAULT_CATEGORY_BASE_PRICES }

export default function TournamentCreate() {
  const [step, setStep] = useState(1)

  // Step 1 — basics
  const [name, setName] = useState('')
  const [sport, setSport] = useState<Sport | ''>('')
  const [tournamentType, setTournamentType] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('') // datetime-local
  const [auctionAt, setAuctionAt] = useState('') // datetime-local

  // Step 2 — auction mode
  const [auctionMode, setAuctionMode] = useState<'CATEGORY' | 'NORMAL'>('CATEGORY')
  const [basePrice, setBasePrice] = useState('10000')

  const [creating, setCreating] = useState(false)

  const step1Valid = name.trim().length >= 2 && (sport === 'CRICKET' || sport === 'FOOTBALL')

  const parsedBasePrice = useMemo(() => {
    const n = parseInt(basePrice, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [basePrice])

  const step2Valid = auctionMode === 'CATEGORY' || parsedBasePrice > 0

  const next = () => {
    if (step === 1 && !step1Valid) {
      toast.error('Tournament name (2+ characters) and sport are required.')
      return
    }
    if (step === 2 && !step2Valid) {
      toast.error('Enter a base price above ৳0 for normal mode.')
      return
    }
    setStep((s) => Math.min(3, s + 1))
  }

  const back = () => setStep((s) => Math.max(1, s - 1))

  const create = async () => {
    setCreating(true)
    try {
      const res = await apiPost<{ tournament: { id: string } }>('/api/tournaments', {
        name: name.trim(),
        sport,
        tournamentType: tournamentType || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        auctionAt: auctionAt ? new Date(auctionAt).toISOString() : undefined,
        auctionMode,
        basePrice: auctionMode === 'NORMAL' ? parsedBasePrice : undefined,
      })
      invalidateCached(TOURNAMENTS_URL)
      toast.success('Tournament created — now add players and teams!')
      navigate(`/tournaments/${res.tournament.id}`)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not create tournament')
      setCreating(false)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Create tournament</h1>
        <p className="mt-1 text-sm text-muted-foreground">Three quick steps and your auction shell is ready.</p>
      </div>

      {/* Stepper */}
      <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((s) => {
          const active = step === s.n
          const done = step > s.n
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => (s.n < step ? setStep(s.n) : undefined)}
                className={`flex w-full min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 transition-colors sm:flex-row sm:gap-2 sm:py-3 ${
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-border bg-background text-muted-foreground'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : <s.icon className="h-4 w-4" aria-hidden />}
                <span className="text-xs font-bold sm:text-sm">
                  {s.n}. {s.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

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
                    Tournament name <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="t-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mirpur Corporate Cricket League 2026"
                    className="h-11"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Sport <span className="text-rose-600">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { value: 'CRICKET', label: 'Cricket', roles: 'Batsman · Bowler · All-rounder · Wicketkeeper' },
                        { value: 'FOOTBALL', label: 'Football', roles: 'Goalkeeper · Defender · Midfielder · Forward' },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSport(s.value)}
                        aria-pressed={sport === s.value}
                        className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                          sport === s.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        <Trophy className="h-5 w-5" aria-hidden />
                        <span className="text-sm font-bold">{s.label}</span>
                        <span className="text-[11px] text-muted-foreground">{s.roles}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tournament type</Label>
                  <Select value={tournamentType} onValueChange={setTournamentType}>
                    <SelectTrigger className="h-11 w-full" aria-label="Tournament type">
                      <SelectValue placeholder="Choose a type (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOURNAMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-location">
                    <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Location
                  </Label>
                  <Input
                    id="t-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mirpur Indoor Stadium, Dhaka"
                    className="h-11"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-start">
                      <CalendarDays className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Start date
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
                      <Gavel className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Auction date &amp; time
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
                  <Label htmlFor="t-desc">Description</Label>
                  <Textarea
                    id="t-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Anything teams should know — format, rules, entry fee…"
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
                      <ListChecks className="h-4.5 w-4.5 text-primary" aria-hidden /> Category-Based
                    </span>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Players are graded into categories A–E, each with its own base price. Best for cricket-style
                      auctions where stars and newcomers cost differently.
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      Recommended default
                    </Badge>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuctionMode('NORMAL')}
                    aria-pressed={auctionMode === 'NORMAL'}
                    className={`rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      auctionMode === 'NORMAL'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-border bg-background hover:bg-accent'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <Gavel className="h-4.5 w-4.5 text-amber-600" aria-hidden /> Normal
                    </span>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Every player starts from one base price. Simple and fast — great for football and small
                      friendly auctions.
                    </p>
                  </button>
                </div>

                {auctionMode === 'CATEGORY' ? (
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Wallet className="h-4 w-4 text-primary" aria-hidden /> Default base prices per category
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      One tap applies these when you add a player. Every player&apos;s base price stays editable
                      individually in the Players tab.
                    </p>
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
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <Label htmlFor="t-base" className="flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-amber-600" aria-hidden /> Base price for every player (৳)
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
                      First bid on any player must be at least this amount. {parsedBasePrice > 0 ? `Current: ${formatBDT(parsedBasePrice)}` : ''}
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
                <h2 className="font-bold">Review &amp; create</h2>
                <dl className="divide-y rounded-xl border">
                  {[
                    { k: 'Name', v: name },
                    { k: 'Sport', v: sport === 'CRICKET' ? 'Cricket' : sport === 'FOOTBALL' ? 'Football' : '—' },
                    { k: 'Type', v: tournamentType || '—' },
                    { k: 'Location', v: location || '—' },
                    { k: 'Start date', v: startDate ? new Date(startDate).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
                    { k: 'Auction at', v: auctionAt ? new Date(auctionAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
                    { k: 'Auction mode', v: auctionMode === 'CATEGORY' ? 'Category-Based (A–E)' : 'Normal' },
                    {
                      k: 'Base price',
                      v:
                        auctionMode === 'NORMAL'
                          ? parsedBasePrice > 0
                            ? formatBDT(parsedBasePrice)
                            : '—'
                          : 'Set per category when adding players',
                    },
                    { k: 'Description', v: description.trim() || '—' },
                  ].map((row) => (
                    <div key={row.k} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                      <dt className="shrink-0 font-medium text-muted-foreground">{row.k}</dt>
                      <dd className="text-right font-semibold">{row.v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">
                  After creating, you&apos;ll land in the tournament workspace to add players and teams.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Nav buttons */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" className="min-h-11" onClick={back} disabled={step === 1 || creating}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Back
        </Button>
        {step < 3 ? (
          <Button className="min-h-11" onClick={next} disabled={creating}>
            Next <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button className="min-h-11" onClick={() => void create()} disabled={creating}>
            {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-1.5 h-4 w-4" aria-hidden />}
            Create tournament
          </Button>
        )}
      </div>

      <Separator className="mt-8" />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        You can change most details later from the tournament workspace.
      </p>
    </div>
  )
}
