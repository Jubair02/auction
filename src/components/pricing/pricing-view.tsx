'use client'

// /pricing — Free vs Pro. The numbers (Pro price, Free limits) are the admin's
// real settings: the server seeds them for the first render and /api/plans
// keeps them current (lib/plan-numbers). Everything listed under Pro is a
// feature the server actually gates on the tournament's plan.
import type { ComponentType, ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  ClipboardList,
  Crown,
  Gavel,
  Minus,
  Palette,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLink } from '@/components/shared/app-link'
import { Arena } from '@/components/shared/arena'
import { DASHBOARD_PATH } from '@/lib/access'
import { formatBDT } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'
import { usePlanNumbers } from '@/lib/plan-numbers'
import { useAuthState } from '@/lib/store'
import { cn } from '@/lib/utils'

type Cell = boolean | string

interface PricingStrings {
  eyebrow: string
  title: string
  sub: string
  chips: [string, string, string]
  freeName: string
  freeWhen: string
  freePrice: string
  forever: string
  freePerks: (teams: number, players: number) => string[]
  proName: string
  proTag: string
  proWhen: string
  oneTime: string
  proIntro: string
  proPerks: string[]
  startFree: string
  createTournament: string
  goDashboard: string
  upgradeHint: string
  howTitle: string
  howSub: string
  steps: { title: string; body: string }[]
  compareTitle: string
  compareSub: string
  feature: string
  rows: (teams: number, players: number) => { label: string; free: Cell; pro: Cell }[]
  included: string
  notIncluded: string
  faqTitle: string
  faqs: (price: string, teams: number, players: number) => { q: string; a: string }[]
  refundLink: string
  refundNote: string
  ctaTitle: string
  ctaSub: string
  ctaFoot: (price: string) => string
}

