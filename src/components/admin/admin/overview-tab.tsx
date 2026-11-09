'use client'

import { DoorOpen, Megaphone, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCachedGet } from '@/lib/api-cache'
import { navigate } from '@/lib/router'
import { formatAuctionWhen, formatBDT, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isLive, plural } from '@/lib/tournament-status'
import { type AdminStats } from '@/lib/types'
import { type Strings, useLang, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedStrings } from './strings'
import { ListSkeleton, loadError, ROLE_BADGE, SETTINGS_URL, STATS_URL, type AdminTournament, type AdminUser } from './shared'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    whatStats: 'platform numbers',
    statUsers: 'Users',
    statUsersHint: (organizers, managers) => `${plural(organizers, 'organizer')} · ${plural(managers, 'manager')}`,
    statTournaments: 'Tournaments',
    statTournamentsHint: (live) => plural(live, 'live auction'),
    statPlayers: 'Players',
    statPlayersHint: 'across all tournaments',
    statBids: 'Bids placed',
    statBidsHint: 'all time',
    statSold: 'Sold for',
    statSoldHint: 'total auction value',
    bannerShowing: 'Everyone sees this banner: ',
    noBanner: 'No announcement banner is showing.',
    editBanner: 'Edit banner',
    addBanner: 'Add a banner',
    liveNow: 'Live now',
    noLive: 'No auctions are running right now.',
    soldMeta: (sold, total, organizer) => `${sold}/${total} sold · ${organizer}`,
    comingUp: 'Coming up',
    noUpcoming: 'No rooms are open and no auctions are scheduled.',
    wasDue: (when) => `Was due ${when}`,
    roomOpenNoTime: 'Room open · no time set',
    recentSignups: 'Recent sign-ups',
    allUsers: 'All users',
    noSignups: 'Nobody has signed up yet.',
    blockedSuffix: ' · blocked',
    watch: 'Watch',
    room: 'Room',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    whatStats: 'প্ল্যাটফর্মের পরিসংখ্যান',
    statUsers: 'ব্যবহারকারী',
    statUsersHint: (organizers, managers) => `${organizers} জন আয়োজক · ${managers} জন ম্যানেজার`,
    statTournaments: 'টুর্নামেন্ট',
    statTournamentsHint: (live) => `${live}টি লাইভ নিলাম`,
    statPlayers: 'খেলোয়াড়',
    statPlayersHint: 'সব টুর্নামেন্ট মিলিয়ে',
    statBids: 'মোট বিড',
    statBidsHint: 'শুরু থেকে এ পর্যন্ত',
    statSold: 'মোট বিক্রি',
    statSoldHint: 'নিলামের মোট মূল্য',
    bannerShowing: 'সবাই এই ব্যানারটি দেখছে: ',
    noBanner: 'এখন কোনো ঘোষণার ব্যানার দেখানো হচ্ছে না।',
    editBanner: 'ব্যানার এডিট করুন',
    addBanner: 'ব্যানার যোগ করুন',
    liveNow: 'এখন লাইভ',
    noLive: 'এই মুহূর্তে কোনো নিলাম চলছে না।',
    soldMeta: (sold, total, organizer) => `${sold}/${total} বিক্রি · ${organizer}`,
    comingUp: 'সামনে আসছে',
    noUpcoming: 'কোনো রুম খোলা নেই, কোনো নিলামের সময়ও ঠিক হয়নি।',
    wasDue: (when) => `হওয়ার কথা ছিল ${when}`,
    roomOpenNoTime: 'রুম খোলা · সময় ঠিক হয়নি',
    recentSignups: 'নতুন সাইন-আপ',
    allUsers: 'সব ব্যবহারকারী',
    noSignups: 'এখনো কেউ সাইন আপ করেনি।',
    blockedSuffix: ' · ব্লকড',
    watch: 'দেখুন',
    room: 'রুম',
  },
} satisfies Strings<
  SharedStrings & {
    whatStats: string
    statUsers: string
    statUsersHint: (organizers: number, managers: number) => string
    statTournaments: string
    statTournamentsHint: (live: number) => string
    statPlayers: string
    statPlayersHint: string
    statBids: string
    statBidsHint: string
    statSold: string
    statSoldHint: string
    bannerShowing: string
    noBanner: string
    editBanner: string
    addBanner: string
    liveNow: string
    noLive: string
    soldMeta: (sold: number, total: number, organizer: string) => string
    comingUp: string
    noUpcoming: string
    wasDue: (when: string) => string
    roomOpenNoTime: string
    recentSignups: string
    allUsers: string
    noSignups: string
    blockedSuffix: string
    watch: string
    room: string
  }
