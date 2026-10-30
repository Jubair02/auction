'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardSignature, Loader2, MapPin } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUpload } from '@/components/shared/image-upload'
import { apiGet, apiPost, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'

type RegisterPlayerStrings = {
  loadFailed: string
  genericError: string
  nameRequired: string
  phoneRequired: string
  roleRequired: string
  loading: string
  registrationFor: (sport: 'CRICKET' | 'FOOTBALL') => string
  starts: (date: string) => string
  registeredTitle: string
  registeredBody: (tournament: string) => string
  closed: string
  photoLabel: string
  fullName: string
  namePlaceholder: string
  phone: string
  playingRole: string
  pickRole: string
  previousTeam: string
  optional: string
  previousTeamPlaceholder: string
  register: string
  phonePrivacy: string
}

const STRINGS = {
  en: {
    loadFailed: 'Could not open this page.',
    genericError: 'Something went wrong. Please try again.',
    nameRequired: 'Enter your full name.',
    phoneRequired: 'Enter your phone number so the organizer can reach you.',
    roleRequired: 'Pick your playing role.',
    loading: 'Loading…',
    registrationFor: (sport) => `${sport === 'FOOTBALL' ? 'Football' : 'Cricket'} player registration`,
    starts: (date) => `· starts ${date}`,
    registeredTitle: "You're registered!",
    registeredBody: (tournament) =>
      `The organizer will review your registration. Once approved you'll be in the auction pool for ${tournament}.`,
    closed: 'Registration for this tournament is closed. Contact the organizer if you still want to play.',
    photoLabel: 'Your photo (optional)',
    fullName: 'Full name',
    namePlaceholder: 'e.g. Rakib Hasan',
    phone: 'Phone',
    playingRole: 'Playing role',
    pickRole: 'Pick your role',
    previousTeam: 'Previous team',
    optional: '(optional)',
    previousTeamPlaceholder: 'e.g. Mirpur Club',
    register: 'Register',
    phonePrivacy: 'Your phone number is shared only with the organizer.',
  },
  bn: {
    loadFailed: 'পেজটি খোলা যায়নি।',
    genericError: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
    nameRequired: 'আপনার পুরো নাম লিখুন।',
    phoneRequired: 'ফোন নম্বর দিন, যাতে আয়োজক আপনার সাথে যোগাযোগ করতে পারেন।',
    roleRequired: 'আপনার খেলার ভূমিকা বেছে নিন।',
    loading: 'লোড হচ্ছে…',
    registrationFor: (sport) => `${sport === 'FOOTBALL' ? 'ফুটবল' : 'ক্রিকেট'} খেলোয়াড় নিবন্ধন`,
    starts: (date) => `· শুরু ${date}`,
    registeredTitle: 'আপনার নিবন্ধন হয়ে গেছে!',
    registeredBody: (tournament) =>
      `আয়োজক আপনার নিবন্ধন যাচাই করবেন। অনুমোদন পেলে আপনি ${tournament}-এর নিলামের খেলোয়াড় তালিকায় থাকবেন।`,
    closed: 'এই টুর্নামেন্টের নিবন্ধন বন্ধ হয়ে গেছে। এখনও খেলতে চাইলে আয়োজকের সাথে যোগাযোগ করুন।',
    photoLabel: 'আপনার ছবি (ঐচ্ছিক)',
    fullName: 'পুরো নাম',
    namePlaceholder: 'যেমন: রাকিব হাসান',
    phone: 'ফোন',
    playingRole: 'খেলার ভূমিকা',
    pickRole: 'ভূমিকা বেছে নিন',
    previousTeam: 'আগের দল',
    optional: '(ঐচ্ছিক)',
    previousTeamPlaceholder: 'যেমন: মিরপুর ক্লাব',
    register: 'রেজিস্টার করুন',
    phonePrivacy: 'আপনার ফোন নম্বর শুধু আয়োজক দেখতে পাবেন।',
  },
} satisfies Strings<RegisterPlayerStrings>

interface RegistrationInfo {
  tournamentName: string
  sport: 'CRICKET' | 'FOOTBALL'
  location: string | null
  startDate: string | null
  logoUrl: string | null
  open: boolean
  roles: string[]
}

/** /register-player/<code> — public player sign-up (no account needed). */
export default function RegisterPlayer({ code }: { code: string }) {
  const [info, setInfo] = useState<RegistrationInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [previousTeam, setPreviousTeam] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const t = useStrings(STRINGS)

  useEffect(() => {
    let cancelled = false
    apiGet<RegistrationInfo>(`/api/register/${encodeURIComponent(code)}`)
      .then((res) => !cancelled && setInfo(res))
      .catch((e) => !cancelled && setLoadError(e instanceof ApiError ? e.message : t.loadFailed))
    return () => {
      cancelled = true
    }
  }, [code])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return setError(t.nameRequired)
    if (!phone.trim()) return setError(t.phoneRequired)
    if (!role) return setError(t.roleRequired)
    setSubmitting(true)
    try {
      await apiPost(`/api/register/${encodeURIComponent(code)}`, {
        name: name.trim(),
        phone: phone.trim(),
        role,
        previousTeam: previousTeam.trim() || null,
        photoUrl,
      })
      setDone(true)
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : t.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <Card className="w-full shadow-sm">
        {loadError ? (
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          </CardContent>
        ) : !info ? (
          <CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t.loading}
          </CardContent>
        ) : (
          <>
            <CardHeader className="items-center text-center">
              {info.logoUrl ? (
                <img src={info.logoUrl} alt="" className="mb-1 h-14 w-14 rounded-xl border object-contain" />
              ) : (
                <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <ClipboardSignature className="h-6 w-6" aria-hidden />
                </span>
              )}
              <CardTitle className="text-xl font-extrabold">{info.tournamentName}</CardTitle>
              <CardDescription className="flex flex-wrap items-center justify-center gap-x-2">
                <span>{t.registrationFor(info.sport)}</span>
                {info.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {info.location}
                  </span>
                ) : null}
                {info.startDate ? <span>{t.starts(formatDate(info.startDate))}</span> : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {done ? (
                <div className="space-y-2 py-4 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
                  <p className="text-lg font-bold">{t.registeredTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.registeredBody(info.tournamentName)}
                  </p>
                </div>
              ) : !info.open ? (
                <Alert>
                  <AlertDescription>{t.closed}</AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={submit} className="space-y-4" noValidate>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <ImageUpload label={t.photoLabel} kind="PHOTO" value={photoUrl} onChange={setPhotoUrl} registrationCode={code} />
                  <div className="space-y-1.5">
                    <Label htmlFor="rp-name">{t.fullName}</Label>
                    <Input id="rp-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className="h-11" placeholder={t.namePlaceholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rp-phone">{t.phone}</Label>
                    <Input id="rp-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={20} className="h-11" placeholder="01XXXXXXXXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.playingRole}</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger className="h-11 w-full" aria-label={t.playingRole}>
                        <SelectValue placeholder={t.pickRole} />
                      </SelectTrigger>
                      <SelectContent>
                        {info.roles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rp-prev">
                      {t.previousTeam} <span className="font-normal text-muted-foreground">{t.optional}</span>
                    </Label>
                    <Input id="rp-prev" value={previousTeam} onChange={(e) => setPreviousTeam(e.target.value)} maxLength={80} className="h-11" placeholder={t.previousTeamPlaceholder} />
                  </div>
                  <Button type="submit" className="h-12 w-full text-base font-bold" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> : null}
                    {t.register}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {t.phonePrivacy}
                  </p>
                </form>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
