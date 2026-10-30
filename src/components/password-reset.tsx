'use client'

import { useState } from 'react'
import { ArrowLeft, KeyRound, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiPost, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    backToLogin: 'Back to log in',
    enterEmail: 'Enter the email address you registered with.',
    genericError: 'Something went wrong. Please try again.',
    forgotTitle: 'Forgot your password?',
    forgotDescription: 'We will email you a link to choose a new one.',
    email: 'Email',
    sendLink: 'Send reset link',
    passwordTooShort: 'Password must be at least 6 characters.',
    passwordsMismatch: 'Passwords do not match.',
    passwordChanged: 'Password changed. Log in with your new password.',
    resetTitle: 'Choose a new password',
    resetDescription: 'You will be signed out on every device after the change.',
    sendNewLink: 'Send a new link',
    newPassword: 'New password',
    newPasswordPlaceholder: 'At least 6 characters',
    confirmPassword: 'Confirm new password',
    confirmPlaceholder: 'Repeat your new password',
    save: 'Save new password',
  },
  bn: {
    backToLogin: 'লগইনে ফিরে যান',
    enterEmail: 'যে ইমেইল দিয়ে রেজিস্টার করেছিলেন, সেটি লিখুন।',
    genericError: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
    forgotTitle: 'পাসওয়ার্ড ভুলে গেছেন?',
    forgotDescription: 'নতুন পাসওয়ার্ড সেট করার জন্য আমরা আপনাকে একটি লিংক ইমেইল করব।',
    email: 'ইমেইল',
    sendLink: 'রিসেট লিংক পাঠান',
    passwordTooShort: 'পাসওয়ার্ড কমপক্ষে 6 অক্ষরের হতে হবে।',
    passwordsMismatch: 'পাসওয়ার্ড দুটি মিলছে না।',
    passwordChanged: 'পাসওয়ার্ড বদলানো হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
    resetTitle: 'নতুন পাসওয়ার্ড দিন',
    resetDescription: 'পাসওয়ার্ড বদলানোর পর সব ডিভাইস থেকে আপনাকে লগ আউট করা হবে।',
    sendNewLink: 'নতুন লিংক পাঠান',
    newPassword: 'নতুন পাসওয়ার্ড',
    newPasswordPlaceholder: 'কমপক্ষে 6 অক্ষর',
    confirmPassword: 'নতুন পাসওয়ার্ড আবার দিন',
    confirmPlaceholder: 'নতুন পাসওয়ার্ডটি আবার লিখুন',
    save: 'নতুন পাসওয়ার্ড সেভ করুন',
  },
} satisfies Strings<{
  backToLogin: string
  enterEmail: string
  genericError: string
  forgotTitle: string
  forgotDescription: string
  email: string
  sendLink: string
  passwordTooShort: string
  passwordsMismatch: string
  passwordChanged: string
  resetTitle: string
  resetDescription: string
  sendNewLink: string
  newPassword: string
  newPasswordPlaceholder: string
  confirmPassword: string
  confirmPlaceholder: string
  save: string
}>

function Shell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const t = useStrings(STRINGS)
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-sm">
        <CardHeader className="text-center">
          <span className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <CardTitle className="text-xl font-extrabold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          <p className="mt-5 text-center text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {t.backToLogin}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/** /forgot-password — asks for the email and sends a reset link. */
export function ForgotPasswordView() {
  const t = useStrings(STRINGS)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) return setError(t.enterEmail)
    setSubmitting(true)
    try {
      const res = await apiPost<{ message: string }>('/api/auth/forgot-password', { email: email.trim() })
      setSentMessage(res.message)
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell title={t.forgotTitle} description={t.forgotDescription}>
      {sentMessage ? (
        <Alert>
          <MailCheck className="h-4 w-4" aria-hidden />
          <AlertDescription>{sentMessage}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">{t.email}</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t.sendLink}
          </Button>
        </form>
      )}
    </Shell>
  )
}

/** /reset-password#<token> — the link from the email lands here. */
export function ResetPasswordView({ token }: { token: string }) {
  const t = useStrings(STRINGS)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError(t.passwordTooShort)
    if (password !== confirm) return setError(t.passwordsMismatch)
    setSubmitting(true)
    try {
      await apiPost('/api/auth/reset-password', { token, password })
      toast.success(t.passwordChanged)
      navigate('/login')
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell title={t.resetTitle} description={t.resetDescription}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error}{' '}
              <button type="button" className="font-semibold underline" onClick={() => navigate('/forgot-password')}>
                {t.sendNewLink}
              </button>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">{t.newPassword}</Label>
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.newPasswordPlaceholder}
            autoComplete="new-password"
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">{t.confirmPassword}</Label>
          <Input
            id="reset-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t.confirmPlaceholder}
            autoComplete="new-password"
            required
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t.save}
        </Button>
      </form>
    </Shell>
  )
}
