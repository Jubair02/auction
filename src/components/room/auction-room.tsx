'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, Gavel, Loader2, LogOut, Maximize2, Minimize2, RefreshCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { useFullscreen } from '@/lib/use-fullscreen'
import {
  clearRoomIdentity,
  seatBelongsTo,
  loadRoomIdentity,
  localizeRoomError,
  saveRoomIdentity,
  useAuctionSocket,
  type StoredIdentity,
} from '@/lib/use-auction-socket'
import type { AuctionStatus, JoinResult, PublicBranding, RoomInfo, RoomState, RoomTeam } from '@/lib/types'
import { brandPalette } from '@/lib/brand-color'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuctionStage } from './stage'
import { BidPanel, MobileBidBar, useBidSubmitter, useManagerOutbid } from './bid-panel'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { OrganizerControls, useOrganizerAction } from './organizer-controls'
import { TeamsPanel } from './teams-panel'
import { ActivityFeed, ParticipantsPanel } from './participants-panel'
import { PlayerPoolPanel, SoldFeed } from './player-pool-panel'
import { SquadPanel } from './squad-panel'
import { JoinCard } from './join-card'
import { SponsorStrip } from '@/components/shared/sponsor-strip'
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
    otherSport: 'Others',
    category: 'Category',
    normal: 'Normal',
    status: { READY: 'Ready', LIVE: 'Live', PAUSED: 'Paused', ENDED: 'Ended' },
    role: { ORGANIZER: 'organizer', MANAGER: 'manager', VIEWER: 'viewer' },
    leave: 'Leave',
    leaveTitle: 'Leave your bidding seat?',
    leaveBody: 'You stop bidding for your team until you join the room again. The auction carries on without you.',
    leaveConfirm: 'Leave seat',
    cancel: 'Cancel',
    live: 'Live',
    joining: 'Joining…',
    connecting: 'Connecting…',
    tabTeams: 'Teams',
    tabPeople: 'People',
    tabActivity: 'Activity',
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    poolCounts: 'Player pool counts',
    kpiAvailable: 'Available',
    kpiSold: 'Sold',
    kpiUnsold: 'Unsold',
    kpiSkipped: 'Skipped',
    kpiTotal: 'Total',
    organizerSeat: 'Organizer seat',
    offlineTitle: 'Connection lost — reconnecting…',
    rejoiningTitle: 'Reconnected — rejoining the room…',
    offlineBody: 'Bidding and controls are paused until you are back. What you see may be out of date.',
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
    otherSport: 'অন্যান্য',
    category: 'ক্যাটাগরি',
    normal: 'সাধারণ',
    status: { READY: 'প্রস্তুত', LIVE: 'লাইভ', PAUSED: 'বিরতি', ENDED: 'শেষ' },
    role: { ORGANIZER: 'আয়োজক', MANAGER: 'ম্যানেজার', VIEWER: 'দর্শক' },
    leave: 'বের হন',
    leaveTitle: 'বিডিং সিট ছেড়ে দেবেন?',
    leaveBody: 'আবার রুমে যোগ না দেওয়া পর্যন্ত আপনি আপনার দলের হয়ে বিড করতে পারবেন না। নিলাম আপনাকে ছাড়াই চলবে।',
    leaveConfirm: 'সিট ছাড়ুন',
    cancel: 'বাতিল',
    live: 'লাইভ',
    joining: 'যোগ দিচ্ছে…',
    connecting: 'সংযোগ হচ্ছে…',
    tabTeams: 'দলসমূহ',
    tabPeople: 'অংশগ্রহণকারী',
    tabActivity: 'অ্যাক্টিভিটি',
    fullScreen: 'ফুল স্ক্রিন',
    exitFullScreen: 'ফুল স্ক্রিন বন্ধ করুন',
    poolCounts: 'খেলোয়াড় পুলের হিসাব',
    kpiAvailable: 'উপলব্ধ',
    kpiSold: 'বিক্রি',
    kpiUnsold: 'অবিক্রিত',
    kpiSkipped: 'বাদ',
    kpiTotal: 'মোট',
    organizerSeat: 'আয়োজকের আসন',
    offlineTitle: 'সংযোগ বিচ্ছিন্ন — আবার যুক্ত হচ্ছে…',
    rejoiningTitle: 'আবার সংযুক্ত — রুমে ফিরছে…',
    offlineBody: 'সংযোগ ফিরে না আসা পর্যন্ত বিড ও নিয়ন্ত্রণ বন্ধ থাকবে। স্ক্রিনে যা দেখছেন তা হালনাগাদ না-ও হতে পারে।',
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
  otherSport: string
  category: string
  normal: string
  status: Record<AuctionStatus, string>
  role: Record<'ORGANIZER' | 'MANAGER' | 'VIEWER', string>
  leave: string
  leaveTitle: string
  leaveBody: string
  leaveConfirm: string
  cancel: string
  live: string
  joining: string
  connecting: string
  tabTeams: string
  tabPeople: string
  tabActivity: string
  fullScreen: string
  exitFullScreen: string
  poolCounts: string
  kpiAvailable: string
  kpiSold: string
  kpiUnsold: string
  kpiSkipped: string
  kpiTotal: string
  organizerSeat: string
  offlineTitle: string
  rejoiningTitle: string
  offlineBody: string
}>

