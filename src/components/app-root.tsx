'use client'

// App shell + hash router. The entire SPA lives under the single Next.js route "/".
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Gavel, LayoutDashboard, Loader2, LogIn, LogOut, Megaphone, ShieldCheck, UserPlus } from 'lucide-react'
import { Toaster as SonnerToaster } from 'sonner'
import { useAppStore } from '@/lib/store'
import { apiGet } from '@/lib/api'
import { navigate, useRoute } from '@/lib/router'
import { type Strings, useLang, useLangBootstrap, useLangStore, useStrings } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
const MyTeamView = dynamic(() => import('@/components/manager/my-team'), { loading: () => <CenterLoader /> })
const ResultsView = dynamic(() => import('@/components/results/results-view'), { loading: () => <CenterLoader /> })

function RoleGate({
  allowed,
  user,
  authLoading,
  children,
}: {
  allowed: ('ADMIN' | 'ORGANIZER' | 'MANAGER')[]
  user: ReturnType<typeof useAppStore.getState>['user']
  authLoading: boolean
  children: React.ReactNode
}) {
  if (authLoading) return <CenterLoader />
  if (!user) {
    return (
      <AccessPanel
        title="Login required"
        description="Please log in to access this page."
        action={
          <Button onClick={() => navigate('/login')}>
            <LogIn className="mr-2 h-4 w-4" /> Login
          </Button>
        }
      />
    )
  }
  if (!allowed.includes(user.role)) {
    return (
      <AccessPanel
        title="Access restricted"
        description={`This area is only for ${allowed.join(' / ').toLowerCase()} accounts. You are logged in as ${user.role.toLowerCase()}.`}
        action={<Button variant="outline" onClick={() => navigate('/dashboard')}>Go to my dashboard</Button>}
      />
    )
  }
  return <>{children}</>
}

function CenterLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading…
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
  return (
    <AccessPanel
      title="Page not found"
      description="The page you are looking for does not exist."
      action={<Button variant="outline" onClick={() => navigate('/')}>Back to home</Button>}
    />
  )
}

