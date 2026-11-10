'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  Coins,
  Crown,
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
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AppLink } from '@/components/shared/app-link'
import { DASHBOARD_PATH } from '@/lib/access'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { useAuthState } from '@/lib/store'
import { useLowData } from '@/lib/low-data'
import { formatBDT } from '@/lib/format'
import { usePlanNumbers } from '@/lib/plan-numbers'
import type { UserRole } from '@/lib/types'
import { TOURNAMENT_TYPES, tournamentTypeLabel } from '@/lib/tournament-types'

type Step = { title: string; text: string }

interface LandingStrings {
  /** Logged-in visitors get a way back to their own page instead of sign-up buttons. */
  homeLabel: Record<UserRole, string>
  madeFor: string
  heroTitle: string
  heroTitleAccent: string
  heroSub: string
  createAuction: string
  haveRoomCode: string
  bdtNative: string
  cricketFootball: string
  freeStart: (teams: number) => string
  heroAlt: string
  soldFor: (amount: string) => string
  stats: { value: string; label: string }[]
  howEyebrow: string
  howTitle: string
  howSub: string
  organizerFlow: string
  organizerFlowSub: string
  managerFlow: string
  managerFlowSub: string
  organizerSteps: Step[]
  managerSteps: Step[]
  featuresEyebrow: string
  featuresTitle: string
  featuresSub: string
  features: Step[]
  sportsEyebrow: string
  sportsTitle: string
  sportsSub: string
  cricket: string
  cricketHint: string
  cricketRoles: string[]
  football: string
  footballHint: string
  footballRoles: string[]
  popularTypes: string
  pricingEyebrow: string
  pricingTitle: string
  pricingSub: string
  freeName: string
  freePrice: string
  freeWhen: string
  freePerks: (teams: number, players: number) => string[]
  proName: string
  proWhen: string
  proPerks: string[]
  oneTime: string
  startFree: string
  howToPay: string
  refundLink: string
  ctaTitle: string
  ctaSub: string
  loginAsOrganizer: string
  ctaFoot: (price: string) => string
}

