'use client'

import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Coins,
  DoorOpen,
  FileSpreadsheet,
  Gavel,
  HandCoins,
  KeyRound,
  ListChecks,
  MapPin,
  PencilLine,
  Rocket,
  Share2,
  Shuffle,
  Timer,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { navigate } from '@/lib/router'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
      {sub ? <p className="mt-3 text-muted-foreground">{sub}</p> : null}
    </motion.div>
  )
}

const ORGANIZER_STEPS = [
  { icon: ClipboardList, title: 'Create tournament', text: 'Pick cricket or football, set the format and venue.' },
  { icon: Users, title: 'Add players', text: 'Type them in or paste a CSV — roles, categories, base prices.' },
  { icon: Trophy, title: 'Create teams', text: 'Names, colors, budgets and squad limits.' },
  { icon: Wallet, title: 'Set budgets', text: 'Every team gets a purse the engine enforces automatically.' },
  { icon: Share2, title: 'Share room code', text: 'Managers join with a code — no app installs.' },
  { icon: Gavel, title: 'Run live auction', text: 'Timer, bids, going once… sold! Then export results.' },
]

const MANAGER_STEPS = [
  { icon: KeyRound, title: 'Get room code', text: 'The organizer shares a code like BD26-DEMO.' },
  { icon: DoorOpen, title: 'Enter name', text: 'Join the room as your team’s manager.' },
  { icon: Trophy, title: 'Pick your team', text: 'Claim the team you manage — one code per auction.' },
  { icon: HandCoins, title: 'Bid live', text: 'Beat the clock with real-time bids and budget checks.' },
  { icon: ListChecks, title: 'Build your squad', text: 'Track spending and squad size as you buy.' },
]

const FEATURES = [
  {
    icon: Gavel,
    title: 'Live auction room',
    text: 'A real-time room with a bid timer, going-once countdown and instant sold announcements.',
  },
  {
    icon: ListChecks,
    title: 'Category-based auctions',
    text: 'Group players into categories A–E with separate base prices — just like the big leagues.',
  },
  {
    icon: Wallet,
    title: 'Automatic budget control',
    text: 'Bids above a team’s remaining purse are rejected on the spot. No math mistakes.',
  },
  {
    icon: Shuffle,
    title: 'Random player selection',
    text: 'The engine picks the next player at random from the pool so no one can plan ahead.',
  },
  {
    icon: Users,
    title: 'Squad & budget tracking',
    text: 'Everyone sees live purse, squad size and which team is bidding what.',
  },
  {
    icon: FileSpreadsheet,
    title: 'CSV import/export + print',
    text: 'Bulk-load players, export sold lists, squads and spending, or print clean reports.',
  },
]

const TOURNAMENT_TYPES = [
  'Corporate Cricket',
  'University Tournament',
  'Local Club Tournament',
  'School Tournament',
  'Community Tournament',
  'Indoor Cricket',
  '6-a-side Football',
]

