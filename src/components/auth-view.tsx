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
import { navigate } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import type { SafeUser, UserRole } from '@/lib/types'

const DEMO_ACCOUNTS = [
  { label: 'Organizer', email: 'organizer@neelamghor.bd', password: 'demo1234' },
  { label: 'Manager', email: 'manager@neelamghor.bd', password: 'demo1234' },
  { label: 'Admin', email: 'admin@neelamghor.bd', password: 'admin1234' },
]

export default function AuthView({ mode }: { mode: 'login' | 'register' }) {
  const setUser = useAppStore((s) => s.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState<UserRole>('ORGANIZER')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const applySuccess = (user: SafeUser) => {
    setUser(user)
    toast.success(`Welcome back, ${user.name.split(/\s+/)[0]}!`)
    navigate('/dashboard')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isRegister) {
      if (name.trim().length < 2) return setError('Please enter your full name.')
      if (password.length < 6) return setError('Password must be at least 6 characters.')
      if (password !== confirm) return setError('Passwords do not match.')
    }
    if (!email.trim() || !password) return setError('Email and password are required.')

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
        applySuccess(res.user)
      } else {
        const res = await apiPost<{ user: SafeUser }>('/api/auth/login', {
          email: email.trim(),
          password,
        })
        applySuccess(res.user)
      }
    } catch (ex) {
      const message = ex instanceof ApiError ? ex.message : 'Something went wrong. Please try again.'
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
      setRole(acc.label === 'Manager' ? 'MANAGER' : acc.label === 'Admin' ? 'ORGANIZER' : 'ORGANIZER')
    }
    toast.info(`${acc.label} demo credentials filled`)
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-sm">
        <CardHeader className="text-center">
          <span className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gavel className="h-5 w-5" aria-hidden />
          </span>
          <CardTitle className="text-xl font-extrabold">
            {isRegister ? 'Create your NeelamGhor account' : 'Welcome back'}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? 'Run auctions as an organizer, or bid as a team manager.'
              : 'Log in to manage tournaments or join your auction room.'}
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
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rakib Hasan"
                    autoComplete="name"
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>I want to…</Label>
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
                      <span className="text-sm font-bold">Organizer</span>
                      <span className="text-xs text-muted-foreground">I run tournaments</span>
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
                      <span className="text-sm font-bold">Team Manager</span>
                      <span className="text-xs text-muted-foreground">I bid for my team</span>
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
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
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                className="h-11"
              />
            </div>

            {isRegister ? (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
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
              {isRegister ? 'Create account' : 'Log in'}
            </Button>
          </form>

          <Separator className="my-5" />

          <div className="rounded-lg border border-dashed bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden /> Demo accounts
            </p>
            <ul className="mt-2 space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <li key={acc.email} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="font-semibold text-foreground">{acc.label}</span> · {acc.email} / {acc.password}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => fillDemo(acc)}
                  >
                    Fill
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {isRegister ? 'Already have an account?' : 'New to NeelamGhor?'}{' '}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => navigate(isRegister ? '/login' : '/register')}
            >
              {isRegister ? 'Log in' : 'Create one free'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