const STRINGS = {
  en: {
    homeLabel: {
      ORGANIZER: 'Open my tournaments',
      MANAGER: 'Open my team',
      ADMIN: 'Open admin console',
    },
    madeFor: 'Made for Bangladesh',
    heroTitle: 'Run your player auction',
    heroTitleAccent: 'like the pros',
    heroSub:
      'Build your tournament, load the players, create the teams and share a room code. Then go live: bids fly, timers tick, and the gavel falls — all in ৳ BDT.',
    createAuction: 'Create your auction',
    haveRoomCode: 'I have a room code',
    bdtNative: '৳ BDT native',
    cricketFootball: 'Cricket & Football',
    freeStart: (teams) => `Free for up to ${teams} teams`,
    heroAlt: 'NeelamGhor live auction room with bids, timers and team purses',
    soldFor: (amount) => `SOLD for ${amount}`,
    stats: [
      { value: '৳ BDT', label: 'Lakh-style currency, no conversions' },
      { value: '2 sports', label: 'Cricket & football role templates' },
      { value: 'Room code', label: 'One code joins every manager' },
      { value: '~5 min', label: 'From signup to a live auction' },
    ],
    howEyebrow: 'How it works',
    howTitle: 'Two roles, one smooth auction',
    howSub: 'Organizers run the show. Team managers join by code and bid from their seats.',
    organizerFlow: 'Organizer flow',
    organizerFlowSub: 'You create and control the auction',
    managerFlow: 'Team manager flow',
    managerFlowSub: 'You bid and build the squad',
    organizerSteps: [
      { title: 'Create tournament', text: 'Pick cricket or football, set the format and venue.' },
      { title: 'Add players', text: 'Type them in or paste a CSV — roles, categories, base prices.' },
      { title: 'Create teams', text: 'Names, colors, budgets and squad limits.' },
      { title: 'Set budgets', text: 'Every team gets a purse the engine enforces automatically.' },
      { title: 'Share room code', text: 'Managers join with a code — no app installs.' },
      { title: 'Run live auction', text: 'Timer, bids, going once… sold! Then export results.' },
    ],
    managerSteps: [
      { title: 'Get room code', text: 'The organizer shares a code like BD26-DEMO.' },
      { title: 'Enter name', text: 'Join the room as your team’s manager.' },
      { title: 'Pick your team', text: 'Claim the team you manage — one code per auction.' },
      { title: 'Bid live', text: 'Beat the clock with real-time bids and budget checks.' },
      { title: 'Build your squad', text: 'Track spending and squad size as you buy.' },
    ],
    featuresEyebrow: 'Features',
    featuresTitle: 'Everything an auction needs',
    featuresSub: 'Built so the organizer can focus on the room, not the rules.',
    features: [
      {
        title: 'Live auction room',
        text: 'A real-time room with a bid timer, going-once countdown and instant sold announcements.',
      },
      {
        title: 'Category-based auctions',
        text: 'Group players into categories A–E with separate base prices — just like the big leagues.',
      },
      {
        title: 'Automatic budget control',
        text: 'Bids above a team’s remaining purse are rejected on the spot. No math mistakes.',
      },
      {
        title: 'Random player selection',
        text: 'The engine picks the next player at random from the pool so no one can plan ahead.',
      },
      {
        title: 'Squad & budget tracking',
        text: 'Everyone sees live purse, squad size and which team is bidding what.',
      },
      {
        title: 'CSV import/export + print',
        text: 'Bulk-load players, export sold lists, squads and spending, or print clean reports.',
      },
    ],
    sportsEyebrow: 'Sports',
    sportsTitle: 'Cricket and football, ready out of the box',
    sportsSub: 'Player roles are preloaded for both sports so you can start adding names in seconds.',
    cricket: 'Cricket',
    cricketHint: 'Category mode with A–E grades works great here',
    cricketRoles: ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'],
    football: 'Football',
    footballHint: 'Normal mode with one base price is the classic choice',
    footballRoles: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
    popularTypes: 'Popular tournament types',
    pricingEyebrow: 'Pricing',
    pricingTitle: 'Start free. Pay once when you need more.',
    pricingSub:
      'Every tournament starts on Free. Upgrade a single tournament to Pro whenever it outgrows the limits — no subscription.',
    freeName: 'Free',
    freePrice: '৳0',
    freeWhen: 'For small tournaments and trying it out',
    freePerks: (teams, players) => [
      `Up to ${teams} teams and ${players} players`,
      'The full live auction room — timers, budgets, categories',
      'Player registration link',
      'Results page, fixtures and points table',
      'CSV import and export',
    ],
    proName: 'Pro',
    proWhen: 'For leagues with more teams, sponsors and an audience',
    proPerks: [
      'Unlimited teams and players',
      'SMS updates to players and team managers',
      'Sponsor logos on the room, stream overlay and share cards',
      'No “Powered by NeelamGhor” mark on the stream overlay',
      'Option to hide NeelamGhor branding on public pages',
    ],
    oneTime: 'one-time, per tournament',
    startFree: 'Start free',
    howToPay:
      'Pay for Pro with bKash or Nagad from inside your tournament. Pro turns on once we have checked the payment — usually within a few hours.',
    refundLink: 'Refund policy',
    ctaTitle: 'Your auction. One room. Zero spreadsheets.',
    ctaSub: 'Create a free account, load your players and share the room code. The gavel is waiting.',
    loginAsOrganizer: 'Log in as organizer',
    ctaFoot: (price) => `Free to start — Pro is ${price} per tournament, paid once`,
  },
  bn: {
    homeLabel: {
      ORGANIZER: 'আমার টুর্নামেন্টে যান',
      MANAGER: 'আমার দলে যান',
      ADMIN: 'অ্যাডমিন কনসোলে যান',
    },
    madeFor: 'বাংলাদেশের জন্য তৈরি',
    heroTitle: 'আপনার প্লেয়ার নিলাম চালান',
    heroTitleAccent: 'একদম প্রো স্টাইলে',
    heroSub:
      'টুর্নামেন্ট বানান, খেলোয়াড় তুলুন, দল তৈরি করে রুম কোড শেয়ার করুন। তারপর লাইভ: বিড উড়বে, টাইমার চলবে, হাতুড়ি পড়বে — সবকিছু ৳ টাকায়।',
    createAuction: 'নিজের নিলাম শুরু করুন',
    haveRoomCode: 'আমার কাছে রুম কোড আছে',
    bdtNative: 'পুরো হিসাব ৳ টাকায়',
    cricketFootball: 'ক্রিকেট ও ফুটবল',
    freeStart: (teams) => `${teams}টি দল পর্যন্ত ফ্রি`,
    heroAlt: 'NeelamGhor-এর লাইভ নিলাম রুম — বিড, টাইমার আর দলের বাজেট',
    soldFor: (amount) => `${amount}-এ বিক্রি!`,
    stats: [
      { value: '৳ টাকা', label: 'লাখের হিসাবে টাকা, কোনো কনভার্সন নেই' },
      { value: '2টি খেলা', label: 'ক্রিকেট ও ফুটবলের রোল রেডি' },
      { value: 'রুম কোড', label: 'এক কোডেই সব ম্যানেজার হাজির' },
      { value: '~5 মিনিট', label: 'সাইনআপ থেকে লাইভ নিলাম পর্যন্ত' },
    ],
    howEyebrow: 'কীভাবে কাজ করে',
    howTitle: 'দুই ভূমিকা, এক ঝামেলাহীন নিলাম',
    howSub: 'আয়োজক পুরো শো চালান। টিম ম্যানেজাররা কোড দিয়ে ঢুকে নিজের জায়গা থেকেই বিড করেন।',
    organizerFlow: 'আয়োজকের ধাপগুলো',
    organizerFlowSub: 'নিলাম আপনি বানাবেন, আপনিই চালাবেন',
    managerFlow: 'টিম ম্যানেজারের ধাপগুলো',
    managerFlowSub: 'আপনি বিড করবেন, স্কোয়াড গড়বেন',
    organizerSteps: [
      { title: 'টুর্নামেন্ট তৈরি করুন', text: 'ক্রিকেট না ফুটবল বেছে নিন, ফরম্যাট আর ভেন্যু ঠিক করুন।' },
      { title: 'খেলোয়াড় যোগ করুন', text: 'হাতে লিখুন বা CSV পেস্ট করুন — রোল, ক্যাটাগরি, বেস প্রাইস সব।' },
      { title: 'দল তৈরি করুন', text: 'নাম, রং, বাজেট আর স্কোয়াড লিমিট।' },
      { title: 'বাজেট ঠিক করুন', text: 'প্রতিটি দল পায় নিজের বাজেট — সিস্টেম নিজেই তা মেনে চলে।' },
      { title: 'রুম কোড শেয়ার করুন', text: 'ম্যানেজাররা কোড দিয়েই যোগ দেন — কোনো অ্যাপ ইনস্টল লাগে না।' },
      { title: 'লাইভ নিলাম চালান', text: 'টাইমার, বিড, গোয়িং ওয়ান্স… বিক্রি! তারপর ফলাফল এক্সপোর্ট করুন।' },
    ],
    managerSteps: [
      { title: 'রুম কোড নিন', text: 'আয়োজক BD26-DEMO-এর মতো একটি কোড শেয়ার করবেন।' },
      { title: 'নাম দিন', text: 'আপনার দলের ম্যানেজার হিসেবে রুমে ঢুকুন।' },
      { title: 'নিজের দল বেছে নিন', text: 'যে দল আপনি চালান সেটি নিন — প্রতি নিলামে একটি কোড।' },
      { title: 'লাইভ বিড করুন', text: 'ঘড়ির সাথে পাল্লা দিয়ে রিয়েল-টাইমে বিড করুন, বাজেট চেক হয় সাথে সাথেই।' },
      { title: 'স্কোয়াড গড়ে তুলুন', text: 'কিনতে কিনতেই খরচ আর স্কোয়াডের সাইজ দেখে নিন।' },
    ],
    featuresEyebrow: 'ফিচার',
    featuresTitle: 'নিলামে যা যা লাগে, সব এখানে',
    featuresSub: 'নিয়মকানুন নিয়ে ভাবতে হবে না — আয়োজক পুরো মনোযোগ দিতে পারবেন রুমে।',
    features: [
      {
        title: 'লাইভ নিলাম রুম',
        text: 'বিড টাইমার, গোয়িং-ওয়ান্স কাউন্টডাউন আর সাথে সাথে বিক্রির ঘোষণা — সব রিয়েল-টাইমে।',
      },
      {
        title: 'ক্যাটাগরিভিত্তিক নিলাম',
        text: 'খেলোয়াড়দের A–E ক্যাটাগরিতে ভাগ করুন, প্রতিটির আলাদা বেস প্রাইস — ঠিক বড় লিগগুলোর মতো।',
      },
      {
        title: 'অটোমেটিক বাজেট কন্ট্রোল',
        text: 'দলের বাকি বাজেটের বেশি বিড সাথে সাথেই বাতিল। হিসাবে ভুলের সুযোগই নেই।',
      },
      {
        title: 'র‍্যান্ডম খেলোয়াড় বাছাই',
        text: 'পরের খেলোয়াড় পুল থেকে র‍্যান্ডমভাবে আসে, তাই কেউ আগে থেকে ছক কষতে পারে না।',
      },
      {
        title: 'স্কোয়াড ও বাজেট ট্র্যাকিং',
        text: 'সবাই লাইভ দেখে — কার কত বাজেট বাকি, স্কোয়াডে কতজন, কোন দল কত বিড করছে।',
      },
      {
        title: 'CSV ইমপোর্ট/এক্সপোর্ট + প্রিন্ট',
        text: 'একসাথে সব খেলোয়াড় তুলুন, বিক্রির তালিকা, স্কোয়াড আর খরচ এক্সপোর্ট করুন, বা ঝকঝকে রিপোর্ট প্রিন্ট করুন।',
      },
    ],
    sportsEyebrow: 'খেলা',
    sportsTitle: 'ক্রিকেট আর ফুটবল — শুরু থেকেই রেডি',
    sportsSub: 'দুই খেলারই প্লেয়ার রোল আগে থেকে সেট করা, তাই কয়েক সেকেন্ডেই নাম যোগ করা শুরু করতে পারবেন।',
    cricket: 'ক্রিকেট',
    cricketHint: 'এখানে A–E গ্রেডের ক্যাটাগরি মোড দারুণ চলে',
    cricketRoles: ['ব্যাটসম্যান', 'বোলার', 'অলরাউন্ডার', 'উইকেটকিপার'],
    football: 'ফুটবল',
    footballHint: 'এক বেস প্রাইসের নরমাল মোডই ক্লাসিক পছন্দ',
    footballRoles: ['গোলকিপার', 'ডিফেন্ডার', 'মিডফিল্ডার', 'ফরোয়ার্ড'],
    popularTypes: 'জনপ্রিয় টুর্নামেন্টগুলো',
    pricingEyebrow: 'দাম',
    pricingTitle: 'ফ্রিতে শুরু করুন। বেশি লাগলে একবার পেমেন্ট।',
    pricingSub:
      'প্রতিটি টুর্নামেন্ট ফ্রি প্ল্যানে শুরু হয়। সীমা ছাড়িয়ে গেলে শুধু সেই টুর্নামেন্টটি Pro-তে নিন — কোনো মাসিক চার্জ নেই।',
    freeName: 'ফ্রি',
    freePrice: '৳0',
    freeWhen: 'ছোট টুর্নামেন্ট আর চালিয়ে দেখার জন্য',
    freePerks: (teams, players) => [
      `সর্বোচ্চ ${teams}টি দল ও ${players} জন খেলোয়াড়`,
      'পুরো লাইভ নিলাম রুম — টাইমার, বাজেট, ক্যাটাগরি',
      'খেলোয়াড় নিবন্ধনের লিংক',
      'ফলাফল পেজ, ফিকশ্চার ও পয়েন্ট টেবিল',
      'CSV ইমপোর্ট ও এক্সপোর্ট',
    ],
    proName: 'Pro',
    proWhen: 'বেশি দল, স্পনসর আর দর্শক নিয়ে লিগের জন্য',
    proPerks: [
      'সীমাহীন দল ও খেলোয়াড়',
      'খেলোয়াড় ও টিম ম্যানেজারদের SMS আপডেট',
      'রুম, স্ট্রিম ওভারলে ও শেয়ার কার্ডে স্পনসরের লোগো',
      'স্ট্রিম ওভারলেতে “Powered by NeelamGhor” চিহ্ন থাকবে না',
      'পাবলিক পেজ থেকে NeelamGhor ব্র্যান্ডিং লুকানোর সুযোগ',
    ],
    oneTime: 'এককালীন, প্রতি টুর্নামেন্টে',
    startFree: 'ফ্রিতে শুরু করুন',
    howToPay:
      'টুর্নামেন্টের ভেতর থেকেই bKash বা Nagad-এ Pro-এর টাকা দিন। পেমেন্ট যাচাইয়ের পর Pro চালু হয় — সাধারণত কয়েক ঘণ্টার মধ্যে।',
    refundLink: 'রিফান্ড নীতি',
    ctaTitle: 'আপনার নিলাম। এক রুমে। কোনো এক্সেল শিট ছাড়াই।',
    ctaSub: 'ফ্রি অ্যাকাউন্ট খুলুন, খেলোয়াড় তুলুন আর রুম কোড শেয়ার করুন। হাতুড়ি অপেক্ষা করছে।',
    loginAsOrganizer: 'আয়োজক হিসেবে লগইন',
    ctaFoot: (price) => `শুরু করুন ফ্রিতে — Pro প্রতি টুর্নামেন্টে ${price}, একবারই`,
  },
} satisfies Strings<LandingStrings>

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