/** GET /api/rooms/:code also carries the tournament's public branding (PRO: colour + sponsors). */
type RoomInfoWithBranding = RoomInfo & { branding?: PublicBranding }

/** fatalError marker for a network failure — rendered in the viewer's language. */
const UNREACHABLE = '__unreachable__'

type Phase = 'loading' | 'notfound' | 'join' | 'live'

const STATUS_CHIP: Record<AuctionStatus, string> = {
  READY: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  LIVE: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  PAUSED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  ENDED: 'bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200',
}

/** The live auction room — resolves identity, joins the socket, renders the role layout. */
export default function AuctionRoom({ roomCode }: { roomCode: string }) {
  const t = useStrings(STRINGS)
  const [info, setInfo] = useState<RoomInfoWithBranding | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [identity, setIdentity] = useState<StoredIdentity | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [organizerPending, setOrganizerPending] = useState(false)
  // Owner/ADMIN (from the room info) or staff whose organizer seat was granted.
  const [canOrganize, setCanOrganize] = useState(false)

  const sock = useAuctionSocket(roomCode, token)
  const { isFullscreen } = useFullscreen()

  // Reset room-scoped state when the room code changes (adjust during render — no effect needed).
  const [roomKey, setRoomKey] = useState(roomCode)
  if (roomKey !== roomCode) {
    setRoomKey(roomCode)
    setInfo(null)
    setFatalError(null)
    setIdentity(null)
    setToken(null)
    setCanOrganize(false)
    setPhase('loading')
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const res = await apiGet<RoomInfoWithBranding>(`/api/rooms/${roomCode}`)
        if (cancelled) return
        setInfo(res)
        setCanOrganize(res.myRole === 'organizer')

        const stored = loadRoomIdentity(roomCode)
        // Only the account the seat was issued to may reuse it (shared phones at a venue).
        if (stored && !seatBelongsTo(stored, useAppStore.getState().user?.id ?? null)) {
          clearRoomIdentity(roomCode)
        } else if (stored) {
          setIdentity(stored)
          setToken(stored.socketToken)
          setPhase('live')
          return
        }
        // Owners/ADMINs are flagged by the room info; tournament staff
        // (co-organizers, auctioneers) are organizer accounts the room info
        // can't vouch for — try the seat and fall back to the join card on 403.
        const sessionRole = useAppStore.getState().user?.role
        if (res.myRole === 'organizer' || sessionRole === 'ORGANIZER') {
          try {
            const jr = await apiPost<JoinResult>(`/api/rooms/${roomCode}/join`, { role: 'organizer' })
            if (cancelled) return
            const ident: StoredIdentity = {
              role: 'ORGANIZER',
              name: useAppStore.getState().user?.name ?? 'Organizer',
              socketToken: jr.socketToken,
              at: Date.now(),
              userId: useAppStore.getState().user?.id ?? null,
            }
            saveRoomIdentity(roomCode, ident)
            setCanOrganize(true)
            setIdentity(ident)
            setToken(ident.socketToken)
            setPhase('live')
            return
          } catch {
            // organizer claim failed (expired session, or not this tournament's
            // staff) — fall through to the join card
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
      // An anonymous viewer has no name to show in the header.
      name: result.identity?.anon ? '' : (result.identity?.name ?? ''),
      teamId: result.identity?.teamId,
      teamName: result.identity?.teamName,
      socketToken: result.socketToken,
      at: Date.now(),
      userId: useAppStore.getState().user?.id ?? null,
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
        userId: useAppStore.getState().user?.id ?? null,
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

  // A pass saved in this tab can stop working (it expired, or the server's
  // secret changed). Instead of showing an error the user can't fix with
  // Retry, get a fresh pass once: organizers are re-seated automatically,
  // managers/viewers go back to the join card. Tried once per pass, so a
  // fresh pass that is also rejected still shows the real error.
  const [recoveredToken, setRecoveredToken] = useState<string | null>(null)
  useEffect(() => {
    if (!sock.joinError || !token || recoveredToken === token) return
    if (!/token|pass|AUCTION_SECRET/i.test(sock.joinError)) return
    const t0 = setTimeout(() => {
      setRecoveredToken(token)
      if (identity?.role === 'ORGANIZER') {
        void refreshOrganizerSeat()
      } else {
        leaveRoom()
      }
    }, 0)
    return () => clearTimeout(t0)
    // leaveRoom / refreshOrganizerSeat are recreated every render; listing them would
    // re-arm this one-shot recovery on each render. The guard above keeps it once per pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sock.joinError, token, recoveredToken, identity?.role])

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
          onOrganizerSeat={canOrganize || identity?.role === 'ORGANIZER' ? () => void refreshOrganizerSeat() : undefined}
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
  const branding = info.branding ?? null
  // Viewers and managers see the sponsors in one slim line under the header —
  // clear of the stage and the bid controls. The organizer cockpit stays bare.
  const showSponsors = role !== 'ORGANIZER' && !!state && !!branding && branding.sponsors.length > 0

  return (
    <div
      className={cn(
        'container mx-auto px-3 py-4 sm:px-4 sm:py-6',
        isFullscreen ? 'max-w-[1680px]' : 'max-w-7xl',
        // keeps the page clear of the phone bid bar
        role === 'MANAGER' && state && 'pb-32 lg:pb-6'
      )}
    >
      <RoomHeader
        info={info}
        branding={branding}
        liveStatus={sock.state?.status ?? null}
        role={role}
        identityName={identity?.name}
        connected={sock.connected}
        joined={sock.joined}
        onLeave={role === 'ORGANIZER' ? undefined : leaveRoom}
      />

      {showSponsors ? <SponsorStrip sponsors={branding.sponsors} variant="room" brandColor={branding.brandColor} className="mt-3" /> : null}

      {sock.joinError ? (
        <Card className="mt-4 border-rose-200 dark:border-rose-900/60">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <WifiOff className="h-8 w-8 text-rose-500" aria-hidden />
            <p className="font-bold">{t.couldNotJoin}</p>
            <p className="max-w-md text-sm text-muted-foreground">{localizeRoomError(sock.joinError)}</p>
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
      ) : (
        <>
          {!sock.connected || !sock.joined ? <OfflineBanner connected={sock.connected} /> : null}
          {/* A crash inside the live layouts keeps the header and offers "Reload room". */}
          <ErrorBoundary variant="room" key={`${roomCode}:${role}`}>
            {role === 'ORGANIZER' ? (
              <OrganizerLayout state={state} sock={sock} />
            ) : role === 'MANAGER' ? (
              <ManagerLayout state={state} sock={sock} myTeam={myTeam} />
            ) : (
              <ViewerLayout state={state} sock={sock} />
            )}
          </ErrorBoundary>
        </>
      )}
    </div>
  )
}

type Sock = ReturnType<typeof useAuctionSocket>
type LiveState = RoomState

// ---------- layouts ----------

function OrganizerLayout({ state, sock }: { state: LiveState; sock: Sock }) {
  const canSelect = state.status === 'LIVE' && !state.currentPlayer
  // Pool actions (put on block, re-auction) explain a refused or unconfirmed send too.
  const poolAction = useOrganizerAction(sock.organizerAction)
  return (
    <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="lg:col-start-1 lg:row-start-1">
        <AuctionStage
          state={state}
          clockOffset={sock.clockOffset}
          onViewResults={() => navigate(`/results/${state.tournamentId}`)}
        />
      </div>

      {/* the cockpit: controls first, everything else one tab away */}
      <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <OrganizerControls
          state={state}
          onAction={sock.organizerAction}
          clockOffset={sock.clockOffset}
          online={sock.connected && sock.joined}
        />
        <RoomSideTabs state={state} notifications={sock.notifications} tabs={['teams', 'people', 'activity']} />
      </div>

      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        <PoolKpiStrip state={state} />
        <PlayerPoolPanel state={state} canSelect={canSelect} onAction={poolAction} />
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
  // One bid in flight for both the console and the phone bid bar.
  const bids = useBidSubmitter(sock.placeBid)
  const online = sock.connected && sock.joined
  const outbid = useManagerOutbid(state, myTeam?.id)
  const bidProps = { state, myTeam, online, pendingAmount: bids.pendingAmount, onBid: bids.submit, outbid }
  return (
    <>
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="lg:col-start-1 lg:row-start-1">
          <AuctionStage
            state={state}
            clockOffset={sock.clockOffset}
            onViewResults={() => navigate(`/results/${state.tournamentId}`)}
          />
        </div>

        <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <BidPanel {...bidProps} />
          <RoomSideTabs state={state} notifications={sock.notifications} tabs={['activity', 'teams', 'people']} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <SquadPanel state={state} myTeam={myTeam} />
        </div>
      </div>

      <MobileBidBar {...bidProps} />
    </>
  )
}

function ViewerLayout({ state, sock }: { state: LiveState; sock: Sock }) {
  const t = useStrings(STRINGS)
  return (
    <div className="mt-4 space-y-5">
      {/* No "View results" for viewers: the results page needs an organizer or team-manager login. */}
      <AuctionStage state={state} clockOffset={sock.clockOffset} />
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

type SideTab = 'teams' | 'people' | 'activity'

/** Teams, participants and the activity feed behind one tab strip, instead of three stacked cards. */
function RoomSideTabs({
  state,
  notifications,
  tabs,
}: {
  state: LiveState
  notifications: Sock['notifications']
  /** Tab order — the first one opens by default. */
  tabs: SideTab[]
}) {
  const t = useStrings(STRINGS)
  const online = state.participants.filter((p) => p.online).length + state.viewersOnline
  const label: Record<SideTab, React.ReactNode> = {
    teams: (
      <>
        {t.tabTeams} <span className="text-xs tabular-nums text-muted-foreground">{state.teams.length}</span>
      </>
    ),
    people: (
      <>
        {t.tabPeople} <span className="text-xs tabular-nums text-muted-foreground">{online}</span>
      </>
    ),
    activity: t.tabActivity,
  }
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Tabs defaultValue={tabs[0]} className="gap-0">
        <div className="border-b p-2">
          <TabsList className="w-full">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {label[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="teams" className="max-h-[28rem] overflow-y-auto p-3">
          <TeamsPanel state={state} embedded />
        </TabsContent>
        <TabsContent value="people" className="max-h-[28rem] overflow-y-auto p-2">
          <ParticipantsPanel state={state} embedded />
        </TabsContent>
        <TabsContent value="activity" className="max-h-[28rem] overflow-y-auto p-2">
          <ActivityFeed notifications={notifications} embedded />
        </TabsContent>
      </Tabs>
    </Card>
  )
}

function PoolKpiStrip({ state }: { state: LiveState }) {
  const t = useStrings(STRINGS)
  const items = [
    { label: t.kpiAvailable, value: state.pool.available, tone: 'text-emerald-700 dark:text-emerald-400' },
    { label: t.kpiSold, value: state.pool.sold, tone: 'text-teal-700 dark:text-teal-300' },
    { label: t.kpiUnsold, value: state.pool.unsold, tone: 'text-rose-700 dark:text-rose-400' },
    { label: t.kpiSkipped, value: state.pool.skipped, tone: 'text-slate-600 dark:text-slate-300' },
    { label: t.kpiTotal, value: state.pool.total, tone: 'text-foreground' },
  ]
  return (
    <div className="grid grid-cols-5 divide-x rounded-xl border bg-card" aria-label={t.poolCounts}>
      {items.map((i) => (
        <div key={i.label} className="px-1 py-2.5 text-center">
          <p className={cn('text-lg font-black leading-tight tabular-nums sm:text-xl', i.tone)}>{i.value}</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{i.label}</p>
        </div>
      ))}
    </div>
  )
}

function RoomHeader({
  info,
  branding,
  liveStatus,
  role,
  identityName,
  connected,
  joined,
  onLeave,
}: {
  info: RoomInfo
  /** Tournament logo always; brand colour only on PRO (null otherwise). */
  branding: PublicBranding | null
  /** live status from the socket snapshot when available (falls back to REST info) */
  liveStatus: AuctionStatus | null
  role: 'ORGANIZER' | 'MANAGER' | 'VIEWER'
  identityName?: string
  connected: boolean
  joined: boolean
  onLeave?: () => void
}) {
  const t = useStrings(STRINGS)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const fullscreen = useFullscreen()
  const status = liveStatus ?? info.status
  const accent = branding?.brandColor ? brandPalette(branding.brandColor).bg : null
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4',
        accent && 'pt-4',
      )}
    >
      {/* PRO brand accent: a thin bar across the top of the header. */}
      {accent ? <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} /> : null}
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => {
            if (fullscreen.isFullscreen) fullscreen.toggle()
            navigate(role === 'VIEWER' ? '/' : '/dashboard')
          }}
          aria-label={t.goBack}
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Button>
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            className="hidden h-11 w-11 shrink-0 rounded-lg border bg-white object-contain p-0.5 sm:block"
          />
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-xs font-bold tracking-[0.18em]">
              {info.roomCode}
            </Badge>
            <Badge variant="secondary" className="text-xs">{info.sport === 'CRICKET' ? t.cricket : info.sport === 'FOOTBALL' ? t.football : t.otherSport}</Badge>
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
        {fullscreen.supported ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={fullscreen.toggle}
            aria-label={fullscreen.isFullscreen ? t.exitFullScreen : t.fullScreen}
            title={fullscreen.isFullscreen ? t.exitFullScreen : t.fullScreen}
          >
            {fullscreen.isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="ml-1.5 hidden lg:inline">{fullscreen.isFullscreen ? t.exitFullScreen : t.fullScreen}</span>
          </Button>
        ) : null}
        {onLeave ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              // A manager leaving mid-auction loses their bidding seat — confirm first.
              onClick={() => (role === 'MANAGER' ? setConfirmLeave(true) : onLeave())}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t.leave}
            </Button>
            <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.leaveTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{t.leaveBody}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={onLeave}>{t.leaveConfirm}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <span className="hidden items-center gap-1 text-xs font-semibold text-muted-foreground md:flex">
            <Gavel className="h-3.5 w-3.5 text-primary" aria-hidden /> {t.organizerSeat}
          </span>
        )}
      </div>
    </div>
  )
}

/** Shown over a live room that lost its connection: the snapshot below is stale and actions are refused. */
function OfflineBanner({ connected }: { connected: boolean }) {
  const t = useStrings(STRINGS)
  return (
    <div
      className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
      role="status"
      aria-live="polite"
    >
      {connected ? (
        <Loader2 className="mt-0.5 h-4.5 w-4.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <WifiOff className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
      )}
      <div className="min-w-0">
        <p className="text-sm font-bold">{connected ? t.rejoiningTitle : t.offlineTitle}</p>
        <p className="text-xs">{t.offlineBody}</p>
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
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
      )}
      role="status"
    >
      {ok ? <Wifi className="h-3 w-3" aria-hidden /> : <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {ok ? t.live : connected ? t.joining : t.connecting}
    </span>
  )
}
