'use client'

import { useState } from 'react'
import { Gavel, HandCoins, Loader2, LogIn, Sparkles, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { apiPost, ApiError } from '@/lib/api'
import { consumeReturnTo, navigate, peekReturnTo } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import type { SafeUser, UserRole } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'

type AuthStrings = {
  welcomeNew: (name: string) => string
  welcomeBack: (name: string) => string
  nameRequired: string
  passwordTooShort: string
  passwordsMismatch: string
  credentialsRequired: string
  genericError: string
  demoLabel: (label: string) => string
  demoFilled: (label: string) => string
  registerTitle: string
  loginTitle: string
  registerDescription: string
  loginDescription: string
  fullName: string
  namePlaceholder: string
  iWantTo: string
  organizer: string
  organizerHint: string
  teamManager: string
  teamManagerHint: string
  email: string
  phone: string
  optional: string
  password: string
  forgotPassword: string
  newPasswordPlaceholder: string
  passwordPlaceholder: string
  confirmPassword: string
  confirmPlaceholder: string
  createAccount: string
  logIn: string
  demoAccounts: string
  fill: string
  haveAccount: string
  newHere: string
  createFree: string
}

const STRINGS = {
  en: {
    welcomeNew: (name) => `Welcome to NeelamGhor, ${name}!`,
    welcomeBack: (name) => `Welcome back, ${name}!`,
    nameRequired: 'Please enter your full name.',
    passwordTooShort: 'Password must be at least 6 characters.',
    passwordsMismatch: 'Passwords do not match.',
    credentialsRequired: 'Email and password are required.',
    genericError: 'Something went wrong. Please try again.',
    demoLabel: (label) => label,
    demoFilled: (label) => `${label} demo credentials filled`,
    registerTitle: 'Create your NeelamGhor account',
    loginTitle: 'Welcome back',
    registerDescription: 'Run auctions as an organizer, or bid as a team manager.',
    loginDescription: 'Log in to manage tournaments or join your auction room.',
    fullName: 'Full name',
    namePlaceholder: 'e.g. Rakib Hasan',
    iWantTo: 'I want to…',
    organizer: 'Organizer',
    organizerHint: 'I run tournaments',
    teamManager: 'Team Manager',
    teamManagerHint: 'I bid for my team',
    email: 'Email',
    phone: 'Phone',
    optional: '(optional)',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    newPasswordPlaceholder: 'At least 6 characters',
    passwordPlaceholder: 'Your password',
    confirmPassword: 'Confirm password',
    confirmPlaceholder: 'Repeat your password',
    createAccount: 'Create account',
    logIn: 'Log in',
    demoAccounts: 'Demo accounts',
    fill: 'Fill',
    haveAccount: 'Already have an account?',
    newHere: 'New to NeelamGhor?',
    createFree: 'Create one free',
  },
  bn: {
    welcomeNew: (name) => `NeelamGhor-এ স্বাগতম, ${name}!`,
    welcomeBack: (name) => `আবার স্বাগতম, ${name}!`,
    nameRequired: 'আপনার পুরো নাম লিখুন।',
    passwordTooShort: 'পাসওয়ার্ড কমপক্ষে 6 অক্ষরের হতে হবে।',
    passwordsMismatch: 'পাসওয়ার্ড দুটি মিলছে না।',
    credentialsRequired: 'ইমেইল ও পাসওয়ার্ড দিতে হবে।',
    genericError: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
    demoLabel: (label) => (label === 'Manager' ? 'ম্যানেজার' : 'আয়োজক'),
    demoFilled: (label) => `${label === 'Manager' ? 'ম্যানেজার' : 'আয়োজক'} ডেমো অ্যাকাউন্টের তথ্য বসানো হয়েছে`,
    registerTitle: 'NeelamGhor-এ অ্যাকাউন্ট খুলুন',
    loginTitle: 'আবার স্বাগতম',
    registerDescription: 'আয়োজক হিসেবে নিলাম চালান, অথবা টিম ম্যানেজার হিসেবে বিড করুন।',
    loginDescription: 'টুর্নামেন্ট পরিচালনা করতে বা আপনার নিলাম রুমে যোগ দিতে লগইন করুন।',
    fullName: 'পুরো নাম',
    namePlaceholder: 'যেমন: রাকিব হাসান',
    iWantTo: 'আমি চাই…',
    organizer: 'আয়োজক',
    organizerHint: 'আমি টুর্নামেন্ট আয়োজন করি',
    teamManager: 'টিম ম্যানেজার',
    teamManagerHint: 'আমি আমার দলের হয়ে বিড করি',
    email: 'ইমেইল',
    phone: 'ফোন',
    optional: '(ঐচ্ছিক)',
    password: 'পাসওয়ার্ড',
    forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
    newPasswordPlaceholder: 'কমপক্ষে 6 অক্ষর',
    passwordPlaceholder: 'আপনার পাসওয়ার্ড',
    confirmPassword: 'পাসওয়ার্ড আবার দিন',
    confirmPlaceholder: 'পাসওয়ার্ডটি আবার লিখুন',
    createAccount: 'অ্যাকাউন্ট খুলুন',
    logIn: 'লগইন',
    demoAccounts: 'ডেমো অ্যাকাউন্ট',
    fill: 'বসান',
    haveAccount: 'আগে থেকেই অ্যাকাউন্ট আছে?',
    newHere: 'NeelamGhor-এ নতুন?',
    createFree: 'ফ্রিতে অ্যাকাউন্ট খুলুন',
  },
} satisfies Strings<AuthStrings>

// Demo logins shown on the sign-in page. The admin account is deliberately
// NOT listed here — publishing platform-admin credentials is not a demo feature.
const DEMO_ACCOUNTS = [
  { label: 'Organizer', email: 'organizer@neelamghor.bd', password: 'demo1234' },
  { label: 'Manager', email: 'manager@neelamghor.bd', password: 'demo1234' },
]

export default function AuthView({ mode }: { mode: 'login' | 'register' }) {
  const setUser = useAppStore((s) => s.setUser)
  const t = useStrings(STRINGS)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirm, setConfirm] = useState('')
  // Arriving from a room's "log in to bid" or a team invite → default to a manager account.
  const [role, setRole] = useState<UserRole>(() =>
    /^\/(room|invite)\//.test(peekReturnTo() ?? '') ? 'MANAGER' : 'ORGANIZER',
  )

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const applySuccess = (user: SafeUser, created: boolean) => {
    setUser(user)
    const firstName = user.name.split(/\s+/)[0]
    toast.success(created ? t.welcomeNew(firstName) : t.welcomeBack(firstName))
    navigate(consumeReturnTo() ?? '/dashboard')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isRegister) {
      if (name.trim().length < 2) return setError(t.nameRequired)
      if (password.length < 6) return setError(t.passwordTooShort)
      if (password !== confirm) return setError(t.passwordsMismatch)
    }
    if (!email.trim() || !password) return setError(t.credentialsRequired)

    setSubmitting(true)
    try {
      if (isRegister) {
        const res = await apiPost<{ user: SafeUser }>('/api/auth/register', {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          role,
        })
        applySuccess(res.user, true)
      } else {
        const res = await apiPost<{ user: SafeUser }>('/api/auth/login', {
          email: email.trim(),
          password,
        })
        applySuccess(res.user, false)
      }
    } catch (ex) {
      const message = ex instanceof ApiError ? ex.message : t.genericError
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(acc.email)
    setPassword(acc.password)
    if (isRegister) {
      setConfirm(acc.password)
      setRole(acc.label === 'Manager' ? 'MANAGER' : 'ORGANIZER')
    }
    toast.info(t.demoFilled(acc.label))
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-sm">
        <CardHeader className="text-center">
          <span className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gavel className="h-5 w-5" aria-hidden />
          </span>
          <CardTitle className="text-xl font-extrabold">
            {isRegister ? t.registerTitle : t.loginTitle}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? t.registerDescription
              : t.loginDescription}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={submit} className="space-y-4" noValidate>
            {isRegister ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t.fullName}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    autoComplete="name"
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.iWantTo}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('ORGANIZER')}
                      aria-pressed={role === 'ORGANIZER'}
                      className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        role === 'ORGANIZER'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <Gavel className="h-5 w-5" aria-hidden />
                      <span className="text-sm font-bold">{t.organizer}</span>
                      <span className="text-xs text-muted-foreground">{t.organizerHint}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('MANAGER')}
                      aria-pressed={role === 'MANAGER'}
                      className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        role === 'MANAGER'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      <HandCoins className="h-5 w-5" aria-hidden />
                      <span className="text-sm font-bold">{t.teamManager}</span>
                      <span className="text-xs text-muted-foreground">{t.teamManagerHint}</span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-11"
              />
            </div>

            {isRegister ? (
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  {t.phone} <span className="font-normal text-muted-foreground">{t.optional}</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  autoComplete="tel"
                  className="h-11"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">{t.password}</Label>
                {!isRegister ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    onClick={() => navigate('/forgot-password')}
                  >
                    {t.forgotPassword}
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? t.newPasswordPlaceholder : t.passwordPlaceholder}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                className="h-11"
              />
            </div>

            {isRegister ? (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">{t.confirmPassword}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t.confirmPlaceholder}
                  autoComplete="new-password"
                  required
                  className="h-11"
                />
              </div>
            ) : null}

            <Button type="submit" className="h-11 w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : isRegister ? (
                <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
              ) : (
                <LogIn className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              {isRegister ? t.createAccount : t.logIn}
            </Button>
          </form>

          <Separator className="my-5" />

          <div className="rounded-lg border border-dashed bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden /> {t.demoAccounts}
            </p>
            <ul className="mt-2 space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <li key={acc.email} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="font-semibold text-foreground">{t.demoLabel(acc.label)}</span> · {acc.email} / {acc.password}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => fillDemo(acc)}
                  >
                    {t.fill}
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {isRegister ? t.haveAccount : t.newHere}{' '}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => navigate(isRegister ? '/login' : '/register')}
            >
              {isRegister ? t.logIn : t.createFree}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
