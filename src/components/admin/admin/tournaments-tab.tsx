'use client'

import { useMemo, useState } from 'react'
import { Archive, Crown, ExternalLink, Loader2, Search, Settings2, Trash2 } from 'lucide-react'
import { AppLink } from '@/components/shared/app-link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { FilterChips } from '@/components/shared/filter-chips'
import { TournamentStatusBadge } from '@/components/shared/status-badges'
import { apiDelete, apiPatch, ApiError } from '@/lib/api'
import { invalidateCached } from '@/lib/api-cache'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isLive, plural, tournamentPhase, type TournamentPhase } from '@/lib/tournament-status'
import { sportLabel, type Plan } from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedStrings } from './strings'
import { ListSkeleton, SearchBox, STATS_URL, type AdminTournament } from './shared'
import { tournamentTypeLabel } from '@/lib/tournament-types'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    searchTournaments: 'Search name, organizer or room code',
    filterTournaments: 'Filter tournaments',
    live: 'Live',
    ready: 'Ready',
    draft: 'Draft',
    completed: 'Completed',
    noTournamentsYet: 'No tournaments yet',
    noTournamentsMatch: 'No tournaments match',
    tournamentsAppear: 'Tournaments appear here as soon as an organizer creates one.',
    colTournament: 'Tournament',
    colOrganizer: 'Organizer',
    colSport: 'Sport',
    colSold: 'Sold',
    colTeams: 'Teams',
    colRoom: 'Room',
    results: 'Results',
    manage: 'Manage',
    archived: 'Archived',
    archivedHint: 'Deleted by its organizer — kept because its auction has bids or audit records.',
    deletePermanently: 'Delete permanently',
    deleteQuestion: (name) => `Delete "${name}" permanently?`,
    deleteDesc:
      'This erases the tournament together with its players, teams, every bid and the full auction audit trail. It cannot be undone.',
    tournamentDeleted: (name) => `"${name}" was deleted permanently`,
    couldNotDelete: 'Could not delete the tournament',
    soldOf: (sold, total) => `${sold}/${total} sold`,
    teamCount: (n) => plural(n, 'team'),
    colPlan: 'Plan',
    planLabel: { FREE: 'Free', PRO: 'Pro' },
    makePro: 'Make Pro',
    makeFree: 'Make Free',
    planQuestion: (name, plan) => (plan === 'PRO' ? `Make "${name}" Pro without a payment?` : `Move "${name}" back to the Free plan?`),
    planDesc: (plan): string =>
      plan === 'PRO'
        ? 'Use this to comp a tournament: it gets every Pro feature straight away.'
        : 'The Free limits apply again to new teams and players, the watermark returns and SMS stops. Existing teams and players stay.',
    planChanged: (name, plan) => `"${name}" is now on ${plan === 'PRO' ? 'Pro' : 'Free'}`,
    couldNotChangePlan: 'Could not change the plan',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    searchTournaments: 'নাম, আয়োজক বা রুম কোড দিয়ে খুঁজুন',
    filterTournaments: 'টুর্নামেন্ট ফিল্টার',
    live: 'লাইভ',
    ready: 'প্রস্তুত',
    draft: 'খসড়া',
    completed: 'সম্পন্ন',
    noTournamentsYet: 'এখনো কোনো টুর্নামেন্ট নেই',
    noTournamentsMatch: 'কোনো টুর্নামেন্ট মেলেনি',
    tournamentsAppear: 'কোনো আয়োজক টুর্নামেন্ট তৈরি করলেই এখানে দেখা যাবে।',
    colTournament: 'টুর্নামেন্ট',
    colOrganizer: 'আয়োজক',
    colSport: 'খেলা',
    colSold: 'বিক্রি',
    colTeams: 'দল',
    colRoom: 'রুম',
    results: 'ফলাফল',
    manage: 'ম্যানেজ করুন',
    archived: 'আর্কাইভ করা',
    archivedHint: 'আয়োজক মুছে দিয়েছেন — নিলামে বিড বা অডিট রেকর্ড থাকায় সংরক্ষিত আছে।',
    deletePermanently: 'স্থায়ীভাবে মুছুন',
    deleteQuestion: (name) => `"${name}" স্থায়ীভাবে মুছে ফেলবেন?`,
    deleteDesc:
      'টুর্নামেন্টটি তার খেলোয়াড়, দল, সব বিড এবং নিলামের পুরো অডিট রেকর্ডসহ মুছে যাবে। এটি আর ফেরানো যাবে না।',
    tournamentDeleted: (name) => `"${name}" স্থায়ীভাবে মুছে ফেলা হয়েছে`,
    couldNotDelete: 'টুর্নামেন্টটি মোছা যায়নি',
    soldOf: (sold, total) => `${sold}/${total} বিক্রি`,
    teamCount: (n) => `${n}টি দল`,
    colPlan: 'প্ল্যান',
    planLabel: { FREE: 'ফ্রি', PRO: 'Pro' },
    makePro: 'Pro করুন',
    makeFree: 'ফ্রি করুন',
    planQuestion: (name, plan) => (plan === 'PRO' ? `পেমেন্ট ছাড়াই "${name}" Pro করবেন?` : `"${name}" আবার ফ্রি প্ল্যানে নেবেন?`),
    planDesc: (plan): string =>
      plan === 'PRO'
        ? 'কোনো টুর্নামেন্টকে বিনামূল্যে Pro দিতে এটি ব্যবহার করুন: সঙ্গে সঙ্গে সব Pro সুবিধা চালু হবে।'
        : 'নতুন দল ও খেলোয়াড় যোগে আবার ফ্রি প্ল্যানের সীমা খাটবে, জলছাপ ফিরে আসবে এবং SMS বন্ধ হবে। আগের দল ও খেলোয়াড় থেকে যাবে।',
    planChanged: (name, plan) => `"${name}" এখন ${plan === 'PRO' ? 'Pro' : 'ফ্রি'} প্ল্যানে`,
    couldNotChangePlan: 'প্ল্যান বদলানো যায়নি',
  },
} satisfies Strings<
  SharedStrings & {
    searchTournaments: string
    filterTournaments: string
    live: string
    ready: string
    draft: string
    completed: string
    noTournamentsYet: string
    noTournamentsMatch: string
    tournamentsAppear: string
    colTournament: string
    colOrganizer: string
    colSport: string
    colSold: string
    colTeams: string
    colRoom: string
    results: string
    manage: string
    archived: string
    archivedHint: string
    deletePermanently: string
    deleteQuestion: (name: string) => string
    deleteDesc: string
    tournamentDeleted: (name: string) => string
    couldNotDelete: string
    soldOf: (sold: number, total: number) => string
    teamCount: (n: number) => string
    colPlan: string
    planLabel: Record<Plan, string>
    makePro: string
    makeFree: string
    planQuestion: (name: string, plan: Plan) => string
    planDesc: (plan: Plan) => string
    planChanged: (name: string, plan: Plan) => string
    couldNotChangePlan: string
  }
