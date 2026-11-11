'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, Loader2, PencilLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api'
import { type Strings, useStrings } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { SafeUser } from '@/lib/types'

const STRINGS = {
  en: {
    editProfile: 'Edit profile',
    editDesc: 'Your email is your login and can’t be changed here.',
    name: 'Name',
    phone: 'Mobile number',
    phoneHint: 'Optional. Used by organizers to reach you, e.g. 01712345678.',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Profile updated',
    saveFailed: 'Could not update your profile',
    nameShort: 'Enter your name (2–60 characters).',
    changePassword: 'Change password',
    passwordDesc: 'You’ll stay signed in here. Every other device — and any open auction seat — is signed out.',
    current: 'Current password',
    next: 'New password',
    confirm: 'Confirm new password',
    tooShort: 'The new password needs at least 6 characters.',
    mismatch: 'The new passwords don’t match.',
    changed: 'Password changed — other devices are signed out',
    changeFailed: 'Could not change your password',
  },
  bn: {
    editProfile: 'প্রোফাইল এডিট',
    editDesc: 'আপনার ইমেইলই লগইন — এখান থেকে বদলানো যায় না।',
    name: 'নাম',
    phone: 'মোবাইল নম্বর',
    phoneHint: 'ঐচ্ছিক। আয়োজকেরা যোগাযোগে ব্যবহার করেন, যেমন 01712345678।',
    save: 'সেভ করুন',
    cancel: 'বাতিল',
    saved: 'প্রোফাইল হালনাগাদ হয়েছে',
    saveFailed: 'প্রোফাইল হালনাগাদ করা যায়নি',
    nameShort: 'আপনার নাম দিন (২–৬০ অক্ষর)।',
    changePassword: 'পাসওয়ার্ড বদলান',
    passwordDesc: 'এই ডিভাইসে লগইন থাকবেন। অন্য সব ডিভাইস — আর খোলা নিলাম-আসন — লগ আউট হয়ে যাবে।',
    current: 'বর্তমান পাসওয়ার্ড',
    next: 'নতুন পাসওয়ার্ড',
    confirm: 'নতুন পাসওয়ার্ড আবার লিখুন',
    tooShort: 'নতুন পাসওয়ার্ডে অন্তত ৬টি অক্ষর লাগবে।',
    mismatch: 'নতুন পাসওয়ার্ড দুটি মেলেনি।',
    changed: 'পাসওয়ার্ড বদলানো হয়েছে — অন্য ডিভাইসগুলো লগ আউট হয়েছে',
    changeFailed: 'পাসওয়ার্ড বদলানো যায়নি',
  },
} satisfies Strings<Record<
  | 'editProfile' | 'editDesc' | 'name' | 'phone' | 'phoneHint' | 'save' | 'cancel' | 'saved' | 'saveFailed' | 'nameShort'
  | 'changePassword' | 'passwordDesc' | 'current' | 'next' | 'confirm' | 'tooShort' | 'mismatch' | 'changed' | 'changeFailed',
  string
>>

/** "Edit profile" and "Change password" buttons for the account page, each with its dialog. */
export function ProfileActions({ user, onSaved }: { user: Pick<SafeUser, 'name' | 'phone'>; onSaved: () => void }) {
  const t = useStrings(STRINGS)
  const [open, setOpen] = useState<'profile' | 'password' | null>(null)
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="min-h-9" onClick={() => setOpen('profile')}>
        <PencilLine className="mr-1.5 h-4 w-4" aria-hidden /> {t.editProfile}
      </Button>
      <Button variant="outline" size="sm" className="min-h-9" onClick={() => setOpen('password')}>
        <KeyRound className="mr-1.5 h-4 w-4" aria-hidden /> {t.changePassword}
      </Button>
      <Dialog open={open === 'profile'} onOpenChange={(o) => setOpen(o ? 'profile' : null)}>
        {open === 'profile' ? <ProfileForm user={user} onDone={() => { setOpen(null); onSaved() }} onCancel={() => setOpen(null)} /> : null}
      </Dialog>
      <Dialog open={open === 'password'} onOpenChange={(o) => setOpen(o ? 'password' : null)}>
        {open === 'password' ? <PasswordForm onDone={() => setOpen(null)} onCancel={() => setOpen(null)} /> : null}
      </Dialog>
    </div>
  )
}

function ProfileForm({ user, onDone, onCancel }: { user: Pick<SafeUser, 'name' | 'phone'>; onDone: () => void; onCancel: () => void }) {
  const t = useStrings(STRINGS)
  const setUser = useAppStore((s) => s.setUser)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2 || name.trim().length > 60) return setError(t.nameShort)
    setSaving(true)
    setError(null)
    try {
      const res = await api<{ user: SafeUser }>('/api/account', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } })
      setUser(res.user) // the header shows the new name straight away
      toast.success(t.saved)
      onDone()
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : t.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <DialogHeader>
          <DialogTitle>{t.editProfile}</DialogTitle>
          <DialogDescription>{t.editDesc}</DialogDescription>
        </DialogHeader>
        <div className="my-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{t.name}</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">{t.phone}</Label>
            <Input
              id="profile-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="01XXXXXXXXX"
              maxLength={20}
              className="h-11"
              aria-describedby="profile-phone-hint"
            />
            <p id="profile-phone-hint" className="text-xs text-muted-foreground">{t.phoneHint}</p>
          </div>
          {error ? (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t.save}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function PasswordForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useStrings(STRINGS)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (next.length < 6) return setError(t.tooShort)
    if (next !== confirm) return setError(t.mismatch)
    setSaving(true)
    setError(null)
    try {
      await api('/api/account/password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
      toast.success(t.changed)
      onDone()
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : t.changeFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <DialogHeader>
          <DialogTitle>{t.changePassword}</DialogTitle>
          <DialogDescription>{t.passwordDesc}</DialogDescription>
        </DialogHeader>
        <div className="my-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">{t.current}</Label>
            <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">{t.next}</Label>
            <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" maxLength={72} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">{t.confirm}</Label>
            <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={72} className="h-11" />
          </div>
          {error ? (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={saving || !current || !next}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t.changePassword}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
