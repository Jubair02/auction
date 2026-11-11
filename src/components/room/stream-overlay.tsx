'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock3, Crosshair, Eye, Gavel, Lock, Sparkles, Tag, Trophy, Users } from 'lucide-react'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'
import { useAuctionSocket, useCountdown } from '@/lib/use-auction-socket'
import type { JoinResult, Plan, PublicBranding, RoomInfo, RoomState } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { PlayerRole } from '@/components/shared/player-role'
import { brandPalette, hexToRgb, type BrandPalette } from '@/lib/brand-color'
import { SponsorStrip } from '@/components/shared/sponsor-strip'

const STRINGS = {
  en: {
    roomNotFound: (code: string) => `Room ${code} not found`,
    live: 'LIVE',
    sold: 'SOLD',
    unsold: 'UNSOLD',
    toTeam: (team: string) => `to ${team}`,
    noTeamBid: 'No team bid this time',
    currentPlayer: 'CURRENT PLAYER',
    upForAuction: 'UP FOR AUCTION',
    category: (c: string) => `Category ${c}`,
    base: (price: string) => `Base ${price}`,
    basePrice: 'BASE PRICE',
    ex: (team: string) => `ex ${team}`,
    currentBid: 'CURRENT BID',
    openingBid: 'OPENING BID',
    timeLeft: 'TIME LEFT',
    topBids: 'TOP BIDS',
    viewers: (n: number) => `${n} watching`,
    paused: 'PAUSED',
    goingOnce: 'GOING ONCE',
    goingTwice: 'GOING TWICE',
    startsSoon: 'The auction starts soon',
    complete: 'Auction complete',
    thanks: 'Thanks for watching!',
    nextUp: 'Next player coming up…',
    breakTag: 'BETWEEN PLAYERS',
    readyTag: 'STARTING SOON',
    endedTag: 'FINAL RESULTS',
    progress: 'AUCTION PROGRESS',
    soldN: 'Sold',
    unsoldN: 'Unsold',
    leftN: 'Still to go',
    latestSales: 'LATEST SALES',
    noSalesYet: 'No sales yet',
    stillToGo: 'STILL TO GO',
    catLeft: (code: string, left: number, total: number) => `Cat ${code} · ${left}/${total}`,
    playersLeft: (n: number) => `${n} player${n === 1 ? '' : 's'} left`,
    teams: 'TEAMS',
    purse: (amount: string) => `${amount} purse`,
    playersSold: 'PLAYERS SOLD',
    totalSpent: 'TOTAL SPENT',
    biggestBuy: 'BIGGEST BUY',
    proOnlyTag: 'PRO FEATURE',
    proOnlyTitle: 'The stream overlay is a Pro feature',
    proOnlyDesc: 'Upgrade this tournament to Pro to show the live auction on your stream.',
  },
  bn: {
    roomNotFound: (code: string) => `রুম ${code} পাওয়া যায়নি`,
    live: 'লাইভ',
    sold: 'বিক্রি',
    unsold: 'অবিক্রিত',
    toTeam: (team: string) => `${team}-এর কাছে`,
    noTeamBid: 'এবার কোনো দল বিড করেনি',
    currentPlayer: 'এখনকার খেলোয়াড়',
    upForAuction: 'নিলামে উঠছেন',
    category: (c: string) => `ক্যাটাগরি ${c}`,
    base: (price: string) => `বেস ${price}`,
    basePrice: 'বেস প্রাইস',
    ex: (team: string) => `সাবেক ${team}`,
    currentBid: 'এখনকার বিড',
    openingBid: 'শুরুর বিড',
    timeLeft: 'বাকি সময়',
    topBids: 'সেরা বিড',
    viewers: (n: number) => `${n} জন দেখছেন`,
    paused: 'বিরতি',
    goingOnce: 'এক বার…',
    goingTwice: 'দুই বার…',
    startsSoon: 'নিলাম শিগগিরই শুরু হবে',
    complete: 'নিলাম শেষ',
    thanks: 'দেখার জন্য ধন্যবাদ!',
    nextUp: 'পরের খেলোয়াড় আসছেন…',
    breakTag: 'খেলোয়াড়দের মাঝে',
    readyTag: 'শিগগিরই শুরু',
    endedTag: 'চূড়ান্ত ফলাফল',
    progress: 'নিলামের অগ্রগতি',
    soldN: 'বিক্রি',
    unsoldN: 'অবিক্রিত',
    leftN: 'বাকি',
    latestSales: 'সাম্প্রতিক বিক্রি',
    noSalesYet: 'এখনো বিক্রি হয়নি',
    stillToGo: 'এখনো বাকি',
    catLeft: (code: string, left: number, total: number) => `ক্যাট ${code} · ${left}/${total}`,
    playersLeft: (n: number) => `${n} জন খেলোয়াড় বাকি`,
    teams: 'দল',
    purse: (amount: string) => `${amount} বাজেট`,
    playersSold: 'বিক্রি হওয়া খেলোয়াড়',
    totalSpent: 'মোট খরচ',
    biggestBuy: 'সবচেয়ে বড় কেনা',
    proOnlyTag: 'PRO ফিচার',
    proOnlyTitle: 'স্ট্রিম ওভারলে একটি Pro ফিচার',
    proOnlyDesc: 'আপনার স্ট্রিমে লাইভ নিলাম দেখাতে এই টুর্নামেন্ট Pro-তে আপগ্রেড করুন।',
  },
} satisfies Strings<{
  roomNotFound: (code: string) => string
  live: string
  sold: string
  unsold: string
  toTeam: (team: string) => string
  noTeamBid: string
  currentPlayer: string
  upForAuction: string
  category: (c: string) => string
  base: (price: string) => string
  basePrice: string
  ex: (team: string) => string
  currentBid: string
  openingBid: string
  timeLeft: string
  topBids: string
  viewers: (n: number) => string
  paused: string
  goingOnce: string
  goingTwice: string
  startsSoon: string
  complete: string
  thanks: string
  nextUp: string
  breakTag: string
  readyTag: string
  endedTag: string
  progress: string
  soldN: string
  unsoldN: string
  leftN: string
  latestSales: string
  noSalesYet: string
  stillToGo: string
  catLeft: (code: string, left: number, total: number) => string
  playersLeft: (n: number) => string
  teams: string
  purse: (amount: string) => string
  playersSold: string
  totalSpent: string
  biggestBuy: string
  /** Shown instead of the overlay on a Free tournament. */
  proOnlyTag: string
  proOnlyTitle: string
  proOnlyDesc: string
}>

