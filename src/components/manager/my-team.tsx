'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, ShieldAlert, Trophy, Users, Wallet } from 'lucide-react'
import { apiGet, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { formatBDT } from '@/lib/format'
import type { PlayerDTO, TeamDTO, TournamentDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { PlayerAvatar, TeamAvatar } from '@/components/shared/avatars'

interface MyTeamRow extends TeamDTO {
  tournamentId: string
  tournamentName: string
}

export default function MyTeamView() {
  const user = useAppStore((s) => s.user)
  const [teams, setTeams] = useState<MyTeamRow[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detailFor, setDetailFor] = useState<{ teamId: string; data: TournamentDetail } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // load my teams
  useEffect(() => {
    let cancelled = false
    apiGet<{ teams: MyTeamRow[] }>('/api/my/teams')
      .then((res) => {
        if (cancelled) return
        setTeams(res.teams)
        setSelected(res.teams[0]?.id ?? null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Could not load your teams')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // load tournament detail for the selected team — setStates only after the await
  useEffect(() => {
    if (!selected) return
    const team = teams?.find((t) => t.id === selected)
    if (!team) return
    let cancelled = false
    async function load(tid: string, teamId: string) {
      try {
        const res = await apiGet<TournamentDetail>(`/api/tournaments/${tid}`)
        if (!cancelled) setDetailFor({ teamId, data: res })
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Could not load the tournament')
          setDetailFor(null)
        }
      }
    }
    void load(team.tournamentId, team.id)
    return () => {
      cancelled = true
    }
  }, [selected, teams])

  const detail = detailFor && detailFor.teamId === selected ? detailFor.data : null
  const detailLoading = !!selected && (!detailFor || detailFor.teamId !== selected)

  const myTeam = detail?.teams.find((t) => t.id === selected)
  const squad = useMemo(() => {
    if (!detail || !myTeam) return []
    return detail.players
      .filter((p) => p.soldToTeamId === myTeam.id && p.status === 'SOLD')
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
  }, [detail, myTeam])

  if (loading && !teams) {
    return (
      <div className="container mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (error && !detail) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (teams && teams.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          icon={Users}
          title="No team yet"
          description="You are not managing a team in any auction yet. Join a room with its code and pick an unclaimed team, or ask the organizer to attach one to your account."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate('/join')}>Join a room</Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Back to dashboard
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const spendPct = myTeam && myTeam.budget > 0 ? Math.min(100, (myTeam.spent / myTeam.budget) * 100) : 0

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">My team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Squad, budget and spending at a glance.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Back to dashboard
        </Button>
      </header>

      {teams && teams.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Choose team">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected === t.id}
              onClick={() => setSelected(t.id)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition-colors',
                selected === t.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary/40'
              )}
            >
              <TeamAvatar name={t.name} color={t.color} logoUrl={t.logoUrl} className="h-6 w-6" />
              {t.name}
            </button>
          ))}
        </div>
      ) : null}

      {detailLoading || !myTeam || !detail ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : (
        <>
          <Card className="mt-6">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <TeamAvatar name={myTeam.name} color={myTeam.color} logoUrl={myTeam.logoUrl} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-black">{myTeam.name}</h2>
                  <p className="truncate text-sm text-muted-foreground">{detail.tournament.name}</p>
                </div>
                {user && myTeam.captainName ? (
                  <Badge variant="secondary" className="hidden sm:inline-flex">{myTeam.captainName}</Badge>
                ) : null}
              </div>
              <Progress value={spendPct} className="mt-3" aria-label="Budget used" />
              <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {formatBDT(myTeam.spent)} of {formatBDT(myTeam.budget)} used
              </p>
            </CardContent>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Budget" value={formatBDT(myTeam.budget)} icon={Wallet} />
            <StatCard label="Spent" value={formatBDT(myTeam.spent)} icon={Trophy} tone="warning" />
            <StatCard label="Remaining" value={formatBDT(myTeam.remaining)} icon={Wallet} tone="success" />
            <StatCard
              label="Squad"
              value={`${myTeam.squadCount}/${myTeam.maxSquad}`}
              hint={`min ${myTeam.minSquad} players`}
              icon={Users}
              tone="primary"
            />
          </div>

          {myTeam.squadCount < myTeam.minSquad ? (
            <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <AlertDescription>
                Need at least {myTeam.minSquad} players — {myTeam.minSquad - myTeam.squadCount} more to reach the minimum squad size.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Squad — purchased players</span>
                <Badge variant="secondary" className="tabular-nums">{squad.length} bought</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {squad.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No players yet"
                  description="When the auction goes live and you win bids, your players appear here automatically."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-2 font-semibold">#</th>
                        <th className="pb-2 pr-2 font-semibold">Player</th>
                        <th className="pb-2 pr-2 font-semibold">Role</th>
                        <th className="pb-2 pr-2 font-semibold">Category</th>
                        <th className="pb-2 text-right font-semibold">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {squad.map((p: PlayerDTO) => (
                        <tr key={p.id} className="hover:bg-muted/40">
                          <td className="py-2.5 pr-2 font-mono text-xs font-bold tabular-nums text-muted-foreground">
                            {String(p.playerNumber).padStart(3, '0')}
                          </td>
                          <td className="py-2.5 pr-2">
                            <span className="flex items-center gap-2.5">
                              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-8 w-8" />
                              <span className="font-semibold">{p.name}</span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-2 text-muted-foreground">{p.role}</td>
                          <td className="py-2.5 pr-2">
                            {p.category ? (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 font-bold text-amber-900">
                                {p.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-bold tabular-nums text-teal-700">
                            {formatBDT(p.soldPrice ?? p.basePrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
