'use client'

import { useState } from 'react'
import { Eye, Gavel, Loader2, ShieldAlert, UserCog } from 'lucide-react'
import { apiPost, ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
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

interface JoinCardProps {
  info: RoomInfo
  onJoined: (result: JoinResult, role: 'MANAGER' | 'VIEWER') => void
  /** present when the logged-in user owns this tournament — takes the organizer seat */
  onOrganizerSeat?: () => void
  organizerSeatPending?: boolean
}

/** Gate before the live room — pick a seat as team manager or watch as viewer. */
export function JoinCard({ info, onJoined, onOrganizerSeat, organizerSeatPending = false }: JoinCardProps) {
  const user = useAppStore((s) => s.user)
  const myManagedTeam = user
    ? info.teams.find((t) => t.managerUserId === user.id)
    : undefined

  const [roleTab, setRoleTab] = useState<'MANAGER' | 'VIEWER'>('MANAGER')
  const [name, setName] = useState(user?.name ?? myManagedTeam?.captainName ?? '')
  const [teamId, setTeamId] = useState<string>(myManagedTeam?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    setError(null)
    if (!name.trim() || name.trim().length < 2) {
      setError(roleTab === 'MANAGER' ? 'Enter your name (min 2 characters)' : 'Enter a display name to watch')
      return
    }
    if (roleTab === 'MANAGER' && !teamId) {
      setError('Choose your team to bid for')
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
      setError(e instanceof ApiError ? e.message : 'Could not join the room. Try again.')
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
              <Badge variant="secondary">{info.sport === 'CRICKET' ? 'Cricket' : 'Football'}</Badge>
              <Badge variant="outline">{info.mode === 'CATEGORY' ? 'Category bids' : 'Normal bids'}</Badge>
              <TournamentStatusBadge status={info.status} />
            </div>
          </div>

          {/* role segmented control */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Join as">
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
              <UserCog className="h-4 w-4" aria-hidden /> Team Manager
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
              <Eye className="h-4 w-4" aria-hidden /> Viewer
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {roleTab === 'MANAGER' ? (
              <div className="space-y-1.5">
                <Label htmlFor="join-team">Your team</Label>
                <Select value={teamId} onValueChange={(v) => { setTeamId(v); setError(null) }}>
                  <SelectTrigger id="join-team" className="h-12 w-full text-base">
                    <SelectValue placeholder="Select the team you manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {info.teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          {t.name}
                          <span className="text-xs text-muted-foreground tabular-nums">
                            ৳{formatNumber(t.budget)} budget
                          </span>
                          {t.managerUserId ? (
                            <span className="text-[10px] font-bold uppercase text-teal-700">· registered</span>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {info.teams.length} teams in this auction. Teams marked “registered” belong to a manager account.
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="join-name">{roleTab === 'MANAGER' ? 'Your name' : 'Display name'}</Label>
              <Input
                id="join-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
                placeholder={roleTab === 'MANAGER' ? 'e.g. Rakib Hasan' : 'e.g. Cricket Fan 42'}
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
              {roleTab === 'MANAGER' ? 'Join & bid' : 'Watch live'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {roleTab === 'MANAGER'
                ? 'Managers bid from their phone in real time. Your seat stays claimed on this device.'
                : 'Viewers see every bid live but cannot bid — perfect for teammates and fans.'}
            </p>

            {onOrganizerSeat ? (
              <>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  variant="outline"
                  className="h-12 w-full text-base font-bold"
                  disabled={organizerSeatPending}
                  onClick={onOrganizerSeat}
                >
                  {organizerSeatPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : <Gavel className="mr-2 h-5 w-5" aria-hidden />}
                  Take the organizer seat
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
