'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ClipboardList, Copy, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/shared/empty-state'
import { PlayerAvatar } from '@/components/shared/avatars'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { formatBDT, formatDate } from '@/lib/format'
import { CATEGORIES, DEFAULT_CATEGORY_BASE_PRICES, type AuctionMode } from '@/lib/types'

interface Registration {
  id: string
  name: string
  phone: string
  role: string
  previousTeam: string | null
  photoUrl: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

interface RegistrationsData {
  registrationOpen: boolean
  registrationCode: string | null
  registrations: Registration[]
}

/** Public sign-up link + organizer review queue. Approved sign-ups join the player pool. */
export function RegistrationsTab({
  tournamentId,
  tournamentName,
  auctionMode,
  basePrice,
  onPlayersChanged,
}: {
  tournamentId: string
  tournamentName: string
  auctionMode: AuctionMode
  basePrice: number
  onPlayersChanged: () => Promise<void>
}) {
  const [data, setData] = useState<RegistrationsData | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState('C')
  const [price, setPrice] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await apiGet<RegistrationsData>(`/api/tournaments/${tournamentId}/registrations`))
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load registrations')
    }
  }, [tournamentId])

  useEffect(() => {
    void load()
  }, [load])

  const pending = useMemo(() => data?.registrations.filter((r) => r.status === 'PENDING') ?? [], [data])
  const handled = useMemo(() => data?.registrations.filter((r) => r.status !== 'PENDING') ?? [], [data])
  const link = data?.registrationCode ? `${window.location.origin}/register-player/${data.registrationCode}` : ''
  const defaultPrice = auctionMode === 'CATEGORY' ? DEFAULT_CATEGORY_BASE_PRICES[category] : basePrice

  async function setOpen(open: boolean, rotate = false) {
    setBusy(true)
    try {
      await apiPost(`/api/tournaments/${tournamentId}/registrations`, { open, rotate })
      toast.success(rotate ? 'New link created — the old one no longer works' : open ? 'Registration is open' : 'Registration closed')
      await load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update registration')
    } finally {
      setBusy(false)
    }
  }

  async function review(action: 'approve' | 'reject') {
    const ids = [...selected]
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res = await apiPatch<{ approved?: number; rejected?: number }>(`/api/tournaments/${tournamentId}/registrations`, {
        ids,
        action,
        ...(action === 'approve'
          ? { category: auctionMode === 'CATEGORY' ? category : undefined, basePrice: price.trim() || undefined }
          : {}),
      })
      toast.success(action === 'approve' ? `${res.approved} player(s) added to the pool` : `${res.rejected} registration(s) rejected`)
      setSelected(new Set())
      await load()
      if (action === 'approve') await onPlayersChanged()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update registrations')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const copy = () =>
    void navigator.clipboard
      .writeText(link)
      .then(() => toast.success('Registration link copied'))
      .catch(() => toast.error('Could not copy — please copy manually'))

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="registration-open" className="text-base font-bold">
                Player self-registration
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Share a link — players sign up from their phone with name, phone, role and a photo. Nothing reaches the
                auction pool until you approve it.
              </p>
            </div>
            <Switch
              id="registration-open"
              checked={data.registrationOpen}
              disabled={busy}
              onCheckedChange={(v) => void setOpen(v)}
              aria-label="Accept player registrations"
            />
          </div>

          {data.registrationCode ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-10 font-mono text-xs" />
                <Button variant="outline" className="h-10 shrink-0" onClick={copy}>
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden /> Copy
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Register for the ${tournamentName} player auction: ${link}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> Share on WhatsApp
                  </a>
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void setOpen(data.registrationOpen, true)}>
                  <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden /> New link
                </Button>
                {!data.registrationOpen ? (
                  <Badge variant="secondary" className="self-center">Closed — the link shows a “registration closed” page</Badge>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-bold">Waiting for review ({pending.length})</h3>
              <p className="text-sm text-muted-foreground">Select players, set their pricing, then approve.</p>
            </div>
            {pending.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((r) => r.id)))}
              >
                {selected.size === pending.length ? 'Clear selection' : 'Select all'}
              </Button>
            ) : null}
          </div>

          {pending.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No pending registrations"
              description={data.registrationOpen ? 'New sign-ups will appear here.' : 'Open registration and share the link to get sign-ups.'}
            />
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {pending.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--primary)]"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                      <PlayerAvatar name={r.name} photoUrl={r.photoUrl} className="h-10 w-10 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.role} · {r.phone}
                          {r.previousTeam ? ` · ex ${r.previousTeam}` : ''}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{formatDate(r.createdAt, true)}</span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end">
                {auctionMode === 'CATEGORY' ? (
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10 w-full sm:w-36" aria-label="Category for approved players">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            Category {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="approve-price">Base price (৳)</Label>
                  <Input
                    id="approve-price"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={String(defaultPrice)}
                    className="h-10 sm:w-40"
                  />
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  <Button variant="outline" className="h-10" disabled={busy || selected.size === 0} onClick={() => void review('reject')}>
                    <X className="mr-1.5 h-4 w-4" aria-hidden /> Reject
                  </Button>
                  <Button className="h-10" disabled={busy || selected.size === 0} onClick={() => void review('approve')}>
                    {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-1.5 h-4 w-4" aria-hidden />}
                    Approve {selected.size > 0 ? selected.size : ''} at {formatBDT(price.trim() ? parseInt(price, 10) || 0 : defaultPrice)}
                  </Button>
                </div>
              </div>
            </>
          )}

          {handled.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Already reviewed: {handled.filter((r) => r.status === 'APPROVED').length} approved,{' '}
              {handled.filter((r) => r.status === 'REJECTED').length} rejected.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