type T = (typeof STRINGS)['en']

const OVERLAY_NAME = 'Stream overlay'
const RESULT_FLASH_MS = 6000
/** How long a new player holds the centre of the screen before moving to the lower third. */
const SPOTLIGHT_MS = 5000
/** Esports / other sports default to a violet neon accent; cricket and football keep NeelamGhor teal. */
const ESPORTS_ACCENT = '#7C3AED'

/**
 * /overlay/<CODE>[/green] — broadcast overlay for an OBS browser source
 * (1920×1080). Rendered without the app chrome on a transparent background
 * (or chroma-key green). Joins the room as a read-only viewer; sizes are in
 * vw so it scales with whatever resolution OBS renders at.
 *
 * The centre stays clear while teams bid (the camera / game feed shows
 * through) and is used only for moments: a new player's spotlight, the SOLD
 * celebration, and a progress panel between players.
 */
export default function StreamOverlay({ roomCode, green }: { roomCode: string; green: boolean }) {
  const t = useStrings(STRINGS)
  const [token, setToken] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Unknown until the room info loads — no mark rather than a flash of one on a Pro stream.
  const [plan, setPlan] = useState<Plan | null>(null)
  // PRO branding (brand colour + sponsors); FREE rooms get none from the API.
  const [branding, setBranding] = useState<PublicBranding | null>(null)

  // Transparent page for OBS; restored if the user navigates back into the app.
  useEffect(() => {
    const bg = green ? '#00B140' : 'transparent'
    const html = document.documentElement.style.background
    const body = document.body.style.background
    document.documentElement.style.background = bg
    document.body.style.background = bg
    return () => {
      document.documentElement.style.background = html
      document.body.style.background = body
    }
  }, [green])

  // Viewer seat. Re-requested after a failure (expired token, service restart).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const info = await apiGet<RoomInfo & { branding?: PublicBranding }>(`/api/rooms/${roomCode}`)
        if (cancelled) return
        setPlan(info.plan === 'PRO' ? 'PRO' : 'FREE')
        setBranding(info.branding ?? null)
        // The stream overlay is a Pro feature: a Free tournament's overlay shows
        // that and never takes a seat in the room.
        if (info.plan !== 'PRO') return
        const res = await apiPost<JoinResult>(`/api/rooms/${roomCode}/join`, { role: 'viewer', name: OVERLAY_NAME })
        if (!cancelled) setToken(res.socketToken)
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) setNotFound(true)
        else setTimeout(() => !cancelled && setAttempt((a) => a + 1), 5000)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomCode, attempt])

  const sock = useAuctionSocket(roomCode, token)

  useEffect(() => {
    if (!sock.joinError) return
    const timer = setTimeout(() => {
      setToken(null)
      setAttempt((a) => a + 1)
    }, 5000)
    return () => clearTimeout(timer)
  }, [sock.joinError])

  if (notFound) {
    return (
      <OverlayShell green={green}>
        <div className="absolute inset-x-[calc(2*var(--u,1vw))] bottom-[calc(2.5*var(--u,1vw))]">
          <Card accent={brandPalette(null)} green={green}>
            <p className="text-[calc(2*var(--u,1vw))] font-bold">{t.roomNotFound(roomCode)}</p>
          </Card>
        </div>
      </OverlayShell>
    )
  }
  if (plan === 'FREE') {
    return (
      <OverlayShell green={green}>
        <div className="absolute inset-x-[calc(2*var(--u,1vw))] bottom-[calc(2.5*var(--u,1vw))]">
          <Card accent={brandPalette(null)} green={green} tab={t.proOnlyTag}>
            <div className="flex items-center gap-[calc(1.4*var(--u,1vw))]">
              <Lock className="h-[calc(2.6*var(--u,1vw))] w-[calc(2.6*var(--u,1vw))] shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0">
                <p className="text-[calc(2*var(--u,1vw))] font-black leading-tight">{t.proOnlyTitle}</p>
                <p className="mt-[calc(0.4*var(--u,1vw))] text-[calc(1.2*var(--u,1vw))] text-white/75">{t.proOnlyDesc}</p>
              </div>
            </div>
          </Card>
        </div>
      </OverlayShell>
    )
  }
  const sponsors =
    plan === 'PRO' && branding && branding.sponsors.length > 0 ? (
      <SponsorStrip
        sponsors={branding.sponsors}
        variant="overlay"
        brandColor={branding.brandColor}
        className="absolute left-[calc(2*var(--u,1vw))] top-[calc(2*var(--u,1vw))] max-w-[calc(60*var(--u,1vw))] compact:top-[calc(6.4*var(--u,1vw))] compact:max-w-[calc(100%-4*var(--u,1vw))]"
      />
    ) : null

  if (!sock.state) {
    return (
      <OverlayShell green={green}>{sponsors}</OverlayShell>
    )
  }
  return (
    <OverlayContent
      state={sock.state}
      clockOffset={sock.clockOffset}
      green={green}
      brandColor={plan === 'PRO' ? (branding?.brandColor ?? null) : null}
    >
      {sponsors}
    </OverlayContent>
  )
}

