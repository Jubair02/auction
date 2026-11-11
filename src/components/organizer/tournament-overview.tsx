'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ClipboardCopy,
  Clock,
  Crown,
  DoorOpen,
  Gavel,
  Info,
  KeyRound,
  Radio,
  Share2,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { copyText } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatCard } from '@/components/shared/empty-state'
import { navigate } from '@/lib/router'
import { formatBDT, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentDTO, PlanInfo, TournamentDetail } from '@/lib/types'
import { type Lang, type Strings, useStrings, useLang } from '@/lib/i18n'
import { useCachedGet } from '@/lib/api-cache'
import { PLANS_URL, paymentsUrl, UpgradeDialog } from '@/components/organizer/upgrade-dialog'
import { tournamentTypeLabel } from '@/lib/tournament-types'

type OverviewStrings = {
  viewResults: string
  addPlayers: string
  createTeams: string
  setUpAuction: string
  enterLive: string
  openAuctionRoom: string
  playersEmpty: string
  playersInPool: (n: number) => string
  manage: string
  categoriesTitle: string
  categoriesEmpty: string
  allCategorized: string
  uncategorized: (n: number) => string
  fix: string
  teamsEmpty: string
  teamsDetail: (n: number, budget: string) => string
  managersTitle: string
  managersEmpty: string
  managersClaim: (managed: number, total: number) => string
  managersCount: (managed: number, total: number) => string
  invite: string
  auctionTitle: string
  auctionDetail: (code: string, seconds: number) => string
  auctionEmpty: string
  settings: string
  setUp: string
  liveTitle: string
  liveEnded: string
  liveStarted: string
  liveReady: string
  results: string
  enterRoom: string
  openRoom: string
  auctionComplete: string
  getReady: string
  setupProgress: string
  recommended: string
  doneSr: string
  todoSr: string
  roomStatus: Record<string, string>
  noRoomCode: string
  noRoomDesc: string
  roomCode: string
  codeCopied: string
  copyCode: (code: string) => string
  inviteMessage: (name: string, code: string, url: string) => string
  inviteCopied: string
  copyInvite: string
  viewRoom: string
  roomFooter: (seconds: number, increment: string) => string
  bidsSoFar: (n: number) => string
  rowType: string
  rowLocation: string
  rowStart: string
  rowAuctionAt: string
  rowMode: string
  categoryModeValue: string
  normal: string
  rowBasePrice: string
  setPerCategory: string
  rowCreated: string
  details: string
  players: string
  playersHint: (sold: number, unsold: number) => string
  teams: string
  teamsHint: (managed: number) => string
  totalBudget: string
  acrossTeams: string
  spentSoFar: string
  left: (amount: string) => string
  planTitle: string
  freePlan: string
  proPlan: string
  proSince: (date: string) => string
  proPerks: string
  usageTeams: (n: number, max: number) => string
  usagePlayers: (n: number, max: number) => string
  usageAria: (what: string, pct: number) => string
  freeUnlocks: string
  upgradeFor: (price: string) => string
  paymentReview: string
  paymentReviewDesc: string
  askOwner: string
}