>

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function OverviewTab({
  users,
  tournaments,
  onOpenTab,
}: {
  users: AdminUser[] | undefined
  tournaments: AdminTournament[] | undefined
  onOpenTab: (tab: string) => void
}) {
  const t = useStrings(STRINGS)
  const lang = useLang()
  const { data: stats } = useCachedGet<AdminStats>(STATS_URL, loadError(t.couldNotLoad(t.whatStats)))
  const { data: settings } = useCachedGet<{ settings: Record<string, string> }>(SETTINGS_URL)
  const announcement = settings?.settings.announcement?.trim()

  // Archived tournaments are gone as far as the platform overview is concerned.
  const current = (tournaments ?? []).filter((tour) => !tour.archivedAt)
  const live = current.filter(isLive)
  // Ready rooms and scheduled auctions, soonest first.
  const upcoming = current
    .filter((tour) => !isLive(tour) && tour.auctionStatus !== 'ENDED' && tour.status !== 'COMPLETED' && (tour.roomCode || tour.auctionAt))
    .sort((a, b) => (a.auctionAt ?? '9999').localeCompare(b.auctionAt ?? '9999'))
    .slice(0, 5)
  const recent = (users ?? []).slice(0, 6)

  return (
    <div className="space-y-4">
      {/* platform numbers — one strip, no overlapping cards */}
      {stats ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-3 lg:grid-cols-5 [&>div]:border-b [&>div]:border-r">
          {[
            { id: 'users', k: t.statUsers, v: stats.users, hint: t.statUsersHint(stats.organizers, stats.managers) },
            { id: 'tournaments', k: t.statTournaments, v: stats.tournaments, hint: t.statTournamentsHint(stats.liveAuctions) },
            { id: 'players', k: t.statPlayers, v: stats.players, hint: t.statPlayersHint },
            { id: 'bids', k: t.statBids, v: stats.bids, hint: t.statBidsHint },
            { id: 'sold', k: t.statSold, v: formatBDT(stats.totalValue), hint: t.statSoldHint },
          ].map((s) => (
            <div key={s.id} className="-mb-px -mr-px px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">{s.k}</dt>
              <dd className="mt-0.5 truncate text-xl font-bold tabular-nums">{s.v}</dd>
              <dd className="truncate text-xs text-muted-foreground">{s.hint}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton className="h-20 rounded-xl" />
      )}

      {/* announcement status, with the way to change it */}
      {settings ? (
        <div
          className={cn(
            'flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
            announcement ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200' : 'border-dashed text-muted-foreground'
          )}
        >
          <p className="flex min-w-0 items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">
              {announcement ? (
                <>
                  <span className="font-semibold">{t.bannerShowing}</span>
                  {announcement}
                </>
              ) : (
                t.noBanner
              )}
            </span>
          </p>
          <Button variant="outline" size="sm" className="h-8 shrink-0 bg-background" onClick={() => onOpenTab('settings')}>
            {announcement ? t.editBanner : t.addBanner}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden /> {t.liveNow}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!tournaments ? (
                <ListSkeleton rows={1} />
              ) : live.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t.noLive}</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {live.map((tour) => (
                    <TournamentRow key={tour.id} t={tour} meta={t.soldMeta(tour.soldCount, tour.playerCount, tour.organizerName ?? '—')} live />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{t.comingUp}</CardTitle>
            </CardHeader>
            <CardContent>
              {!tournaments ? (
                <ListSkeleton rows={2} />
              ) : upcoming.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t.noUpcoming}</p>
              ) : (
                <ul className="-mx-2 divide-y">
                  {upcoming.map((tour) => {
                    const when = formatAuctionWhen(tour.auctionAt, lang)
                    return (
                      <TournamentRow
                        key={tour.id}
                        t={tour}
                        meta={`${when ? (when.past ? t.wasDue(when.text) : when.text) : t.roomOpenNoTime} · ${tour.organizerName ?? '—'}`}
                      />
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="gap-2">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between text-base">
              {t.recentSignups}
              <Button variant="ghost" size="sm" className="-mr-2 h-8" onClick={() => onOpenTab('users')}>
                {t.allUsers}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!users ? (
              <ListSkeleton rows={4} />
            ) : recent.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t.noSignups}</p>
            ) : (
              <ul className="divide-y">
                {recent.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(u.createdAt, false, lang)}
                        {u.status === 'BLOCKED' ? t.blockedSuffix : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', ROLE_BADGE[u.role])}>
                      {t.role[u.role] ?? u.role.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TournamentRow({ t: tour, meta, live = false }: { t: AdminTournament; meta: string; live?: boolean }) {
  const t = useStrings(STRINGS)
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          {live ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" aria-hidden /> : null}
          <span className="truncate">{tour.name}</span>
          {tour.roomCode ? <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">{tour.roomCode}</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      {tour.roomCode ? (
        <Button size="sm" variant={live ? 'default' : 'ghost'} className="h-8 shrink-0" onClick={() => navigate(`/room/${tour.roomCode}`)}>
          <DoorOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden /> {live ? t.watch : t.room}
        </Button>
      ) : null}
    </li>
  )
}
