'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarRange, ExternalLink, Loader2, Plus, RefreshCw, Table2 } from 'lucide-react'
import { apiDelete } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import { type Strings, useStrings } from '@/lib/i18n'
import type { LeagueData, MatchDTO, TournamentDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { EmptyState } from '@/components/shared/empty-state'
import { LoadError } from '@/components/shared/load-error'
import { FixturesList, type MatchActions } from './fixtures-list'
import { GeneratePanel } from './generate-panel'
import { Leaderboards } from './leaderboards'
import { LeagueSettings } from './league-settings'
import { MatchDialog } from './match-dialog'
import { PointsTables } from './points-table'
import { ResultDialog } from './result-dialog'
import { StatsDialog } from './stats-dialog'

const STRINGS = {
  en: {
    what: 'the league',
    fixtures: 'Fixtures',
    table: 'Points table',
    stats: 'Stats',
    settings: 'Settings',
    all: 'All',
    upcoming: 'Upcoming',
    results: 'Results',
    allTeams: 'All teams',
    filterTeam: 'Filter by team',
    addMatch: 'Add match',
    regenerate: 'Make fixtures again',
    publicPage: 'Public page',
    noFixtures: 'No fixtures yet',
    noFixturesDesc: 'The organizer has not made the fixtures yet.',
    noneHere: 'No matches here.',
    noTable: 'No points table',
    noTableDesc: 'Knockout tournaments have no points table — follow the bracket in Fixtures.',
    noTableYet: 'The points table appears once fixtures are made.',
    deleteTitle: (n: number) => `Delete match ${n}?`,
    deleteDesc: 'The match, its result and its player stats will be deleted. Placeholders pointing to it ("Winner M…") will stay empty.',
    delete: 'Delete',
    cancel: 'Cancel',
    deleted: 'Match deleted',
    progress: (done: number, total: number) => `${done} of ${total} matches played`,
  },
  bn: {
    what: 'লিগ',
    fixtures: 'ফিকচার',
    table: 'পয়েন্ট টেবিল',
    stats: 'পরিসংখ্যান',
    settings: 'সেটিংস',
    all: 'সব',
    upcoming: 'আসন্ন',
    results: 'ফলাফল',
    allTeams: 'সব দল',
    filterTeam: 'দল অনুযায়ী দেখুন',
    addMatch: 'ম্যাচ যোগ করুন',
    regenerate: 'আবার ফিকচার তৈরি',
    publicPage: 'পাবলিক পেজ',
    noFixtures: 'এখনো ফিকচার নেই',
    noFixturesDesc: 'আয়োজক এখনো ফিকচার তৈরি করেননি।',
    noneHere: 'এখানে কোনো ম্যাচ নেই।',
    noTable: 'পয়েন্ট টেবিল নেই',
    noTableDesc: 'নকআউট টুর্নামেন্টে পয়েন্ট টেবিল থাকে না — ফিকচারে ব্র্যাকেট দেখুন।',
    noTableYet: 'ফিকচার তৈরি হলে পয়েন্ট টেবিল দেখা যাবে।',
    deleteTitle: (n: number) => `ম্যাচ ${n} মুছবেন?`,
    deleteDesc: 'ম্যাচ, এর ফলাফল ও খেলোয়াড়দের পরিসংখ্যান মুছে যাবে। এর ওপর নির্ভর করা জায়গাগুলো ("Winner M…") ফাঁকা থাকবে।',
    delete: 'মুছুন',
    cancel: 'বাতিল',
    deleted: 'ম্যাচ মুছে ফেলা হয়েছে',
    progress: (done: number, total: number) => `${total}টির মধ্যে ${done}টি ম্যাচ খেলা হয়েছে`,
  },
} satisfies Strings<{
  what: string
  fixtures: string
  table: string
  stats: string
  settings: string
  all: string
  upcoming: string
  results: string
  allTeams: string
  filterTeam: string
  addMatch: string
  regenerate: string
  publicPage: string
  noFixtures: string
  noFixturesDesc: string
  noneHere: string
  noTable: string
  noTableDesc: string
  noTableYet: string
  deleteTitle: (n: number) => string
  deleteDesc: string
  delete: string
  cancel: string
  deleted: string
  progress: (done: number, total: number) => string
}>

type SubTab = 'fixtures' | 'table' | 'stats' | 'settings'
type Filter = 'all' | 'upcoming' | 'results'
const ALL = '__all'

const isPlayed = (m: MatchDTO) => m.status === 'COMPLETED' || m.status === 'ABANDONED'

/** The tournament page's League tab: fixtures, results, points table, stats, settings. */
export default function LeagueTab({ data: detail, canEdit }: { data: TournamentDetail; canEdit: boolean }) {
  const t = useStrings(STRINGS)
  const tournamentId = detail.tournament.id
  // Team managers have no staff access; they read the same data through the league page API.
  const url = detail.myAccess === 'MANAGER' ? `/api/league/${tournamentId}` : `/api/tournaments/${tournamentId}/league`
  const { data, loading, error, refetch } = useCachedGet<LeagueData>(url)

  const [tab, setTab] = useState<SubTab>('fixtures')
  const [regenerating, setRegenerating] = useState(false)

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (!data) return <LoadError what={t.what} error={error} onRetry={refetch} />

  const hasMatches = data.matches.length > 0
  if (canEdit && (!hasMatches || regenerating)) {
    return (
      <GeneratePanel
        data={data}
        onCancel={hasMatches ? () => setRegenerating(false) : undefined}
        onDone={async () => {
          await refetch()
          setRegenerating(false)
          setTab('fixtures')
        }}
      />
    )
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="fixtures" className="min-h-10">{t.fixtures}</TabsTrigger>
          <TabsTrigger value="table" className="min-h-10">{t.table}</TabsTrigger>
          <TabsTrigger value="stats" className="min-h-10">{t.stats}</TabsTrigger>
          <TabsTrigger value="settings" className="min-h-10">{t.settings}</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="sm" asChild>
          <a href={`/league/${tournamentId}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden /> {t.publicPage}
          </a>
        </Button>
      </div>

      <TabsContent value="fixtures" className="mt-4">
        {hasMatches ? (
          <FixturesTab data={data} canEdit={canEdit} refetch={refetch} onRegenerate={() => setRegenerating(true)} />
        ) : (
          <EmptyState icon={CalendarRange} title={t.noFixtures} description={t.noFixturesDesc} />
        )}
      </TabsContent>

      <TabsContent value="table" className="mt-4">
        {data.standings.length > 0 ? (
          <PointsTables data={data} />
        ) : (
          <EmptyState
            icon={Table2}
            title={t.noTable}
            description={data.settings.format === 'KNOCKOUT' ? t.noTableDesc : t.noTableYet}
          />
        )}
      </TabsContent>

      <TabsContent value="stats" className="mt-4">
        <Leaderboards data={data} />
      </TabsContent>

      <TabsContent value="settings" className="mt-4">
        <LeagueSettings data={data} canEdit={canEdit} onSaved={refetch} />
      </TabsContent>
    </Tabs>
  )
}

function FixturesTab({
  data,
  canEdit,
  refetch,
  onRegenerate,
}: {
  data: LeagueData
  canEdit: boolean
  refetch: () => Promise<void>
  onRegenerate: () => void
}) {
  const t = useStrings(STRINGS)
  const [filter, setFilter] = useState<Filter>('all')
  const [team, setTeam] = useState(ALL)
  const [resultFor, setResultFor] = useState<MatchDTO | null>(null)
  const [statsFor, setStatsFor] = useState<MatchDTO | null>(null)
  const [editing, setEditing] = useState<MatchDTO | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MatchDTO | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = useMemo(() => {
    let list = data.matches
    if (team !== ALL) list = list.filter((m) => m.homeTeamId === team || m.awayTeamId === team)
    if (filter === 'upcoming') list = list.filter((m) => !isPlayed(m))
    if (filter === 'results') list = list.filter(isPlayed)
    return list
  }, [data.matches, filter, team])
  const played = data.matches.filter(isPlayed).length

  const actions: MatchActions | null = canEdit
    ? { onResult: setResultFor, onStats: setStatsFor, onEdit: setEditing, onDelete: setDeleting }
    : null

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await apiDelete(`/api/matches/${deleting.id}`)
      toast.success(t.deleted)
      await refetch()
      setDeleting(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5" role="group">
            {(['all', 'upcoming', 'results'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'min-h-9 rounded-md px-3 text-sm font-medium transition-colors',
                  filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t[f]}
              </button>
            ))}
          </div>
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger size="sm" className="h-10 w-44" aria-label={t.filterTeam}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.allTeams}</SelectItem>
              {data.teams.map((tm) => (
                <SelectItem key={tm.id} value={tm.id}>
                  {tm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{t.progress(played, data.matches.length)}</span>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="min-h-10" onClick={onRegenerate}>
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden /> {t.regenerate}
            </Button>
            <Button size="sm" className="min-h-10" onClick={() => setEditing('new')}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t.addMatch}
            </Button>
          </div>
        ) : null}
      </div>

      {matches.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{t.noneHere}</p>
      ) : (
        <FixturesList data={data} matches={matches} actions={actions} />
      )}

      {canEdit ? (
        <>
          <ResultDialog data={data} match={resultFor} onClose={() => setResultFor(null)} onSaved={refetch} />
          <StatsDialog data={data} match={statsFor} onClose={() => setStatsFor(null)} onSaved={refetch} />
          <MatchDialog data={data} match={editing} onClose={() => setEditing(null)} onSaved={refetch} />
          <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{deleting ? t.deleteTitle(deleting.matchNumber) : ''}</AlertDialogTitle>
                <AlertDialogDescription>{t.deleteDesc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={(e) => {
                    e.preventDefault()
                    void remove()
                  }}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}