const STRINGS = {
  en: {
    viewResults: 'View results',
    addPlayers: 'Add players',
    createTeams: 'Create teams',
    setUpAuction: 'Set up auction',
    enterLive: 'Enter live room',
    openAuctionRoom: 'Open auction room',
    playersEmpty: 'Type them in or import a CSV with names, roles and base prices.',
    playersInPool: (n) => `${n} player${n === 1 ? '' : 's'} in the pool`,
    manage: 'Manage',
    categoriesTitle: 'Give every player a category',
    categoriesEmpty: 'Category mode sells A–E in order, each with its own base price.',
    allCategorized: 'Every player has a category',
    uncategorized: (n) => `${n} player${n === 1 ? '' : 's'} without a category — random picks skip them`,
    fix: 'Fix',
    teamsEmpty: 'Names, colours, budgets and squad limits.',
    teamsDetail: (n, budget) => `${n} team${n === 1 ? '' : 's'} · ${budget} in total budgets`,
    managersTitle: 'Give each team a manager',
    managersEmpty: 'Invite managers so they can bid from their own phones.',
    managersClaim: (managed, total) => `${managed} of ${total} assigned — the rest can claim a team in the room`,
    managersCount: (managed, total) => `${managed} of ${total} teams have a manager`,
    invite: 'Invite',
    auctionTitle: 'Set up the auction',
    auctionDetail: (code, seconds) => `Room ${code} · ${seconds}s per bid`,
    auctionEmpty: 'Pick the timer and increments to get your room code.',
    settings: 'Settings',
    setUp: 'Set up',
    liveTitle: 'Run the live auction',
    liveEnded: 'Finished — the final squads are in the results report.',
    liveStarted: 'The auction is under way.',
    liveReady: 'Share the room code, open the room and press Start.',
    results: 'Results',
    enterRoom: 'Enter room',
    openRoom: 'Open room',
    auctionComplete: 'Auction complete',
    getReady: 'Get ready to go live',
    setupProgress: 'Setup progress',
    recommended: 'Recommended',
    doneSr: ' — done',
    todoSr: ' — to do',
    roomStatus: { READY: 'Ready to start', LIVE: 'Live now', PAUSED: 'Paused', ENDED: 'Ended' },
    noRoomCode: 'No room code yet',
    noRoomDesc: 'Set up the auction to get a code managers join with.',
    roomCode: 'Room code',
    codeCopied: 'Room code copied',
    copyCode: (code) => `Copy room code ${code}`,
    inviteMessage: (name, code, url) => `NeelamGhor Live Auction — ${name}. Room Code: ${code}. Join: ${url}`,
    inviteCopied: 'Invite message copied',
    copyInvite: 'Copy invite',
    viewRoom: 'View room',
    roomFooter: (seconds, increment) => `${seconds}s bid timer · min increment ${increment}`,
    bidsSoFar: (n) => `${n} bids so far`,
    rowType: 'Type',
    rowLocation: 'Location',
    rowStart: 'Start date',
    rowAuctionAt: 'Auction at',
    rowMode: 'Auction mode',
    categoryModeValue: 'Category-Based (A–E)',
    normal: 'Normal',
    rowBasePrice: 'Base price',
    setPerCategory: 'Set per category',
    rowCreated: 'Created',
    details: 'Details',
    players: 'Players',
    playersHint: (sold, unsold) => `${sold} sold · ${unsold} unsold`,
    teams: 'Teams',
    teamsHint: (managed) => `${managed} with a manager`,
    totalBudget: 'Total budget',
    acrossTeams: 'Across all teams',
    spentSoFar: 'Spent so far',
    left: (amount) => `${amount} left`,
    planTitle: 'Plan',
    freePlan: 'Free',
    proPlan: 'Pro',
    proSince: (date) => `Pro since ${date}`,
    proPerks: 'Unlimited teams and players, SMS updates and no watermark on the stream overlay.',
    usageTeams: (n, max) => `Teams ${n} / ${max}`,
    usagePlayers: (n, max) => `Players ${n} / ${max}`,
    usageAria: (what, pct) => `${what}: ${pct}% of the free limit used`,
    freeUnlocks: 'Pro unlocks unlimited teams and players, SMS updates to players, and removes the watermark from the stream overlay.',
    upgradeFor: (price) => `Upgrade to Pro — ${price}`,
    paymentReview: 'Payment under review',
    paymentReviewDesc: 'Pro turns on as soon as an admin verifies your Transaction ID.',
    askOwner: 'Only the tournament owner can upgrade it to Pro.',
  },
  bn: {
    viewResults: 'ফলাফল দেখুন',
    addPlayers: 'খেলোয়াড় যোগ করুন',
    createTeams: 'দল তৈরি করুন',
    setUpAuction: 'নিলাম সেট আপ করুন',
    enterLive: 'লাইভ রুমে ঢুকুন',
    openAuctionRoom: 'নিলাম রুম খুলুন',
    playersEmpty: 'হাতে লিখুন, বা নাম, রোল আর বেস প্রাইসসহ CSV ইমপোর্ট করুন।',
    playersInPool: (n) => `তালিকায় ${n} জন খেলোয়াড়`,
    manage: 'ম্যানেজ করুন',
    categoriesTitle: 'প্রতিটি খেলোয়াড়কে ক্যাটাগরি দিন',
    categoriesEmpty: 'ক্যাটাগরি মোডে A থেকে E ক্রমে বিক্রি হয়, প্রতিটির আলাদা বেস প্রাইস।',
    allCategorized: 'সব খেলোয়াড়ের ক্যাটাগরি দেওয়া আছে',
    uncategorized: (n) => `${n} জন খেলোয়াড়ের ক্যাটাগরি নেই — র‍্যান্ডম বাছাইয়ে তারা বাদ পড়বে`,
    fix: 'ঠিক করুন',
    teamsEmpty: 'নাম, রং, বাজেট আর স্কোয়াড লিমিট।',
    teamsDetail: (n, budget) => `${n}টি দল · মোট বাজেট ${budget}`,
    managersTitle: 'প্রতিটি দলে একজন ম্যানেজার দিন',
    managersEmpty: 'ম্যানেজারদের আমন্ত্রণ পাঠান, যাতে তারা নিজের ফোন থেকে বিড করতে পারেন।',
    managersClaim: (managed, total) => `${total}টির মধ্যে ${managed}টি দলে ম্যানেজার আছে — বাকিরা রুমে এসে দল নিতে পারবেন`,
    managersCount: (managed, total) => `${total}টির মধ্যে ${managed}টি দলে ম্যানেজার আছে`,
    invite: 'আমন্ত্রণ',
    auctionTitle: 'নিলাম সেট আপ করুন',
    auctionDetail: (code, seconds) => `রুম ${code} · প্রতি বিডে ${seconds} সেকেন্ড`,
    auctionEmpty: 'টাইমার আর ইনক্রিমেন্ট ঠিক করলেই রুম কোড পাবেন।',
    settings: 'সেটিংস',
    setUp: 'সেট আপ',
    liveTitle: 'লাইভ নিলাম চালান',
    liveEnded: 'শেষ — চূড়ান্ত স্কোয়াড ফলাফল রিপোর্টে আছে।',
    liveStarted: 'নিলাম চলছে।',
    liveReady: 'রুম কোড শেয়ার করুন, রুম খুলুন আর Start চাপুন।',
    results: 'ফলাফল',
    enterRoom: 'রুমে ঢুকুন',
    openRoom: 'রুম খুলুন',
    auctionComplete: 'নিলাম সম্পন্ন',
    getReady: 'লাইভে যাওয়ার প্রস্তুতি',
    setupProgress: 'সেট আপের অগ্রগতি',
    recommended: 'প্রস্তাবিত',
    doneSr: ' — হয়ে গেছে',
    todoSr: ' — বাকি',
    roomStatus: { READY: 'শুরুর জন্য প্রস্তুত', LIVE: 'এখন লাইভ', PAUSED: 'বিরতি', ENDED: 'শেষ' },
    noRoomCode: 'এখনো রুম কোড নেই',
    noRoomDesc: 'নিলাম সেট আপ করলে একটি কোড পাবেন, ম্যানেজাররা সেটা দিয়ে যোগ দেবেন।',
    roomCode: 'রুম কোড',
    codeCopied: 'রুম কোড কপি হয়েছে',
    copyCode: (code) => `রুম কোড ${code} কপি করুন`,
    inviteMessage: (name, code, url) => `NeelamGhor লাইভ নিলাম — ${name}। রুম কোড: ${code}। যোগ দিন: ${url}`,
    inviteCopied: 'আমন্ত্রণ মেসেজ কপি হয়েছে',
    copyInvite: 'আমন্ত্রণ কপি করুন',
    viewRoom: 'রুম দেখুন',
    roomFooter: (seconds, increment) => `${seconds} সেকেন্ডের বিড টাইমার · সর্বনিম্ন বৃদ্ধি ${increment}`,
    bidsSoFar: (n) => `এ পর্যন্ত ${n}টি বিড`,
    rowType: 'ধরন',
    rowLocation: 'স্থান',
    rowStart: 'শুরুর তারিখ',
    rowAuctionAt: 'নিলামের সময়',
    rowMode: 'নিলামের ধরন',
    categoryModeValue: 'ক্যাটাগরি ভিত্তিক (A–E)',
    normal: 'নরমাল',
    rowBasePrice: 'বেস প্রাইস',
    setPerCategory: 'ক্যাটাগরি অনুযায়ী',
    rowCreated: 'তৈরি হয়েছে',
    details: 'বিস্তারিত',
    players: 'খেলোয়াড়',
    playersHint: (sold, unsold) => `${sold} বিক্রি · ${unsold} অবিক্রিত`,
    teams: 'দল',
    teamsHint: (managed) => `${managed}টিতে ম্যানেজার আছে`,
    totalBudget: 'মোট বাজেট',
    acrossTeams: 'সব দল মিলিয়ে',
    spentSoFar: 'এ পর্যন্ত খরচ',
    left: (amount) => `${amount} বাকি`,
    planTitle: 'প্ল্যান',
    freePlan: 'ফ্রি',
    proPlan: 'Pro',
    proSince: (date) => `${date} থেকে Pro`,
    proPerks: 'সীমাহীন দল ও খেলোয়াড়, SMS আপডেট, আর স্ট্রিম ওভারলেতে কোনো জলছাপ নেই।',
    usageTeams: (n, max) => `দল ${n} / ${max}`,
    usagePlayers: (n, max) => `খেলোয়াড় ${n} / ${max}`,
    usageAria: (what, pct) => `${what}: ফ্রি সীমার ${pct}% ব্যবহার হয়েছে`,
    freeUnlocks: 'Pro-তে পাবেন সীমাহীন দল ও খেলোয়াড়, খেলোয়াড়দের SMS আপডেট, আর স্ট্রিম ওভারলেতে জলছাপ থাকবে না।',
    upgradeFor: (price) => `Pro-তে আপগ্রেড — ${price}`,
    paymentReview: 'পেমেন্ট যাচাই হচ্ছে',
    paymentReviewDesc: 'অ্যাডমিন আপনার ট্রানজেকশন আইডি যাচাই করলেই Pro চালু হবে।',
    askOwner: 'শুধু টুর্নামেন্টের মালিক এটি Pro-তে আপগ্রেড করতে পারেন।',
  },
} satisfies Strings<OverviewStrings>

