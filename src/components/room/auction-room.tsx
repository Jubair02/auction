'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, Gavel, Loader2, LogOut, RefreshCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import {
  clearRoomIdentity,
  loadRoomIdentity,
  saveRoomIdentity,
  useAuctionSocket,
  type StoredIdentity,
} from '@/lib/use-auction-socket'
import type { AuctionStatus, JoinResult, RoomInfo, RoomState, RoomTeam } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuctionStage } from './stage'
import { BidPanel } from './bid-panel'
import { OrganizerControls } from './organizer-controls'
import { TeamsPanel } from './teams-panel'
import { ActivityFeed, ParticipantsPanel } from './participants-panel'
import { PlayerPoolPanel, SoldFeed } from './player-pool-panel'
import { SquadPanel } from './squad-panel'
import { JoinCard } from './join-card'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    unreachable: 'Could not reach the room. Check your connection and try again.',
    roomNotFound: 'Room not found',
    checkCode: 'Check the code and try again.',
    anotherCode: 'Enter another code',
    home: 'Home',
    couldNotJoin: 'Could not join the live room',
    retry: 'Retry',
    refreshSeat: 'Refresh seat',
    switchSeat: 'Switch seat',
    connectingFloor: 'Connecting to the auction floor…',
    serviceUnreachable: "Can't reach the live auction service",
    serviceUnreachableHint: 'Still trying every few seconds — this page will connect by itself as soon as the service is back.',
    serviceUnreachableDev: 'Running locally? Start it with "npm run dev" (starts the website and the auction service together) or "npm run dev:auction".',
    watchingNote: 'You’re watching — only team managers can bid.',
    goBack: 'Go back',
    cricket: 'Cricket',
    football: 'Football',
    category: 'Category',
    normal: 'Normal',
    status: { READY: 'Ready', LIVE: 'Live', PAUSED: 'Paused', ENDED: 'Ended' },
    role: { ORGANIZER: 'organizer', MANAGER: 'manager', VIEWER: 'viewer' },
    leave: 'Leave',
    live: 'Live',
    joining: 'Joining…',
    connecting: 'Connecting…',
  },
  bn: {
    unreachable: 'রুমে পৌঁছানো যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।',
    roomNotFound: 'রুম পাওয়া যায়নি',
    checkCode: 'কোডটি দেখে আবার চেষ্টা করুন।',
    anotherCode: 'অন্য কোড দিন',
    home: 'হোম',
    couldNotJoin: 'লাইভ রুমে যোগ দেওয়া যায়নি',
    retry: 'আবার চেষ্টা করুন',
    refreshSeat: 'আসন রিফ্রেশ করুন',
    switchSeat: 'আসন বদলান',
    connectingFloor: 'নিলামে সংযোগ হচ্ছে…',
    serviceUnreachable: 'লাইভ নিলাম সার্ভিসে সংযোগ করা যাচ্ছে না',
    serviceUnreachableHint: 'কয়েক সেকেন্ড পরপর আবার চেষ্টা করা হচ্ছে — সার্ভিস চালু হলেই পেজটি নিজে থেকে যুক্ত হবে।',
    serviceUnreachableDev: 'লোকালি চালাচ্ছেন? "npm run dev" (ওয়েবসাইট ও নিলাম সার্ভিস একসাথে চালু হয়) বা "npm run dev:auction" দিয়ে চালু করুন।',
    watchingNote: 'আপনি দেখছেন — শুধু টিম ম্যানেজাররা বিড করতে পারবেন।',
    goBack: 'ফিরে যান',
    cricket: 'ক্রিকেট',
    football: 'ফুটবল',
    category: 'ক্যাটাগরি',
    normal: 'সাধারণ',
    status: { READY: 'প্রস্তুত', LIVE: 'লাইভ', PAUSED: 'বিরতি', ENDED: 'শেষ' },
    role: { ORGANIZER: 'আয়োজক', MANAGER: 'ম্যানেজার', VIEWER: 'দর্শক' },
    leave: 'বের হন',
    live: 'লাইভ',
    joining: 'যোগ দিচ্ছে…',
    connecting: 'সংযোগ হচ্ছে…',
  },
} satisfies Strings<{
  unreachable: string
  roomNotFound: string
  checkCode: string
  anotherCode: string
  home: string
  couldNotJoin: string
  retry: string
  refreshSeat: string
  switchSeat: string
  connectingFloor: string
  serviceUnreachable: string
  serviceUnreachableHint: string
  serviceUnreachableDev: string
  watchingNote: string
  goBack: string
  cricket: string
  football: string
  category: string
  normal: string
  status: Record<AuctionStatus, string>
  role: Record<'ORGANIZER' | 'MANAGER' | 'VIEWER', string>
  leave: string
  live: string
  joining: string
  connecting: string
}>

