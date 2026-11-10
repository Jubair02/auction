'use client'

// App shell + client router. Every path is served by src/app/[[...slug]]/page.tsx,
// which passes the path in so the server HTML is the real page.
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Gavel, KeyRound, Loader2, LogIn, LogOut, Megaphone, Plus, ShieldCheck, Trophy, UserCog, UserPlus, Users } from 'lucide-react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { useAppStore, useAuthState } from '@/lib/store'
import { useCachedGet } from '@/lib/api-cache'
import { navigate, setReturnTo, useRoute } from '@/lib/router'
import { useFullscreen } from '@/lib/use-fullscreen'
import { canOpen, DASHBOARD_PATH, pageAccess } from '@/lib/access'
import { type Strings, useLang, useLangBootstrap, useLangStore, useStrings } from '@/lib/i18n'
import { useLowDataBootstrap } from '@/lib/low-data'
import { useServiceWorker } from '@/lib/pwa'
import type { UserRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { AppLink } from '@/components/shared/app-link'
import { DataSaverMenuItem } from '@/components/shared/data-saver'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { SiteFooter } from '@/components/shared/site-footer'
import { useTheme } from '@/lib/theme'
import { InstallAppMenuItem, InstallHelpHost, InstallHint } from '@/components/shared/install-app'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import Landing from '@/components/landing'

// Every other view is code-split: a visitor downloads only the screen they open,
// not the whole app (admin, organizer tools, the live room…) up front.
const AuthView = dynamic(() => import('@/components/auth-view'), { loading: () => <CenterLoader /> })
const ForgotPasswordView = dynamic(() => import('@/components/password-reset').then((m) => m.ForgotPasswordView), { loading: () => <CenterLoader /> })
const ResetPasswordView = dynamic(() => import('@/components/password-reset').then((m) => m.ResetPasswordView), { loading: () => <CenterLoader /> })
const OrganizerDashboard = dynamic(() => import('@/components/organizer/dashboard'), { loading: () => <CenterLoader /> })
const TournamentsList = dynamic(() => import('@/components/organizer/tournaments'), { loading: () => <CenterLoader /> })
const TournamentCreate = dynamic(() => import('@/components/organizer/tournament-create'), { loading: () => <CenterLoader /> })
const TournamentDetail = dynamic(() => import('@/components/organizer/tournament-detail'), { loading: () => <CenterLoader /> })
const AuctionHistory = dynamic(() => import('@/components/organizer/auction-history'), { loading: () => <CenterLoader /> })
const AdminView = dynamic(() => import('@/components/admin/admin-view'), { loading: () => <CenterLoader /> })
const AuctionRoom = dynamic(() => import('@/components/room/auction-room'), { loading: () => <CenterLoader /> })
const StreamOverlay = dynamic(() => import('@/components/room/stream-overlay'), { loading: () => <CenterLoader /> })
const ManagerDashboard = dynamic(() => import('@/components/manager/manager-dashboard'), { loading: () => <CenterLoader /> })
const JoinRoomView = dynamic(() => import('@/components/manager/join-room'), { loading: () => <CenterLoader /> })
const AcceptInvite = dynamic(() => import('@/components/manager/accept-invite'), { loading: () => <CenterLoader /> })
const RegisterPlayer = dynamic(() => import('@/components/register-player'), { loading: () => <CenterLoader /> })
const ResultsView = dynamic(() => import('@/components/results/results-view'), { loading: () => <CenterLoader /> })
const LeaguePublicView = dynamic(() => import('@/components/league/league-public-view'), { loading: () => <CenterLoader /> })
const AccountView = dynamic(() => import('@/components/account/account-view'), { loading: () => <CenterLoader /> })
const PrivacyView = dynamic(() => import('@/components/legal/privacy-view'), { loading: () => <CenterLoader /> })
const TermsView = dynamic(() => import('@/components/legal/terms-view'), { loading: () => <CenterLoader /> })

/**
 * Leaves a page the current user may not open. Replaces the history entry, so
 * Back doesn't return to the blocked page and bounce again.
 */
function Redirect({ to, returnTo, notice }: { to: string; returnTo?: string; notice?: string }) {
  useEffect(() => {
    if (returnTo) setReturnTo(returnTo)
    if (notice) toast.error(notice, { id: 'access-denied' })
    navigate(to, { replace: true })
  }, [to, returnTo, notice])
  return <CenterLoader />
}

function CenterLoader() {
  const t = useStrings(SHELL_STRINGS)
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t.loading}
    </div>
  )
}

