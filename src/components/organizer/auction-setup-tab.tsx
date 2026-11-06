'use client'

import { type ReactNode, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Gavel, History, Info, Loader2, MessageCircle, MonitorPlay, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/empty-state'
import { apiPatch, apiPost, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { formatBDT } from '@/lib/format'
import type { AuctionDTO, AuctionMode, PlayerDTO, TeamDTO } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'

const BID_TIMER_OPTIONS = ['10', '15', '20', '30', '45', '60']
const GOING_OPTIONS = ['5', '8', '10', '15']
const INCREMENT_OPTIONS = ['1000', '2000', '5000', '10000']

const AUCTION_STATUS_TONES: Record<string, string> = {
  READY: 'bg-sky-100 text-sky-900 border-sky-200',
  LIVE: 'bg-amber-100 text-amber-900 border-amber-300',
  PAUSED: 'bg-slate-200 text-slate-700 border-slate-300',
  ENDED: 'bg-teal-100 text-teal-900 border-teal-300',
}

const STRINGS = {
  en: {
    roomCreated: 'Auction room created — share the room code with your managers!',
    createFailed: 'Could not create the auction',
    settingsUpdated: 'Auction settings updated',
    updateFailed: 'Could not update settings',
    inviteMessage: (tournament: string, code: string, url: string) =>
      `NeelamGhor Live Auction — ${tournament}. Room Code: ${code}. Join: ${url}`,
    inviteCopied: 'Invite message copied',
    codeCopied: 'Room code copied',
    noRoomTitle: 'No auction room yet',
    noRoomDesc:
      'Create the auction room to generate a unique room code. Team managers join with that code and bid live while you run the show.',
    needAtLeast: (players: number, teams: number): ReactNode => (
      <>
        You need at least <strong>1 player</strong> and <strong>1 team</strong> before creating the auction room.
        Currently: {players} players, {teams} teams.
      </>
    ),
    settingsTitle: 'Auction settings',
    tweakLater: 'Settings can still be tweaked after creation — but not once the auction is live.',
    createRoom: 'Create auction room',
    roomCode: 'Room code',
    copyCode: 'Copy code',
    copyInvite: 'Copy invite message',
    statusLabel: { READY: 'READY', LIVE: 'LIVE', PAUSED: 'PAUSED', ENDED: 'ENDED' } as Record<string, string>,
    bidsPlaced: (n: number) => `${n} bids placed`,
    results: 'Results',
    bidHistory: 'Bid history',
    openRoom: 'Open auction room',
    settingsDesc: 'Timing and minimum bid increment for the room.',
    timingsLocked: (status: string): ReactNode => (
      <>
        Timings are locked while the auction is <strong>{status}</strong> — they can only be changed while the room
        is READY. The re-auction and team-claiming rules below can still be changed at any time.
      </>
    ),
    saveSettings: 'Save settings',
    noCategory: (n: number) =>
      `${n} player${n === 1 ? ' has' : 's have'} no category. Category rotation skips them — they come up last, or when you pick them from the pool by hand.`,
    minExceedsPool: (totalMin: number, pool: number) =>
      `Every team's minimum squad adds up to ${totalMin} players, but the pool only has ${pool}. Some teams cannot reach their minimum.`,
    maxBelowPool: (totalMax: number, unsold: number) =>
      `Squad limits allow ${totalMax} players in total, so at least ${unsold} will stay unsold.`,
    shortPurse: (teams: string, count: number, cheapest: string) =>
      `${teams} cannot afford ${count === 1 ? 'its' : 'their'} minimum squad at the cheapest base price (${cheapest} each).`,
    oneTeam: 'Only one team is registered — there is nobody to bid against.',
    readinessPassed: (players: number, teams: number) =>
      `Readiness check passed — ${players} players, ${teams} teams, every squad reachable.`,
    readinessCheck: 'Readiness check',
    warningsNote: 'These are warnings, not blockers — you can still run the auction.',
    bidTimer: 'Bid timer',
    bidTimerAria: 'Bid timer seconds',
    seconds: (n: string) => `${n} seconds`,
    bidTimerHelp: 'Reset on every new bid',
    goingInterval: '“Going once” interval',
    goingAria: 'Going once interval seconds',
    goingHelp: 'Pause between the final calls',
    minIncrement: 'Min bid increment',
    minIncrementAria: 'Minimum bid increment',
    minIncrementHelp: 'Each bid must beat the last by this',
    rebidLabel: 'Previous owner may bid again after a re-auction',
    rebidOn: 'On — a team that loses a player to a re-auction can bid for them again, and would pay the new price in full.',
    rebidOff:
      'Off — the team that lost the player is locked out of that round. Use this when a sale is being reversed because of their mistake.',
    changeAnyTime: 'Can be changed at any time, including mid-auction.',
    rebidAria: 'Allow the previous owner to bid again after a re-auction',
    claimLabel: 'Let any manager claim an unassigned team',
    claimOn:
      'On — any logged-in team manager with the room code can pick a team nobody manages yet. Convenient for casual events, but a stranger could take a team.',
    claimOff:
      'Off (recommended) — only the manager you linked by email or who accepted that team’s invite link can bid for it.',
    claimAria: 'Let any team manager claim an unassigned team',
    overlayTransparent: 'Transparent (OBS browser source)',
    overlayGreen: 'Green screen (chroma key)',
    overlayCopied: 'Overlay link copied',
    overlayTitle: 'Live stream overlay',
    overlayDesc: (
      <>
        Streaming the auction on Facebook or YouTube Live? In OBS add a <strong>Browser</strong> source at 1920×1080
        with one of these links. It shows the player on the block, the live bid, the countdown and every SOLD call — no
        login needed, and it updates by itself.
      </>
    ) as ReactNode,
    copy: 'Copy',
  },
  bn: {
    roomCreated: 'নিলামের রুম তৈরি হয়েছে — রুম কোডটি ম্যানেজারদের সাথে শেয়ার করুন!',
    createFailed: 'নিলাম তৈরি করা যায়নি',
    settingsUpdated: 'নিলামের সেটিংস আপডেট হয়েছে',
    updateFailed: 'সেটিংস আপডেট করা যায়নি',
    inviteMessage: (tournament: string, code: string, url: string) =>
      `NeelamGhor লাইভ নিলাম — ${tournament}। রুম কোড: ${code}। যোগ দিন: ${url}`,
    inviteCopied: 'আমন্ত্রণ বার্তা কপি হয়েছে',
    codeCopied: 'রুম কোড কপি হয়েছে',
    noRoomTitle: 'এখনো নিলামের রুম নেই',
    noRoomDesc:
      'নিলামের রুম তৈরি করলে একটি আলাদা রুম কোড পাবেন। টিম ম্যানেজাররা সেই কোড দিয়ে যোগ দিয়ে লাইভ বিড করবে, আর আপনি পুরো নিলাম চালাবেন।',
    needAtLeast: (players: number, teams: number): ReactNode => (
      <>
        নিলামের রুম তৈরির আগে অন্তত <strong>১ জন খেলোয়াড়</strong> ও <strong>১টি দল</strong> লাগবে। এখন আছে: {players}{' '}
        জন খেলোয়াড়, {teams}টি দল।
      </>
    ),
    settingsTitle: 'নিলামের সেটিংস',
    tweakLater: 'তৈরির পরেও সেটিংস বদলানো যাবে — তবে নিলাম লাইভ হয়ে গেলে আর নয়।',
    createRoom: 'নিলামের রুম তৈরি করুন',
    roomCode: 'রুম কোড',
    copyCode: 'কোড কপি করুন',
    copyInvite: 'আমন্ত্রণ বার্তা কপি করুন',
    statusLabel: { READY: 'প্রস্তুত', LIVE: 'লাইভ', PAUSED: 'বিরতি', ENDED: 'শেষ' } as Record<string, string>,
    bidsPlaced: (n: number) => `${n}টি বিড হয়েছে`,
    results: 'ফলাফল',
    bidHistory: 'বিডের ইতিহাস',
    openRoom: 'নিলামের রুম খুলুন',
    settingsDesc: 'রুমের সময় ও সর্বনিম্ন বিড বৃদ্ধি।',
    timingsLocked: (status: string): ReactNode => (
      <>
        নিলাম <strong>{status}</strong> অবস্থায় থাকায় সময়ের সেটিংস লক করা আছে — শুধু রুম প্রস্তুত থাকা অবস্থায় এগুলো
        বদলানো যায়। নিচের পুনরায় নিলাম ও দল নেওয়ার নিয়ম যেকোনো সময় বদলানো যাবে।
      </>
    ),
    saveSettings: 'সেটিংস সংরক্ষণ',
    noCategory: (n: number) =>
      `${n} জন খেলোয়াড়ের কোনো ক্যাটাগরি নেই। ক্যাটাগরি অনুযায়ী পালা ঘোরার সময় তারা বাদ পড়বে — একদম শেষে আসবে, অথবা আপনি পুল থেকে হাতে বেছে নিলে।`,
    minExceedsPool: (totalMin: number, pool: number) =>
      `সব দলের সর্বনিম্ন স্কোয়াড মিলিয়ে ${totalMin} জন খেলোয়াড় লাগে, কিন্তু পুলে আছে মাত্র ${pool} জন। কিছু দল সর্বনিম্ন স্কোয়াড পূরণ করতে পারবে না।`,
    maxBelowPool: (totalMax: number, unsold: number) =>
      `স্কোয়াডের সীমা অনুযায়ী মোট ${totalMax} জন খেলোয়াড় নেওয়া যাবে, তাই অন্তত ${unsold} জন অবিক্রিত থেকে যাবে।`,
    shortPurse: (teams: string, count: number, cheapest: string) =>
      `সবচেয়ে কম বেস প্রাইসেও (প্রতিজন ${cheapest}) ${teams} ${count === 1 ? 'তার' : 'তাদের'} সর্বনিম্ন স্কোয়াড কেনার মতো বাজেট রাখে না।`,
    oneTeam: 'মাত্র একটি দল নিবন্ধিত — প্রতিদ্বন্দ্বী হিসেবে বিড করার কেউ নেই।',
    readinessPassed: (players: number, teams: number) =>
      `প্রস্তুতি যাচাই সম্পন্ন — ${players} জন খেলোয়াড়, ${teams}টি দল, সব স্কোয়াড পূরণ করা সম্ভব।`,
    readinessCheck: 'প্রস্তুতি যাচাই',
    warningsNote: 'এগুলো শুধু সতর্কতা, বাধা নয় — নিলাম চালাতে পারবেন।',
    bidTimer: 'বিডের টাইমার',
    bidTimerAria: 'বিডের টাইমার (সেকেন্ড)',
    seconds: (n: string) => `${n} সেকেন্ড`,
    bidTimerHelp: 'প্রতিটি নতুন বিডে আবার শুরু হয়',
    goingInterval: '“এক বার…” ডাকের বিরতি',
    goingAria: '“এক বার…” ডাকের বিরতি (সেকেন্ড)',
    goingHelp: 'শেষ ডাকগুলোর মাঝের বিরতি',
    minIncrement: 'সর্বনিম্ন বিড বৃদ্ধি',
    minIncrementAria: 'সর্বনিম্ন বিড বৃদ্ধি',
    minIncrementHelp: 'প্রতিটি বিড আগেরটির চেয়ে অন্তত এতটা বেশি হতে হবে',
    rebidLabel: 'পুনরায় নিলামের পর আগের মালিক আবার বিড করতে পারবে',
    rebidOn: 'চালু — পুনরায় নিলামে খেলোয়াড় হারানো দল আবার বিড করতে পারবে, এবং নতুন দাম পুরোটা দেবে।',
    rebidOff:
      'বন্ধ — যে দল খেলোয়াড় হারিয়েছে সে ওই রাউন্ডে বিড করতে পারবে না। তাদের ভুলের কারণে বিক্রি বাতিল হলে এটি ব্যবহার করুন।',
    changeAnyTime: 'যেকোনো সময় বদলানো যায়, নিলাম চলার মাঝেও।',
    rebidAria: 'পুনরায় নিলামের পর আগের মালিককে আবার বিড করতে দিন',
    claimLabel: 'যেকোনো ম্যানেজার ফাঁকা দল নিতে পারবে',
    claimOn:
      'চালু — রুম কোড থাকা যেকোনো লগইন করা টিম ম্যানেজার এমন দল বেছে নিতে পারবে যার এখনো ম্যানেজার নেই। ঘরোয়া আয়োজনে সুবিধাজনক, তবে অচেনা কেউ দল নিয়ে নিতে পারে।',
    claimOff:
      'বন্ধ (প্রস্তাবিত) — শুধু ইমেইল দিয়ে যুক্ত করা বা দলের আমন্ত্রণ লিংক গ্রহণ করা ম্যানেজারই সেই দলের হয়ে বিড করতে পারবে।',
    claimAria: 'যেকোনো টিম ম্যানেজারকে ফাঁকা দল নিতে দিন',
    overlayTransparent: 'স্বচ্ছ (OBS ব্রাউজার সোর্স)',
    overlayGreen: 'গ্রিন স্ক্রিন (ক্রোমা কি)',
    overlayCopied: 'ওভারলে লিংক কপি হয়েছে',
    overlayTitle: 'লাইভ স্ট্রিম ওভারলে',
    overlayDesc: (
      <>
        Facebook বা YouTube Live-এ নিলাম স্ট্রিম করছেন? OBS-এ 1920×1080 সাইজের একটি <strong>Browser</strong> সোর্স যোগ
        করে নিচের যেকোনো লিংক দিন। এতে নিলামে থাকা খেলোয়াড়, লাইভ বিড, কাউন্টডাউন আর প্রতিটি বিক্রির ঘোষণা দেখাবে — লগইন
        লাগবে না, নিজে থেকেই আপডেট হবে।
      </>
    ) as ReactNode,
    copy: 'কপি',
  },
} satisfies Strings<{
  roomCreated: string
  createFailed: string
  settingsUpdated: string
  updateFailed: string
  inviteMessage: (tournament: string, code: string, url: string) => string
  inviteCopied: string
  codeCopied: string
  noRoomTitle: string
  noRoomDesc: string
  needAtLeast: (players: number, teams: number) => ReactNode
  settingsTitle: string
  tweakLater: string
  createRoom: string
  roomCode: string
  copyCode: string
  copyInvite: string
  statusLabel: Record<string, string>
  bidsPlaced: (n: number) => string
  results: string
  bidHistory: string
  openRoom: string
  settingsDesc: string
  timingsLocked: (status: string) => ReactNode
  saveSettings: string
  noCategory: (n: number) => string
  minExceedsPool: (totalMin: number, pool: number) => string
  maxBelowPool: (totalMax: number, unsold: number) => string
  shortPurse: (teams: string, count: number, cheapest: string) => string
  oneTeam: string
  readinessPassed: (players: number, teams: number) => string
  readinessCheck: string
  warningsNote: string
  bidTimer: string
  bidTimerAria: string
  seconds: (n: string) => string
  bidTimerHelp: string
  goingInterval: string
  goingAria: string
  goingHelp: string
  minIncrement: string
  minIncrementAria: string
  minIncrementHelp: string
  rebidLabel: string
  rebidOn: string
  rebidOff: string
  changeAnyTime: string
  rebidAria: string
  claimLabel: string
  claimOn: string
  claimOff: string
  claimAria: string
  overlayTransparent: string
  overlayGreen: string
  overlayCopied: string
  overlayTitle: string
  overlayDesc: ReactNode
  copy: string
}>

interface SettingsState {
  bidTimerSeconds: string
  goingIntervalSeconds: string
  minIncrement: string
  allowPreviousOwnerRebid: boolean
  allowOpenClaim: boolean
}

export function AuctionSetupTab({
  tournamentId,
  tournamentName,
  auction,
  auctionMode,
  players,
  teams,
  refetch,
}: {
  tournamentId: string
  tournamentName: string
  auction: AuctionDTO | null
  auctionMode: AuctionMode
  players: PlayerDTO[]
  teams: TeamDTO[]
  refetch: () => Promise<void>
}) {
  const t = useStrings(STRINGS)
  const playerCount = players.length
  const teamCount = teams.length
  const [settings, setSettings] = useState<SettingsState>(() =>
    auction
      ? {
          bidTimerSeconds: String(auction.bidTimerSeconds),
          goingIntervalSeconds: String(auction.goingIntervalSeconds),
          minIncrement: String(auction.minIncrement),
          allowPreviousOwnerRebid: auction.allowPreviousOwnerRebid !== false,
          allowOpenClaim: auction.allowOpenClaim === true,
        }
      : {
          bidTimerSeconds: '20',
          goingIntervalSeconds: '8',
          minIncrement: '5000',
          allowPreviousOwnerRebid: true,
          allowOpenClaim: false,
        },
  )
  const [saving, setSaving] = useState(false)

  const readyToCreate = playerCount > 0 && teamCount > 0

  const createAuction = async () => {
    setSaving(true)
    try {
      await apiPost(`/api/tournaments/${tournamentId}/auction`, {
        bidTimerSeconds: parseInt(settings.bidTimerSeconds, 10),
        goingIntervalSeconds: parseInt(settings.goingIntervalSeconds, 10),
        minIncrement: parseInt(settings.minIncrement, 10),
        allowPreviousOwnerRebid: settings.allowPreviousOwnerRebid,
        allowOpenClaim: settings.allowOpenClaim,
      })
      toast.success(t.roomCreated)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.createFailed)
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const locked = !!auction && auction.status !== 'READY'
      await apiPatch(`/api/tournaments/${tournamentId}/auction`, {
        allowPreviousOwnerRebid: settings.allowPreviousOwnerRebid,
        allowOpenClaim: settings.allowOpenClaim,
        ...(locked
          ? {}
          : {
              bidTimerSeconds: parseInt(settings.bidTimerSeconds, 10),
              goingIntervalSeconds: parseInt(settings.goingIntervalSeconds, 10),
              minIncrement: parseInt(settings.minIncrement, 10),
            }),
      })
      toast.success(t.settingsUpdated)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  const copyInvite = () => {
    if (!auction) return
    const joinUrl = `${window.location.origin}/room/${auction.roomCode}`
    const msg = t.inviteMessage(tournamentName, auction.roomCode, joinUrl)
    copyText(msg, t.inviteCopied)
  }

  const copyCode = () => {
    if (!auction) return
    copyText(auction.roomCode, t.codeCopied)
  }

  const form = (
    <SettingsForm
      settings={settings}
      onChange={setSettings}
      disabled={saving || (!!auction && auction.status !== 'READY')}
    />
  )

  /* ---------------- No auction yet ---------------- */
  if (!auction) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Gavel}
          title={t.noRoomTitle}
          description={t.noRoomDesc}
        />

        {!readyToCreate ? (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <p className="text-amber-900">
                {t.needAtLeast(playerCount, teamCount)}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <ReadinessCheck players={players} teams={teams} auctionMode={auctionMode} />

        <Card>
          <CardContent className="space-y-5 p-6">
            <h3 className="font-bold">{t.settingsTitle}</h3>
            {form}
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t.tweakLater}
              </p>
              <Button
                className="min-h-11 sm:w-auto"
                disabled={!readyToCreate || saving}
                onClick={() => void createAuction()}
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Gavel className="mr-1.5 h-4 w-4" aria-hidden />}
                {t.createRoom}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* ---------------- Auction exists ---------------- */
  const joinUrl = `${window.location.origin}/room/${auction.roomCode}`
  const waHref = `https://wa.me/?text=${encodeURIComponent(
    t.inviteMessage(tournamentName, auction.roomCode, joinUrl),
  )}`
  const settingsLocked = auction.status !== 'READY'

  return (
    <div className="space-y-4">
      {/* Hero room-code panel */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-teal-700 to-emerald-800 px-6 py-8 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-200">{t.roomCode}</p>
          <p className="mt-2 font-mono text-4xl font-extrabold tracking-wider sm:text-6xl">{auction.roomCode}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10 bg-white/95 text-teal-900 hover:bg-white"
              onClick={copyCode}
            >
              {t.copyCode}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 border-white/40 text-white hover:bg-white/10 hover:text-white"
              onClick={copyInvite}
            >
              {t.copyInvite}
            </Button>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-md bg-emerald-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> WhatsApp
            </a>
          </div>
        </div>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className={AUCTION_STATUS_TONES[auction.status] ?? ''}>
              {t.statusLabel[auction.status] ?? auction.status}
            </Badge>
            <span className="text-muted-foreground">{t.bidsPlaced(auction.bidCount)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-10 flex-1 sm:flex-none" onClick={() => navigate(`/results/${tournamentId}`)}>
              <Trophy className="mr-1.5 h-4 w-4" aria-hidden /> {t.results}
            </Button>
            <Button variant="outline" className="min-h-10 flex-1 sm:flex-none" onClick={() => navigate(`/tournaments/${tournamentId}/history`)}>
              <History className="mr-1.5 h-4 w-4" aria-hidden /> {t.bidHistory}
            </Button>
            <Button className="min-h-10 flex-1 sm:flex-none" onClick={() => navigate(`/room/${auction.roomCode}`)}>
              <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> {t.openRoom}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReadinessCheck players={players} teams={teams} auctionMode={auctionMode} />

      <StreamOverlayCard roomCode={auction.roomCode} />

      {/* Settings */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">{t.settingsTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.settingsDesc}</p>
            </div>
          </div>
          {settingsLocked ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                {t.timingsLocked(t.statusLabel[auction.status] ?? auction.status)}
              </p>
            </div>
          ) : null}
          {form}
          <div className="flex justify-end">
            <Button className="min-h-10" onClick={() => void saveSettings()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t.saveSettings}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Pre-flight warnings for situations the live engine cannot resolve on its own:
 * players that will never come up in category rotation, and teams that can
 * never legally fill their minimum squad.
 */
function ReadinessCheck({
  players,
  teams,
  auctionMode,
}: {
  players: PlayerDTO[]
  teams: TeamDTO[]
  auctionMode: AuctionMode
}) {
  const t = useStrings(STRINGS)
  const open = players.filter((p) => p.status !== 'SOLD')
  const cheapest = open.length > 0 ? Math.min(...open.map((p) => p.basePrice)) : 0

  const warnings: string[] = []

  if (auctionMode === 'CATEGORY') {
    const uncategorized = open.filter((p) => !p.category).length
    if (uncategorized > 0) {
      warnings.push(t.noCategory(uncategorized))
    }
  }

  const totalMin = teams.reduce((n, tm) => n + tm.minSquad, 0)
  if (totalMin > players.length) {
    warnings.push(t.minExceedsPool(totalMin, players.length))
  }

  const totalMax = teams.reduce((n, tm) => n + tm.maxSquad, 0)
  if (teams.length > 0 && totalMax < players.length) {
    warnings.push(t.maxBelowPool(totalMax, players.length - totalMax))
  }

  const shortPurse = teams.filter((tm) => tm.minSquad > 0 && tm.budget < tm.minSquad * cheapest)
  if (shortPurse.length > 0) {
    warnings.push(t.shortPurse(shortPurse.map((tm) => tm.name).join(', '), shortPurse.length, formatBDT(cheapest)))
  }

  if (teams.length === 1) {
    warnings.push(t.oneTeam)
  }

  if (warnings.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <p className="text-emerald-900">
            {t.readinessPassed(players.length, teams.length)}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex items-start gap-3 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold text-amber-900">{t.readinessCheck}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-900/90">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-900/70">
            {t.warningsNote}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function SettingsForm({
  settings,
  onChange,
  disabled,
}: {
  settings: SettingsState
  onChange: (s: SettingsState) => void
  disabled: boolean
}) {
  const t = useStrings(STRINGS)
  const set = (patch: Partial<SettingsState>) => onChange({ ...settings, ...patch })
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label>{t.bidTimer}</Label>
        <Select value={settings.bidTimerSeconds} onValueChange={(v) => set({ bidTimerSeconds: v })} disabled={disabled}>
          <SelectTrigger className="h-10 w-full" aria-label={t.bidTimerAria}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BID_TIMER_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {t.seconds(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t.bidTimerHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{t.goingInterval}</Label>
        <Select value={settings.goingIntervalSeconds} onValueChange={(v) => set({ goingIntervalSeconds: v })} disabled={disabled}>
          <SelectTrigger className="h-10 w-full" aria-label={t.goingAria}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GOING_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {t.seconds(o)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t.goingHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label>{t.minIncrement}</Label>
        <Select value={settings.minIncrement} onValueChange={(v) => set({ minIncrement: v })} disabled={disabled}>
          <SelectTrigger className="h-10 w-full" aria-label={t.minIncrementAria}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCREMENT_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                ৳{new Intl.NumberFormat('en-IN').format(parseInt(o, 10))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t.minIncrementHelp}</p>
      </div>

      <div className="sm:col-span-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-0">
            <Label htmlFor="reauction-policy" className="text-sm font-semibold">
              {t.rebidLabel}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.allowPreviousOwnerRebid
                ? t.rebidOn
                : t.rebidOff}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.changeAnyTime}</p>
          </div>
          <Switch
            id="reauction-policy"
            checked={settings.allowPreviousOwnerRebid}
            onCheckedChange={(v) => set({ allowPreviousOwnerRebid: v })}
            aria-label={t.rebidAria}
          />
        </div>
      </div>

      <div className="sm:col-span-3">
        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
          <div className="min-w-0">
            <Label htmlFor="open-claim-policy" className="text-sm font-semibold">
              {t.claimLabel}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.allowOpenClaim
                ? t.claimOn
                : t.claimOff}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.changeAnyTime}</p>
          </div>
          <Switch
            id="open-claim-policy"
            checked={settings.allowOpenClaim}
            onCheckedChange={(v) => set({ allowOpenClaim: v })}
            aria-label={t.claimAria}
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** Links for the OBS browser-source overlay used on Facebook / YouTube Live. */
function StreamOverlayCard({ roomCode }: { roomCode: string }) {
  const t = useStrings(STRINGS)
  const base = `${window.location.origin}/overlay/${roomCode}`
  const variants = [
    { label: t.overlayTransparent, url: base },
    { label: t.overlayGreen, url: `${base}/green` },
  ]
  const copy = (url: string) =>
    copyText(url, t.overlayCopied)

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div>
          <h3 className="flex items-center gap-1.5 font-bold">
            <MonitorPlay className="h-4 w-4 text-primary" aria-hidden /> {t.overlayTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.overlayDesc}
          </p>
        </div>
        {variants.map((v) => (
          <div key={v.url} className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{v.label}</p>
            <div className="flex gap-2">
              <Input readOnly aria-label={v.label} value={v.url} onFocus={(e) => e.currentTarget.select()} className="h-10 font-mono text-xs" />
              <Button variant="outline" className="h-10 shrink-0" onClick={() => copy(v.url)}>
                {t.copy}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