/** Tabs of the tournament page a checklist step can send the organizer to. */
export type DetailTab = 'overview' | 'players' | 'teams' | 'registrations' | 'insights' | 'auction'

export interface NextStep {
  label: string
  icon: LucideIcon
  /** Switch to a tab of this page… */
  tab?: DetailTab
  /** …or leave for another page. */
  href?: string
  /** The room is live right now — the button should draw the eye. */
  live?: boolean
}

/**
 * The one thing the organizer should do next, from what the page already knows.
 * Drives both the header's primary button and the checklist highlight.
 */
export function nextStep({ tournament: t, players, teams, auction }: TournamentDetail, lang: Lang = 'en'): NextStep {
  const s = STRINGS[lang]
  if (t.status === 'COMPLETED' || auction?.status === 'ENDED') {
    return { label: s.viewResults, icon: Trophy, href: `/results/${t.id}` }
  }
  if (players.length === 0) return { label: s.addPlayers, icon: Users, tab: 'players' }
  if (teams.length === 0) return { label: s.createTeams, icon: Wallet, tab: 'teams' }
  if (!auction) return { label: s.setUpAuction, icon: Gavel, tab: 'auction' }
  if (auction.status === 'LIVE' || auction.status === 'PAUSED') {
    return { label: s.enterLive, icon: Radio, href: `/room/${auction.roomCode}`, live: true }
  }
  return { label: s.openAuctionRoom, icon: DoorOpen, href: `/room/${auction.roomCode}` }
}