function AccessPanel({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="container mx-auto flex min-h-[50vh] max-w-md items-center">
      <div className="w-full rounded-xl border bg-card p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
        {action}
      </div>
    </div>
  )
}

function NotFound() {
  const t = useStrings(SHELL_STRINGS)
  return (
    <AccessPanel
      title={t.notFoundTitle}
      description={t.notFoundDescription}
      action={
        <Button variant="outline" asChild>
          <AppLink href="/">{t.backHome}</AppLink>
        </Button>
      }
    />
  )
}

export default function AppRoot({ initialSegs }: { initialSegs?: string[] }) {
  const { segs, fragment, ready: routeReady } = useRoute(initialSegs)
  const { user, authLoading, authChecked } = useAuthState()
  const fetchMe = useAppStore((s) => s.fetchMe)
  // Signed-in pages read browser-only state (saved room seats, storage) while
  // rendering, so they start after mount — one frame later, with the header
  // already right from the server's session check.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const logout = useAppStore((s) => s.logout)
  useLangBootstrap()
  useLowDataBootstrap()
  useServiceWorker()
  const siteSettings = useSiteSettings()
  const t = useStrings(SHELL_STRINGS)
  const { resolved: resolvedTheme } = useTheme()

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const head = segs[0] ?? ''
  // The live room drops the footer, and in browser full screen the header too —
  // so a projector or TV shows only the auction.
  const inRoom = head === 'room'
  const roomFocus = useFullscreen().isFullscreen && inRoom

  const renderRoute = () => {
    // Pages that don't depend on who is logged in render without waiting for
    // the session check — so they are in the server HTML too. (Results are
    // public or not per tournament; the API decides and the page explains.)
    if (head === '') return <Landing />
    if (head === 'privacy' && segs.length === 1) return <PrivacyView />
    if (head === 'terms' && segs.length === 1) return <TermsView />
    if (head === 'results' && segs.length === 2) return <ResultsView tournamentId={segs[1]} />
    if (head === 'league' && segs.length === 2) return <LeaguePublicView tournamentId={segs[1]} />
    if (!authChecked || !mounted) return <CenterLoader />

    // One access check for every page (rules in lib/access.ts).
    if (!canOpen(segs, user?.role ?? null)) {
      if (authLoading) return <CenterLoader />
      const access = pageAccess(segs)
      // Already logged in: login/register lead to the user's own dashboard.
      if (access === 'guest') return <Redirect to={DASHBOARD_PATH} />
      // Logged out: log in first, then come straight back here (if allowed).
      if (!user) {
        const here = typeof window === 'undefined' ? `/${segs.join('/')}` : window.location.pathname + window.location.search
        return <Redirect to="/login" returnTo={here} />
      }
      // Logged in with the wrong role: back to their own dashboard.
      return <Redirect to={DASHBOARD_PATH} notice={t.noAccess} />
    }

    switch (true) {
      case head === 'login' && segs.length === 1:
        return <AuthView mode="login" />
      case head === 'register' && segs.length === 1:
        return <AuthView mode="register" />
      case head === 'forgot-password' && segs.length === 1:
        return <ForgotPasswordView />
      // Works signed in or out — the link must always be usable.
      // Token in the fragment (/reset-password#<token>); the path form is kept for old links.
      case head === 'reset-password' && !!(segs[1] || fragment):
        return <ResetPasswordView token={segs[1] ?? fragment} />
      // Each role's own dashboard, all at /dashboard.
      case head === 'dashboard' && segs.length === 1:
        return user?.role === 'ADMIN' ? <AdminView /> : user?.role === 'ORGANIZER' ? <OrganizerDashboard /> : <ManagerDashboard />
      case head === 'account' && segs.length === 1:
        return <AccountView />
      case head === 'tournaments' && segs.length === 1:
        return <TournamentsList />
      case head === 'tournaments' && segs[1] === 'new':
        return <TournamentCreate />
      // Both spellings are accepted: /tournaments/:id/history and /tournaments/history/:id
      case head === 'tournaments' && segs[2] === 'history' && !!segs[1]:
        return <AuctionHistory tournamentId={segs[1]} />
      case head === 'tournaments' && segs[1] === 'history' && !!segs[2]:
        return <AuctionHistory tournamentId={segs[2]} />
      case head === 'tournaments' && !!segs[1]:
        return <TournamentDetail tournamentId={segs[1]} />
      case head === 'room' && !!segs[1]:
        return <AuctionRoom roomCode={(segs[1] || '').toUpperCase()} />
      case head === 'register-player' && segs.length === 2:
        return <RegisterPlayer code={segs[1]} />
      case head === 'invite' && !!(segs[1] || fragment):
        return <AcceptInvite token={segs[1] ?? fragment} />
      case head === 'join' && segs.length === 1:
        return <JoinRoomView />
      // Old link to the managers' squad page — the dashboard now shows every squad.
      case head === 'my-team' && segs.length === 1:
        return <ManagerDashboard />
      case head === 'admin' && segs.length === 1:
        return <AdminView />
      default:
        return <NotFound />
    }
  }

  // Only token links (/reset-password#…, /invite#…) wait here: their token is
  // in the fragment, which only the browser can read after mount.
  if (!routeReady) return <div className="min-h-screen" aria-busy="true" />

  // Broadcast overlay: no header, footer, toasts or auth — just the overlay.
  if (head === 'overlay' && segs[1]) {
    return <StreamOverlay roomCode={segs[1].toUpperCase()} green={segs[2] === 'green'} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header hidden={roomFocus} className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          {/* Brand mark only — deliberately not a link, so clicking it never leaves the current page. */}
          <div className="flex select-none items-center gap-2 px-1 py-1" aria-label="NeelamGhor">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gavel className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Neelam<span className="text-primary">Ghor</span>
            </span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">BD</Badge>
          </div>

          <nav className="flex items-center gap-1.5" aria-label={t.mainNav}>
            <ThemeToggle />
            <LangToggle />
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 rounded-full border px-2 py-1 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      aria-label={t.accountMenu}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                          {user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[120px] truncate text-sm font-medium md:inline">{user.name}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel>
                      <div className="text-sm font-semibold">{user.name}</div>
                      <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
                      <Badge variant="secondary" className="mt-1.5">{t.role[user.role] ?? user.role}</Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* Each role's way home — the logo deliberately isn't a link. */}
                    {user.role === 'MANAGER' && (
                      <>
                        <DropdownMenuItem asChild>
                          <AppLink href={DASHBOARD_PATH}>
                            <Users className="mr-2 h-4 w-4" /> {t.myTeam}
                          </AppLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <AppLink href="/join">
                            <KeyRound className="mr-2 h-4 w-4" /> {t.joinRoom}
                          </AppLink>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {user.role === 'ORGANIZER' && (
                      <>
                        <DropdownMenuItem asChild>
                          <AppLink href={DASHBOARD_PATH}>
                            <Trophy className="mr-2 h-4 w-4" /> {t.myTournaments}
                          </AppLink>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <AppLink href="/tournaments/new">
                            <Plus className="mr-2 h-4 w-4" /> {t.newTournament}
                          </AppLink>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {user.role === 'ADMIN' && (
                      <>
                        <DropdownMenuItem asChild>
                          <AppLink href={DASHBOARD_PATH}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> {t.adminConsole}
                          </AppLink>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <AppLink href="/account">
                        <UserCog className="mr-2 h-4 w-4" /> {t.myAccount}
                      </AppLink>
                    </DropdownMenuItem>
                    <InstallAppMenuItem />
                    <DataSaverMenuItem />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void logout()} variant="destructive">
                      <LogOut className="mr-2 h-4 w-4" /> {t.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <AppLink href="/login">
                    {/* Icons drop out on very narrow phones (≤ 380px) so the header never overflows. */}
                    <LogIn className="mr-1.5 hidden h-4 w-4 min-[380px]:inline" /> {t.login}
                  </AppLink>
                </Button>
                <Button size="sm" asChild>
                  <AppLink href="/register">
                    <UserPlus className="mr-1.5 hidden h-4 w-4 min-[380px]:inline" /> {t.register}
                  </AppLink>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {roomFocus ? null : <AnnouncementBanner />}
      {/* Phones only; not in the live room, where the stage needs the space. */}
      {!inRoom && (user?.role === 'ORGANIZER' || user?.role === 'MANAGER') ? <InstallHint /> : null}

      <main className="flex-1">
        {/* A crash on one page shows a fallback instead of a blank app; navigating away resets it. */}
        <ErrorBoundary key={segs.join('/')}>{renderRoute()}</ErrorBoundary>
      </main>

      <SiteFooter hidden={inRoom} settings={siteSettings} />

      <SonnerToaster richColors position="top-center" closeButton theme={resolvedTheme} />
      <InstallHelpHost />
    </div>
  )
}

const SHELL_STRINGS = {
  en: {
    joinRoom: 'Join auction room',
    myTeam: 'My team',
    myTournaments: 'My tournaments',
    newTournament: 'New tournament',
    adminConsole: 'Admin console',
    logout: 'Log out',
    login: 'Login',
    register: 'Register',
    noAccess: "You don't have access to that page — here is your dashboard.",
    loading: 'Loading…',
    notFoundTitle: 'Page not found',
    notFoundDescription: 'The page you are looking for does not exist.',
    backHome: 'Back to home',
    mainNav: 'Main navigation',
    accountMenu: 'Account menu',
    myAccount: 'My account',
    role: { ADMIN: 'ADMIN', ORGANIZER: 'ORGANIZER', MANAGER: 'MANAGER' },
  },
  bn: {
    joinRoom: 'নিলাম রুমে যোগ দিন',
    myTeam: 'আমার দল',
    myTournaments: 'আমার টুর্নামেন্ট',
    newTournament: 'নতুন টুর্নামেন্ট',
    adminConsole: 'অ্যাডমিন কনসোল',
    logout: 'লগ আউট',
    login: 'লগইন',
    register: 'রেজিস্টার',
    noAccess: 'ওই পেজে আপনার প্রবেশাধিকার নেই — এই আপনার ড্যাশবোর্ড।',
    loading: 'লোড হচ্ছে…',
    notFoundTitle: 'পেজটি পাওয়া যায়নি',
    notFoundDescription: 'আপনি যে পেজটি খুঁজছেন সেটি নেই।',
    backHome: 'হোমে ফিরে যান',
    mainNav: 'প্রধান মেনু',
    accountMenu: 'অ্যাকাউন্ট মেনু',
    myAccount: 'আমার অ্যাকাউন্ট',
    role: { ADMIN: 'অ্যাডমিন', ORGANIZER: 'আয়োজক', MANAGER: 'টিম ম্যানেজার' },
  },
} satisfies Strings<{ role: Record<UserRole, string> } & Record<'joinRoom' | 'myTeam' | 'myTournaments' | 'newTournament' | 'adminConsole' | 'logout' | 'login' | 'register' | 'noAccess' | 'loading' | 'notFoundTitle' | 'notFoundDescription' | 'backHome' | 'mainNav' | 'accountMenu' | 'myAccount', string>>

/** EN / বাংলা switch in the header. */
function LangToggle() {
  const lang = useLang()
  const setLang = useLangStore((s) => s.setLang)
  return (
    <div className="flex items-center rounded-full border p-0.5 text-xs font-bold" role="group" aria-label="Language / ভাষা">
      {(['en', 'bn'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`min-h-7 rounded-full px-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
            lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l === 'en' ? 'EN' : 'বাং'}
        </button>
      ))}
    </div>
  )
}

/** Site-wide banner driven by the admin "announcement" setting. */
/** Public admin settings (announcement, site name, support phone) — one cached request for the shell. */
function useSiteSettings(): Record<string, string> {
  return useCachedGet<{ settings: Record<string, string> }>('/api/settings').data?.settings ?? {}
}

function AnnouncementBanner() {
  const message = useSiteSettings().announcement?.trim()

  if (!message) return null
  return (
    <div className="border-b border-amber-200 bg-amber-50 print:hidden dark:border-amber-900/60 dark:bg-amber-950/40" role="status">
      <div className="container mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0">{message}</p>
      </div>
    </div>
  )
}

