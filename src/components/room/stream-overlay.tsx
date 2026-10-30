'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'
import { useAuctionSocket, useCountdown } from '@/lib/use-auction-socket'
import type { JoinResult, RoomInfo, RoomState } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    roomNotFound: (code: string) => `Room ${code} not found`,
    live: 'LIVE',
    sold: 'SOLD',
    unsold: 'UNSOLD',
    toTeam: (team: string) => `to ${team}`,
    noTeamBid: 'No team bid this time',
    playerNo: (n: number) => `PLAYER #${n}`,
    category: (c: string) => ` · Category ${c}`,
    base: (price: string) => ` · Base ${price}`,
    ex: (team: string) => ` · ex ${team}`,
    openingBid: 'OPENING BID',
    paused: 'PAUSED',
    goingOnce: 'GOING ONCE',
    goingTwice: 'GOING TWICE',
    startsSoon: 'The auction starts soon',
    complete: 'Auction complete — thanks for watching!',
    nextUp: 'Next player coming up…',
    poolLine: (sold: number, available: number) => `${sold} sold · ${available} still to go`,
  },
  bn: {
    roomNotFound: (code: string) => `রুম ${code} পাওয়া যায়নি`,
    live: 'লাইভ',
    sold: 'বিক্রি',
    unsold: 'অবিক্রিত',
    toTeam: (team: string) => `${team}-এর কাছে`,
    noTeamBid: 'এবার কোনো দল বিড করেনি',
    playerNo: (n: number) => `খেলোয়াড় #${n}`,
    category: (c: string) => ` · ক্যাটাগরি ${c}`,
    base: (price: string) => ` · বেস ${price}`,
    ex: (team: string) => ` · সাবেক ${team}`,
    openingBid: 'শুরুর বিড',
    paused: 'বিরতি',
    goingOnce: 'এক বার…',
    goingTwice: 'দুই বার…',
    startsSoon: 'নিলাম শিগগিরই শুরু হবে',
    complete: 'নিলাম শেষ — দেখার জন্য ধন্যবাদ!',
    nextUp: 'পরের খেলোয়াড় আসছেন…',
    poolLine: (sold: number, available: number) => `${sold} জন বিক্রি · আরও ${available} জন বাকি`,
  },
} satisfies Strings<{
  roomNotFound: (code: string) => string
  live: string
  sold: string
  unsold: string
  toTeam: (team: string) => string
  noTeamBid: string
  playerNo: (n: number) => string
  category: (c: string) => string
  base: (price: string) => string
  ex: (team: string) => string
  openingBid: string
  paused: string
  goingOnce: string
  goingTwice: string
  startsSoon: string
  complete: string
  nextUp: string
  poolLine: (sold: number, available: number) => string
}>

const OVERLAY_NAME = 'Stream overlay'
const RESULT_FLASH_MS = 6000

/**
 * /overlay/<CODE>[/green] — broadcast overlay for an OBS browser source
 * (1920×1080). Rendered without the app chrome on a transparent background
 * (or chroma-key green). Joins the room as a read-only viewer; sizes are in
 * vw so it scales with whatever resolution OBS renders at.
 */
export default function StreamOverlay({ roomCode, green }: { roomCode: string; green: boolean }) {
  const t = useStrings(STRINGS)
  const [token, setToken] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [attempt, setAttempt] = useState(0)

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
        await apiGet<RoomInfo>(`/api/rooms/${roomCode}`)
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
    return <OverlayShell green={green}><Bar><p className="text-[2vw] font-bold">{t.roomNotFound(roomCode)}</p></Bar></OverlayShell>
  }
  if (!sock.state) return <OverlayShell green={green} />
  return <OverlayContent state={sock.state} clockOffset={sock.clockOffset} green={green} />
}