function PerkList({ perks }: { perks: string[] }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {perks.map((perk) => (
        <li key={perk} className="flex items-start gap-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span>{perk}</span>
        </li>
      ))}
    </ul>
  )
}

// Icons for the text lists in STRINGS (same order).
const ORGANIZER_STEP_ICONS = [ClipboardList, Users, Trophy, Wallet, Share2, Gavel]
const MANAGER_STEP_ICONS = [KeyRound, DoorOpen, Trophy, HandCoins, ListChecks]
const FEATURE_ICONS = [Gavel, ListChecks, Wallet, Shuffle, Users, FileSpreadsheet]

export default function Landing() {
  const { user } = useAuthState()
  const t = useStrings(STRINGS)
  const lang = useLang()
  // Data saver: no hero image (the page's largest download).
  const lowData = useLowData()
  const plans = usePlanNumbers()
  const proPrice = formatBDT(plans.proPrice)
  return (
    <div className="bg-background">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
          {/* Above the fold: rendered visible in the server HTML (no fade-in from opacity 0). */}
          <div>
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 px-3 py-1 text-primary">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {t.madeFor}
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t.heroTitle} <span className="text-primary">{t.heroTitleAccent}</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t.heroSub}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="min-h-11" asChild>
                <AppLink href={user ? DASHBOARD_PATH : '/register'}>
                  {user ? t.homeLabel[user.role] : t.createAuction} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </AppLink>
              </Button>
              <Button size="lg" variant="outline" className="min-h-11" asChild>
                <AppLink href="/join">
                  <KeyRound className="mr-1.5 h-4 w-4" aria-hidden /> {t.haveRoomCode}
                </AppLink>
              </Button>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.bdtNative}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.cricketFootball}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.freeStart(plans.freeMaxTeams)}
              </span>
            </p>
          </div>

          {lowData ? null : (
            <div className="relative">
              <div className="rounded-2xl border bg-card p-2 shadow-xl shadow-primary/10">
                {/* Intrinsic size reserves the box before the image loads — no layout shift. */}
                <Image
                  src="/images/hero.png"
                  alt={t.heroAlt}
                  width={1344}
                  height={768}
                  sizes="(min-width: 1280px) 600px, (min-width: 1024px) 46vw, 100vw"
                  preload
                  className="h-auto w-full rounded-xl object-cover"
                />
              </div>
              <div className="absolute -bottom-4 left-4 hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-md sm:flex">
                <Gavel className="h-4 w-4 text-primary" aria-hidden />
                <span className="text-sm font-semibold">{t.soldFor('৳1,25,000')}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- Stats strip ---------------- */}
      <section className="border-b bg-muted/40">
        <div className="container mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-4 py-8 sm:grid-cols-4">
          {t.stats.map((s, i) => (
            <div key={i} className="px-2 py-3 text-center sm:py-4">
              <p className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
        <SectionHeading
          eyebrow={t.howEyebrow}
          title={t.howTitle}
          sub={t.howSub}
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
                    <h3 className="font-bold">{t.organizerFlow}</h3>
                    <p className="text-sm text-muted-foreground">{t.organizerFlowSub}</p>
                  </div>
                </div>
                <ol className="mt-5 space-y-4">
                  {t.organizerSteps.map((step, i) => {
                    const StepIcon = ORGANIZER_STEP_ICONS[i]
                    return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <StepIcon className="h-4 w-4 text-primary" aria-hidden /> {step.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{step.text}</p>
                      </div>
                    </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeUp}>
            <Card className="h-full border-amber-200/70 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <HandCoins className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-bold">{t.managerFlow}</h3>
                    <p className="text-sm text-muted-foreground">{t.managerFlowSub}</p>
                  </div>
                </div>
                <ol className="mt-5 space-y-4">
                  {t.managerSteps.map((step, i) => {
                    const StepIcon = MANAGER_STEP_ICONS[i]
                    return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-300">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <StepIcon className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden /> {step.title}
                        </p>
                        <p className="text-sm text-muted-foreground">{step.text}</p>
                      </div>
                    </li>
                    )
                  })}
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
            eyebrow={t.featuresEyebrow}
            title={t.featuresTitle}
            sub={t.featuresSub}
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => {
              const FeatureIcon = FEATURE_ICONS[i]
              return (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.04 }}>
                <Card className="group h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <FeatureIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="font-bold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.text}</p>
                  </CardContent>
                </Card>
              </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Sports ---------------- */}
      <section className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
        <SectionHeading
          eyebrow={t.sportsEyebrow}
          title={t.sportsTitle}
          sub={t.sportsSub}
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <motion.div {...fadeUp}>
            <Card className="h-full overflow-hidden">
              <div className="flex items-center gap-3 border-b bg-emerald-50/70 px-6 py-4 dark:bg-emerald-950/20">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <Trophy className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-bold">{t.cricket}</h3>
                  <p className="text-xs text-muted-foreground">{t.cricketHint}</p>
                </div>
              </div>
              <CardContent className="flex flex-wrap gap-2 p-6">
                {t.cricketRoles.map((r) => (
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
                  <h3 className="font-bold">{t.football}</h3>
                  <p className="text-xs text-muted-foreground">{t.footballHint}</p>
                </div>
              </div>
              <CardContent className="flex flex-wrap gap-2 p-6">
                {t.footballRoles.map((r) => (
                  <Badge key={r} variant="secondary" className="px-3 py-1.5 text-sm">
                    {r}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div {...fadeUp} className="mt-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">{t.popularTypes}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {TOURNAMENT_TYPES.map((type) => (
              <Badge key={type} variant="outline" className="border-primary/25 bg-primary/5 px-3 py-1.5 text-sm text-foreground">
                {tournamentTypeLabel(type, lang)}
              </Badge>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="pricing" className="scroll-mt-16 border-t bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 py-14 sm:py-16">
          <SectionHeading eyebrow={t.pricingEyebrow} title={t.pricingTitle} sub={t.pricingSub} />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <motion.div {...fadeUp}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-5 p-6">
                  <div>
                    <h3 className="text-lg font-bold">{t.freeName}</h3>
                    <p className="text-sm text-muted-foreground">{t.freeWhen}</p>
                  </div>
                  <p className="text-4xl font-extrabold tracking-tight">{t.freePrice}</p>
                  <PerkList perks={t.freePerks(plans.freeMaxTeams, plans.freeMaxPlayers)} />
                  {user ? null : (
                    <Button variant="outline" size="lg" className="mt-auto min-h-11" asChild>
                      <AppLink href="/register">{t.startFree}</AppLink>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            <motion.div {...fadeUp}>
              <Card className="h-full border-2 border-primary/60 shadow-md shadow-primary/10">
                <CardContent className="flex h-full flex-col gap-5 p-6">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      <Crown className="h-5 w-5 text-amber-500" aria-hidden /> {t.proName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{t.proWhen}</p>
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-4xl font-extrabold tracking-tight text-primary">{proPrice}</span>
                    <span className="text-sm text-muted-foreground">{t.oneTime}</span>
                  </p>
                  <PerkList perks={t.proPerks} />
                </CardContent>
              </Card>
            </motion.div>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
            {t.howToPay}{' '}
            <AppLink href="/terms#refunds" className="font-medium text-foreground underline underline-offset-4">
              {t.refundLink}
            </AppLink>
          </p>
        </div>
      </section>

      {/* ---------------- Final CTA (sign-up pitch — not for logged-in users) ---------------- */}
      {user ? null : (
        <section className="container mx-auto max-w-7xl px-4 pb-16">
          <motion.div {...fadeUp}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-6 py-12 text-center text-white shadow-lg sm:px-12 sm:py-16 dark:from-teal-800 dark:via-teal-900 dark:to-emerald-950 dark:ring-1 dark:ring-white/10">
              <Zap className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 text-white/5" aria-hidden />
              <Trophy className="pointer-events-none absolute -bottom-10 -right-6 h-44 w-44 text-white/5" aria-hidden />
              <h2 className="relative text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t.ctaTitle}
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-teal-100">
                {t.ctaSub}
              </p>
              <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" className="min-h-11 bg-white text-teal-900 hover:bg-teal-50" asChild>
                  <AppLink href="/register">
                    <Rocket className="mr-1.5 h-4 w-4" aria-hidden /> {t.createAuction}
                  </AppLink>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-11 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white dark:border-white/40 dark:bg-transparent dark:hover:bg-white/10"
                  asChild
                >
                  <AppLink href="/login">
                    <PencilLine className="mr-1.5 h-4 w-4" aria-hidden /> {t.loginAsOrganizer}
                  </AppLink>
                </Button>
              </div>
              <p className="relative mt-5 flex items-center justify-center gap-1.5 text-xs text-teal-200">
                <Coins className="h-3.5 w-3.5" aria-hidden /> {t.ctaFoot(proPrice)}
              </p>
            </div>
          </motion.div>
        </section>
      )}
    </div>
  )
}
