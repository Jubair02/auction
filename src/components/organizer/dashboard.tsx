'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  ClipboardList,
  Gavel,
  History,
  LayoutList,
  Plus,
  Radio,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState, StatCard } from '@/components/shared/empty-state'
import { TournamentCard } from '@/components/organizer/tournament-card'
import { apiGet } from '@/lib/api'
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import type { TournamentSummary } from '@/lib/types'

const GUIDE_STEPS = [
  { icon: ClipboardList, text: 'Create a tournament (sport, type, venue)' },
  { icon: Users, text: 'Add players — manually or by CSV import' },
  { icon: Trophy, text: 'Create teams with budgets and squad limits' },
  { icon: Gavel, text: 'Set up the auction to get your room code' },
  { icon: Share2, text: 'Share the room code with team managers' },
  { icon: Radio, text: 'Run the live auction, then export results' },
]

export default function OrganizerDashboard() {
  const user = useAppStore((s) => s.user)
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ tournaments: TournamentSummary[] }>('/api/tournaments')
      setTournaments(res.tournaments)
    } catch (ex) {
      void ex
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const firstName = (user?.name ?? 'Organizer').split(/\s+/)[0]
  const totalPlayers = tournaments.reduce((n, t) => n + t.playerCount, 0)
  const totalTeams = tournaments.reduce((n, t) => n + t.teamCount, 0)
  const liveCount = tournaments.filter((t) => t.status === 'LIVE').length

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">
            Assalamu alaikum, {firstName}
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              <Gavel className="mr-1 h-3 w-3" aria-hidden /> Organizer
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here is everything happening across your auctions today.
          </p>
        </div>
        <Button size="lg" className="min-h-11" onClick={() => navigate('/tournaments/new')}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tournament
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Tournaments" value={tournaments.length} icon={Trophy} />
            <StatCard label="Total players" value={totalPlayers} icon={Users} tone="success" />
            <StatCard label="Total teams" value={totalTeams} icon={Wallet} hint="Registered squads" />
            <StatCard label="Live now" value={liveCount} icon={Radio} tone={liveCount > 0 ? 'warning' : 'default'} />
          </>
        )}
      </div>

      {/* Tournaments grid */}
      <section className="mt-8" aria-label="My tournaments">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">My tournaments</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tournaments')}>
            View all <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={Trophy}
            title="No tournaments yet"
            description="Create your first tournament, add players and teams, then go live with a room-code auction."
            action={
              <Button onClick={() => navigate('/tournaments/new')}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Create your first tournament
              </Button>
            }
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.slice(0, 6).map((t) => (
              <TournamentCard
                key={t.id}
                t={t}
                actions={
                  <>
                    <Button className="min-h-10 flex-1" onClick={() => navigate(`/tournaments/${t.id}`)}>
                      <LayoutList className="mr-1.5 h-4 w-4" aria-hidden /> Manage
                    </Button>
                    <Button variant="outline" className="min-h-10 flex-1" onClick={() => navigate(`/results/${t.id}`)}>
                      <History className="mr-1.5 h-4 w-4" aria-hidden /> Results
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick guide */}
      <Card className="mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4.5 w-4.5 text-amber-600" aria-hidden /> Quick guide — run an auction in 6 steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDE_STEPS.map((step, i) => (
              <li key={step.text} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <step.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden /> {step.text}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
