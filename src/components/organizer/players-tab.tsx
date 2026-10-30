'use client'

import { useMemo, useState } from 'react'
import {
  Download,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ImageUpload } from '@/components/shared/image-upload'
import { PlayerAvatar } from '@/components/shared/avatars'
import { PlayerStatusBadge } from '@/components/shared/status-badges'
import { apiDelete, apiDownload, apiPatch, apiPost, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'
import {
  CATEGORIES,
  CRICKET_ROLES,
  DEFAULT_CATEGORY_BASE_PRICES,
  FOOTBALL_ROLES,
  type AuctionMode,
  type PlayerDTO,
  type PlayerStatus,
  type Sport,
} from '@/lib/types'

const ALL_STATUSES: PlayerStatus[] = ['AVAILABLE', 'LIVE', 'SOLD', 'UNSOLD', 'SKIPPED']

function rolesFor(sport: Sport): readonly string[] {
  return sport === 'FOOTBALL' ? FOOTBALL_ROLES : CRICKET_ROLES
}

interface PlayerFormState {
  name: string
  phone: string
  role: string
  category: string
  basePrice: string
  previousTeam: string
  photoUrl: string | null
}

function emptyForm(mode: AuctionMode, basePrice: number): PlayerFormState {
  return {
    name: '',
    phone: '',
    role: '',
    category: mode === 'CATEGORY' ? 'A' : '',
    basePrice: String(mode === 'CATEGORY' ? DEFAULT_CATEGORY_BASE_PRICES.A : basePrice || 5000),
    previousTeam: '',
    photoUrl: null,
  }
}

export function PlayersTab({
  tournamentId,
  sport,
  auctionMode,
  basePrice,
  players,
  refetch,
  loading,
}: {
  tournamentId: string
  sport: Sport
  auctionMode: AuctionMode
  basePrice: number
  players: PlayerDTO[]
  refetch: () => Promise<void>
  loading: boolean
}) {
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')

  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<PlayerFormState>(() => emptyForm(auctionMode, basePrice))

  const [editTarget, setEditTarget] = useState<PlayerDTO | null>(null)
  const [editForm, setEditForm] = useState<PlayerFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlayerDTO | null>(null)
  const [deleting, setDeleting] = useState(false)

  const roles = rolesFor(sport)

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false
      if (catFilter !== 'ALL' && p.category !== catFilter) return false
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (roleFilter !== 'ALL' && p.role !== roleFilter) return false
      return true
    })
  }, [players, query, catFilter, statusFilter, roleFilter])

  const quickPicks =
    auctionMode === 'CATEGORY'
      ? Object.entries(DEFAULT_CATEGORY_BASE_PRICES).map(([cat, v]) => ({ label: cat, value: v }))
      : [{ label: 'Default', value: basePrice || 5000 }]

  const setPrice = (v: number) => setForm((f) => ({ ...f, basePrice: String(v) }))

  const addPlayer = async () => {
    if (form.name.trim().length < 2) return toast.error('Player name is required.')
    if (!form.role) return toast.error('Pick a role for the player.')
    const price = parseInt(form.basePrice, 10)
    if (!Number.isFinite(price) || price <= 0) return toast.error('Base price must be above ৳0.')

    setSaving(true)
    try {
      await apiPost(`/api/tournaments/${tournamentId}/players`, {
        players: [
          {
            name: form.name.trim(),
            phone: form.phone.trim() || undefined,
            role: form.role,
            category: auctionMode === 'CATEGORY' ? form.category : undefined,
            basePrice: price,
            previousTeam: form.previousTeam.trim() || undefined,
            photoUrl: form.photoUrl ?? undefined,
          },
        ],
      })
      toast.success(`${form.name.trim()} added to the pool`)
      setAddOpen(false)
      setForm(emptyForm(auctionMode, basePrice))
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not add player')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (p: PlayerDTO) => {
    setEditTarget(p)
    setEditForm({
      name: p.name,
      phone: p.phone ?? '',
      role: p.role,
      category: p.category ?? '',
      basePrice: String(p.basePrice),
      previousTeam: p.previousTeam ?? '',
      photoUrl: p.photoUrl,
    })
  }

  const saveEdit = async () => {
    if (!editTarget || !editForm) return
    if (editForm.name.trim().length < 2) return toast.error('Player name is required.')
    if (!editForm.role) return toast.error('Pick a role for the player.')
    const price = parseInt(editForm.basePrice, 10)
    if (editTarget.status !== 'SOLD' && (!Number.isFinite(price) || price <= 0)) {
      return toast.error('Base price must be above ৳0.')
    }

    // A sold player's price/category are locked in by the sale — re-auction to change them.
    const sold = editTarget.status === 'SOLD'

    setSaving(true)
    try {
      await apiPatch(`/api/players/${editTarget.id}`, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        previousTeam: editForm.previousTeam.trim() || null,
        photoUrl: editForm.photoUrl,
        ...(sold
          ? {}
          : {
              category: auctionMode === 'CATEGORY' ? editForm.category : null,
              basePrice: price,
            }),
      })
      toast.success('Player updated')
      setEditTarget(null)
      setEditForm(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update player')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/players/${deleteTarget.id}`)
      toast.success(`${deleteTarget.name} removed`)
      setDeleteTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      await apiDownload(`/api/tournaments/${tournamentId}/export?type=template`, 'neelamghor-players-template.csv')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Template download failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players…"
              aria-label="Search players"
              className="h-10 pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            {auctionMode === 'CATEGORY' ? (
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger size="sm" className="h-10 w-full lg:w-28" aria-label="Filter by category">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All cats</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      Cat {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="h-10 w-full lg:w-32" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger size="sm" className="h-10 w-full lg:w-36" aria-label="Filter by role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 lg:ml-auto">
            <Button variant="outline" className="min-h-10 flex-1 lg:flex-none" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Import CSV
            </Button>
            <Button className="min-h-10 flex-1 lg:flex-none" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add player
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length === players.length
            ? `${players.length} players in the pool`
            : `${filtered.length} of ${players.length} players shown`}
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="font-semibold">{players.length === 0 ? 'No players yet' : 'No players match these filters'}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {players.length === 0
                ? 'Add players one by one, or import a CSV with names, roles and base prices.'
                : 'Try clearing the search or filters.'}
            </p>
            {players.length === 0 ? (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <FileUp className="mr-1.5 h-4 w-4" aria-hidden /> Import CSV
                </Button>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add player
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden max-h-96 overflow-y-auto rounded-lg border md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Role</TableHead>
                  {auctionMode === 'CATEGORY' ? <TableHead>Cat</TableHead> : null}
                  <TableHead>Base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums text-muted-foreground">{p.playerNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-8 w-8" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{p.name}</p>
                          {p.previousTeam ? (
                            <p className="truncate text-xs text-muted-foreground">ex {p.previousTeam}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.role}</TableCell>
                    {auctionMode === 'CATEGORY' ? (
                      <TableCell>
                        {p.category ? <Badge variant="secondary">{p.category}</Badge> : <span>—</span>}
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-nowrap tabular-nums">{formatBDT(p.basePrice)}</TableCell>
                    <TableCell>
                      <PlayerStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {p.status === 'SOLD' ? (
                        <span>
                          <span className="font-semibold tabular-nums">{formatBDT(p.soldPrice)}</span>
                          {p.soldToTeamName ? <span className="text-muted-foreground"> · {p.soldToTeamName}</span> : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:text-rose-700"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="max-h-96 space-y-2 overflow-y-auto pr-0.5 md:hidden">
            {filtered.map((p) => (
              <Card key={p.id} className="py-0">
                <CardContent className="flex items-start gap-3 p-3">
                  <PlayerAvatar name={p.name} photoUrl={p.photoUrl} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">
                        <span className="mr-1 text-xs text-muted-foreground">#{p.playerNumber}</span>
                        {p.name}
                      </p>
                      <PlayerStatusBadge status={p.status} />
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{p.role}</span>
                      {p.category ? <Badge variant="secondary" className="px-1.5 py-0">Cat {p.category}</Badge> : null}
                      <span>Base {formatBDT(p.basePrice)}</span>
                      {p.status === 'SOLD' ? (
                        <span className="font-semibold text-teal-700">
                          Sold {formatBDT(p.soldPrice)}{p.soldToTeamName ? ` · ${p.soldToTeamName}` : ''}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 text-rose-600 hover:text-rose-700"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ---------------- Add dialog ---------------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add player</DialogTitle>
            <DialogDescription>New players join the pool with the next free number.</DialogDescription>
          </DialogHeader>
          <PlayerFormFields
            form={form}
            onChange={setForm}
            roles={roles}
            auctionMode={auctionMode}
            quickPicks={quickPicks}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void addPlayer()} disabled={saving} className="min-h-10">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
              Add player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Edit dialog ---------------- */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.name}</DialogTitle>
            <DialogDescription>Players can be edited any time before they go under the hammer.</DialogDescription>
          </DialogHeader>
          {editForm ? (
            <PlayerFormFields
              form={editForm}
              onChange={setEditForm}
              roles={roles}
              auctionMode={auctionMode}
              quickPicks={quickPicks}
              pricingLocked={editTarget?.status === 'SOLD'}
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving} className="min-h-10">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Delete confirm ---------------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove player?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}"` : 'This player'} will be permanently removed from the pool.
              Players that are live on the block or already sold cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? 'Removing…' : 'Remove player'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------------- Import dialog ---------------- */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tournamentId={tournamentId}
        templateDownload={() => void downloadTemplate()}
        refetch={refetch}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PlayerFormFields({
  form,
  onChange,
  roles,
  auctionMode,
  quickPicks,
  pricingLocked = false,
}: {
  form: PlayerFormState
  onChange: (f: PlayerFormState) => void
  roles: readonly string[]
  auctionMode: AuctionMode
  quickPicks: { label: string; value: number }[]
  /** true for a SOLD player — base price and category are settled by the sale */
  pricingLocked?: boolean
}) {
  const set = (patch: Partial<PlayerFormState>) => onChange({ ...form, ...patch })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ImageUpload
        className="sm:col-span-2"
        label="Photo (optional)"
        kind="PHOTO"
        value={form.photoUrl}
        onChange={(url) => set({ photoUrl: url })}
      />

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-name">
          Name <span className="text-rose-600">*</span>
        </Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Shakib Hasan"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={form.role} onValueChange={(v) => set({ role: v })}>
          <SelectTrigger className="h-10 w-full" aria-label="Player role">
            <SelectValue placeholder="Pick a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auctionMode === 'CATEGORY' ? (
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => set({ category: v })} disabled={pricingLocked}>
            <SelectTrigger className="h-10 w-full" aria-label="Player category">
              <SelectValue placeholder="Category" />
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
        <Label htmlFor="p-base">Base price (৳)</Label>
        <Input
          id="p-base"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.basePrice}
          onChange={(e) => set({ basePrice: e.target.value })}
          disabled={pricingLocked}
          className="h-10"
        />
        {pricingLocked ? (
          <p className="pt-0.5 text-xs text-muted-foreground">
            Locked — this player is sold. Re-auction them from the room to change the price.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {quickPicks.map((q) => (
              <Button
                key={q.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => set({ basePrice: String(q.value) })}
              >
                {q.label} · {formatBDT(q.value)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-phone">
          Phone <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="p-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => set({ phone: e.target.value })}
          placeholder="01XXXXXXXXX"
          className="h-10"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-prev">
          Previous team <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="p-prev"
          value={form.previousTeam}
          onChange={(e) => set({ previousTeam: e.target.value })}
          placeholder="e.g. Mirpur Club"
          className="h-10"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ImportDialog({
  open,
  onOpenChange,
  tournamentId,
  templateDownload,
  refetch,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  templateDownload: () => void
  refetch: () => Promise<void>
}) {
  const [csv, setCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null)

  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ''))
    reader.onerror = () => toast.error('Could not read that file')
    reader.readAsText(file)
  }

  const runImport = async () => {
    if (!csv.trim()) return toast.error('Paste CSV text or choose a file first.')
    setImporting(true)
    setResult(null)
    try {
      const res = await apiPost<{ created: number; errors: { row: number; error: string }[] }>(
        `/api/tournaments/${tournamentId}/players/import`,
        { csv },
      )
      setResult(res)
      if (res.created > 0) {
        toast.success(`Imported ${res.created} player${res.created === 1 ? '' : 's'}`)
        await refetch()
        setCsv('')
      } else {
        toast.error('Nothing imported — check the errors below.')
      }
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk import players</DialogTitle>
          <DialogDescription>
            Paste CSV text or upload a .csv file. Headers: <code className="rounded bg-muted px-1">Name, Phone, Role, Category, Base Price, Previous Team</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={templateDownload}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Download className="h-4 w-4" aria-hidden /> Download CSV template
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="csv-file">Upload file</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="h-11 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="csv-text">…or paste CSV</Label>
            <Textarea
              id="csv-text"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={6}
              placeholder={'Name,Phone,Role,Category,Base Price,Previous Team\nShakib Hasan,01712345678,Batsman,A,50000,Mirpur Club'}
              className="font-mono text-xs"
            />
          </div>

          {result ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-semibold text-emerald-700">Created {result.created} players</p>
              {result.errors.length > 0 ? (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  <p className="text-xs font-semibold text-rose-700">{result.errors.length} row(s) skipped:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Row {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Close
          </Button>
          <Button onClick={() => void runImport()} disabled={importing} className="min-h-10">
            {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-4 w-4" aria-hidden />}
            Import players
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
