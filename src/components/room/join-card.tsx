'use client'

import { useState } from 'react'
import { Eye, Gavel, Loader2, LogIn, ShieldAlert, UserCog, UserPlus } from 'lucide-react'
import { apiPost, ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { navigate, setReturnTo } from '@/lib/router'
import type { JoinResult, RoomInfo } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    errNameManager: 'Enter your name (min 2 characters)',
    errNameViewer: 'Enter a display name to watch',
    errTeam: 'Choose your team to bid for',
    errJoin: 'Could not join the room. Try again.',
    cricket: 'Cricket',
    football: 'Football',
    categoryBids: 'Category bids',
    normalBids: 'Normal bids',
    joinAs: 'Join as',
    teamManager: 'Team Manager',
    viewer: 'Viewer',
    loggedInAs: (admin: boolean) =>
      `You're logged in as ${admin ? 'an admin' : 'an organizer'}. Only team manager accounts can bid — log in with your manager account, or watch as a viewer.`,
    loginPrompt:
      'Log in with your team manager account to bid. Your team stays linked to your account, so nobody else can bid with its budget.',
    loginToBid: 'Log in to bid',
    createAccount: 'Create account',
    watchInstead: 'Watch as a viewer instead',
    yourTeam: 'Your team',
    selectTeam: 'Select the team you manage',
    budget: (amount: string) => `৳${amount} budget`,
    tagYourTeam: '· your team',
    tagTaken: '· taken',
    tagInviteOnly: '· invite only',
    teamsOpen: (n: number) => `${n} teams in this auction. Picking an open team links it to your account.`,
    teamsInvite: (n: number) =>
      `${n} teams in this auction. Your team must be linked to your account — use the invite link the organizer sent you.`,
    yourName: 'Your name',
    displayName: 'Display name',
    placeholderManager: 'e.g. Rakib Hasan',
    placeholderViewer: 'e.g. Cricket Fan 42',
    joinBid: 'Join & bid',
    watchLive: 'Watch live',
    managerNote: 'Managers bid from their phone in real time. Your team stays linked to your account.',
    viewerNote: 'Viewers see every bid live but cannot bid — perfect for teammates and fans.',
    or: 'or',
    takeOrganizerSeat: 'Take the organizer seat',
  },
  bn: {
    errNameManager: 'আপনার নাম লিখুন (কমপক্ষে 2 অক্ষর)',
    errNameViewer: 'দেখার জন্য একটি নাম দিন',
    errTeam: 'কোন দলের হয়ে বিড করবেন, বেছে নিন',
    errJoin: 'রুমে যোগ দেওয়া যায়নি। আবার চেষ্টা করুন।',
    cricket: 'ক্রিকেট',
    football: 'ফুটবল',
    categoryBids: 'ক্যাটাগরি বিড',
    normalBids: 'সাধারণ বিড',
    joinAs: 'যেভাবে যোগ দেবেন',
    teamManager: 'টিম ম্যানেজার',
    viewer: 'দর্শক',
    loggedInAs: (admin: boolean) =>
      `আপনি ${admin ? 'অ্যাডমিন' : 'আয়োজক'} হিসেবে লগইন করেছেন। শুধু টিম ম্যানেজার অ্যাকাউন্ট থেকে বিড করা যায় — ম্যানেজার অ্যাকাউন্টে লগইন করুন, অথবা দর্শক হিসেবে দেখুন।`,
    loginPrompt:
      'বিড করতে টিম ম্যানেজার অ্যাকাউন্টে লগইন করুন। আপনার দল আপনার অ্যাকাউন্টের সাথে যুক্ত থাকে, তাই অন্য কেউ এর বাজেট দিয়ে বিড করতে পারবে না।',
    loginToBid: 'বিড করতে লগইন করুন',
    createAccount: 'অ্যাকাউন্ট খুলুন',
    watchInstead: 'বরং দর্শক হিসেবে দেখুন',
    yourTeam: 'আপনার দল',
    selectTeam: 'আপনি যে দলের ম্যানেজার, সেটি বেছে নিন',
    budget: (amount: string) => `৳${amount} বাজেট`,
    tagYourTeam: '· আপনার দল',
    tagTaken: '· নেওয়া হয়ে গেছে',
    tagInviteOnly: '· শুধু ইনভাইটে',
    teamsOpen: (n: number) => `এই নিলামে ${n}টি দল। খালি কোনো দল বেছে নিলে সেটি আপনার অ্যাকাউন্টের সাথে যুক্ত হবে।`,
    teamsInvite: (n: number) =>
      `এই নিলামে ${n}টি দল। আপনার দল আপনার অ্যাকাউন্টের সাথে যুক্ত থাকতে হবে — আয়োজকের পাঠানো ইনভাইট লিংক ব্যবহার করুন।`,
    yourName: 'আপনার নাম',
    displayName: 'ডিসপ্লে নাম',
    placeholderManager: 'যেমন: রাকিব হাসান',
    placeholderViewer: 'যেমন: ক্রিকেট ফ্যান 42',
    joinBid: 'যোগ দিন ও বিড করুন',
    watchLive: 'লাইভ দেখুন',
    managerNote: 'ম্যানেজাররা ফোন থেকেই রিয়েল টাইমে বিড করেন। আপনার দল আপনার অ্যাকাউন্টের সাথে যুক্ত থাকে।',
    viewerNote: 'দর্শকরা প্রতিটি বিড লাইভ দেখতে পান, তবে বিড করতে পারেন না — সতীর্থ আর ভক্তদের জন্য দারুণ।',
    or: 'অথবা',
    takeOrganizerSeat: 'আয়োজকের আসনে বসুন',
  },
} satisfies Strings<{
  errNameManager: string
  errNameViewer: string
  errTeam: string
  errJoin: string
  cricket: string
  football: string
  categoryBids: string
  normalBids: string
  joinAs: string
  teamManager: string
  viewer: string
  loggedInAs: (admin: boolean) => string
  loginPrompt: string
  loginToBid: string
  createAccount: string
  watchInstead: string
  yourTeam: string
  selectTeam: string
  budget: (amount: string) => string
  tagYourTeam: string
  tagTaken: string
  tagInviteOnly: string
  teamsOpen: (n: number) => string
  teamsInvite: (n: number) => string
  yourName: string
  displayName: string
  placeholderManager: string
  placeholderViewer: string
  joinBid: string
  watchLive: string
  managerNote: string
  viewerNote: string
  or: string
  takeOrganizerSeat: string
}>

