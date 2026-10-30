'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, LogIn, MailWarning, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeamAvatar } from '@/components/shared/avatars'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'
import { navigate, setReturnTo } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { type Strings, useStrings } from '@/lib/i18n'

type AcceptInviteStrings = {
  loadFailed: string
  acceptFailed: string
  nowManage: (team: string) => string
  opening: string
  manageTitle: (team: string) => string
  invited: (team: string, tournament: string) => string
  teamBudget: string
  sentenceEnd: string
  loginPrompt: string
  logIn: string
  createAccount: string
  wrongRole: (isAdmin: boolean) => string
  acceptAs: (name: string) => string
  expires: (date: string) => string
}

const STRINGS = {
  en: {
    loadFailed: 'Could not open this invite.',
    acceptFailed: 'Could not accept the invite. Try again.',
    nowManage: (team) => `You now manage ${team}`,
    opening: 'Opening invite…',
    manageTitle: (team) => `Manage ${team}`,
    invited: (team, tournament) => `You're invited to bid for ${team} in ${tournament}.`,
    teamBudget: 'Team budget',
    sentenceEnd: '.',
    loginPrompt: 'Log in with your team manager account — or create one — to accept.',
    logIn: 'Log in',
    createAccount: 'Create account',
    wrongRole: (isAdmin) =>
      `You're logged in as ${isAdmin ? 'an admin' : 'an organizer'}. Invites are for team manager accounts — log out and accept with a manager account.`,
    acceptAs: (name) => `Accept as ${name}`,
    expires: (date) => `The link works once and expires ${date}.`,
  },
  bn: {
    loadFailed: 'আমন্ত্রণটি খোলা যায়নি।',
    acceptFailed: 'আমন্ত্রণ গ্রহণ করা যায়নি। আবার চেষ্টা করুন।',
    nowManage: (team) => `আপনি এখন ${team}-এর টিম ম্যানেজার`,
    opening: 'আমন্ত্রণ খোলা হচ্ছে…',
    manageTitle: (team) => `${team} পরিচালনা করুন`,
    invited: (team, tournament) => `${tournament}-এ ${team}-এর হয়ে বিড করতে আপনাকে আমন্ত্রণ জানানো হয়েছে।`,
    teamBudget: 'দলের বাজেট',
    sentenceEnd: '।',
    loginPrompt: 'গ্রহণ করতে আপনার টিম ম্যানেজার অ্যাকাউন্টে লগইন করুন — অথবা নতুন অ্যাকাউন্ট খুলুন।',
    logIn: 'লগইন',
    createAccount: 'অ্যাকাউন্ট খুলুন',
    wrongRole: (isAdmin) =>
      `আপনি ${isAdmin ? 'অ্যাডমিন' : 'আয়োজক'} হিসেবে লগইন করে আছেন। আমন্ত্রণ শুধু টিম ম্যানেজার অ্যাকাউন্টের জন্য — লগ আউট করে ম্যানেজার অ্যাকাউন্ট দিয়ে গ্রহণ করুন।`,
    acceptAs: (name) => `${name} হিসেবে গ্রহণ করুন`,
    expires: (date) => `লিংকটি একবারই কাজ করবে, মেয়াদ ${date} পর্যন্ত।`,
  },
} satisfies Strings<AcceptInviteStrings>

interface InviteInfo {
  teamName: string
  teamColor: string | null
  tournamentName: string
  sport: 'CRICKET' | 'FOOTBALL'
  budget: number
  expiresAt: string
}

interface AcceptResult {
  teamName: string
  roomCode: string | null
}

/** /invite#<token> — a manager accepts the organizer's invite for one team. */
export default function AcceptInvite({ token }: { token: string }) {
  const user = useAppStore((s) => s.user)
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useStrings(STRINGS)

  useEffect(() => {
    let cancelled = false
    apiGet<InviteInfo>(`/api/invites/${encodeURIComponent(token)}`)
      .then((res) => !cancelled && setInfo(res))
      .catch((e) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t.loadFailed))
    return () => {
      cancelled = true
    }
  }, [token])

  function goToAuth(to: '/login' | '/register') {
    setReturnTo(`/invite/${token}`)
    navigate(to)
  }

  async function accept() {
    setError(null)
    setAccepting(true)
    try {
      const res = await apiPost<AcceptResult>(`/api/invites/${encodeURIComponent(token)}`, {})
      toast.success(t.nowManage(res.teamName))
      navigate(res.roomCode ? `/room/${res.roomCode}` : '/my-team')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.acceptFailed)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-sm">
        {loadError ? (
          <CardContent className="p-6">
            <Alert variant="destructive">
              <MailWarning className="h-4 w-4" aria-hidden />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          </CardContent>
        ) : !info ? (
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t.opening}
          </CardContent>
        ) : (
          <>
            <CardHeader className="items-center text-center">
              <TeamAvatar name={info.teamName} color={info.teamColor} className="mb-1 h-14 w-14 text-lg" />
              <CardTitle className="text-xl font-extrabold">{t.manageTitle(info.teamName)}</CardTitle>
              <CardDescription>
                {t.invited(info.teamName, info.tournamentName)} {t.teamBudget}{' '}
                <span className="font-semibold text-foreground">{formatBDT(info.budget)}</span>
                {t.sentenceEnd}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {!user ? (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    {t.loginPrompt}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="h-11 font-bold" onClick={() => goToAuth('/login')}>
                      <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> {t.logIn}
                    </Button>
                    <Button variant="outline" className="h-11 font-bold" onClick={() => goToAuth('/register')}>
                      <UserPlus className="mr-1.5 h-4 w-4" aria-hidden /> {t.createAccount}
                    </Button>
                  </div>
                </>
              ) : user.role !== 'MANAGER' ? (
                <Alert>
                  <AlertDescription>
                    {t.wrongRole(user.role === 'ADMIN')}
                  </AlertDescription>
                </Alert>
              ) : (
                <Button className="h-12 w-full text-base font-black" disabled={accepting} onClick={() => void accept()}>
                  {accepting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden />
                  )}
                  {t.acceptAs(user.name)}
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                {t.expires(new Date(info.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
