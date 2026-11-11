'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Crown, Loader2, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'
import { invalidateCached, useCachedGet } from '@/lib/api-cache'
import { LoadError } from '@/components/shared/load-error'
import { siteSettingsChanged } from '@/components/shared/site-settings'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedStrings } from './strings'
import { ListSkeleton, loadError, PLANS_URL, SETTINGS_URL } from './shared'

/** Pricing settings (see PLAN_SETTING_KEYS in lib/plans.ts) and their built-in defaults. */
const PLAN_FIELDS = [
  { key: 'pro_price', placeholder: '999', numeric: true },
  { key: 'free_max_teams', placeholder: '4', numeric: true },
  { key: 'free_max_players', placeholder: '60', numeric: true },
  { key: 'pay_bkash_number', placeholder: '01XXXXXXXXX', numeric: false },
  { key: 'pay_nagad_number', placeholder: '01XXXXXXXXX', numeric: false },
] as const
type PlanFieldKey = (typeof PLAN_FIELDS)[number]['key'] | 'pay_instructions'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    whatSettings: 'settings',
    settingsSaved: 'Settings saved',
    couldNotSave: 'Could not save settings',
    announcementBanner: 'Announcement banner',
    announcementHelp: 'Shown at the top of every page, to everyone. Leave it empty to hide the banner.',
    announcementText: 'Announcement text',
    announcementPlaceholder: 'e.g. The auction service is down for maintenance on Friday from 2–3 am.',
    preview: 'Preview',
    noBannerPreview: 'No banner — nothing shows above the pages.',
    platformDetails: 'Platform details',
    fieldLabel: { siteName: 'Platform name', supportPhone: 'Support phone' },
    discard: 'Discard changes',
    save: 'Save settings',
    allSaved: 'All changes saved',
    pricingTitle: 'Pricing & payments',
    pricingHelp:
      'Pro is a one-time payment per tournament. Organizers send it to these numbers on bKash / Nagad and submit the Transaction ID; you approve it under Payments.',
    planField: {
      pro_price: 'Pro price (৳)',
      free_max_teams: 'Free plan: max teams',
      free_max_players: 'Free plan: max players',
      pay_bkash_number: 'Platform bKash number',
      pay_nagad_number: 'Platform Nagad number',
      pay_instructions: 'Payment instructions for organizers',
    },
    blankDefault: (v) => `Blank = ${v}`,
    payInstructionsPlaceholder: 'e.g. Use Send Money (not Cash Out) and write your tournament name in the reference.',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    whatSettings: 'সেটিংস',
    settingsSaved: 'সেটিংস সেভ হয়েছে',
    couldNotSave: 'সেটিংস সেভ করা যায়নি',
    announcementBanner: 'ঘোষণার ব্যানার',
    announcementHelp: 'প্রতিটি পেজের ওপরে সবাই দেখবে। ব্যানার লুকাতে ঘরটি খালি রাখুন।',
    announcementText: 'ঘোষণার লেখা',
    announcementPlaceholder: 'যেমন: রক্ষণাবেক্ষণের জন্য শুক্রবার রাত 2–3টা নিলাম সার্ভিস বন্ধ থাকবে।',
    preview: 'প্রিভিউ',
    noBannerPreview: 'কোনো ব্যানার নেই — পেজের ওপরে কিছুই দেখাবে না।',
    platformDetails: 'প্ল্যাটফর্মের তথ্য',
    fieldLabel: { siteName: 'প্ল্যাটফর্মের নাম', supportPhone: 'সাপোর্ট ফোন' },
    discard: 'পরিবর্তন বাদ দিন',
    save: 'সেটিংস সেভ করুন',
    allSaved: 'সব পরিবর্তন সেভ হয়েছে',
    pricingTitle: 'মূল্য ও পেমেন্ট',
    pricingHelp:
      'Pro প্রতি টুর্নামেন্টে এককালীন পেমেন্ট। আয়োজকেরা এই নম্বরগুলোতে bKash / Nagad-এ টাকা পাঠিয়ে ট্রানজেকশন আইডি জমা দেন; আপনি “পেমেন্ট” ট্যাবে অনুমোদন দেন।',
    planField: {
      pro_price: 'Pro-এর দাম (৳)',
      free_max_teams: 'ফ্রি প্ল্যান: সর্বোচ্চ দল',
      free_max_players: 'ফ্রি প্ল্যান: সর্বোচ্চ খেলোয়াড়',
      pay_bkash_number: 'প্ল্যাটফর্মের bKash নম্বর',
      pay_nagad_number: 'প্ল্যাটফর্মের Nagad নম্বর',
      pay_instructions: 'আয়োজকদের জন্য পেমেন্টের নির্দেশনা',
    },
    blankDefault: (v) => `খালি = ${v}`,
    payInstructionsPlaceholder: 'যেমন: Send Money করুন (Cash Out নয়) এবং রেফারেন্সে টুর্নামেন্টের নাম লিখুন।',
  },
} satisfies Strings<
  SharedStrings & {
    whatSettings: string
    settingsSaved: string
    couldNotSave: string
    announcementBanner: string
    announcementHelp: string
    announcementText: string
    announcementPlaceholder: string
    preview: string
    noBannerPreview: string
    platformDetails: string
    fieldLabel: Record<'siteName' | 'supportPhone', string>
    discard: string
    save: string
    allSaved: string
    pricingTitle: string
    pricingHelp: string
    planField: Record<PlanFieldKey, string>
    blankDefault: (v: string) => string
    payInstructionsPlaceholder: string
  }