export function goTo(step: Pick<NextStep, 'tab' | 'href'>, setTab: (tab: DetailTab) => void) {
  if (step.href) navigate(step.href)
  else if (step.tab) setTab(step.tab)
}

/** Owner, admin or co-organizer — the same line the detail page draws for its setup tabs. */
const canManage = ({ myAccess }: TournamentDetail) => myAccess === 'OWNER' || myAccess === 'ADMIN' || myAccess === 'CO_ORGANIZER'

interface ChecklistItem {
  key: string
  title: string
  detail: string
  done: boolean
  /** Shown as a "Recommended" step: not needed to go live. */
  optional?: boolean
  action?: { label: string; tab?: DetailTab; href?: string }
}

function checklist(data: TournamentDetail, s: OverviewStrings): ChecklistItem[] {
  const { tournament: t, players, teams, auction } = data
  const uncategorized = t.auctionMode === 'CATEGORY' ? players.filter((p) => !p.category).length : 0
  const managed = teams.filter((tm) => tm.managerUserId).length
  const started = !!auction && auction.status !== 'READY'
  const items: ChecklistItem[] = [
    {
      key: 'players',
      title: s.addPlayers,
      detail: players.length === 0 ? s.playersEmpty : s.playersInPool(players.length),
      done: players.length > 0,
      action: { label: players.length === 0 ? s.addPlayers : s.manage, tab: 'players' },
    },
  ]
  if (t.auctionMode === 'CATEGORY') {
    items.push({
      key: 'categories',
      title: s.categoriesTitle,
      detail:
        players.length === 0
          ? s.categoriesEmpty
          : uncategorized === 0
            ? s.allCategorized
            : s.uncategorized(uncategorized),
      done: players.length > 0 && uncategorized === 0,
      optional: true,
      action: uncategorized > 0 ? { label: s.fix, tab: 'players' } : undefined,
    })
  }
  items.push(
    {
      key: 'teams',
      title: s.createTeams,
      detail:
        teams.length === 0
          ? s.teamsEmpty
          : s.teamsDetail(teams.length, formatBDT(teams.reduce((n, tm) => n + tm.budget, 0))),
      done: teams.length > 0,
      action: { label: teams.length === 0 ? s.createTeams : s.manage, tab: 'teams' },
    },
    {
      key: 'managers',
      title: s.managersTitle,
      detail:
        teams.length === 0
          ? s.managersEmpty
          : auction?.allowOpenClaim && managed < teams.length
            ? s.managersClaim(managed, teams.length)
            : s.managersCount(managed, teams.length),
      done: teams.length > 0 && (managed === teams.length || !!auction?.allowOpenClaim),
      optional: true,
      action: teams.length > 0 && managed < teams.length ? { label: s.invite, tab: 'teams' } : undefined,
    },
    {
      key: 'auction',
      title: s.auctionTitle,
      detail: auction ? s.auctionDetail(auction.roomCode, auction.bidTimerSeconds) : s.auctionEmpty,
      done: !!auction,
      action: { label: auction ? s.settings : s.setUp, tab: 'auction' },
    },
    {
      key: 'live',
      title: s.liveTitle,
      detail:
        auction?.status === 'ENDED'
          ? s.liveEnded
          : started
            ? s.liveStarted
            : s.liveReady,
      done: auction?.status === 'ENDED' || t.status === 'COMPLETED',
      action: auction
        ? auction.status === 'ENDED'
          ? { label: s.results, href: `/results/${t.id}` }
          : { label: started ? s.enterRoom : s.openRoom, href: `/room/${auction.roomCode}` }
        : undefined,
    },
  )
  // Read-only staff can't open the setup tabs — keep only the links that leave the page.
  if (!canManage(data)) {
    for (const item of items) if (item.action?.tab) item.action = undefined
  }
  return items
}