function OverlayContent({ state, clockOffset, green }: { state: RoomState; clockOffset: number; green: boolean }) {
  const t = useStrings(STRINGS)
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
  const stageLabel = state.status === 'PAUSED' ? t.paused : state.stage === 2 ? t.goingTwice : state.stage === 1 ? t.goingOnce : null

  return (
    <OverlayShell green={green}>
      {/* Top-right bug: tournament + status */}
      <div className="absolute right-[2vw] top-[2vw] flex items-center gap-[0.8vw] rounded-[0.6vw] bg-slate-950/85 px-[1.2vw] py-[0.6vw] text-white shadow-2xl">
        {state.status === 'LIVE' ? (
          <span className="flex items-center gap-[0.4vw] rounded-[0.3vw] bg-rose-600 px-[0.6vw] py-[0.15vw] text-[0.9vw] font-black tracking-widest">
            <span className="h-[0.5vw] w-[0.5vw] animate-pulse rounded-full bg-white" /> {t.live}
          </span>
        ) : null}
        <span className="text-[1.1vw] font-bold">{state.tournamentName}</span>
        <span className="font-mono text-[0.9vw] text-teal-300">{state.roomCode}</span>
      </div>

      {/* Lower third */}
      <div className="absolute inset-x-[2vw] bottom-[2.5vw]">
        <AnimatePresence mode="wait">
          {flashAt && state.lastResult ? (
            <motion.div
              key={`result-${flashAt}`}
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.35 }}
            >
              <Bar
                className={state.lastResult.type === 'SOLD' ? 'bg-gradient-to-r from-emerald-700 to-teal-700' : 'bg-gradient-to-r from-slate-800 to-slate-700'}
              >
                <p className="text-[4.2vw] font-black leading-none tracking-tight">{state.lastResult.type === 'SOLD' ? t.sold : t.unsold}</p>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[2.2vw] font-extrabold leading-tight">
                    #{state.lastResult.playerNumber} {state.lastResult.playerName}
                  </p>
                  <p className="truncate text-[1.5vw] font-semibold text-white/85">
                    {state.lastResult.type === 'SOLD'
                      ? t.toTeam(state.lastResult.teamName ?? '')
                      : t.noTeamBid}
                  </p>
                </div>
                {state.lastResult.type === 'SOLD' && state.lastResult.price != null ? (
                  <p className="text-[3.6vw] font-black tabular-nums leading-none">{formatBDT(state.lastResult.price)}</p>
                ) : null}
              </Bar>
            </motion.div>
          ) : p && (state.status === 'LIVE' || state.status === 'PAUSED') ? (
            <motion.div
              key={`player-${p.id}-${p.auctionCycle ?? 0}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.35 }}
            >
              <Bar>
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt="" className="h-[7vw] w-[7vw] shrink-0 rounded-[0.8vw] object-cover ring-[0.2vw] ring-white/30" />
                ) : (
                  <div className="flex h-[7vw] w-[7vw] shrink-0 items-center justify-center rounded-[0.8vw] bg-teal-700 text-[2.6vw] font-black">
                    {p.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[1vw] font-bold tracking-[0.2em] text-teal-300">{t.playerNo(p.playerNumber)}</p>
                  <p className="truncate text-[2.8vw] font-black leading-tight">{p.name}</p>
                  <p className="truncate text-[1.25vw] text-white/80">
                    {p.role}
                    {p.category ? t.category(p.category) : ''}{t.base(formatBDT(p.basePrice))}
                    {p.previousTeam ? t.ex(p.previousTeam) : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {bid ? (
                    <>
                      <p className="text-[3.4vw] font-black tabular-nums leading-none">{formatBDT(bid.amount)}</p>
                      <p className="mt-[0.4vw] flex items-center justify-end gap-[0.5vw] text-[1.4vw] font-bold">
                        <span className="h-[1vw] w-[1vw] rounded-full" style={{ backgroundColor: bid.teamColor ?? '#14B8A6' }} />
                        {bid.teamName}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[1.1vw] font-bold tracking-widest text-white/70">{t.openingBid}</p>
                      <p className="text-[3vw] font-black tabular-nums leading-none">{formatBDT(p.basePrice)}</p>
                    </>
                  )}
                </div>
                <div
                  className={`flex h-[7vw] w-[7vw] shrink-0 flex-col items-center justify-center rounded-full border-[0.35vw] ${
                    state.status === 'PAUSED' ? 'border-slate-400' : seconds <= 5 ? 'border-rose-500' : seconds <= 10 ? 'border-amber-400' : 'border-emerald-400'
                  }`}
                >
                  <p className="text-[2.6vw] font-black tabular-nums leading-none">{seconds}</p>
                  {stageLabel ? <p className="mt-[0.2vw] text-[0.7vw] font-black tracking-wider text-amber-300">{stageLabel}</p> : null}
                </div>
              </Bar>
            </motion.div>
          ) : (
            <motion.div key={`idle-${state.status}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Bar>
                <p className="text-[2vw] font-extrabold">
                  {state.status === 'READY'
                    ? t.startsSoon
                    : state.status === 'ENDED'
                      ? t.complete
                      : t.nextUp}
                </p>
                {state.status !== 'READY' ? (
                  <p className="ml-auto text-[1.3vw] text-white/80">
                    {t.poolLine(state.pool.sold, state.pool.available)}
                  </p>
                ) : null}
              </Bar>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OverlayShell>
  )
}

function OverlayShell({ green, children }: { green: boolean; children?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: green ? '#00B140' : 'transparent' }}>
      {children}
    </div>
  )
}

function Bar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-[1.6vw] rounded-[1vw] px-[2vw] py-[1.4vw] text-white shadow-2xl ${className ?? 'bg-slate-950/90'}`}
    >
      {children}
    </div>
  )
}