/** fatalError marker for a network failure — rendered in the viewer's language. */
const UNREACHABLE = '__unreachable__'

type Phase = 'loading' | 'notfound' | 'join' | 'live'

const STATUS_CHIP: Record<AuctionStatus, string> = {
  READY: 'bg-slate-200 text-slate-700',
  LIVE: 'bg-amber-100 text-amber-900',
  PAUSED: 'bg-slate-200 text-slate-700',
  ENDED: 'bg-teal-100 text-teal-900',
}

/** The live auction room — resolves identity, joins the socket, renders the role layout. */
export default function AuctionRoom({ roomCode }: { roomCode: string }) {
  const t = useStrings(STRINGS)
  const [info, setInfo] = useState<RoomInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [identity, setIdentity] = useState<StoredIdentity | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [organizerPending, setOrganizerPending] = useState(false)

  const sock = useAuctionSocket(roomCode, token)

  // Reset room-scoped state when the room code changes (adjust during render — no effect needed).
  const [roomKey, setRoomKey] = useState(roomCode)
  if (roomKey !== roomCode) {
    setRoomKey(roomCode)
    setInfo(null)
    setFatalError(null)
    setIdentity(null)
    setToken(null)
    setPhase('loading')
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const res = await apiGet<RoomInfo>(`/api/rooms/${roomCode}`)
        if (cancelled) return
        setInfo(res)

        const stored = loadRoomIdentity(roomCode)
        if (stored) {
          setIdentity(stored)
          setToken(stored.socketToken)
          setPhase('live')
          return
        }
        if (res.myRole === 'organizer') {
          try {
            const jr = await apiPost<JoinResult>(`/api/rooms/${roomCode}/join`, { role: 'organizer' })
            if (cancelled) return
            const ident: StoredIdentity = {
              role: 'ORGANIZER',
              name: useAppStore.getState().user?.name ?? 'Organizer',
              socketToken: jr.socketToken,
              at: Date.now(),
            }
            saveRoomIdentity(roomCode, ident)
            setIdentity(ident)
            setToken(ident.socketToken)
            setPhase('live')
            return
          } catch {
            // organizer claim failed (expired session?) — fall through to the join card
          }
        }
        setPhase('join')
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && (e.status === 404 || e.status === 429)) {
          setFatalError(e.message)
        } else {
          setFatalError(UNREACHABLE)
        }
        setPhase('notfound')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [roomCode])

  function handleJoined(result: JoinResult, role: 'MANAGER' | 'VIEWER') {
    const ident: StoredIdentity = {
      role,
      name: result.identity?.name ?? '',
      teamId: result.identity?.teamId,
      teamName: result.identity?.teamName,
      socketToken: result.socketToken,
      at: Date.now(),
    }
    saveRoomIdentity(roomCode, ident)
    setIdentity(ident)
    setToken(ident.socketToken)
    setPhase('live')
  }

  function leaveRoom() {
    clearRoomIdentity(roomCode)
    setIdentity(null)
    setToken(null)
    setPhase(info ? 'join' : 'loading')
  }

  /** Re-issue a fresh organizer token (used when a stored seat token went stale). */
  async function refreshOrganizerSeat() {
    setOrganizerPending(true)
    try {
      const jr = await apiPost<JoinResult>(`/api/rooms/${roomCode}/join`, { role: 'organizer' })
      const ident: StoredIdentity = {
        role: 'ORGANIZER',
        name: useAppStore.getState().user?.name ?? 'Organizer',
        socketToken: jr.socketToken,
        at: Date.now(),
      }
      saveRoomIdentity(roomCode, ident)
      setIdentity(ident)
      setToken(ident.socketToken)
    } catch {
      // session likely expired — fall back to the join gate
      clearRoomIdentity(roomCode)
      setIdentity(null)
      setToken(null)
      setPhase(info ? 'join' : 'loading')
    } finally {
      setOrganizerPending(false)
    }
  }

  // ---------- not found ----------
  if (phase === 'notfound') {
    return (
      <div className="container mx-auto max-w-md px-4 py-16">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-bold">{t.roomNotFound}</h1>
            <p className="text-sm text-muted-foreground">{fatalError === UNREACHABLE ? t.unreachable : (fatalError ?? t.checkCode)}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={() => navigate('/join')}>
                {t.anotherCode}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> {t.home}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------- loading ----------
  if (phase === 'loading') {
    return (
      <div className="container mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  // ---------- join gate ----------
  if (phase === 'join' && info) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <JoinCard
          info={info}
          onJoined={handleJoined}
          onOrganizerSeat={info.myRole === 'organizer' ? () => void refreshOrganizerSeat() : undefined}
          organizerSeatPending={organizerPending}
        />
      </div>
    )
  }

  if (!info) return null

  const state = sock.state
  const role = identity?.role ?? 'VIEWER'
  const myTeam: RoomTeam | undefined =
    state && identity?.teamId ? state.teams.find((team) => team.id === identity.teamId) : undefined

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <RoomHeader
        info={info}
        liveStatus={sock.state?.status ?? null}
        role={role}
        identityName={identity?.name}
        connected={sock.connected}
        joined={sock.joined}
        onLeave={role === 'ORGANIZER' ? undefined : leaveRoom}
      />

      {sock.joinError ? (
        <Card className="mt-4 border-rose-200">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <WifiOff className="h-8 w-8 text-rose-500" aria-hidden />
            <p className="font-bold">{t.couldNotJoin}</p>
            <p className="max-w-md text-sm text-muted-foreground">{sock.joinError}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={sock.rejoin}>
                <RefreshCw className="mr-2 h-4 w-4" /> {t.retry}
              </Button>
              {role === 'ORGANIZER' ? (
                <Button variant="outline" onClick={() => void refreshOrganizerSeat()}>
                  {t.refreshSeat}
                </Button>
              ) : null}
              <Button variant="outline" onClick={leaveRoom}>
                {t.switchSeat}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !state ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          {sock.connectFailures >= 3 ? (
            <div className="max-w-md space-y-1.5 text-center">
              <p className="text-sm font-semibold text-foreground">{t.serviceUnreachable}</p>
              <p className="text-sm">{t.serviceUnreachableHint}</p>
              {typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) ? (
                <p className="text-xs">{t.serviceUnreachableDev}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-medium">{t.connectingFloor}</p>
          )}
        </div>
      ) : role === 'ORGANIZER' ? (
        <OrganizerLayout state={state} sock={sock} />
      ) : role === 'MANAGER' ? (
        <ManagerLayout state={state} sock={sock} myTeam={myTeam} />
      ) : (
        <ViewerLayout state={state} sock={sock} />
      )}
    </div>
  )
}

type Sock = ReturnType<typeof useAuctionSocket>
type LiveState = RoomState

// ---------- layouts ----------

function OrganizerLayout({ state, sock }: { state: LiveState; sock: Sock }) {
  const canSelect = state.status === 'LIVE' && !state.currentPlayer
  return (
    <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
        <AuctionStage
          state={state}
          clockOffset={sock.clockOffset}
          onViewResults={() => navigate(`/results/${state.tournamentId}`)}
        />
      </div>

      <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <PoolKpiStrip state={state} />
        <OrganizerControls state={state} onAction={sock.organizerAction} clockOffset={sock.clockOffset} />
        <TeamsPanel state={state} />
        <ParticipantsPanel state={state} />
        <ActivityFeed notifications={sock.notifications} />
      </div>

      <div className="space-y-4 lg:col-start-1 lg:row-start-2">
        <PlayerPoolPanel state={state} canSelect={canSelect} onAction={sock.organizerAction} />
      </div>
    </div>
  )
}

function ManagerLayout({
  state,
  sock,
  myTeam,
}: {
  state: LiveState
  sock: Sock
  myTeam: RoomTeam | undefined
}) {
  return (
    <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
      <div className="lg:col-start-1 lg:row-start-1">
        <AuctionStage
          state={state}
          clockOffset={sock.clockOffset}
          onViewResults={() => navigate(`/results/${state.tournamentId}`)}
        />
      </div>

      <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <BidPanel state={state} myTeam={myTeam} onBid={sock.placeBid} />
        <ParticipantsPanel state={state} />
        <ActivityFeed notifications={sock.notifications} />
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
        <SquadPanel state={state} myTeam={myTeam} />
      </div>
    </div>
  )
}

function ViewerLayout({ state, sock }: { state: LiveState; sock: Sock }) {
  const t = useStrings(STRINGS)
  return (
    <div className="mt-4 space-y-5">
      <AuctionStage
        state={state}
        clockOffset={sock.clockOffset}
        onViewResults={() => navigate(`/results/${state.tournamentId}`)}
      />
      <p className="flex items-center justify-center gap-1.5 rounded-full border border-dashed bg-muted/40 px-4 py-2 text-center text-sm text-muted-foreground">
        <Eye className="h-4 w-4" aria-hidden />
        {t.watchingNote}
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <TeamsPanel state={state} compact />
        <div className="space-y-5">
          <SoldFeed feed={state.soldFeed} />
          <ActivityFeed notifications={sock.notifications} />
        </div>
      </div>
    </div>
  )
}

// ---------- chrome ----------

function PoolKpiStrip({ state }: { state: LiveState }) {
  const items = [
    { label: 'Available', value: state.pool.available, tone: 'text-emerald-700' },
    { label: 'Sold', value: state.pool.sold, tone: 'text-teal-700' },
    { label: 'Unsold', value: state.pool.unsold, tone: 'text-rose-700' },
    { label: 'Skipped', value: state.pool.skipped, tone: 'text-slate-600' },
    { label: 'Total', value: state.pool.total, tone: 'text-foreground' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Player pool counts">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border bg-card px-2 py-2 text-center">
          <p className={cn('text-lg font-black leading-tight tabular-nums', i.tone)}>{i.value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{i.label}</p>
        </div>
      ))}
    </div>
  )
}