interface JoinCardProps {
  info: RoomInfo
  onJoined: (result: JoinResult, role: 'MANAGER' | 'VIEWER') => void
  /** present when the logged-in user owns this tournament — takes the organizer seat */
  onOrganizerSeat?: () => void
  organizerSeatPending?: boolean
}

/** Gate before the live room — pick a seat as team manager or watch as viewer. */
export function JoinCard({ info, onJoined, onOrganizerSeat, organizerSeatPending = false }: JoinCardProps) {
  const t = useStrings(STRINGS)
  const user = useAppStore((s) => s.user)
  const myManagedTeam = user
    ? info.teams.find((team) => team.managerUserId === user.id)
    : undefined

  const [roleTab, setRoleTab] = useState<'MANAGER' | 'VIEWER'>('MANAGER')
  const [name, setName] = useState(user?.name ?? myManagedTeam?.captainName ?? '')
  const [teamId, setTeamId] = useState<string>(myManagedTeam?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Bidding spends a real team purse, so it needs a manager login (the API enforces this too).
  const canBid = user?.role === 'MANAGER'
  const needsManagerLogin = roleTab === 'MANAGER' && !canBid

  function goToAuth(to: '/login' | '/register') {
    setReturnTo(`/room/${info.roomCode}`)
    navigate(to)
  }

  async function join() {
    setError(null)
    if (!name.trim() || name.trim().length < 2) {
      setError(roleTab === 'MANAGER' ? t.errNameManager : t.errNameViewer)
      return
    }
    if (roleTab === 'MANAGER' && !teamId) {
      setError(t.errTeam)
      return
    }
    setSubmitting(true)
    try {
      if (roleTab === 'MANAGER') {
        const res = await apiPost<JoinResult>(`/api/rooms/${info.roomCode}/join`, {
          role: 'manager',
          name: name.trim(),
          teamId,
        })
        onJoined(res, 'MANAGER')
      } else {
        const res = await apiPost<JoinResult>(`/api/rooms/${info.roomCode}/join`, {
          role: 'viewer',
          name: name.trim(),
        })
        onJoined(res, 'VIEWER')
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errJoin)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="border-2 shadow-md">
        <CardContent className="p-5 sm:p-6">
          {/* room header */}
          <div className="mb-5 flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
              <Gavel className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">{info.tournamentName}</h1>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Badge variant="outline" className="font-mono tracking-widest">{info.roomCode}</Badge>
              <Badge variant="secondary">{info.sport === 'CRICKET' ? t.cricket : t.football}</Badge>
              <Badge variant="outline">{info.mode === 'CATEGORY' ? t.categoryBids : t.normalBids}</Badge>
              <TournamentStatusBadge status={info.status} />
            </div>
          </div>

          {/* role segmented control */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={t.joinAs}>
            <button
              type="button"
              role="tab"
              aria-selected={roleTab === 'MANAGER'}
              onClick={() => setRoleTab('MANAGER')}
              className={cn(
                'flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all',
                roleTab === 'MANAGER' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <UserCog className="h-4 w-4" aria-hidden /> {t.teamManager}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleTab === 'VIEWER'}
              onClick={() => setRoleTab('VIEWER')}
              className={cn(
                'flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-all',
                roleTab === 'VIEWER' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-4 w-4" aria-hidden /> {t.viewer}
            </button>
          </div>

          {needsManagerLogin ? (
            <div className="mt-4 space-y-4">
              <Alert>
                <ShieldAlert className="h-4 w-4" aria-hidden />
                <AlertDescription>
                  {user
                    ? t.loggedInAs(user.role === 'ADMIN')
                    : t.loginPrompt}
                </AlertDescription>
              </Alert>
              {!user ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button size="lg" className="h-12 text-base font-black" onClick={() => goToAuth('/login')}>
                    <LogIn className="mr-2 h-5 w-5" aria-hidden /> {t.loginToBid}
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 text-base font-bold" onClick={() => goToAuth('/register')}>
                    <UserPlus className="mr-2 h-5 w-5" aria-hidden /> {t.createAccount}
                  </Button>
                </div>
              ) : null}
              <Button variant="ghost" className="h-11 w-full" onClick={() => setRoleTab('VIEWER')}>
                <Eye className="mr-2 h-4 w-4" aria-hidden /> {t.watchInstead}
              </Button>
            </div>
          ) : (
          <div className="mt-4 space-y-4">
            {roleTab === 'MANAGER' ? (
              <div className="space-y-1.5">
                <Label htmlFor="join-team">{t.yourTeam}</Label>
                <Select value={teamId} onValueChange={(v) => { setTeamId(v); setError(null) }}>
                  <SelectTrigger id="join-team" className="h-12 w-full text-base">
                    <SelectValue placeholder={t.selectTeam} />
                  </SelectTrigger>
                  <SelectContent>
                    {info.teams.map((team) => (
                      <SelectItem
                        key={team.id}
                        value={team.id}
                        disabled={team.managerUserId ? team.managerUserId !== user?.id : !info.allowOpenClaim}
                      >
                        <span className="flex items-center gap-2">
                          {team.name}
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t.budget(formatNumber(team.budget))}
                          </span>
                          {team.managerUserId === user?.id ? (
                            <span className="text-[10px] font-bold uppercase text-teal-700">{t.tagYourTeam}</span>
                          ) : team.managerUserId ? (
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">{t.tagTaken}</span>
                          ) : !info.allowOpenClaim ? (
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">{t.tagInviteOnly}</span>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {info.allowOpenClaim
                    ? t.teamsOpen(info.teams.length)
                    : t.teamsInvite(info.teams.length)}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="join-name">{roleTab === 'MANAGER' ? t.yourName : t.displayName}</Label>
              <Input
                id="join-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
                placeholder={roleTab === 'MANAGER' ? t.placeholderManager : t.placeholderViewer}
                className="h-12 text-base"
                maxLength={40}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !submitting) void join()
                }}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              size="lg"
              className="h-12 w-full text-base font-black"
              disabled={submitting}
              onClick={() => void join()}
            >
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : <Gavel className="mr-2 h-5 w-5" aria-hidden />}
              {roleTab === 'MANAGER' ? t.joinBid : t.watchLive}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {roleTab === 'MANAGER'
                ? t.managerNote
                : t.viewerNote}
            </p>
          </div>
          )}

          {onOrganizerSeat ? (
            <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> {t.or} <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  variant="outline"
                  className="h-12 w-full text-base font-bold"
                  disabled={organizerSeatPending}
                  onClick={onOrganizerSeat}
                >
                  {organizerSeatPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : <Gavel className="mr-2 h-5 w-5" aria-hidden />}
                  {t.takeOrganizerSeat}
                </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