function SetupChecklist({ data, setTab }: { data: TournamentDetail; setTab: (tab: DetailTab) => void }) {
  const s = useStrings(STRINGS)
  const items = checklist(data, s)
  const required = items.filter((i) => !i.optional)
  const doneCount = required.filter((i) => i.done).length
  // The first unfinished required step is the one to do now.
  const currentKey = required.find((i) => !i.done)?.key
  const allDone = doneCount === required.length

  return (
    <Card className="gap-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{allDone ? s.auctionComplete : s.getReady}</CardTitle>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {doneCount}/{required.length}
          </span>
        </div>
        <Progress value={(doneCount / required.length) * 100} className="mt-2 h-1.5" aria-label={s.setupProgress} />
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {items.map((item) => {
            const current = item.key === currentKey
            return (
              <li
                key={item.key}
                className={cn(
                  // Narrow phones: the action drops under the text instead of squeezing it.
                  'grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 min-[420px]:flex',
                  current && '-mx-3 rounded-lg bg-primary/5 px-3',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                    item.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : current
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground'
                  )}
                  aria-hidden
                >
                  {item.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : items.indexOf(item) + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold', item.done && !current && 'text-muted-foreground')}>
                    {item.title}
                    {item.optional ? (
                      <span className="text-xs font-normal text-muted-foreground">{s.recommended}</span>
                    ) : null}
                    <span className="sr-only">{item.done ? s.doneSr : s.todoSr}</span>
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground sm:truncate">{item.detail}</p>
                </div>
                {item.action ? (
                  <Button
                    size="sm"
                    variant={current ? 'default' : 'ghost'}
                    className="col-start-2 h-8 shrink-0 justify-self-start"
                    onClick={() => goTo(item.action!, setTab)}
                  >
                    {item.action.label}
                    {current ? <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden /> : null}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

const ROOM_STATUS_CLASS: Record<string, string> = {
  READY: 'bg-muted text-muted-foreground',
  LIVE: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  PAUSED: 'bg-muted text-muted-foreground',
  ENDED: 'bg-teal-100 text-teal-900 dark:bg-teal-950/50 dark:text-teal-200',
}

function copy(text: string, done: string) {
  copyText(text, done)
}

function RoomCard({ data, setTab }: { data: TournamentDetail; setTab: (tab: DetailTab) => void }) {
  const s = useStrings(STRINGS)
  const { tournament: t, auction } = data
  if (!auction) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <KeyRound className="h-7 w-7 text-muted-foreground" aria-hidden />
          <p className="font-semibold">{s.noRoomCode}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{s.noRoomDesc}</p>
          {canManage(data) ? (
            <Button variant="outline" size="sm" className="mt-1" onClick={() => setTab('auction')}>
              {s.setUpAuction}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }
  const known = auction.status in ROOM_STATUS_CLASS
  const status = {
    label: known ? s.roomStatus[auction.status] : s.roomStatus.READY,
    className: known ? ROOM_STATUS_CLASS[auction.status] : ROOM_STATUS_CLASS.READY,
  }
  const joinUrl = () => `${window.location.origin}/room/${auction.roomCode}`
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.roomCode}</p>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', status.className)}>{status.label}</span>
        </div>
        <button
          type="button"
          onClick={() => copy(auction.roomCode, s.codeCopied)}
          className="group flex w-full items-center justify-between gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/60"
          aria-label={s.copyCode(auction.roomCode)}
        >
          <span className="font-mono text-2xl font-black tracking-[0.18em] text-primary">{auction.roomCode}</span>
          <ClipboardCopy className="h-4 w-4 text-primary/60 group-hover:text-primary" aria-hidden />
        </button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-10"
            onClick={() =>
              copy(s.inviteMessage(t.name, auction.roomCode, joinUrl()), s.inviteCopied)
            }
          >
            <Share2 className="mr-1.5 h-4 w-4" aria-hidden /> {s.copyInvite}
          </Button>
          <Button className="h-10" onClick={() => navigate(`/room/${auction.roomCode}`)}>
            <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden /> {auction.status === 'ENDED' ? s.viewRoom : s.openRoom}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {s.roomFooter(auction.bidTimerSeconds, formatBDT(auction.minIncrement))}
          {auction.bidCount > 0 ? ` · ${s.bidsSoFar(auction.bidCount)}` : ''}
        </p>
      </CardContent>
    </Card>
  )
}

function UsageBar({ label, n, max, what }: { label: string; n: number; max: number; what: string }) {
  const s = useStrings(STRINGS)
  const pct = max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={cn('font-medium', n >= max ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground')}>{label}</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" aria-label={s.usageAria(what, pct)} />
    </div>
  )
}

/** FREE: usage against the limits + the way to Pro. PRO: a badge and since-date. */
function PlanCard({ data }: { data: TournamentDetail }) {
  const s = useStrings(STRINGS)
  const lang = useLang()
  const { tournament: t, teams, players, myAccess } = data
  const plans = useCachedGet<PlanInfo>(PLANS_URL)
  const canPay = myAccess === 'OWNER' || myAccess === 'ADMIN'

  if (t.plan === 'PRO') {
    return (
      <Card className="gap-2 border-amber-300/70 bg-gradient-to-br from-amber-50 to-transparent dark:border-amber-900 dark:from-amber-950/30">
        <CardContent className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.planTitle}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-white">
              <Crown className="h-3.5 w-3.5" aria-hidden /> {s.proPlan}
            </span>
          </div>
          {t.proSince ? <p className="text-sm font-semibold">{s.proSince(formatDate(t.proSince, false, lang))}</p> : null}
          <p className="text-xs text-muted-foreground">{s.proPerks}</p>
        </CardContent>
      </Card>
    )
  }

  const limits = plans.data
  return (
    <Card className="gap-2">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.planTitle}</p>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">{s.freePlan}</span>
        </div>
        {limits ? (
          <div className="space-y-2">
            <UsageBar label={s.usageTeams(teams.length, limits.freeMaxTeams)} n={teams.length} max={limits.freeMaxTeams} what={s.teams} />
            <UsageBar
              label={s.usagePlayers(players.length, limits.freeMaxPlayers)}
              n={players.length}
              max={limits.freeMaxPlayers}
              what={s.players}
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{s.freeUnlocks}</p>
        {canPay ? (
          <PlanUpgradeAction tournamentId={t.id} price={limits ? formatBDT(limits.proPrice) : null} />
        ) : (
          <p className="text-xs font-medium">{s.askOwner}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** The upgrade button, or "Payment under review" while a payment waits for an admin. Owner/ADMIN only. */
function PlanUpgradeAction({ tournamentId, price }: { tournamentId: string; price: string | null }) {
  const s = useStrings(STRINGS)
  const payments = useCachedGet<{ payments: PaymentDTO[] }>(paymentsUrl(tournamentId))
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const pending = payments.data?.payments.some((p) => p.status === 'PENDING')
  if (pending) {
    return (
      <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-semibold">{s.paymentReview}</p>
          <p className="text-xs">{s.paymentReviewDesc}</p>
        </div>
      </div>
    )
  }
  return (
    <>
      <Button className="h-10 w-full bg-amber-500 text-white hover:bg-amber-600" onClick={() => setUpgradeOpen(true)}>
        <Crown className="mr-1.5 h-4 w-4" aria-hidden /> {s.upgradeFor(price ?? '…')}
      </Button>
      <UpgradeDialog
        tournamentId={tournamentId}
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onSubmitted={() => void payments.refetch()}
      />
    </>
  )
}

export function TournamentOverview({ data, setTab }: { data: TournamentDetail; setTab: (tab: DetailTab) => void }) {
  const s = useStrings(STRINGS)
  const lang = useLang()
  const { tournament: t, players, teams } = data
  const sold = players.filter((p) => p.status === 'SOLD').length
  const unsold = players.filter((p) => p.status === 'UNSOLD').length
  const totalBudget = teams.reduce((n, tm) => n + tm.budget, 0)
  const spent = teams.reduce((n, tm) => n + tm.spent, 0)
  const managed = teams.filter((tm) => tm.managerUserId).length

  const details = [
    { k: s.rowType, v: tournamentTypeLabel(t.tournamentType, lang) ?? '—' },
    { k: s.rowLocation, v: t.location ?? '—' },
    { k: s.rowStart, v: formatDate(t.startDate, false, lang) },
    { k: s.rowAuctionAt, v: formatDate(t.auctionAt, true, lang) },
    { k: s.rowMode, v: t.auctionMode === 'CATEGORY' ? s.categoryModeValue : s.normal },
    { k: s.rowBasePrice, v: t.auctionMode === 'NORMAL' ? formatBDT(t.basePrice) : s.setPerCategory },
    { k: s.rowCreated, v: formatDate(t.createdAt, true, lang) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={s.players} value={players.length} hint={s.playersHint(sold, unsold)} />
        <StatCard label={s.teams} value={teams.length} hint={s.teamsHint(managed)} />
        <StatCard label={s.totalBudget} value={formatBDT(totalBudget)} hint={s.acrossTeams} />
        <StatCard label={s.spentSoFar} value={formatBDT(spent)} tone={spent > 0 ? 'success' : 'default'} hint={s.left(formatBDT(totalBudget - spent))} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SetupChecklist data={data} setTab={setTab} />

        <div className="space-y-4">
          <RoomCard data={data} setTab={setTab} />
          <PlanCard data={data} />
          <Card className="gap-3">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" aria-hidden /> {s.details}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2">
                {details.map((row) => (
                  <div key={row.k} className="flex items-start justify-between gap-4 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                    <dt className="shrink-0 text-muted-foreground">{row.k}</dt>
                    <dd className="text-right font-medium">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
