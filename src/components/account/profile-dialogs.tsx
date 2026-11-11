'use client'

import { useState, type FormEvent } from 'react'
import { Headset, KeyRound, Loader2, PencilLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { siteSettingsChanged } from '@/components/shared/site-settings'
import { SUPPORT_PHONE_MAX, validateSupportPhone } from '@/lib/support-phone'
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
    supportTitle: 'Website support number',
    supportDesc: 'Shown to everyone in the site footer (call and WhatsApp), the Terms and the Privacy notice. This is not your personal number.',
    supportLabel: 'Support number',
    supportHint: 'A mobile, landline or hotline, e.g. 01712345678. Leave empty to hide it.',
    supportLoading: 'Loading the current support number…',
    supportSaved: 'Profile and support number updated',
    supportFailed: 'Your profile was saved, but the support number was not:',
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
    supportTitle: 'ওয়েবসাইটের সাপোর্ট নম্বর',
    supportDesc: 'সাইটের ফুটারে (কল ও WhatsApp), শর্তাবলি ও গোপনীয়তা নীতিতে সবাই এটি দেখবেন। এটি আপনার ব্যক্তিগত নম্বর নয়।',
    supportLabel: 'সাপোর্ট নম্বর',
    supportHint: 'মোবাইল, ল্যান্ডলাইন বা হটলাইন, যেমন 01712345678। লুকাতে খালি রাখুন।',
    supportLoading: 'বর্তমান সাপোর্ট নম্বর লোড হচ্ছে…',
    supportSaved: 'প্রোফাইল ও সাপোর্ট নম্বর হালনাগাদ হয়েছে',
    supportFailed: 'আপনার প্রোফাইল সেভ হয়েছে, কিন্তু সাপোর্ট নম্বর হয়নি:',
  },
} satisfies Strings<Record<
  | 'editProfile' | 'editDesc' | 'name' | 'phone' | 'phoneHint' | 'save' | 'cancel' | 'saved' | 'saveFailed' | 'nameShort'
  | 'changePassword' | 'passwordDesc' | 'current' | 'next' | 'confirm' | 'tooShort' | 'mismatch' | 'changed' | 'changeFailed'
  | 'supportTitle' | 'supportDesc' | 'supportLabel' | 'supportHint' | 'supportLoading' | 'supportSaved' | 'supportFailed',
  string
>>

/** "Edit profile" and "Change password" buttons for the account page, each with its dialog. */
export function ProfileActions({ user, onSaved, isAdmin = false }: { user: Pick<SafeUser, 'name' | 'phone'>; onSaved: () => void; isAdmin?: boolean }) {
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
        {open === 'profile' ? <ProfileForm user={user} isAdmin={isAdmin} onDone={() => { setOpen(null); onSaved() }} onCancel={() => setOpen(null)} /> : null}
      </Dialog>
      <Dialog open={open === 'password'} onOpenChange={(o) => setOpen(o ? 'password' : null)}>
        {open === 'password' ? <PasswordForm onDone={() => setOpen(null)} onCancel={() => setOpen(null)} /> : null}
      </Dialog>
    </div>
  )
}

const SUPPORT_URL = '/api/admin/support-phone'

function ProfileForm({
  user,
  isAdmin,
  onDone,
  onCancel,
}: {
  user: Pick<SafeUser, 'name' | 'phone'>
  isAdmin: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const t = useStrings(STRINGS)
  const setUser = useAppStore((s) => s.setUser)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Admins: the site's support number (one Setting row), separate from their own phone.
  // `supportDraft` stays null until they type, so the field shows the saved value.
  const support = useSupportPhoneSetting(isAdmin)
  const [supportDraft, setSupportDraft] = useState<string | null>(null)
  const supportValue = supportDraft ?? support.value ?? ''
  const supportCheck = supportDraft === null ? null : validateSupportPhone(supportDraft)
  const supportError = supportCheck && 'error' in supportCheck ? supportCheck.error : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2 || name.trim().length > 60) return setError(t.nameShort)
    if (supportError) return setError(supportError)
    const supportChanged = isAdmin && supportCheck !== null && 'value' in supportCheck && supportCheck.value !== (support.value ?? '')
    setSaving(true)
    setError(null)
    try {
      const res = await api<{ user: SafeUser }>('/api/account', { method: 'PATCH', body: { name: name.trim(), phone: phone.trim() } })
      setUser(res.user) // the header shows the new name straight away
      if (supportChanged) {
        try {
          await api(SUPPORT_URL, { method: 'PUT', body: { supportPhone: supportDraft } })
        } catch (ex) {
          // The profile part is saved; say exactly what wasn't.
          setError(`${t.supportFailed} ${ex instanceof ApiError ? ex.message : ''}`.trim())
          return
        } finally {
          invalidateCached(SUPPORT_URL)
        }
        // Footer, Terms and Privacy refresh now, without a reload.
        siteSettingsChanged()
      }
      toast.success(supportChanged ? t.supportSaved : t.saved)
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
          {isAdmin ? (
            <section aria-labelledby="support-title" className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <h3 id="support-title" className="flex items-center gap-2 text-sm font-semibold">
                  <Headset className="h-4 w-4 text-primary" aria-hidden /> {t.supportTitle}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.supportDesc}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-support">{t.supportLabel}</Label>
                <Input
                  id="profile-support"
                  value={supportValue}
                  onChange={(e) => setSupportDraft(e.target.value)}
                  inputMode="tel"
                  autoComplete="off"
                  placeholder={support.loading ? t.supportLoading : '01XXXXXXXXX'}
                  disabled={support.loading}
                  maxLength={SUPPORT_PHONE_MAX}
                  className="h-11 bg-background"
                  aria-invalid={!!supportError}
                  aria-describedby="profile-support-hint"
                />
                <p id="profile-support-hint" className={supportError ? 'text-xs text-rose-600 dark:text-rose-400' : 'text-xs text-muted-foreground'}>
                  {supportError ?? t.supportHint}
                </p>
              </div>
            </section>
          ) : null}
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

/** The saved support number for the admin form; nothing is fetched for other roles. */
function useSupportPhoneSetting(enabled: boolean): { value: string | null; loading: boolean } {
  const { data, loading } = useCachedGet<{ supportPhone: string }>(enabled ? SUPPORT_URL : '/api/settings')
  if (!enabled) return { value: null, loading: false }
  return { value: data?.supportPhone ?? null, loading: loading && !data }
}