export default function Landing() {
  return (
    <div className="bg-background">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 px-3 py-1 text-primary">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Made for Bangladesh
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Run your player auction <span className="text-primary">like the pros</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Build your tournament, load the players, create the teams and share a room code.
              Then go live: bids fly, timers tick, and the gavel falls — all in ৳ BDT.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="min-h-11" onClick={() => navigate('/register')}>
                Create your auction <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Button>
              <Button size="lg" variant="outline" className="min-h-11" onClick={() => navigate('/join')}>
                <KeyRound className="mr-1.5 h-4 w-4" aria-hidden /> I have a room code
              </Button>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden /> ৳ BDT native
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Cricket &amp; Football
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Free during beta
              </span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-2xl border bg-card p-2 shadow-xl shadow-primary/10">
              <img
                src="/images/hero.png"
                alt="NeelamGhor live auction room with bids, timers and team purses"
                className="h-auto w-full rounded-xl object-cover"
                loading="eager"
              />
            </div>
            <div className="absolute -bottom-4 left-4 hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-md sm:flex">
              <Gavel className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-semibold">SOLD for ৳1,25,000</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Stats strip ---------------- */}
      <section className="border-b bg-muted/40">
        <div className="container mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-4 py-8 sm:grid-cols-4">
          {[
            { value: '৳ BDT', label: 'Lakh-style currency, no conversions' },
            { value: '2 sports', label: 'Cricket & football role templates' },
            { value: 'Room code', label: 'One code joins every manager' },
            { value: '~5 min', label: 'From signup to a live auction' },
          ].map((s) => (
            <motion.div key={s.label} {...fadeUp} className="px-2 py-3 text-center sm:py-4">
              <p className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
        <SectionHeading
          eyebrow="How it works"
          title="Two roles, one smooth auction"
          sub="Organizers run the show. Team managers join by code and bid from their seats."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Gavel className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-bold">Organizer flow</h3>
                    <p className="text-sm text-muted-foreground">You create and control the auction</p>
                  </div>
                </div>
                <ol className="mt-5 space-y-4">
                  {ORGANIZER_STEPS.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <step.icon className="h-4 w-4 text-primary" aria-hidden /> {step.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeUp}>
            <Card className="h-full border-amber-200/70 bg-amber-50/40 dark:bg-amber-950/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <HandCoins className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-bold">Team manager flow</h3>
                    <p className="text-sm text-muted-foreground">You bid and build the squad</p>
                  </div>
                </div>
                <ol className="mt-5 space-y-4">
                  {MANAGER_STEPS.map((step, i) => (
                    <li key={step.title} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <step.icon className="h-4 w-4 text-amber-700" aria-hidden /> {step.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
          <SectionHeading
            eyebrow="Features"
            title="Everything an auction needs"
            sub="Built so the organizer can focus on the room, not the rules."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.04 }}>
                <Card className="group h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <f.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="font-bold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.text}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Sports ---------------- */}
      <section className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
        <SectionHeading
          eyebrow="Sports"
          title="Cricket and football, ready out of the box"
          sub="Player roles are preloaded for both sports so you can start adding names in seconds."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <motion.div {...fadeUp}>
            <Card className="h-full overflow-hidden">
              <div className="flex items-center gap-3 border-b bg-emerald-50/70 px-6 py-4 dark:bg-emerald-950/20">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Trophy className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold">Cricket</h3>
                  <p className="text-xs text-muted-foreground">Category mode with A–E grades works great here</p>
                </div>
              </div>
              <CardContent className="flex flex-wrap gap-2 p-6">
                {['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'].map((r) => (
                  <Badge key={r} variant="secondary" className="px-3 py-1.5 text-sm">
                    {r}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </motion.div>
          <motion.div {...fadeUp}>
            <Card className="h-full overflow-hidden">
              <div className="flex items-center gap-3 border-b bg-amber-50/70 px-6 py-4 dark:bg-amber-950/20">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <Trophy className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold">Football</h3>
                  <p className="text-xs text-muted-foreground">Normal mode with one base price is the classic choice</p>
                </div>
              </div>
              <CardContent className="flex flex-wrap gap-2 p-6">
                {['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map((r) => (
                  <Badge key={r} variant="secondary" className="px-3 py-1.5 text-sm">
                    {r}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div {...fadeUp} className="mt-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Popular tournament types</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {TOURNAMENT_TYPES.map((t) => (
              <Badge key={t} variant="outline" className="border-primary/25 bg-primary/5 px-3 py-1.5 text-sm text-foreground">
                {t}
              </Badge>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="container mx-auto max-w-7xl px-4 pb-16">
        <motion.div {...fadeUp}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-6 py-12 text-center text-white shadow-lg sm:px-12 sm:py-16">
            <Zap className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 text-white/5" aria-hidden />
            <Trophy className="pointer-events-none absolute -bottom-10 -right-6 h-44 w-44 text-white/5" aria-hidden />
            <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">
              Your auction. One room. Zero spreadsheets.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-teal-100">
              Create a free account, load your players and share the room code. The gavel is waiting.
            </p>
            <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" className="min-h-11 bg-white text-teal-900 hover:bg-teal-50" onClick={() => navigate('/register')}>
                <Rocket className="mr-1.5 h-4 w-4" aria-hidden /> Create your auction
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate('/login')}
              >
                <PencilLine className="mr-1.5 h-4 w-4" aria-hidden /> Log in as organizer
              </Button>
            </div>
            <p className="relative mt-5 flex items-center justify-center gap-1.5 text-xs text-teal-200">
              <Coins className="h-3.5 w-3.5" aria-hidden /> Free during beta — ৳ BDT pricing built in
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