>

/* ------------------------------------------------------------------ */
/* Tournaments                                                         */
/* ------------------------------------------------------------------ */

type TournamentFilter = 'ALL' | TournamentPhase | 'ARCHIVED'

const matchesFilter = (tour: AdminTournament, f: TournamentFilter) =>
  f === 'ALL' || (f === 'ARCHIVED' ? !!tour.archivedAt : !tour.archivedAt && tournamentPhase(tour) === f)

function ArchivedBadge({ className }: { className?: string }) {
  const t = useStrings(STRINGS)
  return (
    <Badge variant="outline" className={cn('border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300', className)} title={t.archivedHint}>
      <Archive className="mr-1 h-3 w-3" aria-hidden /> {t.archived}
    </Badge>
  )
}

export function TournamentsTab({ tournaments, refetch }: { tournaments: AdminTournament[] | undefined; refetch: () => Promise<void> }) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TournamentFilter>('ALL')
  const [target, setTarget] = useState<AdminTournament | null>(null)
  const [busy, setBusy] = useState(false)

  const hardDelete = async () => {
    if (!target) return
    setBusy(true)
    try {
      await apiDelete(`/api/tournaments/${target.id}?hard=1`)
      invalidateCached(STATS_URL)
      toast.success(t.tournamentDeleted(target.name))
      setTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotDelete)
    } finally {
      setBusy(false)
    }
  }

  const deleteButton = (tour: AdminTournament, className?: string) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300', className)}
      onClick={() => setTarget(tour)}
    >
      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.deletePermanently}
    </Button>
  )

  // Admin plan override (comp a tournament, or undo a mistake).
  const [planTarget, setPlanTarget] = useState<{ tour: AdminTournament; plan: Plan } | null>(null)
  const changePlan = async () => {
    if (!planTarget) return
    setBusy(true)
    try {
      await apiPatch(`/api/admin/tournaments/${planTarget.tour.id}/plan`, { plan: planTarget.plan })
      toast.success(t.planChanged(planTarget.tour.name, planTarget.plan))
      setPlanTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotChangePlan)
    } finally {
      setBusy(false)
    }
  }
  const planButton = (tour: AdminTournament, className?: string) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-9', tour.plan === 'PRO' ? 'text-muted-foreground' : 'text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300', className)}
      onClick={() => setPlanTarget({ tour, plan: tour.plan === 'PRO' ? 'FREE' : 'PRO' })}
    >
      {tour.plan === 'PRO' ? t.makeFree : <><Crown className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.makePro}</>}
    </Button>
  )

  const all = useMemo(() => tournaments ?? [], [tournaments])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (tour) =>
        matchesFilter(tour, filter) &&
        (!q || tour.name.toLowerCase().includes(q) || (tour.organizerName ?? '').toLowerCase().includes(q) || (tour.roomCode ?? '').toLowerCase().includes(q))
    )
  }, [all, query, filter])

  if (!tournaments) return <ListSkeleton rows={5} />

  const count = (f: TournamentFilter) => all.filter((tour) => matchesFilter(tour, f)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBox value={query} onChange={setQuery} placeholder={t.searchTournaments} />
        <FilterChips
          label={t.filterTournaments}
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'ALL', label: t.all, count: count('ALL') },
            { key: 'LIVE', label: t.live, count: count('LIVE') },
            { key: 'READY', label: t.ready, count: count('READY') },
            { key: 'DRAFT', label: t.draft, count: count('DRAFT') },
            { key: 'COMPLETED', label: t.completed, count: count('COMPLETED') },
            ...(count('ARCHIVED') > 0 ? [{ key: 'ARCHIVED' as const, label: t.archived, count: count('ARCHIVED') }] : []),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={all.length === 0 ? t.noTournamentsYet : t.noTournamentsMatch}
          description={all.length === 0 ? t.tournamentsAppear : t.tryAnother}
        />
      ) : (
        <>
          {/* Desktop table — page scroll, sticky header */}
          <div className="hidden rounded-lg border lg:block">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead>{t.colTournament}</TableHead>
                  <TableHead>{t.colOrganizer}</TableHead>
                  <TableHead>{t.colSport}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead>{t.colSold}</TableHead>
                  <TableHead>{t.colTeams}</TableHead>
                  <TableHead>{t.colRoom}</TableHead>
                  <TableHead>{t.colPlan}</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">{t.colActions}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tour) => (
                  <TableRow key={tour.id} className={cn(tour.archivedAt && 'bg-muted/40')}>
                    <TableCell className="max-w-60">
                      <p className="flex items-center gap-2 font-semibold">
                        <span className="truncate">{tour.name}</span>
                        {tour.archivedAt ? <ArchivedBadge className="shrink-0" /> : null}
                      </p>
                      {tour.tournamentType ? <p className="truncate text-xs text-muted-foreground">{tournamentTypeLabel(tour.tournamentType, lang)}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm">{tour.organizerName ?? '—'}</TableCell>
                    <TableCell className="text-sm">{sportLabel(tour.sport, lang, tour.sportName)}</TableCell>
                    <TableCell>
                      <TournamentStatusBadge status={isLive(tour) ? 'LIVE' : tour.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {tour.soldCount}/{tour.playerCount}
                    </TableCell>
                    <TableCell className="tabular-nums">{tour.teamCount}</TableCell>
                    <TableCell className="font-mono text-xs">{tour.roomCode ?? '—'}</TableCell>
                    <TableCell>
                      <PlanBadge plan={tour.plan} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {tour.archivedAt ? null : planButton(tour)}
                        {tour.archivedAt ? null : (
                          <Button asChild variant="ghost" size="sm" className="h-9">
                            <AppLink href={`/tournaments/${tour.id}`}>
                              <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.manage}
                            </AppLink>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-9" onClick={() => navigate(`/results/${tour.id}`)}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.results}
                        </Button>
                        {tour.archivedAt ? deleteButton(tour) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>

          {/* Phone & tablet cards */}
          <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
            {filtered.map((tour) => (
              <Card key={tour.id} className="py-0">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{tour.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tour.organizerName ?? '—'} · {sportLabel(tour.sport, lang, tour.sportName)}
                      </p>
                    </div>
                    {tour.archivedAt ? (
                      <ArchivedBadge className="shrink-0" />
                    ) : (
                      <TournamentStatusBadge status={isLive(tour) ? 'LIVE' : tour.status} className="shrink-0" />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                    <span>
                      {t.soldOf(tour.soldCount, tour.playerCount)}
                    </span>
                    <span>{t.teamCount(tour.teamCount)}</span>
                    {tour.roomCode ? <span className="font-mono">{tour.roomCode}</span> : null}
                    <PlanBadge plan={tour.plan} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    {tour.archivedAt ? null : (
                      <Button asChild variant="outline" size="sm" className="h-9 flex-1">
                        <AppLink href={`/tournaments/${tour.id}`}>
                          <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.manage}
                        </AppLink>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-9 flex-1" onClick={() => navigate(`/results/${tour.id}`)}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {t.results}
                    </Button>
                    {tour.archivedAt ? null : planButton(tour, 'flex-1 border')}
                  </div>
                  {tour.archivedAt ? deleteButton(tour, 'mt-1 w-full') : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && !busy && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteQuestion(target?.name ?? '')}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void hardDelete()
              }}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />}
              {t.deletePermanently}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!planTarget} onOpenChange={(open) => !open && !busy && setPlanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{planTarget ? t.planQuestion(planTarget.tour.name, planTarget.plan) : ''}</AlertDialogTitle>
            <AlertDialogDescription>{planTarget ? t.planDesc(planTarget.plan) : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void changePlan()
              }}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {planTarget?.plan === 'PRO' ? t.makePro : t.makeFree}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  const t = useStrings(STRINGS)
  return plan === 'PRO' ? (
    <Badge className={cn('border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200', className)}>
      <Crown className="h-3 w-3" aria-hidden /> {t.planLabel.PRO}
    </Badge>
  ) : (
    <Badge variant="outline" className={cn('text-muted-foreground', className)}>
      {t.planLabel.FREE}
    </Badge>
  )
}