const STRINGS = {
  en: {
    eyebrow: 'Pricing',
    title: 'Start free. Pay once when you need more.',
    sub: 'Every tournament starts on Free. Upgrade a single tournament to Pro whenever it outgrows the limits — no subscription, no monthly bill.',
    chips: ['No subscription', 'Pay with bKash or Nagad', 'Priced per tournament'],
    freeName: 'Free',
    freeWhen: 'For small tournaments and trying it out',
    freePrice: '৳0',
    forever: 'free, always',
    freePerks: (teams, players) => [
      `Up to ${teams} teams and ${players} players`,
      'The full live auction room — timers, budgets, categories',
      'Player registration link',
      'Results page, fixtures and points table',
      'CSV export',
    ],
    proName: 'Pro',
    proTag: 'For leagues',
    proWhen: 'For leagues with more teams, sponsors and an audience',
    oneTime: 'one-time, per tournament',
    proIntro: 'Everything in Free, plus:',
    proPerks: [
      'Unlimited teams and players',
      'Import players from a CSV file',
      'SMS updates to players and team managers',
      'Your brand colour on the overlay, room, results and share cards',
      'Up to 20 sponsors with logos — a title sponsor shown as “Presented by”',
      'Stream overlay for Facebook / YouTube Live (OBS)',
      'Option to hide NeelamGhor branding on public pages',
    ],
    startFree: 'Start free',
    createTournament: 'Create a tournament',
    goDashboard: 'Go to my tournaments',
    upgradeHint: 'Upgrade from the tournament’s page whenever you’re ready.',
    howTitle: 'How Pro works',
    howSub: 'No card, no contract. Upgrade only the tournament that needs it.',
    steps: [
      { title: 'Create on Free', body: 'Set up the tournament, add players and teams. Nothing to pay yet.' },
      { title: 'Pay from the tournament', body: 'Open “Upgrade to Pro”, send the amount with bKash or Nagad and enter the Transaction ID.' },
      { title: 'Pro turns on', body: 'We check the payment — usually within a few hours — and every Pro feature unlocks for that tournament.' },
    ],
    compareTitle: 'Compare plans',
    compareSub: 'What each plan includes, side by side.',
    feature: 'Feature',
    rows: (teams, players) => [
      { label: 'Teams', free: `Up to ${teams}`, pro: 'Unlimited' },
      { label: 'Players', free: `Up to ${players}`, pro: 'Unlimited' },
      { label: 'Live auction room', free: true, pro: true },
      { label: 'Player registration link', free: true, pro: true },
      { label: 'Fixtures, results and points table', free: true, pro: true },
      { label: 'Stream overlay (OBS)', free: false, pro: true },
      { label: 'CSV export', free: true, pro: true },
      { label: 'Import players from CSV', free: false, pro: true },
      { label: 'SMS updates to players and managers', free: false, pro: true },
      { label: 'Your brand colour', free: false, pro: true },
      { label: 'Sponsor logos (up to 20)', free: false, pro: true },
      { label: 'Hide NeelamGhor branding', free: false, pro: true },
    ],
    included: 'Included',
    notIncluded: 'Not included',
    faqTitle: 'Questions, answered',
    faqs: (price, teams, players) => [
      { q: 'Is Pro a subscription?', a: `No. Pro is a one-time payment of ${price} for one tournament. There is nothing to cancel.` },
      { q: 'Does Pro cover all my tournaments?', a: 'No — you upgrade one tournament at a time. Your other tournaments stay on Free until you upgrade them too.' },
      { q: 'How do I pay?', a: 'From inside the tournament: choose “Upgrade to Pro”, send the amount with bKash or Nagad (Send Money), then enter the Transaction ID from the confirmation SMS.' },
      { q: 'How fast does Pro turn on?', a: 'As soon as an admin has checked the payment — usually within a few hours. You can keep working on the tournament in the meantime.' },
      { q: 'What can I do on Free?', a: `Run a complete auction: the live room, player registration, fixtures and results — for up to ${teams} teams and ${players} players.` },
      { q: 'Can I upgrade later?', a: 'Yes. Start on Free and upgrade whenever the tournament outgrows the limits or you want sponsors and your own branding.' },
    ],
    refundLink: 'Refund policy',
    refundNote: 'Paid for Pro and something went wrong? Read our',
    ctaTitle: 'Your auction. One room. Zero spreadsheets.',
    ctaSub: 'Create a free account, load your players and share the room code. The gavel is waiting.',
    ctaFoot: (price) => `Free to start — Pro is ${price} per tournament, once`,
  },
  bn: {
    eyebrow: 'দাম',
    title: 'ফ্রিতে শুরু করুন। বেশি লাগলে একবার পেমেন্ট।',
    sub: 'প্রতিটি টুর্নামেন্ট ফ্রি প্ল্যানে শুরু হয়। সীমা ছাড়িয়ে গেলে শুধু সেই টুর্নামেন্টটি Pro-তে নিন — কোনো মাসিক চার্জ নেই।',
    chips: ['কোনো মাসিক চার্জ নেই', 'bKash বা Nagad-এ পেমেন্ট', 'প্রতি টুর্নামেন্টে দাম'],
    freeName: 'ফ্রি',
    freeWhen: 'ছোট টুর্নামেন্ট আর চালিয়ে দেখার জন্য',
    freePrice: '৳0',
    forever: 'সবসময় ফ্রি',
    freePerks: (teams, players) => [
      `সর্বোচ্চ ${teams}টি দল ও ${players} জন খেলোয়াড়`,
      'পুরো লাইভ নিলাম রুম — টাইমার, বাজেট, ক্যাটাগরি',
      'খেলোয়াড় নিবন্ধনের লিংক',
      'ফলাফল পেজ, ফিকশ্চার ও পয়েন্ট টেবিল',
      'CSV এক্সপোর্ট',
    ],
    proName: 'Pro',
    proTag: 'লিগের জন্য',
    proWhen: 'বেশি দল, স্পনসর আর দর্শক নিয়ে লিগের জন্য',
    oneTime: 'এককালীন, প্রতি টুর্নামেন্টে',
    proIntro: 'ফ্রি-র সবকিছু, সাথে:',
    proPerks: [
      'সীমাহীন দল ও খেলোয়াড়',
      'CSV ফাইল থেকে খেলোয়াড় ইমপোর্ট',
      'খেলোয়াড় ও টিম ম্যানেজারদের SMS আপডেট',
      'ওভারলে, রুম, ফলাফল ও শেয়ার কার্ডে আপনার ব্র্যান্ড কালার',
      'লোগোসহ সর্বোচ্চ ২০টি স্পনসর — টাইটেল স্পনসর “Presented by” হিসেবে',
      'Facebook / YouTube Live-এর জন্য স্ট্রিম ওভারলে (OBS)',
      'পাবলিক পেজ থেকে NeelamGhor ব্র্যান্ডিং লুকানোর সুযোগ',
    ],
    startFree: 'ফ্রিতে শুরু করুন',
    createTournament: 'টুর্নামেন্ট তৈরি করুন',
    goDashboard: 'আমার টুর্নামেন্টে যান',
    upgradeHint: 'প্রস্তুত হলে টুর্নামেন্টের পেজ থেকেই আপগ্রেড করুন।',
    howTitle: 'Pro যেভাবে কাজ করে',
    howSub: 'কোনো কার্ড বা চুক্তি নেই। শুধু যে টুর্নামেন্টের দরকার, সেটিই আপগ্রেড করুন।',
    steps: [
      { title: 'ফ্রিতে তৈরি করুন', body: 'টুর্নামেন্ট সাজান, খেলোয়াড় ও দল যোগ করুন। এখনো কিছু দিতে হবে না।' },
      { title: 'টুর্নামেন্ট থেকেই পেমেন্ট', body: '“Pro-তে আপগ্রেড করুন” খুলে bKash বা Nagad-এ টাকা পাঠান এবং ট্রানজ্যাকশন আইডি দিন।' },
      { title: 'Pro চালু হয়', body: 'আমরা পেমেন্ট যাচাই করি — সাধারণত কয়েক ঘণ্টার মধ্যে — তারপর সেই টুর্নামেন্টে Pro-এর সব সুবিধা খুলে যায়।' },
    ],
    compareTitle: 'প্ল্যান মিলিয়ে দেখুন',
    compareSub: 'কোন প্ল্যানে কী আছে, পাশাপাশি।',
    feature: 'সুবিধা',
    rows: (teams, players) => [
      { label: 'দল', free: `সর্বোচ্চ ${teams}টি`, pro: 'সীমাহীন' },
      { label: 'খেলোয়াড়', free: `সর্বোচ্চ ${players} জন`, pro: 'সীমাহীন' },
      { label: 'লাইভ নিলাম রুম', free: true, pro: true },
      { label: 'খেলোয়াড় নিবন্ধনের লিংক', free: true, pro: true },
      { label: 'ফিকশ্চার, ফলাফল ও পয়েন্ট টেবিল', free: true, pro: true },
      { label: 'স্ট্রিম ওভারলে (OBS)', free: false, pro: true },
      { label: 'CSV এক্সপোর্ট', free: true, pro: true },
      { label: 'CSV থেকে খেলোয়াড় ইমপোর্ট', free: false, pro: true },
      { label: 'খেলোয়াড় ও ম্যানেজারদের SMS আপডেট', free: false, pro: true },
      { label: 'আপনার ব্র্যান্ড কালার', free: false, pro: true },
      { label: 'স্পনসরের লোগো (সর্বোচ্চ ২০টি)', free: false, pro: true },
      { label: 'NeelamGhor ব্র্যান্ডিং লুকানো', free: false, pro: true },
    ],
    included: 'আছে',
    notIncluded: 'নেই',
    faqTitle: 'সাধারণ প্রশ্ন',
    faqs: (price, teams, players) => [
      { q: 'Pro কি মাসিক সাবস্ক্রিপশন?', a: `না। Pro হলো একটি টুর্নামেন্টের জন্য এককালীন ${price}। বাতিল করার কিছু নেই।` },
      { q: 'Pro কি আমার সব টুর্নামেন্টে চলবে?', a: 'না — একবারে একটি টুর্নামেন্ট আপগ্রেড হয়। বাকিগুলো ফ্রি থাকবে, যতক্ষণ না সেগুলোও আপগ্রেড করেন।' },
      { q: 'কীভাবে পেমেন্ট করব?', a: 'টুর্নামেন্টের ভেতর থেকে: “Pro-তে আপগ্রেড করুন” বেছে bKash বা Nagad-এ (Send Money) টাকা পাঠান, তারপর কনফার্মেশন SMS-এর ট্রানজ্যাকশন আইডি দিন।' },
      { q: 'Pro কত দ্রুত চালু হয়?', a: 'অ্যাডমিন পেমেন্ট যাচাই করলেই — সাধারণত কয়েক ঘণ্টার মধ্যে। এর মধ্যেও টুর্নামেন্টের কাজ চালিয়ে যেতে পারবেন।' },
      { q: 'ফ্রি-তে কী কী করা যায়?', a: `পুরো একটি নিলাম চালানো যায়: লাইভ রুম, খেলোয়াড় নিবন্ধন, ফিকশ্চার ও ফলাফল — সর্বোচ্চ ${teams}টি দল ও ${players} জন খেলোয়াড় নিয়ে।` },
      { q: 'পরে কি আপগ্রেড করা যাবে?', a: 'হ্যাঁ। ফ্রিতে শুরু করুন, টুর্নামেন্ট সীমা ছাড়ালে বা স্পনসর ও নিজের ব্র্যান্ডিং চাইলে যেকোনো সময় আপগ্রেড করুন।' },
    ],
    refundLink: 'রিফান্ড নীতি',
    refundNote: 'Pro-এর টাকা দিয়ে কোনো সমস্যা হয়েছে? দেখুন আমাদের',
    ctaTitle: 'আপনার নিলাম। এক রুমে। কোনো এক্সেল শিট ছাড়াই।',
    ctaSub: 'ফ্রি অ্যাকাউন্ট খুলুন, খেলোয়াড় তুলুন আর রুম কোড শেয়ার করুন। হাতুড়ি অপেক্ষা করছে।',
    ctaFoot: (price) => `শুরু করুন ফ্রিতে — Pro প্রতি টুর্নামেন্টে ${price}, একবারই`,
  },
} satisfies Strings<PricingStrings>

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.45, ease: 'easeOut' as const },
}