/** rgba() of a hex colour, for glows. */
function alpha(hex: string, a: number): string {
  const c = hexToRgb(hex)
  return c ? `rgba(${c.r},${c.g},${c.b},${a})` : `rgba(124,58,237,${a})`
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

function OverlayContent({
  state,
  clockOffset,
  green,
  brandColor,
  children,
}: {
  state: RoomState
  clockOffset: number
  green: boolean
  /** PRO brand colour (accent glow, labels, timer); null = the sport default. */
  brandColor: string | null
  /** Extra layers: the sponsor strip, the free-plan mark. */
  children?: React.ReactNode
}) {
  const t = useStrings(STRINGS)
  const accent = brandPalette(brandColor ?? (state.sport === 'OTHER' ? ESPORTS_ACCENT : null))
  const live = state.status === 'LIVE' && !!state.currentPlayer
  const remaining = useCountdown(state.timerEndsAt, clockOffset, live)
  const seconds = state.status === 'PAUSED' ? Math.ceil((state.pausedRemainingMs ?? 0) / 1000) : Math.ceil(remaining / 1000)

  // SOLD / UNSOLD flash, keyed by the result timestamp so each call shows once.
  const [flashAt, setFlashAt] = useState<string | null>(null)
  const resultAt = state.lastResult?.at ?? null
  useEffect(() => {
    if (!resultAt || Date.now() - new Date(resultAt).getTime() > RESULT_FLASH_MS) return
    const t0 = setTimeout(() => setFlashAt(resultAt), 0)
    const t1 = setTimeout(() => setFlashAt(null), RESULT_FLASH_MS)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
    }
  }, [resultAt])

  const p = state.currentPlayer
  const bid = state.currentBid

  // Spotlight: a player who has just come up (no bid yet) holds the centre for a moment.
  const playerKey = p ? `${p.id}-${p.auctionCycle ?? 0}` : null
  const fresh = state.status === 'LIVE' && !bid
  const [spotKey, setSpotKey] = useState<string | null>(null)
  useEffect(() => {
    if (!playerKey || !fresh) return
    const t0 = setTimeout(() => setSpotKey(playerKey), 0)
    const t1 = setTimeout(() => setSpotKey((k) => (k === playerKey ? null : k)), SPOTLIGHT_MS)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
    }
  }, [playerKey, fresh])

  const flashing = !!flashAt && !!state.lastResult
  const onBlock = !flashing && !!p && (state.status === 'LIVE' || state.status === 'PAUSED')
  // The first bid ends the spotlight at once.
  const spotlight = onBlock && spotKey === playerKey && !bid
  const between = !flashing && !onBlock
  const stageLabel = state.status === 'PAUSED' ? t.paused : state.stage === 2 ? t.goingTwice : state.stage === 1 ? t.goingOnce : null

  // Top bids on the player on the block: each team's best bid, highest first.
  const teamById = new Map(state.teams.map((tm) => [tm.id, tm]))
  const best = new Map<string, { teamId: string; teamName: string; amount: number }>()
  for (const b of state.currentBidHistory) {
    const prev = best.get(b.teamId)
    if (!prev || b.amount > prev.amount) best.set(b.teamId, { teamId: b.teamId, teamName: b.teamName, amount: b.amount })
  }
  const topBids = [...best.values()].sort((a, b) => b.amount - a.amount).slice(0, 3)

  // Timer bar: share of the bidding window left (each bid resets it).
  const windowSec = Math.max(1, state.sessionTimerSeconds || state.bidTimerSeconds || 1)
  const ratio = Math.min(1, Math.max(0, seconds / windowSec))
  const timerTone = state.status === 'PAUSED' ? '#94A3B8' : seconds <= 5 ? '#F43F5E' : seconds <= 10 ? '#FBBF24' : accent.onDark
  const photoKey = p ? `photo-${playerKey}` : undefined

  return (
    <OverlayShell green={green}>
      {/* Top-right bug: status, tournament, room code, viewers */}
      <div
        className="absolute right-[calc(2*var(--u,1vw))] top-[calc(2*var(--u,1vw))] z-10 flex items-center compact:left-[calc(2*var(--u,1vw))] gap-[calc(0.9*var(--u,1vw))] rounded-[calc(0.9*var(--u,1vw))] bg-[#0b0a1a]/95 px-[calc(1.1*var(--u,1vw))] py-[calc(0.55*var(--u,1vw))] text-white ring-1 ring-white/10"
        style={green ? undefined : { boxShadow: `0 0 calc(1.6*var(--u,1vw)) ${alpha(accent.bg, 0.25)}` }}
      >
        {state.status === 'LIVE' ? (
          <span className="flex items-center gap-[calc(0.45*var(--u,1vw))] rounded-full bg-emerald-500/15 px-[calc(0.7*var(--u,1vw))] py-[calc(0.2*var(--u,1vw))] text-[calc(0.85*var(--u,1vw))] font-black tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/40">
            <span className="h-[calc(0.5*var(--u,1vw))] w-[calc(0.5*var(--u,1vw))] animate-pulse rounded-full bg-emerald-400" /> {t.live}
          </span>
        ) : state.status === 'PAUSED' ? (
          <span className="rounded-full bg-amber-400/15 px-[calc(0.7*var(--u,1vw))] py-[calc(0.2*var(--u,1vw))] text-[calc(0.85*var(--u,1vw))] font-black tracking-[0.18em] text-amber-200 ring-1 ring-amber-300/40">{t.paused}</span>
        ) : null}
        <span className="max-w-[calc(28*var(--u,1vw))] truncate text-[calc(1.1*var(--u,1vw))] font-bold compact:min-w-0 compact:max-w-none compact:flex-1">{state.tournamentName}</span>
        <span className="h-[calc(1.2*var(--u,1vw))] w-px bg-white/15" />
        <span className="font-mono text-[calc(0.95*var(--u,1vw))] font-bold tracking-[0.12em]" style={{ color: accent.onDark }}>{state.roomCode}</span>
        {state.viewersOnline > 0 ? (
          <span className="flex items-center gap-[calc(0.35*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-semibold text-white/80" aria-label={t.viewers(state.viewersOnline)}>
            <Eye className="h-[calc(1*var(--u,1vw))] w-[calc(1*var(--u,1vw))]" aria-hidden /> {state.viewersOnline}
          </span>
        ) : null}
      </div>

      {/* ---------------- centre stage: moments only ---------------- */}
      <div className="pointer-events-none absolute inset-x-[calc(2*var(--u,1vw))] bottom-[calc(4*var(--u,1vw))] top-[calc(7*var(--u,1vw))] compact:top-[calc(11*var(--u,1vw))] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {flashing && state.lastResult ? (
            <SoldMoment key={`result-${flashAt}`} state={state} t={t} green={green} />
          ) : spotlight && p ? (
            <motion.div
              key={`spot-${playerKey}`}
              initial={{ opacity: 0, scale: 0.88, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: '14vw' }}
              transition={{ type: 'spring', stiffness: 210, damping: 24 }}
              className="relative"
            >
              {!green ? <Rays color={accent.bg} /> : null}
              <Card accent={accent} green={green} tab={`${t.upForAuction} · #${p.playerNumber}`} strong>
                <div className="flex items-center gap-[calc(2.6*var(--u,1vw))] px-[calc(0.6*var(--u,1vw))] py-[calc(0.6*var(--u,1vw))] compact:flex-col compact:gap-[calc(1.6*var(--u,1vw))] compact:text-center">
                  <PlayerPhoto layoutId={photoKey} name={p.name} photoUrl={p.photoUrl} accent={accent} green={green} size="calc(15*var(--u,1vw))" text="calc(5*var(--u,1vw))" />
                  <div className="min-w-[calc(24*var(--u,1vw))] max-w-[calc(34*var(--u,1vw))] compact:w-[calc(100vw-10*var(--u,1vw))] compact:min-w-0 compact:max-w-none">
                    <p className="truncate text-[calc(5*var(--u,1vw))] font-black leading-[1] tracking-tight compact:text-[calc(4.2*var(--u,1vw))]">{p.name}</p>
                    <div className="mt-[calc(1*var(--u,1vw))] flex flex-wrap items-center gap-[calc(0.6*var(--u,1vw))] text-[calc(1.3*var(--u,1vw))] font-bold compact:justify-center">
                      <RoleChip accent={accent} role={p.role} />
                      {p.category ? <Chip>{t.category(p.category)}</Chip> : null}
                      {p.previousTeam ? <Chip>{t.ex(p.previousTeam)}</Chip> : null}
                    </div>
                    <div className="mt-[calc(1.6*var(--u,1vw))] border-t border-white/10 pt-[calc(1.2*var(--u,1vw))]">
                      <p className="text-[calc(1*var(--u,1vw))] font-black tracking-[0.18em] text-white/60">{t.basePrice}</p>
                      <p className="mt-[calc(0.3*var(--u,1vw))] text-[calc(3.6*var(--u,1vw))] font-black tabular-nums leading-none" style={{ color: accent.onDark }}>
                        {formatBDT(p.basePrice)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : between ? (
            <motion.div
              key={`between-${state.status}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.4 }}
            >
              {state.status === 'ENDED' ? (
                <EndedPanel state={state} t={t} accent={accent} green={green} />
              ) : (
                <BreakPanel state={state} t={t} accent={accent} green={green} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ---------------- lower third: while teams bid ---------------- */}
      <div className="absolute inset-x-[calc(2*var(--u,1vw))] bottom-[calc(2.6*var(--u,1vw))] flex flex-col items-end gap-[calc(1*var(--u,1vw))]">
        <AnimatePresence>
          {onBlock && !spotlight && topBids.length > 0 ? (
            <motion.div
              key="top-bids"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.3 }}
              className="w-[calc(21*var(--u,1vw))] rounded-[calc(1*var(--u,1vw))] bg-[#0d0a1f] compact:w-full p-[calc(0.9*var(--u,1vw))] text-white ring-1 ring-white/10"
              style={green ? undefined : { boxShadow: `0 0 0 calc(0.08*var(--u,1vw)) ${alpha(accent.bg, 0.35)}, 0 0 calc(1.6*var(--u,1vw)) ${alpha(accent.bg, 0.2)}` }}
            >
              <p className="mb-[calc(0.5*var(--u,1vw))] flex items-center gap-[calc(0.5*var(--u,1vw))] px-[calc(0.3*var(--u,1vw))] text-[calc(0.85*var(--u,1vw))] font-black tracking-[0.18em] text-white/75">
                <Trophy className="h-[calc(1*var(--u,1vw))] w-[calc(1*var(--u,1vw))] text-amber-300" aria-hidden /> {t.topBids}
              </p>
              <ol className="space-y-[calc(0.35*var(--u,1vw))]">
                {topBids.map((b, i) => (
                  <motion.li
                    key={b.teamId}
                    layout
                    className={`flex items-center gap-[calc(0.7*var(--u,1vw))] rounded-[calc(0.6*var(--u,1vw))] px-[calc(0.6*var(--u,1vw))] py-[calc(0.45*var(--u,1vw))] ${i === 0 ? 'bg-amber-400/10 ring-1 ring-amber-300/25' : ''}`}
                  >
                    <span
                      className={`flex h-[calc(1.5*var(--u,1vw))] w-[calc(1.5*var(--u,1vw))] shrink-0 items-center justify-center rounded-[calc(0.35*var(--u,1vw))] text-[calc(0.85*var(--u,1vw))] font-black ${
                        i === 0 ? 'bg-amber-400 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-900' : 'bg-orange-700 text-orange-50'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <TeamDot color={teamById.get(b.teamId)?.color ?? accent.bg} size="calc(0.8*var(--u,1vw))" />
                    <span className="min-w-0 flex-1 truncate text-[calc(1.05*var(--u,1vw))] font-bold">{b.teamName}</span>
                    <span className="text-[calc(1.1*var(--u,1vw))] font-black tabular-nums">{formatBDT(b.amount)}</span>
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="w-full">
          <AnimatePresence mode="wait">
            {onBlock && !spotlight && p ? (
              <motion.div
                key={`player-${playerKey}`}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.35 }}
              >
                <Card accent={accent} green={green} tab={`${t.currentPlayer} · #${p.playerNumber}`}>
                  <div className="flex items-center gap-[calc(1.8*var(--u,1vw))] compact:flex-wrap compact:gap-y-[calc(1.4*var(--u,1vw))]">
                    <PlayerPhoto layoutId={photoKey} name={p.name} photoUrl={p.photoUrl} accent={accent} green={green} size="calc(8*var(--u,1vw))" text="calc(2.8*var(--u,1vw))" />

                    {/* name + chips */}
                    <div className="min-w-0 flex-1 compact:basis-[calc(100%-10*var(--u,1vw))]">
                      <p className="truncate text-[calc(3*var(--u,1vw))] font-black leading-[1.05] tracking-tight">{p.name}</p>
                      <div className="mt-[calc(0.7*var(--u,1vw))] flex flex-wrap items-center gap-[calc(0.5*var(--u,1vw))] text-[calc(1.05*var(--u,1vw))] font-bold">
                        <RoleChip accent={accent} role={p.role} />
                        {p.category ? <Chip>{t.category(p.category)}</Chip> : null}
                        <Chip>{t.base(formatBDT(p.basePrice))}</Chip>
                        {p.previousTeam ? <Chip>{t.ex(p.previousTeam)}</Chip> : null}
                      </div>
                    </div>

                    <span className="h-[calc(6*var(--u,1vw))] w-px shrink-0 bg-white/10 compact:hidden" />

                    {/* current bid */}
                    <div className="w-[calc(17*var(--u,1vw))] shrink-0 compact:w-auto compact:min-w-0 compact:flex-1">
                      <p className="flex items-center gap-[calc(0.45*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.16em] text-white/70">
                        <Tag className="h-[calc(1*var(--u,1vw))] w-[calc(1*var(--u,1vw))]" style={{ color: accent.onDark }} aria-hidden /> {bid ? t.currentBid : t.openingBid}
                      </p>
                      <p className="mt-[calc(0.3*var(--u,1vw))] truncate text-[calc(3.4*var(--u,1vw))] font-black tabular-nums leading-none">{formatBDT(bid ? bid.amount : p.basePrice)}</p>
                      {bid ? (
                        <p className="mt-[calc(0.5*var(--u,1vw))] flex items-center gap-[calc(0.5*var(--u,1vw))] truncate text-[calc(1.25*var(--u,1vw))] font-bold">
                          <TeamDot color={bid.teamColor ?? accent.bg} size="calc(0.9*var(--u,1vw))" />
                          <span className="truncate">{bid.teamName}</span>
                        </p>
                      ) : null}
                    </div>

                    <span className="h-[calc(6*var(--u,1vw))] w-px shrink-0 bg-white/10 compact:hidden" />

                    {/* time left */}
                    <div className="w-[calc(13*var(--u,1vw))] shrink-0 compact:w-auto">
                      <p className="flex items-center gap-[calc(0.45*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.16em] text-white/70">
                        <Clock3 className="h-[calc(1*var(--u,1vw))] w-[calc(1*var(--u,1vw))]" style={{ color: timerTone }} aria-hidden /> {t.timeLeft}
                      </p>
                      <p
                        className="mt-[calc(0.3*var(--u,1vw))] font-mono text-[calc(3.2*var(--u,1vw))] font-black tabular-nums leading-none transition-colors"
                        style={{ color: timerTone, textShadow: green ? undefined : `0 0 calc(1.2*var(--u,1vw)) ${alpha(timerTone, 0.45)}` }}
                      >
                        {mmss(Math.max(0, seconds))}
                      </p>
                      <p className="mt-[calc(0.5*var(--u,1vw))] h-[calc(1.4*var(--u,1vw))] text-[calc(1*var(--u,1vw))] font-black tracking-[0.14em] text-amber-300">{stageLabel ?? ''}</p>
                    </div>
                  </div>

                  {/* bidding window */}
                  <div className="mt-[calc(1.1*var(--u,1vw))] flex items-center gap-[calc(0.8*var(--u,1vw))]">
                    <Gavel className="h-[calc(1.1*var(--u,1vw))] w-[calc(1.1*var(--u,1vw))] shrink-0 text-white/60" aria-hidden />
                    <div className="h-[calc(0.45*var(--u,1vw))] flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full origin-left rounded-full transition-transform duration-1000 ease-linear"
                        style={{ transform: `scaleX(${ratio})`, background: `linear-gradient(90deg, ${alpha(timerTone, 0.7)}, ${timerTone})` }}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      {children}
    </OverlayShell>
  )
}

/* ------------------------------------------------------------- moments */

/** SOLD / UNSOLD celebration, centred, in the buying team's colour. */
function SoldMoment({ state, t, green }: { state: RoomState; t: T; green: boolean }) {
  const r = state.lastResult!
  const sold = r.type === 'SOLD'
  const team = r.teamId ? state.teams.find((tm) => tm.id === r.teamId) : undefined
  const tone = brandPalette(sold ? (team?.color ?? '#10B981') : '#64748B')
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative"
    >
      {sold && !green ? <Rays color={tone.bg} strong /> : null}
      <Card accent={tone} green={green} strong={sold}>
        <div className="flex min-w-[calc(46*var(--u,1vw))] flex-col items-center compact:min-w-0 compact:w-[calc(100vw-8*var(--u,1vw))] px-[calc(2*var(--u,1vw))] py-[calc(1*var(--u,1vw))] text-center">
          <p
            className={`text-[calc(8*var(--u,1vw))] font-black leading-[0.9] tracking-tight ${
              sold ? 'bg-gradient-to-b from-white via-emerald-100 to-emerald-300 bg-clip-text text-transparent' : 'text-slate-300'
            }`}
            style={sold && !green ? { filter: `drop-shadow(0 0 calc(1.6*var(--u,1vw)) ${alpha(tone.bg, 0.6)})` } : undefined}
          >
            {sold ? t.sold : t.unsold}
          </p>
          <p className="mt-[calc(1.2*var(--u,1vw))] max-w-[calc(60*var(--u,1vw))] truncate text-[calc(2.8*var(--u,1vw))] font-extrabold leading-tight">
            #{r.playerNumber} {r.playerName}
          </p>
          {sold && r.teamName ? (
            <div className="mt-[calc(1.4*var(--u,1vw))] flex items-center gap-[calc(1.6*var(--u,1vw))] compact:flex-wrap compact:justify-center compact:gap-y-[calc(0.8*var(--u,1vw))]">
              <TeamBadge name={r.teamName} color={team?.color ?? null} logoUrl={team?.logoUrl ?? null} />
              <span className="text-[calc(1.8*var(--u,1vw))] font-bold text-white/85">{t.toTeam(r.teamName)}</span>
              {r.price != null ? <span className="text-[calc(4*var(--u,1vw))] font-black tabular-nums leading-none">{formatBDT(r.price)}</span> : null}
            </div>
          ) : (
            <p className="mt-[calc(0.8*var(--u,1vw))] text-[calc(1.6*var(--u,1vw))] font-semibold text-white/75">{t.noTeamBid}</p>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

/** Between players and before the start: progress, latest sales, what's left. */
function BreakPanel({ state, t, accent, green }: { state: RoomState; t: T; accent: BrandPalette; green: boolean }) {
  const ready = state.status === 'READY'
  const { sold, unsold, available, total } = state.pool
  const done = total > 0 ? (sold + unsold) / total : 0
  const sales = state.soldFeed.slice(0, 3)
  const cats = state.mode === 'CATEGORY' ? state.categories.filter((c) => c.total > 0) : []
  return (
    <Card accent={accent} green={green} tab={ready ? t.readyTag : t.breakTag}>
      <div className="w-[calc(58*var(--u,1vw))] px-[calc(0.4*var(--u,1vw))] py-[calc(0.4*var(--u,1vw))] compact:w-[calc(100vw-8*var(--u,1vw))]">
        <div className="flex items-center gap-[calc(1*var(--u,1vw))]">
          <Sparkles className="h-[calc(2.2*var(--u,1vw))] w-[calc(2.2*var(--u,1vw))] shrink-0" style={{ color: accent.onDark }} aria-hidden />
          <p className="text-[calc(2.8*var(--u,1vw))] font-black leading-tight tracking-tight">{ready ? t.startsSoon : t.nextUp}</p>
        </div>

        {/* progress */}
        <div className="mt-[calc(1.6*var(--u,1vw))]">
          <p className="text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.18em] text-white/60">{t.progress}</p>
          <div className="mt-[calc(0.7*var(--u,1vw))] h-[calc(0.7*var(--u,1vw))] overflow-hidden rounded-full bg-white/10">
            <div className="h-full origin-left rounded-full" style={{ transform: `scaleX(${done})`, background: `linear-gradient(90deg, ${alpha(accent.bg, 0.7)}, ${accent.onDark})` }} />
          </div>
          <div className="mt-[calc(0.9*var(--u,1vw))] grid grid-cols-3 gap-[calc(1*var(--u,1vw))]">
            <Stat label={t.soldN} value={sold} tone="#34D399" />
            <Stat label={t.unsoldN} value={unsold} tone="#CBD5E1" />
            <Stat label={t.leftN} value={available} tone={accent.onDark} />
          </div>
        </div>

        <div className="mt-[calc(1.6*var(--u,1vw))] grid grid-cols-2 gap-[calc(1.6*var(--u,1vw))] border-t compact:grid-cols-1 border-white/10 pt-[calc(1.4*var(--u,1vw))]">
          {/* latest sales, or the teams before the start */}
          {ready ? (
            <div className="col-span-2">
              <p className="mb-[calc(0.7*var(--u,1vw))] flex items-center gap-[calc(0.5*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.18em] text-white/60">
                <Users className="h-[calc(1*var(--u,1vw))] w-[calc(1*var(--u,1vw))]" aria-hidden /> {t.teams}
              </p>
              <div className="flex flex-wrap gap-[calc(0.6*var(--u,1vw))]">
                {state.teams.slice(0, 10).map((tm) => (
                  <span key={tm.id} className="inline-flex items-center gap-[calc(0.5*var(--u,1vw))] rounded-[calc(0.6*var(--u,1vw))] bg-white/[0.06] px-[calc(0.8*var(--u,1vw))] py-[calc(0.4*var(--u,1vw))] text-[calc(1.1*var(--u,1vw))] font-bold ring-1 ring-white/10">
                    <TeamDot color={tm.color ?? accent.bg} size="calc(0.8*var(--u,1vw))" />
                    {tm.name}
                    <span className="font-semibold text-white/55">· {t.purse(formatBDT(tm.budget))}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <p className="mb-[calc(0.7*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.18em] text-white/60">{t.latestSales}</p>
                {sales.length === 0 ? (
                  <p className="text-[calc(1.2*var(--u,1vw))] text-white/55">{t.noSalesYet}</p>
                ) : (
                  <ul className="space-y-[calc(0.45*var(--u,1vw))]">
                    {sales.map((s) => {
                      const team = state.teams.find((tm) => tm.name === s.teamName)
                      return (
                        <li key={`${s.at}-${s.playerName}`} className="flex items-center gap-[calc(0.6*var(--u,1vw))] text-[calc(1.15*var(--u,1vw))]">
                          <TeamDot color={team?.color ?? accent.bg} size="calc(0.75*var(--u,1vw))" />
                          <span className="min-w-0 flex-1 truncate font-bold">{s.playerName}</span>
                          <span className="truncate text-white/60">{s.teamName}</span>
                          <span className="font-black tabular-nums">{formatBDT(s.price)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <div className="min-w-0">
                <p className="mb-[calc(0.7*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.18em] text-white/60">{t.stillToGo}</p>
                {cats.length > 0 ? (
                  <div className="flex flex-wrap gap-[calc(0.5*var(--u,1vw))]">
                    {cats.map((c) => (
                      <span
                        key={c.code}
                        className={`rounded-[calc(0.5*var(--u,1vw))] px-[calc(0.7*var(--u,1vw))] py-[calc(0.3*var(--u,1vw))] text-[calc(1.05*var(--u,1vw))] font-bold ring-1 ${c.available > 0 ? 'bg-white/[0.06] ring-white/10' : 'text-white/35 ring-white/5'}`}
                      >
                        {t.catLeft(c.code, c.available, c.total)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[calc(1.6*var(--u,1vw))] font-black tabular-nums" style={{ color: accent.onDark }}>{t.playersLeft(available)}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

/** After the last player: the auction's headline numbers. */
function EndedPanel({ state, t, accent, green }: { state: RoomState; t: T; accent: BrandPalette; green: boolean }) {
  const spent = state.teams.reduce((n, tm) => n + tm.spent, 0)
  const top = state.players.filter((pl) => pl.status === 'SOLD' && pl.soldPrice != null).sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))[0]
  return (
    <Card accent={accent} green={green} tab={t.endedTag} strong>
      <div className="w-[calc(58*var(--u,1vw))] px-[calc(0.4*var(--u,1vw))] py-[calc(0.4*var(--u,1vw))] compact:w-[calc(100vw-8*var(--u,1vw))] text-center">
        <Trophy className="mx-auto h-[calc(3.4*var(--u,1vw))] w-[calc(3.4*var(--u,1vw))] text-amber-300" aria-hidden />
        <p className="mt-[calc(0.8*var(--u,1vw))] text-[calc(4*var(--u,1vw))] font-black leading-none tracking-tight">{t.complete}</p>
        <p className="mt-[calc(0.6*var(--u,1vw))] text-[calc(1.5*var(--u,1vw))] font-semibold text-white/70">{t.thanks}</p>
        <div className="mt-[calc(1.8*var(--u,1vw))] grid grid-cols-3 gap-[calc(1.2*var(--u,1vw))] border-t compact:grid-cols-2 border-white/10 pt-[calc(1.4*var(--u,1vw))] text-left">
          <Stat label={t.playersSold} value={state.pool.sold} tone="#34D399" big />
          <Stat label={t.totalSpent} value={formatBDT(spent)} tone={accent.onDark} big />
          <div className="min-w-0">
            <p className="text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.16em] text-white/60">{t.biggestBuy}</p>
            {top ? (
              <>
                <p className="mt-[calc(0.3*var(--u,1vw))] truncate text-[calc(2.4*var(--u,1vw))] font-black tabular-nums leading-tight text-amber-200">{formatBDT(top.soldPrice)}</p>
                <p className="truncate text-[calc(1.1*var(--u,1vw))] font-semibold text-white/70">
                  {top.name}
                  {top.teamName ? ` · ${top.teamName}` : ''}
                </p>
              </>
            ) : (
              <p className="mt-[calc(0.3*var(--u,1vw))] text-[calc(2.4*var(--u,1vw))] font-black">—</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------- parts */

function OverlayShell({ green, children }: { green: boolean; children?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden [--u:1vw] compact:[--u:min(2.8vw,2.4vh)]" style={{ background: green ? '#00B140' : 'transparent' }}>
      {children}
    </div>
  )
}

/**
 * The neon glass card every state sits on. Glows are dropped on the
 * green-screen variant: a coloured halo over chroma-key green keys badly.
 */
function Card({
  accent,
  green,
  tab,
  strong,
  children,
}: {
  accent: BrandPalette
  green: boolean
  /** Label pill on the top edge, e.g. "CURRENT PLAYER · #12". */
  tab?: string
  /** A stronger glow (spotlight, SOLD). */
  strong?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="relative rounded-[calc(1.2*var(--u,1vw))] px-[calc(2*var(--u,1vw))] pb-[calc(1.4*var(--u,1vw))] pt-[calc(1.7*var(--u,1vw))] text-white"
      style={{
        // Opaque base (text stays readable over any footage); the accent is a tint on top.
        background: `radial-gradient(ellipse 60% 120% at 100% 0%, ${alpha(accent.bg, 0.3)}, transparent 70%), radial-gradient(ellipse 40% 90% at 0% 100%, ${alpha(accent.bg, 0.14)}, transparent 70%), linear-gradient(135deg, #0e0b20 0%, #140d2a 100%)`,
        boxShadow: green
          ? `inset 0 0 0 calc(0.12*var(--u,1vw)) ${accent.bg}`
          : `inset 0 0 0 calc(0.1*var(--u,1vw)) ${alpha(accent.bg, 0.6)}, 0 0 ${strong ? 'calc(3.2*var(--u,1vw))' : 'calc(2.2*var(--u,1vw))'} ${alpha(accent.bg, strong ? 0.5 : 0.32)}, 0 calc(1.6*var(--u,1vw)) calc(3*var(--u,1vw)) rgba(0,0,0,0.45)`,
      }}
    >
      {tab ? (
        <span
          className="absolute -top-[calc(1.05*var(--u,1vw))] left-[calc(2*var(--u,1vw))] whitespace-nowrap rounded-full px-[calc(1.2*var(--u,1vw))] py-[calc(0.35*var(--u,1vw))] text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.18em]"
          style={{ backgroundColor: accent.bg, color: accent.fg, boxShadow: green ? undefined : `0 0 calc(1.4*var(--u,1vw)) ${alpha(accent.bg, 0.6)}` }}
        >
          {tab}
        </span>
      ) : null}
      {children}
    </div>
  )
}

/** Soft light rays behind a centred moment. */
function Rays({ color, strong }: { color: string; strong?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute -inset-[calc(6*var(--u,1vw))] -z-10"
      style={{
        background: `radial-gradient(closest-side, ${alpha(color, strong ? 0.45 : 0.32)}, transparent 75%), conic-gradient(from 0deg, transparent 0deg, ${alpha(color, 0.12)} 20deg, transparent 40deg, transparent 90deg, ${alpha(color, 0.12)} 110deg, transparent 130deg, transparent 180deg, ${alpha(color, 0.12)} 200deg, transparent 220deg, transparent 270deg, ${alpha(color, 0.12)} 290deg, transparent 310deg)`,
        maskImage: 'radial-gradient(closest-side, black 40%, transparent 100%)',
      }}
      aria-hidden
    />
  )
}

function PlayerPhoto({
  layoutId,
  name,
  photoUrl,
  accent,
  green,
  size,
  text,
}: {
  layoutId?: string
  name: string
  photoUrl: string | null
  accent: BrandPalette
  green: boolean
  size: string
  text: string
}) {
  return (
    <motion.div
      layoutId={layoutId}
      className="relative shrink-0 overflow-hidden rounded-[calc(1*var(--u,1vw))]"
      style={{
        width: size,
        height: size,
        boxShadow: green ? `0 0 0 calc(0.18*var(--u,1vw)) ${accent.bg}` : `0 0 0 calc(0.18*var(--u,1vw)) ${alpha(accent.bg, 0.9)}, 0 0 calc(2*var(--u,1vw)) ${alpha(accent.bg, 0.55)}`,
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-black"
          style={{ fontSize: text, background: `linear-gradient(135deg, ${accent.bg}, ${alpha(accent.bg, 0.45)})`, color: accent.fg }}
        >
          {initials(name)}
        </div>
      )}
    </motion.div>
  )
}

function TeamBadge({ name, color, logoUrl }: { name: string; color: string | null; logoUrl: string | null }) {
  return (
    <span
      className="flex h-[calc(4.4*var(--u,1vw))] w-[calc(4.4*var(--u,1vw))] shrink-0 items-center justify-center overflow-hidden rounded-[calc(0.9*var(--u,1vw))] text-[calc(1.6*var(--u,1vw))] font-black text-white ring-[calc(0.12*var(--u,1vw))] ring-white/25"
      style={{ backgroundColor: color ?? '#0F766E' }}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  )
}

function RoleChip({ accent, role }: { accent: BrandPalette; role: string }) {
  return (
    <span
      className="inline-flex items-center gap-[calc(0.4*var(--u,1vw))] rounded-[calc(0.5*var(--u,1vw))] px-[calc(0.7*var(--u,1vw))] py-[calc(0.25*var(--u,1vw))]"
      style={{ backgroundColor: alpha(accent.bg, 0.2), color: accent.onDark, boxShadow: `inset 0 0 0 calc(0.06*var(--u,1vw)) ${alpha(accent.bg, 0.5)}` }}
    >
      <Crosshair className="h-[1em] w-[1em]" aria-hidden /> <PlayerRole role={role} />
    </span>
  )
}

/** A team colour swatch; the ring keeps very dark team colours visible on the dark card. */
function TeamDot({ color, size }: { color: string; size: string }) {
  return <span className="shrink-0 rounded-full ring-[calc(0.1*var(--u,1vw))] ring-white/40" style={{ backgroundColor: color, width: size, height: size }} />
}

function Stat({ label, value, tone, big }: { label: string; value: number | string; tone: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[calc(0.95*var(--u,1vw))] font-black tracking-[0.16em] text-white/60">{label.toUpperCase()}</p>
      <p className={`mt-[calc(0.3*var(--u,1vw))] truncate font-black tabular-nums leading-tight ${big ? 'text-[calc(2.4*var(--u,1vw))]' : 'text-[calc(2*var(--u,1vw))]'}`} style={{ color: tone }}>
        {value}
      </p>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[calc(0.5*var(--u,1vw))] bg-white/[0.07] px-[calc(0.7*var(--u,1vw))] py-[calc(0.25*var(--u,1vw))] text-white/85 ring-1 ring-white/10">{children}</span>
}
