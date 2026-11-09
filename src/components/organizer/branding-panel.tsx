'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Crown,
  ExternalLink,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Tv,
} from 'lucide-react'
import { apiDelete, apiPatch, apiPost, ApiError } from '@/lib/api'
import { type CachedGet, invalidateCached, useCachedGet } from '@/lib/api-cache'
import {
  BRAND_PRESETS,
  brandPalette,
  contrastLevelOnWhite,
  contrastRatio,
  DEFAULT_BRAND_COLOR,
  normalizeHex,
  parseSponsorUrl,
  SPONSOR_LIMITS,
  SPONSOR_TIERS,
  titleSponsor,
} from '@/lib/brand-color'
import type { SponsorDTO, SponsorTier, TournamentDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { type Strings, useStrings } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ImageUpload } from '@/components/shared/image-upload'
import { SponsorStrip } from '@/components/shared/sponsor-strip'
import { UpgradeDialog } from '@/components/organizer/upgrade-dialog'

const STRINGS = {
  en: {
    proTitle: 'Branding & sponsors is a Pro feature',
    proDesc: 'Upgrade this tournament to Pro to make every public screen look like your league:',
    proPoints: [
      'Your brand colour on the stream overlay, live room, results page and share cards',
      'Hide NeelamGhor branding on public pages, the overlay and share cards',
      'Up to 20 sponsors with logos — a title sponsor shown as "Presented by"',
      'Sponsor logos on the live stream, in the room and on the results page',
    ],
    upgrade: 'Upgrade to Pro',
    askOwner: 'Only the tournament owner can upgrade it to Pro.',
    lockedNote: 'Free tournaments always show NeelamGhor branding and no sponsors.',
    colorTitle: 'Brand colour',
    colorDesc: 'Used for accents: stripes on the overlay, the room header, results and share cards. Text on it is always black or white, whichever reads better.',
    presets: 'Preset colours',
    presetAria: (hex: string) => `Use ${hex}`,
    hex: 'Hex colour',
    hexInvalid: 'Enter a colour like #0F766E',
    pick: 'Pick a colour',
    useDefault: 'Use default',
    save: 'Save colour',
    saved: 'Brand colour saved',
    saveFailed: 'Could not save the brand colour',
    previewChip: 'Your league',
    contrast: (ratio: string) => `Contrast on white: ${ratio}:1`,
    contrastGood: 'Good — readable as text and as a background.',
    contrastLow: 'Fine for stripes and buttons, but small text in this colour is hard to read on white. We darken it automatically wherever it is used as text.',
    contrastPoor: 'Very light — text in this colour would be unreadable on white. We switch to black text on it and darken it for text, but a deeper shade will look better.',
    whiteTitle: 'Hide NeelamGhor branding',
    whiteLabel: 'Hide NeelamGhor branding on public pages, the stream overlay and share cards',
    whiteDesc: 'Your league name and logo take its place. Pages stay on the NeelamGhor web address.',
    whiteOn: 'NeelamGhor branding hidden',
    whiteOff: 'NeelamGhor branding shown',
    whiteFailed: 'Could not change the branding setting',
    previewTitle: 'Preview',
    previewDesc: 'How the stream overlay and the results header will look.',
    previewOverlay: 'Stream overlay',
    previewResults: 'Results page',
    previewLive: 'LIVE',
    previewPlayer: 'PLAYER #7',
    previewName: 'Player name',
    previewBid: '৳ 25,000',
    poweredBy: ['Powered by', ''],
    presentedBy: 'Presented by',
    sponsorsTitle: 'Sponsors',
    sponsorsDesc: 'Shown on the stream overlay, in the live room and on the results page. The title sponsor appears as "Presented by" and on share cards.',
    count: (n: number, max: number) => `${n} of ${max}`,
    noSponsors: 'No sponsors yet. Add your title sponsor first.',
    loadFailed: 'Could not load the sponsors',
    addTitle: 'Add a sponsor',
    name: 'Sponsor name',
    namePlaceholder: 'e.g. Rahim Traders',
    link: 'Website (optional)',
    linkPlaceholder: 'https://…',
    tier: 'Tier',
    logo: 'Logo (optional)',
    add: 'Add sponsor',
    added: (name: string) => `${name} added`,
    addFailed: 'Could not add the sponsor',
    full: (max: number) => `You have reached the limit of ${max} sponsors.`,
    nameInvalid: `Sponsor name must be ${SPONSOR_LIMITS.nameMin}–${SPONSOR_LIMITS.nameMax} characters`,
    linkInvalid: 'Enter a web address starting with http:// or https://',
    tierLabel: { TITLE: 'Title sponsor', ASSOCIATE: 'Associate sponsor', SPONSOR: 'Sponsor', PARTNER: 'Partner' },
    tierHelp: 'Title sponsors are shown first ("Presented by"), then associates, sponsors and partners.',
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    edit: (name: string) => `Edit ${name}`,
    remove: (name: string) => `Remove ${name}`,
    editTitle: 'Edit sponsor',
    editDesc: 'Changes show on public pages straight away.',
    saveSponsor: 'Save',
    updated: 'Sponsor updated',
    updateFailed: 'Could not update the sponsor',
    reorderFailed: 'Could not change the order',
    removeTitle: (name: string) => `Remove ${name}?`,
    removeDesc: 'Their logo disappears from the overlay, the live room and the results page.',
    removeConfirm: 'Remove',
    removed: (name: string) => `${name} removed`,
    removeFailed: 'Could not remove the sponsor',
    cancel: 'Cancel',
    readOnly: 'Only the owner and co-organizers can change branding.',
  },
  bn: {
    proTitle: 'ব্র্যান্ডিং ও স্পনসর প্রো ফিচার',
    proDesc: 'টুর্নামেন্টটি প্রো-তে আপগ্রেড করুন — প্রতিটি পাবলিক স্ক্রিন দেখাবে আপনার লিগের মতো:',
    proPoints: [
      'স্ট্রিম ওভারলে, লাইভ রুম, ফলাফল পেজ ও শেয়ার কার্ডে আপনার ব্র্যান্ডের রং',
      'পাবলিক পেজ, ওভারলে ও শেয়ার কার্ড থেকে NeelamGhor ব্র্যান্ডিং লুকানো',
      'লোগোসহ সর্বোচ্চ ২০টি স্পনসর — টাইটেল স্পনসর দেখাবে "পরিবেশনায়" হিসেবে',
      'লাইভ স্ট্রিম, রুম ও ফলাফল পেজে স্পনসরের লোগো',
    ],
    upgrade: 'প্রো-তে আপগ্রেড করুন',
    askOwner: 'শুধু টুর্নামেন্টের মালিক প্রো-তে আপগ্রেড করতে পারবেন।',
    lockedNote: 'ফ্রি টুর্নামেন্টে সবসময় NeelamGhor ব্র্যান্ডিং থাকে, কোনো স্পনসর দেখানো হয় না।',
    colorTitle: 'ব্র্যান্ডের রং',
    colorDesc: 'অ্যাকসেন্ট হিসেবে ব্যবহার হবে: ওভারলের স্ট্রাইপ, রুমের হেডার, ফলাফল ও শেয়ার কার্ড। এর ওপরের লেখা সবসময় কালো বা সাদা — যেটা ভালো পড়া যায়।',
    presets: 'তৈরি রং',
    presetAria: (hex: string) => `${hex} ব্যবহার করুন`,
    hex: 'হেক্স রং',
    hexInvalid: '#0F766E-এর মতো একটি রং লিখুন',
    pick: 'রং বেছে নিন',
    useDefault: 'ডিফল্ট রং',
    save: 'রং সেভ করুন',
    saved: 'ব্র্যান্ডের রং সেভ হয়েছে',
    saveFailed: 'ব্র্যান্ডের রং সেভ করা যায়নি',
    previewChip: 'আপনার লিগ',
    contrast: (ratio: string) => `সাদার ওপর কনট্রাস্ট: ${ratio}:1`,
    contrastGood: 'ভালো — লেখা ও ব্যাকগ্রাউন্ড দুই হিসেবেই পড়া যায়।',
    contrastLow: 'স্ট্রাইপ ও বাটনের জন্য ঠিক আছে, তবে এই রঙের ছোট লেখা সাদার ওপর পড়া কঠিন। লেখায় ব্যবহারের সময় আমরা নিজে থেকেই রংটা গাঢ় করে নিই।',
    contrastPoor: 'খুব হালকা — এই রঙের লেখা সাদার ওপর পড়া যাবে না। আমরা এর ওপর কালো লেখা দেব আর লেখার জন্য রংটা গাঢ় করে নেব, তবে আরেকটু গাঢ় রং বেশি সুন্দর দেখাবে।',
    whiteTitle: 'NeelamGhor ব্র্যান্ডিং লুকান',
    whiteLabel: 'পাবলিক পেজ, স্ট্রিম ওভারলে ও শেয়ার কার্ডে NeelamGhor ব্র্যান্ডিং লুকান',
    whiteDesc: 'সেখানে আপনার লিগের নাম ও লোগো দেখাবে। পেজগুলো NeelamGhor-এর ওয়েব ঠিকানাতেই থাকবে।',
    whiteOn: 'NeelamGhor ব্র্যান্ডিং লুকানো হয়েছে',
    whiteOff: 'NeelamGhor ব্র্যান্ডিং দেখানো হচ্ছে',
    whiteFailed: 'ব্র্যান্ডিং সেটিং বদলানো যায়নি',
    previewTitle: 'প্রিভিউ',
    previewDesc: 'স্ট্রিম ওভারলে ও ফলাফল পেজের হেডার যেমন দেখাবে।',
    previewOverlay: 'স্ট্রিম ওভারলে',
    previewResults: 'ফলাফল পেজ',
    previewLive: 'লাইভ',
    previewPlayer: 'খেলোয়াড় #7',
    previewName: 'খেলোয়াড়ের নাম',
    previewBid: '৳ 25,000',
    poweredBy: ['', 'দ্বারা চালিত'],
    presentedBy: 'পরিবেশনায়',
    sponsorsTitle: 'স্পনসর',
    sponsorsDesc: 'স্ট্রিম ওভারলে, লাইভ রুম ও ফলাফল পেজে দেখাবে। টাইটেল স্পনসর দেখাবে "পরিবেশনায়" হিসেবে, শেয়ার কার্ডেও।',
    count: (n: number, max: number) => `${max}-এর মধ্যে ${n}`,
    noSponsors: 'এখনো কোনো স্পনসর নেই। প্রথমে টাইটেল স্পনসর যোগ করুন।',
    loadFailed: 'স্পনসর লোড করা যায়নি',
    addTitle: 'স্পনসর যোগ করুন',
    name: 'স্পনসরের নাম',
    namePlaceholder: 'যেমন: রহিম ট্রেডার্স',
    link: 'ওয়েবসাইট (ঐচ্ছিক)',
    linkPlaceholder: 'https://…',
    tier: 'ধরন',
    logo: 'লোগো (ঐচ্ছিক)',
    add: 'স্পনসর যোগ করুন',
    added: (name: string) => `${name} যোগ হয়েছে`,
    addFailed: 'স্পনসর যোগ করা যায়নি',
    full: (max: number) => `সর্বোচ্চ ${max}টি স্পনসর যোগ করা যায় — সীমা পূর্ণ হয়েছে।`,
    nameInvalid: `স্পনসরের নাম ${SPONSOR_LIMITS.nameMin}–${SPONSOR_LIMITS.nameMax} অক্ষরের হতে হবে`,
    linkInvalid: 'http:// বা https:// দিয়ে শুরু হওয়া ওয়েব ঠিকানা দিন',
    tierLabel: { TITLE: 'টাইটেল স্পনসর', ASSOCIATE: 'অ্যাসোসিয়েট স্পনসর', SPONSOR: 'স্পনসর', PARTNER: 'পার্টনার' },
    tierHelp: 'প্রথমে টাইটেল স্পনসর ("পরিবেশনায়"), তারপর অ্যাসোসিয়েট, স্পনসর ও পার্টনার দেখাবে।',
    moveUp: (name: string) => `${name} ওপরে নিন`,
    moveDown: (name: string) => `${name} নিচে নিন`,
    edit: (name: string) => `${name} এডিট করুন`,
    remove: (name: string) => `${name} সরান`,
    editTitle: 'স্পনসর এডিট',
    editDesc: 'পরিবর্তন সাথে সাথে পাবলিক পেজে দেখাবে।',
    saveSponsor: 'সেভ করুন',
    updated: 'স্পনসর আপডেট হয়েছে',
    updateFailed: 'স্পনসর আপডেট করা যায়নি',
    reorderFailed: 'ক্রম বদলানো যায়নি',
    removeTitle: (name: string) => `${name} সরাবেন?`,
    removeDesc: 'ওভারলে, লাইভ রুম ও ফলাফল পেজ থেকে তাদের লোগো সরে যাবে।',
    removeConfirm: 'সরান',
    removed: (name: string) => `${name} সরানো হয়েছে`,
    removeFailed: 'স্পনসর সরানো যায়নি',
    cancel: 'বাতিল',
    readOnly: 'শুধু মালিক ও কো-অর্গানাইজার ব্র্যান্ডিং বদলাতে পারবেন।',
  },
} satisfies Strings<{
  proTitle: string
  proDesc: string
  proPoints: string[]
  upgrade: string
  askOwner: string
  lockedNote: string
  colorTitle: string
  colorDesc: string
  presets: string
  presetAria: (hex: string) => string
  hex: string
  hexInvalid: string
  pick: string
  useDefault: string
  save: string
  saved: string
  saveFailed: string
  previewChip: string
  contrast: (ratio: string) => string
  contrastGood: string
  contrastLow: string
  contrastPoor: string
  whiteTitle: string
  whiteLabel: string
  whiteDesc: string
  whiteOn: string
  whiteOff: string
  whiteFailed: string
  previewTitle: string
  previewDesc: string
  previewOverlay: string
  previewResults: string
  previewLive: string
  previewPlayer: string
  previewName: string
  previewBid: string
  /** Text before / after the brand name. */
  poweredBy: [string, string]
  presentedBy: string
  sponsorsTitle: string
  sponsorsDesc: string
  count: (n: number, max: number) => string
  noSponsors: string
  loadFailed: string
  addTitle: string
  name: string
  namePlaceholder: string
  link: string
  linkPlaceholder: string
  tier: string
  logo: string
  add: string
  added: (name: string) => string
  addFailed: string
  full: (max: number) => string
  nameInvalid: string
  linkInvalid: string
  tierLabel: Record<SponsorTier, string>
  tierHelp: string
  moveUp: (name: string) => string
  moveDown: (name: string) => string
  edit: (name: string) => string
  remove: (name: string) => string
  editTitle: string
  editDesc: string
  saveSponsor: string
  updated: string
  updateFailed: string
  reorderFailed: string
  removeTitle: (name: string) => string
  removeDesc: string
  removeConfirm: string
  removed: (name: string) => string
  removeFailed: string
  cancel: string
  readOnly: string
}>

