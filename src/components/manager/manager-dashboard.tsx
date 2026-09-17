'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, DoorOpen, Gavel, LayoutGrid, Loader2, Plus, Trophy, UserCog, Users } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { formatBDT } from '@/lib/format'
import type { AuctionStatus, TeamDTO, TournamentStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { TeamAvatar } from '@/components/shared/avatars'
import { TournamentStatusBadge } from '@/components/shared/status-badges'

interface MyTeamRow extends TeamDTO {
  tournamentName: string
  tournamentStatus: TournamentStatus
  tournamentId: string
  roomCode?: string | null
  auctionStatus?: AuctionStatus | null
}

const ENTERABLE: AuctionStatus[] = ['READY', 'LIVE', 'PAUSED']

export default function ManagerDashboard() {
  const user = useAppStore((s) => s.user)
  const [teams, setTeams] = useState<MyTeamRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ teams: MyTeamRow[] }>('/api/my/teams')
      .then((res) => {
        if (!cancelled) setTeams(res.teams)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your teams')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = user?.name.split(/\s+/)[0] ?? 'Manager'
  const totalRemaining = teams?.reduce((acc, t) => acc + t.remaining, 0) ?? 0
  const totalSpent = teams?.reduce((acc, t) => acc + t.spent, 0) ?? 0

  // dedupe tournaments of my teams
  const myAuctions = teams
    ? Array.from(
        teams.reduce((map, t) => {
          if (!map.has(t.tournamentId)) {
            map.set(t.tournamentId, {
              tournamentId: t.tournamentId,
              tournamentName: t.tournamentName,
              tournamentStatus: t.tournamentStatus,
            })
          }
          return map
        },
        new Map<string, { tournamentId: string; tournamentName: string; tournamentStatus: TournamentStatus }>())
      ).map(([, v]) => v)
    : []

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Welcome back, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your teams, squads and live auction rooms — all in one place.
          </p>
        </div>
        <Button size="lg" className="h-12 font-bold" onClick={() => navigate('/join')}>
          <DoorOpen className="mr-2 h-4.5 w-4.5" /> Join room
        </Button>
      </header>

      {error ? (
        <Card className="mt-6 border-rose-200">
          <CardContent className="py-6 text-center text-sm text-rose-700">{error}</CardContent>
        </Card>
      ) : null}

      {!teams && !error ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : null}

      {teams && teams.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="My teams" value={teams.length} icon={Users} tone="primary" />
            <StatCard label="Players owned" value={teams.reduce((a, t) => a + t.squadCount, 0)} icon={UserCog} />
            <StatCard label="Total spent" value={formatBDT(totalSpent)} icon={Trophy} tone="warning" />
            <StatCard label="Total left" value={formatBDT(totalRemaining)} icon={LayoutGrid} tone="success" />
          </div>

          <section className="mt-8" aria-label="My teams">
            <h2 className="mb-3 text-lg font-black tracking-tight">My teams</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((t) => {
                const spendPct = t.budget > 0 ? Math.min(100, (t.spent / t.budget) * 100) : 0
                const canEnter = !!t.roomCode && !!t.auctionStatus && ENTERABLE.includes(t.auctionStatus)
                const isLive = t.auctionStatus === 'LIVE'
                return (
                  <Card key={t.id} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <TeamAvatar name={t.name} color={t.color} logoUrl={t.logoUrl} className="h-11 w-11" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{t.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{t.tournamentName}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isLive ? (
                            <Badge className="bg-amber-500 text-white">Live now</Badge>
                          ) : null}
                          <TournamentStatusBadge status={t.tournamentStatus} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/50 px-1 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</p>
                          <p className="text-sm font-bold tabular-nums">{formatBDT(t.budget)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 px-1 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Spent</p>
                          <p className="text-sm font-bold tabular-nums">{formatBDT(t.spent)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-1 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Left</p>
                          <p className="text-sm font-bold tabular-nums text-emerald-700">{formatBDT(t.remaining)}</p>
                        </div>
                      </div>
                      <Progress value={spendPct} className="h-1.5" aria-label={`${t.name} budget used`} />

                      <p className="text-xs text-muted-foreground">
                        Squad <span className="font-bold text-foreground tabular-nums">{t.squadCount}/{t.maxSquad}</span> · min {t.minSquad}
                      </p>

                      <div className="mt-auto grid grid-cols-2 gap-2">
                        {canEnter ? (
                          <Button className="col-span-2 h-10 font-bold" onClick={() => navigate(`/room/${t.roomCode}`)}>
                            <DoorOpen className="mr-1.5 h-4 w-4" /> Enter auction room
                          </Button>
                        ) : null}
                        <Button variant="outline" className="h-10" onClick={() => navigate('/my-team')}>
                          View squad
                        </Button>
                        <Button variant="ghost" className="h-10" onClick={() => navigate(`/results/${t.tournamentId}`)}>
                          Results
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>

          <section className="mt-8" aria-label="My auctions">
            <h2 className="mb-3 text-lg font-black tracking-tight">My auctions</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myAuctions.map((a) => (
                <Card key={a.tournamentId}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100" aria-hidden>
                        <CalendarDays className="h-4.5 w-4.5 text-amber-700" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{a.tournamentName}</p>
                        <p className="text-xs text-muted-foreground">tournament</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <TournamentStatusBadge status={a.tournamentStatus} />
                      <Button variant="link" className="h-6 p-0 text-xs" onClick={() => navigate(`/results/${a.tournamentId}`)}>
                        Results
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {teams && teams.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Users}
            title="No team yet"
            description="You are not managing a team in any auction. Ask the organizer to add you as a team manager, or join a live room as a viewer to see how it works."
            action={
              <Button onClick={() => navigate('/join')}>
                <Plus className="mr-2 h-4 w-4" /> Join room
              </Button>
            }
          />
        </div>
      ) : null}

      {teams && teams.length === 0 ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Gavel className="h-3 w-3" aria-hidden />
          Tip: room codes look like BD26-XXXX.
        </p>
      ) : null}

      {teams === null && error ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : null}
    </div>
  )
}
