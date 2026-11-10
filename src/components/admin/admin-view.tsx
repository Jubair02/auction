'use client'

import { useState } from 'react'
import { ShieldCheck, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLink } from '@/components/shared/app-link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { LoadError } from '@/components/shared/load-error'
import { type Strings, useStrings } from '@/lib/i18n'
import AnalyticsPanel from '@/components/admin/analytics-panel'
import NotificationsPanel from '@/components/admin/notifications-panel'
import { SHARED_STRINGS, type SharedStrings } from './admin/strings'
import {
  loadError,
  paymentsUrl,
  STATS_URL,
  TOURNAMENTS_URL,
  USERS_URL,
  type AdminTournament,
  type AdminUser,
} from './admin/shared'
import { OverviewTab } from './admin/overview-tab'
import { UsersTab } from './admin/users-tab'
import { TournamentsTab } from './admin/tournaments-tab'
import { PaymentsTab } from './admin/payments-tab'
import { SettingsTab } from './admin/settings-tab'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    whatUsers: 'users',
    whatTournaments: 'tournaments',
    title: 'Admin console',
    subtitle: 'Everyone and every auction on NeelamGhor.',
    tabOverview: 'Overview',
    tabUsers: 'Users',
    tabTournaments: 'Tournaments',
    tabSettings: 'Settings',
    tabPayments: 'Payments',
    tabAnalytics: 'Analytics',
    tabSms: 'SMS log',
    manageTournaments: 'Manage tournaments',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    whatUsers: 'ব্যবহারকারীর তালিকা',
    whatTournaments: 'টুর্নামেন্টের তালিকা',
    title: 'অ্যাডমিন কনসোল',
    subtitle: 'NeelamGhor-এর সব ব্যবহারকারী আর সব নিলাম, এক জায়গায়।',
    tabOverview: 'ওভারভিউ',
    tabUsers: 'ব্যবহারকারী',
    tabTournaments: 'টুর্নামেন্ট',
    tabSettings: 'সেটিংস',
    tabPayments: 'পেমেন্ট',
    tabAnalytics: 'অ্যানালিটিক্স',
    tabSms: 'SMS লগ',
    manageTournaments: 'টুর্নামেন্ট ম্যানেজ করুন',
  },
} satisfies Strings<
  SharedStrings & {
    whatUsers: string
    whatTournaments: string
    title: string
    subtitle: string
    tabOverview: string
    tabUsers: string
    tabTournaments: string
    tabSettings: string
    tabPayments: string
    tabAnalytics: string
    tabSms: string
    manageTournaments: string
  }
>

export default function AdminView() {
  const t = useStrings(STRINGS)
  const [tab, setTab] = useState('overview')
  const users = useCachedGet<{ users: AdminUser[] }>(USERS_URL, loadError(t.couldNotLoad(t.whatUsers)))
  const tournaments = useCachedGet<{ tournaments: AdminTournament[] }>(TOURNAMENTS_URL, loadError(t.couldNotLoad(t.whatTournaments)))
  // For the "Payments" tab badge; the tab itself opens on the same (cached) list.
  const pending = useCachedGet<{ pendingCount: number }>(paymentsUrl('PENDING'))
  const pendingPayments = pending.data?.pendingCount ?? 0

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden /> {t.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {/* The full tournament management page (the same one organizers use; admins see every tournament). */}
        <Button asChild variant="outline" size="lg" className="min-h-11">
          <AppLink href="/tournaments">
            <Trophy className="mr-1.5 h-4 w-4" aria-hidden /> {t.manageTournaments}
          </AppLink>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto w-full justify-start overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:flex-wrap sm:overflow-visible">
          <TabsTrigger value="overview" className="min-h-11">{t.tabOverview}</TabsTrigger>
          <TabsTrigger value="users" className="min-h-11">
            {t.tabUsers} {users.data ? <span className="ml-1 text-xs tabular-nums text-muted-foreground">{users.data.users.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="min-h-11">
            {t.tabTournaments}{' '}
            {tournaments.data ? <span className="ml-1 text-xs tabular-nums text-muted-foreground">{tournaments.data.tournaments.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="payments" className="min-h-11">
            {t.tabPayments}
            {pendingPayments > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs font-bold tabular-nums text-white">{pendingPayments}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11">{t.tabSettings}</TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-11">{t.tabAnalytics}</TabsTrigger>
          <TabsTrigger value="sms" className="min-h-11">{t.tabSms}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab users={users.data?.users} tournaments={tournaments.data?.tournaments} onOpenTab={setTab} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          {!users.data && users.error ? (
            <LoadError what={t.whatUsers} error={users.error} onRetry={users.refetch} />
          ) : (
            <UsersTab users={users.data?.users} refetch={users.refetch} />
          )}
        </TabsContent>
        <TabsContent value="tournaments" className="mt-4">
          {!tournaments.data && tournaments.error ? (
            <LoadError what={t.whatTournaments} error={tournaments.error} onRetry={tournaments.refetch} />
          ) : (
            <TournamentsTab tournaments={tournaments.data?.tournaments} refetch={tournaments.refetch} />
          )}
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          {tab === 'payments' ? (
            <PaymentsTab
              onChanged={async () => {
                invalidateCached(STATS_URL)
                await Promise.all([pending.refetch(), tournaments.refetch()])
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          {tab === 'settings' ? <SettingsTab /> : null}
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          {tab === 'analytics' ? <AnalyticsPanel /> : null}
        </TabsContent>
        <TabsContent value="sms" className="mt-4">
          {tab === 'sms' ? <NotificationsPanel /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