type T = (typeof STRINGS)['en']

interface SponsorsResponse {
  sponsors: SponsorDTO[]
}

/**
 * Tournament → Branding tab. PRO: brand colour, white-label switch, sponsors
 * and a live preview. FREE: what Pro unlocks (controls shown, disabled).
 */
export default function BrandingPanel({
  data,
  canEdit,
  refetch,
}: {
  data: TournamentDetail
  canEdit: boolean
  refetch: () => Promise<void>
}) {
  const t = useStrings(STRINGS)
  const tour = data.tournament
  const isPro = tour.plan === 'PRO'
  const canUpgrade = data.myAccess === 'OWNER' || data.myAccess === 'ADMIN'
  const editable = canEdit && isPro
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const sponsorsUrl = `/api/tournaments/${tour.id}/sponsors`
  const sponsorsQuery = useCachedGet<SponsorsResponse>(sponsorsUrl)
  const sponsors = sponsorsQuery.data?.sponsors ?? []

  // The colour being edited, shared with the preview (null = nothing typed yet → saved colour).
  const [draftColor, setDraftColor] = useState<string | null>(null)
  const savedColor = normalizeHex(tour.brandColor)
  const previewColor = isPro ? (draftColor !== null ? normalizeHex(draftColor) : savedColor) : null

  return (
    <div className="space-y-4">
      {!isPro ? (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-background dark:border-amber-900 dark:from-amber-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" aria-hidden /> {t.proTitle}
            </CardTitle>
            <CardDescription>{t.proDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {t.proPoints.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              {canUpgrade ? (
                <Button className="min-h-10" onClick={() => setUpgradeOpen(true)}>
                  <Sparkles className="mr-1.5 h-4 w-4" aria-hidden /> {t.upgrade}
                </Button>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">{t.askOwner}</p>
              )}
              <p className="text-xs text-muted-foreground">{t.lockedNote}</p>
            </div>
          </CardContent>
        </Card>
      ) : !canEdit ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t.readOnly}</p>
      ) : null}

      {canUpgrade && !isPro ? (
        <UpgradeDialog tournamentId={tour.id} open={upgradeOpen} onOpenChange={setUpgradeOpen} onSubmitted={() => void refetch()} />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <ColorCard
            // Remount after a save so the editor starts from the saved colour.
            key={savedColor ?? 'none'}
            tournamentId={tour.id}
            saved={savedColor}
            disabled={!editable}
            onDraft={setDraftColor}
            refetch={refetch}
            t={t}
          />
          <WhiteLabelCard tournamentId={tour.id} value={isPro && tour.brandHidePlatform} disabled={!editable} refetch={refetch} t={t} />
          <SponsorsCard
            url={sponsorsUrl}
            query={sponsorsQuery}
            sponsors={sponsors}
            editable={editable}
            canDelete={canEdit}
            t={t}
          />
        </div>
        <div className="lg:sticky lg:top-4">
          <PreviewCard
            name={tour.name}
            logoUrl={tour.logoUrl}
            color={previewColor}
            hidePlatform={isPro && tour.brandHidePlatform}
            isPro={isPro}
            sponsors={isPro ? sponsors : []}
            t={t}
          />
        </div>
      </div>
    </div>
  )
}

// ---------- brand colour ----------

function ColorCard({
  tournamentId,
  saved,
  disabled,
  onDraft,
  refetch,
  t,
}: {
  tournamentId: string
  saved: string | null
  disabled: boolean
  onDraft: (value: string | null) => void
  refetch: () => Promise<void>
  t: T
}) {
  const [input, setInput] = useState(saved ?? '')
  const [saving, setSaving] = useState(false)
  const normalized = normalizeHex(input)
  const empty = input.trim() === ''
  const invalid = !empty && !normalized
  const dirty = (empty ? null : normalized) !== saved
  const shown = normalized ?? saved ?? DEFAULT_BRAND_COLOR
  const palette = brandPalette(shown)
  const ratio = contrastRatio(shown, '#FFFFFF')
  const level = contrastLevelOnWhite(shown)

  const change = (value: string) => {
    setInput(value)
    onDraft(value.trim() === '' ? '' : value)
  }

  const save = async () => {
    if (invalid) return toast.error(t.hexInvalid)
    setSaving(true)
    try {
      await apiPatch(`/api/tournaments/${tournamentId}`, { brandColor: empty ? null : normalized })
      toast.success(t.saved)
      onDraft(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={cn(disabled && 'opacity-75')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4 text-primary" aria-hidden /> {t.colorTitle}
        </CardTitle>
        <CardDescription>{t.colorDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset disabled={disabled} className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t.presets}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t.presets}>
              {BRAND_PRESETS.map((hex) => {
                const active = normalized === hex
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => change(hex)}
                    aria-label={t.presetAria(hex)}
                    aria-pressed={active}
                    title={hex}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
                      active ? 'ring-2 ring-foreground' : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: hex, color: brandPalette(hex).fg }}
                  >
                    {active ? <Check className="h-4 w-4" aria-hidden /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brand-hex">{t.hex}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={t.pick}
                  value={shown.toLowerCase()}
                  onChange={(e) => change(e.target.value.toUpperCase())}
                  className="h-10 w-12 cursor-pointer rounded-md border bg-background p-1 disabled:cursor-not-allowed"
                />
                <Input
                  id="brand-hex"
                  value={input}
                  onChange={(e) => change(e.target.value)}
                  placeholder={DEFAULT_BRAND_COLOR}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={invalid}
                  aria-describedby="brand-contrast"
                  className="w-32 font-mono uppercase"
                />
              </div>
            </div>
            <span
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-bold shadow-sm"
              style={{ backgroundColor: palette.bg, color: palette.fg }}
            >
              {t.previewChip}
            </span>
            <div className="ml-auto flex gap-2">
              {input !== '' ? (
                <Button type="button" variant="ghost" className="min-h-10" onClick={() => change('')}>
                  {t.useDefault}
                </Button>
              ) : null}
              <Button type="button" className="min-h-10" disabled={!dirty || invalid || saving} onClick={() => void save()}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t.save}
              </Button>
            </div>
          </div>
        </fieldset>

        <div
          id="brand-contrast"
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
            invalid
              ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              : level === 'good'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
          )}
          role="status"
          aria-live="polite"
        >
          {invalid || level !== 'good' ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>
            {invalid ? (
              t.hexInvalid
            ) : (
              <>
                <span className="font-semibold">{t.contrast(ratio.toFixed(1))}</span> ·{' '}
                {level === 'good' ? t.contrastGood : level === 'low' ? t.contrastLow : t.contrastPoor}
              </>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- white-label ----------

function WhiteLabelCard({
  tournamentId,
  value,
  disabled,
  refetch,
  t,
}: {
  tournamentId: string
  value: boolean
  disabled: boolean
  refetch: () => Promise<void>
  t: T
}) {
  const [pending, setPending] = useState<boolean | null>(null)
  const checked = pending ?? value

  const toggle = async (next: boolean) => {
    setPending(next)
    try {
      await apiPatch(`/api/tournaments/${tournamentId}`, { brandHidePlatform: next })
      toast.success(next ? t.whiteOn : t.whiteOff)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.whiteFailed)
    } finally {
      setPending(null)
    }
  }

  return (
    <Card className={cn(disabled && 'opacity-75')}>
      <CardContent className="flex items-start justify-between gap-4 py-1">
        <div className="space-y-1">
          <Label htmlFor="brand-hide" className="text-sm font-semibold leading-snug">
            {t.whiteLabel}
          </Label>
          <p className="text-xs text-muted-foreground">{t.whiteDesc}</p>
        </div>
        <Switch
          id="brand-hide"
          checked={checked}
          disabled={disabled || pending !== null}
          onCheckedChange={(v) => void toggle(v)}
          className="mt-0.5"
        />
      </CardContent>
    </Card>
  )
}

// ---------- preview ----------

function PreviewCard({
  name,
  logoUrl,
  color,
  hidePlatform,
  isPro,
  sponsors,
  t,
}: {
  name: string
  logoUrl: string | null
  color: string | null
  hidePlatform: boolean
  isPro: boolean
  sponsors: SponsorDTO[]
  t: T
}) {
  const palette = brandPalette(color)
  const title = titleSponsor(sponsors)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tv className="h-4 w-4 text-primary" aria-hidden /> {t.previewTitle}
        </CardTitle>
        <CardDescription>{t.previewDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stream overlay mock — fixed pixel sizes, not the vw-scaled real thing. */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t.previewOverlay}</p>
          <div
            className="relative aspect-video overflow-hidden rounded-lg bg-[linear-gradient(135deg,#334155,#0f172a)]"
            aria-hidden
          >
            {title ? (
              <div
                className="absolute left-2 top-2 flex max-w-[60%] items-center gap-1.5 rounded bg-slate-950/85 py-1 pl-2 pr-1.5 text-white"
                style={{ borderLeft: `3px solid ${palette.bg}` }}
              >
                <span className="text-[7px] font-bold uppercase tracking-wider text-white/70">{t.presentedBy}</span>
                {title.logoUrl ? (
                  <span className="flex h-4 items-center rounded-sm bg-white px-0.5">
                    <img src={title.logoUrl} alt="" className="h-full w-auto max-w-12 object-contain" />
                  </span>
                ) : (
                  <span className="truncate text-[9px] font-extrabold">{title.name}</span>
                )}
              </div>
            ) : null}
            <div
              className="absolute right-2 top-2 flex items-center gap-1 rounded bg-slate-950/85 px-1.5 py-0.5 text-white"
              style={{ borderRight: `3px solid ${palette.bg}` }}
            >
              <span className="rounded-sm bg-rose-600 px-1 text-[6px] font-black tracking-widest">{t.previewLive}</span>
              <span className="max-w-24 truncate text-[8px] font-bold">{name}</span>
            </div>
            <div
              className="absolute inset-x-2 bottom-3 flex items-center gap-2 rounded-md bg-slate-950/90 px-2 py-1.5 text-white"
              style={{ boxShadow: `inset 0 3px 0 ${palette.bg}` }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-black"
                style={{ backgroundColor: palette.bg, color: palette.fg }}
              >
                PN
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[6px] font-bold tracking-[0.2em]" style={{ color: palette.onDark }}>
                  {t.previewPlayer}
                </p>
                <p className="truncate text-[11px] font-black leading-tight">{t.previewName}</p>
              </div>
              <span className="text-xs font-black tabular-nums">{t.previewBid}</span>
            </div>
            {!isPro ? (
              <span className="absolute bottom-0.5 right-2 rounded-full bg-slate-950/60 px-1.5 text-[6px] font-semibold text-white/80">
                {t.poweredBy[0]} <b className="text-white">Neelam<span className="text-teal-300">Ghor</span></b> {t.poweredBy[1]}
              </span>
            ) : null}
          </div>
        </div>

        {/* Results header mock */}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t.previewResults}</p>
          <div className="space-y-3 rounded-lg border bg-background p-3" aria-hidden>
            {!hidePlatform ? (
              <p className="text-[10px] font-extrabold tracking-tight text-muted-foreground">
                Neelam<span className="text-teal-600 dark:text-teal-400">Ghor</span>
              </p>
            ) : null}
            <div>
              {color ? <span className="mb-1.5 block h-1 w-10 rounded-full" style={{ backgroundColor: palette.bg }} /> : null}
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border bg-white object-contain p-0.5" />
                ) : null}
                <p className="min-w-0 truncate text-base font-black tracking-tight">{name}</p>
              </div>
            </div>
            {sponsors.length > 0 ? <SponsorStrip sponsors={sponsors} variant="card" brandColor={color} /> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- sponsors ----------

interface SponsorFormValue {
  name: string
  url: string
  tier: SponsorTier
  logoUrl: string | null
}

const EMPTY_FORM: SponsorFormValue = { name: '', url: '', tier: 'SPONSOR', logoUrl: null }

/** Client-side check mirroring the API; returns an error message or the body to send. */
function validateForm(v: SponsorFormValue, t: T): { error: string } | { body: Record<string, unknown> } {
  const name = v.name.trim().replace(/\s+/g, ' ')
  if (name.length < SPONSOR_LIMITS.nameMin || name.length > SPONSOR_LIMITS.nameMax) return { error: t.nameInvalid }
  const url = parseSponsorUrl(v.url)
  if (url === false) return { error: t.linkInvalid }
  return { body: { name, url, tier: v.tier, logoUrl: v.logoUrl } }
}

function SponsorFields({
  value,
  onChange,
  disabled,
  idPrefix,
  t,
}: {
  value: SponsorFormValue
  onChange: (v: SponsorFormValue) => void
  disabled: boolean
  idPrefix: string
  t: T
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>{t.name}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={t.namePlaceholder}
          maxLength={SPONSOR_LIMITS.nameMax}
          disabled={disabled}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-tier`}>{t.tier}</Label>
        <Select value={value.tier} onValueChange={(v) => onChange({ ...value, tier: v as SponsorTier })} disabled={disabled}>
          <SelectTrigger id={`${idPrefix}-tier`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPONSOR_TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {t.tierLabel[tier]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-url`}>{t.link}</Label>
        <Input
          id={`${idPrefix}-url`}
          type="url"
          inputMode="url"
          value={value.url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          placeholder={t.linkPlaceholder}
          maxLength={SPONSOR_LIMITS.urlMax}
          disabled={disabled}
        />
      </div>
      <ImageUpload
        className="sm:col-span-2"
        label={t.logo}
        kind="LOGO"
        value={value.logoUrl}
        onChange={(logoUrl) => onChange({ ...value, logoUrl })}
        disabled={disabled}
      />
    </div>
  )
}

function SponsorsCard({
  url,
  query,
  sponsors,
  editable,
  canDelete,
  t,
}: {
  url: string
  query: CachedGet<SponsorsResponse>
  sponsors: SponsorDTO[]
  editable: boolean
  /** Deleting works on any plan, so a tournament without Pro can still clean up. */
  canDelete: boolean
  t: T
}) {
  const [form, setForm] = useState<SponsorFormValue>(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<SponsorDTO | null>(null)
  const [editForm, setEditForm] = useState<SponsorFormValue>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<SponsorDTO | null>(null)
  const [removing, setRemoving] = useState(false)
  const full = sponsors.length >= SPONSOR_LIMITS.max

  const reload = async () => {
    invalidateCached(url)
    await query.refetch()
  }

  const add = async () => {
    const v = validateForm(form, t)
    if ('error' in v) return toast.error(v.error)
    setAdding(true)
    try {
      const res = await apiPost<{ sponsor: SponsorDTO }>(url, v.body)
      toast.success(t.added(res.sponsor.name))
      setForm(EMPTY_FORM)
      await reload()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.addFailed)
    } finally {
      setAdding(false)
    }
  }

  const patch = async (s: SponsorDTO, body: Record<string, unknown>) => {
    setBusyId(s.id)
    try {
      await apiPatch(`${url}/${s.id}`, body)
      toast.success(t.updated)
      await reload()
      return true
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.updateFailed)
      return false
    } finally {
      setBusyId(null)
    }
  }

  // Order applies within a tier (title sponsors always lead), so a sponsor
  // moves past its neighbour only when both share the tier.
  const move = async (index: number, dir: -1 | 1) => {
    const other = sponsors[index + dir]
    const me = sponsors[index]
    if (!other || other.tier !== me.tier) return
    const ids = sponsors.map((s) => s.id)
    ids[index] = other.id
    ids[index + dir] = me.id
    setBusyId(me.id)
    try {
      await apiPatch(`${url}/order`, { ids })
      await reload()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.reorderFailed)
      await reload()
    } finally {
      setBusyId(null)
    }
  }

  const openEdit = (s: SponsorDTO) => {
    setEditForm({ name: s.name, url: s.url ?? '', tier: s.tier, logoUrl: s.logoUrl })
    setEditTarget(s)
  }

  const saveEdit = async () => {
    if (!editTarget) return
    const v = validateForm(editForm, t)
    if ('error' in v) return toast.error(v.error)
    setSavingEdit(true)
    const ok = await patch(editTarget, v.body)
    setSavingEdit(false)
    if (ok) setEditTarget(null)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await apiDelete(`${url}/${removeTarget.id}`)
      toast.success(t.removed(removeTarget.name))
      setRemoveTarget(null)
      await reload()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.removeFailed)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className={cn(!editable && 'opacity-75')}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden /> {t.sponsorsTitle}
          <Badge variant="secondary" className="tabular-nums">
            {t.count(sponsors.length, SPONSOR_LIMITS.max)}
          </Badge>
        </CardTitle>
        <CardDescription>{t.sponsorsDesc}</CardDescription>
        <p className="text-xs text-muted-foreground">{t.tierHelp}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : query.error && !query.data ? (
          <p className="text-sm text-rose-700 dark:text-rose-400">{t.loadFailed}</p>
        ) : sponsors.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{t.noSponsors}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sponsors.map((s, i) => {
              const busy = busyId === s.id
              const canUp = i > 0 && sponsors[i - 1].tier === s.tier
              const canDown = i < sponsors.length - 1 && sponsors[i + 1].tier === s.tier
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
                  <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <span className="text-sm font-black text-slate-500">{s.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <span className="truncate">{s.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                  <Select
                    value={s.tier}
                    onValueChange={(v) => void patch(s, { tier: v })}
                    disabled={!editable || busy}
                  >
                    <SelectTrigger className="h-9 w-[11.5rem]" aria-label={t.tier}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPONSOR_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {t.tierLabel[tier]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={!editable || busy || !canUp}
                      onClick={() => void move(i, -1)}
                      aria-label={t.moveUp(s.name)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={!editable || busy || !canDown}
                      onClick={() => void move(i, 1)}
                      aria-label={t.moveDown(s.name)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={!editable || busy}
                      onClick={() => openEdit(s)}
                      aria-label={t.edit(s.name)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                      disabled={!canDelete || busy}
                      onClick={() => setRemoveTarget(s)}
                      aria-label={t.remove(s.name)}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {full ? (
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">{t.full(SPONSOR_LIMITS.max)}</p>
        ) : (
          <form
            className="space-y-3 rounded-lg border bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <p className="text-sm font-semibold">{t.addTitle}</p>
            <SponsorFields value={form} onChange={setForm} disabled={!editable || adding} idPrefix="sponsor-new" t={t} />
            <div className="flex justify-end">
              <Button type="submit" className="min-h-10" disabled={!editable || adding}>
                {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
                {t.add}
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      <Dialog open={editTarget !== null} onOpenChange={(open) => (open ? null : setEditTarget(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{t.editDesc}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void saveEdit()
            }}
          >
            <SponsorFields value={editForm} onChange={setEditForm} disabled={savingEdit} idPrefix="sponsor-edit" t={t} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t.saveSponsor}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => (open ? null : setRemoveTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removeTarget ? t.removeTitle(removeTarget.name) : ''}</AlertDialogTitle>
            <AlertDialogDescription>{t.removeDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault()
                void confirmRemove()
              }}
            >
              {removing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t.removeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