function RoomHeader({
  info,
  liveStatus,
  role,
  identityName,
  connected,
  joined,
  onLeave,
}: {
  info: RoomInfo
  /** live status from the socket snapshot when available (falls back to REST info) */
  liveStatus: AuctionStatus | null
  role: 'ORGANIZER' | 'MANAGER' | 'VIEWER'
  identityName?: string
  connected: boolean
  joined: boolean
  onLeave?: () => void
}) {
  const t = useStrings(STRINGS)
  const status = liveStatus ?? info.status
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => navigate(role === 'VIEWER' ? '/' : '/dashboard')}
          aria-label={t.goBack}
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-xs font-bold tracking-[0.18em]">
              {info.roomCode}
            </Badge>
            <Badge variant="secondary" className="text-xs">{info.sport === 'CRICKET' ? t.cricket : t.football}</Badge>
            <Badge variant="outline" className="text-xs">{info.mode === 'CATEGORY' ? t.category : t.normal}</Badge>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                STATUS_CHIP[status]
              )}
            >
              {t.status[status]}
            </span>
            {status === 'LIVE' ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
            ) : null}
          </div>
          <h1 className="mt-1 truncate text-base font-black tracking-tight sm:text-lg">{info.tournamentName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-12 sm:pl-0">
        <ConnectionChip connected={connected} joined={joined} />
        {identityName && role !== 'ORGANIZER' ? (
          <span className="hidden text-xs font-medium text-muted-foreground md:inline">
            {identityName} · {t.role[role]}
          </span>
        ) : null}
        {onLeave ? (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground" onClick={onLeave}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t.leave}
          </Button>
        ) : (
          <span className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground md:flex">
            <Gavel className="h-3.5 w-3.5 text-primary" aria-hidden /> Organizer seat
          </span>
        )}
      </div>
    </div>
  )
}

function ConnectionChip({ connected, joined }: { connected: boolean; joined: boolean }) {
  const t = useStrings(STRINGS)
  const ok = connected && joined
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
      )}
      role="status"
    >
      {ok ? <Wifi className="h-3 w-3" aria-hidden /> : <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {ok ? t.live : connected ? t.joining : t.connecting}
    </span>
  )
}