>

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const FIELDS = [
  { key: 'siteName', placeholder: 'NeelamGhor', max: 80 },
  { key: 'supportPhone', placeholder: '01XXXXXXXXX', max: 30 },
] as const
const ANNOUNCEMENT_MAX = 300
const PAY_INSTRUCTIONS_MAX = 300
const FORM_KEYS: readonly string[] = [...FIELDS.map((f) => f.key), 'announcement', ...PLAN_FIELDS.map((f) => f.key), 'pay_instructions']

/** `onDirtyChange` tells the admin page about unsaved edits, so it can warn before they are lost. */
export function SettingsTab({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const t = useStrings(STRINGS)
  const { data, loading, error, refetch } = useCachedGet<{ settings: Record<string, string> }>(SETTINGS_URL, loadError(t.couldNotLoad(t.whatSettings)))
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)

  const saved = data?.settings ?? {}
  const values = draft ?? saved
  const dirty = !!data && FORM_KEYS.some((k) => (values[k] ?? '') !== (saved[k] ?? ''))
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  // Unmounted (tab left): nothing unsaved remains.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  if (!data && error) return <LoadError what={t.whatSettings} error={error} onRetry={refetch} />
  if (loading || !data) return <ListSkeleton rows={3} />

  const set = (key: string, value: string) => setDraft({ ...values, [key]: value })
  // Keys saved by an older version of this page. Nothing reads them, but the
  // API replaces the whole set on save — so send them back untouched.
  const extraKeys = Object.keys(saved).filter((k) => !FORM_KEYS.includes(k))
  const announcement = (values.announcement ?? '').trim()

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      for (const k of extraKeys) payload[k] = saved[k]
      for (const k of FORM_KEYS) {
        const v = (values[k] ?? '').trim()
        if (v) payload[k] = v
      }
      await api(SETTINGS_URL, { method: 'PUT', body: { settings: payload } })
      invalidateCached(PLANS_URL)
      // The banner and footer (app shell) read the public settings — refresh them too.
      siteSettingsChanged()
      await refetch()
      setDraft(null)
      toast.success(t.settingsSaved)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotSave)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty && !saving) void save()
      }}
    >
      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden /> {t.announcementBanner}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.announcementHelp}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-announcement" className="sr-only">
              {t.announcementText}
            </Label>
            <Textarea
              id="set-announcement"
              value={values.announcement ?? ''}
              onChange={(e) => set('announcement', e.target.value)}
              maxLength={ANNOUNCEMENT_MAX}
              rows={2}
              placeholder={t.announcementPlaceholder}
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {(values.announcement ?? '').length}/{ANNOUNCEMENT_MAX}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.preview}</p>
            {announcement ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="flex items-start gap-2">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{announcement}</span>
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">{t.noBannerPreview}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{t.platformDetails}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`set-${f.key}`}>{t.fieldLabel[f.key]}</Label>
              <Input
                id={`set-${f.key}`}
                value={values[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                maxLength={f.max}
                placeholder={f.placeholder}
                inputMode={f.key === 'supportPhone' ? 'tel' : undefined}
                className="h-10"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-4">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden /> {t.pricingTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.pricingHelp}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {PLAN_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`set-${f.key}`}>{t.planField[f.key]}</Label>
              <Input
                id={`set-${f.key}`}
                value={values[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                maxLength={f.numeric ? 9 : 20}
                placeholder={f.numeric ? t.blankDefault(f.placeholder) : f.placeholder}
                inputMode={f.numeric ? 'numeric' : 'tel'}
                className="h-10"
              />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="set-pay_instructions">{t.planField.pay_instructions}</Label>
            <Textarea
              id="set-pay_instructions"
              value={values.pay_instructions ?? ''}
              onChange={(e) => set('pay_instructions', e.target.value)}
              maxLength={PAY_INSTRUCTIONS_MAX}
              rows={2}
              placeholder={t.payInstructionsPlaceholder}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {dirty ? (
          <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={() => setDraft(null)}>
            {t.discard}
          </Button>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={!dirty || saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />}
          {dirty ? t.save : t.allSaved}
        </Button>
      </div>
    </form>
  )
}