export default function AppRoot() {
  const { segs, fragment } = useRoute()
  const user = useAppStore((s) => s.user)
  const authLoading = useAppStore((s) => s.authLoading)
  const authChecked = useAppStore((s) => s.authChecked)
  const fetchMe = useAppStore((s) => s.fetchMe)
  const logout = useAppStore((s) => s.logout)
  useLangBootstrap()
  const t = useStrings(SHELL_STRINGS)

  useEffect(() => {
    void fetchMe()
  }, [fetchMe])

  const head = segs[0] ?? ''

  const renderRoute = () => {
    // The landing page doesn't depend on who is logged in — show it without
    // waiting for the session check.
    if (head === '') return <Landing />
    if (!authChecked) return <CenterLoader />
    switch (true) {
      case head === 'login' && segs.length === 1:
        return authLoading ? <CenterLoader /> : user ? <RedirectDashboard /> : <AuthView mode="login" />
      case head === 'register' && segs.length === 1:
        return authLoading ? <CenterLoader /> : user ? <RedirectDashboard /> : <AuthView mode="register" />
      case head === 'forgot-password' && segs.length === 1:
        return <ForgotPasswordView />
      // Works signed in or out — the link must always be usable.
      // Token in the fragment (/reset-password#<token>); the path form is kept for old links.
      case head === 'reset-password' && !!(segs[1] || fragment):
        return <ResetPasswordView token={segs[1] ?? fragment} />
      case head === 'dashboard' && segs.length === 1:
        return authLoading ? <CenterLoader /> : !user ? (
          <AccessPanel title="Login required" description="Please log in to open your dashboard." action={<Button onClick={() => navigate('/login')}><LogIn className="mr-2 h-4 w-4" /> Login</Button>} />
        ) : user.role === 'ADMIN' ? (
          <AdminView />
        ) : user.role === 'ORGANIZER' ? (
          <OrganizerDashboard />
        ) : (
          <ManagerDashboard />
        )
      case head === 'tournaments' && segs.length === 1:
        return <RoleGate allowed={['ORGANIZER', 'ADMIN']} user={user} authLoading={authLoading}><TournamentsList /></RoleGate>
      case head === 'tournaments' && segs[1] === 'new':
        return <RoleGate allowed={['ORGANIZER', 'ADMIN']} user={user} authLoading={authLoading}><TournamentCreate /></RoleGate>
      // Both spellings are accepted: /tournaments/:id/history and /tournaments/history/:id
      case head === 'tournaments' && segs[2] === 'history' && !!segs[1]:
        return <RoleGate allowed={['ORGANIZER', 'ADMIN']} user={user} authLoading={authLoading}><AuctionHistory tournamentId={segs[1]} /></RoleGate>
      case head === 'tournaments' && segs[1] === 'history' && !!segs[2]:
        return <RoleGate allowed={['ORGANIZER', 'ADMIN']} user={user} authLoading={authLoading}><AuctionHistory tournamentId={segs[2]} /></RoleGate>
      case head === 'tournaments' && !!segs[1]:
        return <RoleGate allowed={['ORGANIZER', 'ADMIN']} user={user} authLoading={authLoading}><TournamentDetail tournamentId={segs[1]} /></RoleGate>
      case head === 'results' && !!segs[1]:
        return authLoading ? <CenterLoader /> : !user ? (
          <AccessPanel title="Login required" description="Please log in to view auction results." action={<Button onClick={() => navigate('/login')}><LogIn className="mr-2 h-4 w-4" /> Login</Button>} />
        ) : (
          <ResultsView tournamentId={segs[1]} />
        )
      case head === 'room' && !!segs[1]:
        return <AuctionRoom roomCode={(segs[1] || '').toUpperCase()} />
      case head === 'register-player' && segs.length === 2:
        return <RegisterPlayer code={segs[1]} />
      case head === 'invite' && !!(segs[1] || fragment):
        return <AcceptInvite token={segs[1] ?? fragment} />
      case head === 'join' && segs.length === 1:
        return <JoinRoomView />
      case head === 'my-team' && segs.length === 1:
        return <RoleGate allowed={['MANAGER']} user={user} authLoading={authLoading}><MyTeamView /></RoleGate>
      case head === 'admin' && segs.length === 1:
        return <RoleGate allowed={['ADMIN']} user={user} authLoading={authLoading}><AdminView /></RoleGate>
      default:
        return <NotFound />
    }
  }

  // Broadcast overlay: no header, footer, toasts or auth — just the overlay.
  if (head === 'overlay' && segs[1]) {
    return <StreamOverlay roomCode={segs[1].toUpperCase()} green={segs[2] === 'green'} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <button
            className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => navigate('/')}
            aria-label="NeelamGhor home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gavel className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Neelam<span className="text-primary">Ghor</span>
            </span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">BD</Badge>
          </button>

          <nav className="flex items-center gap-1.5" aria-label="Main navigation">
            <LangToggle />
            {user ? (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="mr-1.5 h-4 w-4" /> {t.dashboard}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 rounded-full border px-2 py-1 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      aria-label="Account menu"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                          {user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-[120px] truncate text-sm font-medium md:inline">{user.name}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>
                      <div className="text-sm font-semibold">{user.name}</div>
                      <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
                      <Badge variant="secondary" className="mt-1.5">{user.role}</Badge>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> {t.dashboard}
                    </DropdownMenuItem>
                    {user.role === 'MANAGER' && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/join')}>{t.joinRoom}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/my-team')}>{t.myTeam}</DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void logout()} variant="destructive">
                      <LogOut className="mr-2 h-4 w-4" /> {t.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  <LogIn className="mr-1.5 h-4 w-4" /> {t.login}
                </Button>
                <Button size="sm" onClick={() => navigate('/register')}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> {t.register}
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <AnnouncementBanner />

      <main className="flex-1">{renderRoute()}</main>

      <footer className="mt-auto border-t bg-muted/40 pb-[env(safe-area-inset-bottom)] print:hidden">
        <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-1.5">
            <Gavel className="h-3.5 w-3.5" aria-hidden />
            <span className="font-semibold text-foreground">NeelamGhor</span> — {t.tagline}
          </p>
          <p>{t.footerFacts}</p>
        </div>
      </footer>

      <SonnerToaster richColors position="top-center" closeButton />
    </div>
  )
}

const SHELL_STRINGS = {
  en: {
    dashboard: 'Dashboard',
    joinRoom: 'Join auction room',
    myTeam: 'My team',
    logout: 'Log out',
    login: 'Login',
    register: 'Register',
    tagline: 'Live player auctions for Bangladesh',
    footerFacts: '৳ BDT · Cricket & Football · Room-code joining',
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড',
    joinRoom: 'নিলাম রুমে যোগ দিন',
    myTeam: 'আমার দল',
    logout: 'লগ আউট',
    login: 'লগইন',
    register: 'রেজিস্টার',
    tagline: 'বাংলাদেশের লাইভ প্লেয়ার নিলাম',
    footerFacts: '৳ টাকা · ক্রিকেট ও ফুটবল · রুম কোড দিয়ে যোগদান',
  },
} satisfies Strings<Record<'dashboard' | 'joinRoom' | 'myTeam' | 'logout' | 'login' | 'register' | 'tagline' | 'footerFacts', string>>

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
function AnnouncementBanner() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ settings: Record<string, string> }>('/api/settings')
      .then((res) => {
        const text = res.settings?.announcement?.trim()
        if (!cancelled && text) setMessage(text)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!message) return null
  return (
    <div className="border-b border-amber-200 bg-amber-50 print:hidden" role="status">
      <div className="container mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm text-amber-900">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0">{message}</p>
      </div>
    </div>
  )
}

function RedirectDashboard() {
  useEffect(() => {
    navigate('/dashboard')
  }, [])
  return <CenterLoader />
}