const CHIP_ICONS = [Sparkles, Smartphone, Trophy]
const STEP_ICONS = [ClipboardList, Receipt, Zap]

export default function PricingView() {
  const t = useStrings<PricingStrings>(STRINGS)
  const { user } = useAuthState()
  const plans = usePlanNumbers()
  const proPrice = formatBDT(plans.proPrice)
  const teams = plans.freeMaxTeams
  const players = plans.freeMaxPlayers
  const organizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN'

  // Guests sign up; organizers go to their tournaments (Pro is bought per tournament there).
  const primaryHref = user ? DASHBOARD_PATH : '/register'
  const primaryLabel = user ? t.goDashboard : t.createTournament

  return (
    <div className="relative">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_70%)]"
          aria-hidden
        />
        <div className="container mx-auto max-w-4xl px-4 pb-10 pt-12 text-center sm:pb-14 sm:pt-16">
          <motion.p {...fadeUp} className="text-sm font-bold uppercase tracking-widest text-primary">
            {t.eyebrow}
          </motion.p>
          <motion.h1 {...fadeUp} className="mx-auto mt-3 max-w-3xl text-3xl font-black leading-[1.1] tracking-tight text-balance sm:text-5xl">
            {t.title}
          </motion.h1>
          <motion.p {...fadeUp} className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            {t.sub}
          </motion.p>
          <motion.ul {...fadeUp} className="mt-6 flex flex-wrap justify-center gap-2">
            {t.chips.map((chip, i) => {
              const Icon = CHIP_ICONS[i]
              return (
                <li key={chip} className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-semibold text-foreground/85 sm:text-sm">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden /> {chip}
                </li>
              )
            })}
          </motion.ul>
        </div>
      </section>

      {/* ---------------- Plans ---------------- */}
      <section aria-label={`${t.freeName} / ${t.proName}`} className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {/* Free */}
          <motion.article {...fadeUp} className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <PlanHeader icon={BadgeCheck} name={t.freeName} when={t.freeWhen} />
            <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
              <span className="text-5xl font-black tracking-tight tabular-nums">{t.freePrice}</span>
              <span className="text-sm text-muted-foreground">{t.forever}</span>
            </p>
            <div className="my-6 h-px bg-border" />
            <PerkList perks={t.freePerks(teams, players)} />
            <div className="mt-auto pt-8">
              {user ? (
                <Button variant="outline" size="lg" className="min-h-12 w-full font-semibold" asChild>
                  <AppLink href={DASHBOARD_PATH}>{t.goDashboard}</AppLink>
                </Button>
              ) : (
                <Button variant="outline" size="lg" className="min-h-12 w-full font-semibold" asChild>
                  <AppLink href="/register">{t.startFree}</AppLink>
                </Button>
              )}
            </div>
          </motion.article>

          {/* Pro */}
          <motion.div {...fadeUp} className="flex">
            <Arena as="div" className="flex w-full flex-col p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <PlanHeader icon={Crown} iconClass="text-amber-300" name={t.proName} when={t.proWhen} />
                <span className="shrink-0 rounded-md bg-amber-400/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/30">
                  {t.proTag}
                </span>
              </div>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
                <span className="text-5xl font-black tracking-tight tabular-nums text-teal-200">{proPrice}</span>
                <span className="text-sm text-muted-foreground">{t.oneTime}</span>
              </p>
              <div className="my-6 h-px bg-white/10" />
              <p className="mb-3 text-sm font-semibold text-foreground/90">{t.proIntro}</p>
              <PerkList perks={t.proPerks} tone="pro" />
              <div className="mt-auto pt-8">
                <Button size="lg" className="min-h-12 w-full font-bold transition-transform active:scale-[0.98]" asChild>
                  <AppLink href={primaryHref}>
                    {primaryLabel} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                  </AppLink>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">{t.upgradeHint}</p>
              </div>
            </Arena>
          </motion.div>
        </div>
      </section>

      {/* ---------------- How Pro works ---------------- */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <SectionHeading title={t.howTitle} sub={t.howSub} />
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {t.steps.map((step, i) => {
              const Icon = STEP_ICONS[i]
              return (
                <motion.li key={step.title} {...fadeUp} className="relative rounded-2xl border bg-card p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
                </motion.li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* ---------------- Compare ---------------- */}
      <section className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <SectionHeading title={t.compareTitle} sub={t.compareSub} />
        <motion.div {...fadeUp} className="mt-8 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">{t.compareTitle}</caption>
            <colgroup>
              <col />
              <col className="w-[26%] sm:w-[22%]" />
              <col className="w-[26%] sm:w-[22%]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-3 py-3 font-semibold text-muted-foreground sm:px-5">{t.feature}</th>
                <th scope="col" className="px-2 py-3 text-center font-bold sm:px-4">{t.freeName}</th>
                <th scope="col" className="px-2 py-3 text-center font-bold text-primary sm:px-4">
                  <span className="inline-flex items-center gap-1">
                    <Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden /> {t.proName}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {t.rows(teams, players).map((row) => (
                <tr key={row.label} className="transition-colors hover:bg-muted/30">
                  <th scope="row" className="px-3 py-3 text-left font-medium leading-snug sm:px-5">{row.label}</th>
                  <td className="px-2 py-3 text-center sm:px-4">
                    <CompareCell value={row.free} t={t} />
                  </td>
                  <td className="bg-primary/[0.04] px-2 py-3 text-center sm:px-4">
                    <CompareCell value={row.pro} t={t} pro />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <SectionHeading title={t.faqTitle} />
          <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {t.faqs(proPrice, teams, players).map((f) => (
              <motion.div key={f.q} {...fadeUp}>
                <dt className="flex items-start gap-2.5 text-base font-bold tracking-tight">
                  <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden /> {f.q}
                </dt>
                <dd className="mt-2 pl-[1.875rem] text-sm leading-relaxed text-muted-foreground text-pretty">{f.a}</dd>
              </motion.div>
            ))}
          </dl>
          <p className="mt-10 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> {t.refundNote}{' '}
            <AppLink href="/terms#refunds" className="rounded-sm font-semibold text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {t.refundLink}
            </AppLink>
          </p>
        </div>
      </section>

      {/* ---------------- Final CTA (guests and organizers) ---------------- */}
      {!user || organizer ? (
        <section className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <motion.div {...fadeUp}>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 px-6 py-12 text-center text-white shadow-lg sm:px-12 sm:py-14 dark:from-teal-800 dark:via-teal-900 dark:to-emerald-950 dark:ring-1 dark:ring-white/10">
              <Gavel className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 text-white/5" aria-hidden />
              <Users className="pointer-events-none absolute -bottom-10 -right-6 h-44 w-44 text-white/5" aria-hidden />
              <h2 className="relative text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{t.ctaTitle}</h2>
              <p className="relative mx-auto mt-3 max-w-xl text-teal-100 text-pretty">{t.ctaSub}</p>
              <Button size="lg" variant="secondary" className="relative mt-7 min-h-12 bg-white px-6 font-bold text-teal-900 hover:bg-teal-50" asChild>
                <AppLink href={primaryHref}>
                  {primaryLabel} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </AppLink>
              </Button>
              <p className="relative mt-5 flex items-center justify-center gap-1.5 text-xs text-teal-200">
                <Palette className="h-3.5 w-3.5" aria-hidden /> {t.ctaFoot(proPrice)}
              </p>
            </div>
          </motion.div>
        </section>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------- parts */

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{title}</h2>
      {sub ? <p className="mt-3 text-muted-foreground text-pretty">{sub}</p> : null}
    </motion.div>
  )
}

function PlanHeader({
  icon: Icon,
  iconClass,
  name,
  when,
}: {
  icon: ComponentType<{ className?: string }>
  iconClass?: string
  name: string
  when: string
}) {
  return (
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
        <Icon className={cn('h-5 w-5 text-primary', iconClass)} aria-hidden /> {name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{when}</p>
    </div>
  )
}

function PerkList({ perks, tone }: { perks: string[]; tone?: 'pro' }) {
  return (
    <ul className="space-y-3 text-sm">
      {perks.map((perk) => (
        <li key={perk} className="flex items-start gap-2.5">
          <span
            className={cn(
              'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              tone === 'pro' ? 'bg-teal-400/15 text-teal-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
            aria-hidden
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <span className="leading-relaxed">{perk}</span>
        </li>
      ))}
    </ul>
  )
}

function CompareCell({ value, t, pro }: { value: Cell; t: PricingStrings; pro?: boolean }): ReactNode {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className={cn('h-5 w-5', pro ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400')} strokeWidth={2.75} aria-hidden />
        <span className="sr-only">{t.included}</span>
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center text-muted-foreground/60">
        <Minus className="h-5 w-5" aria-hidden />
        <span className="sr-only">{t.notIncluded}</span>
      </span>
    )
  }
  return <span className={cn('text-xs font-semibold leading-snug sm:text-sm', pro && 'text-primary')}>{value}</span>
}
