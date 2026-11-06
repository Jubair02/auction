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
  rolesForTournament,
  DEFAULT_CATEGORY_BASE_PRICES,
  type AuctionMode,
  type PlayerDTO,
  type PlayerStatus,
  type Sport,
} from '@/lib/types'

import { type Strings, useStrings } from '@/lib/i18n'

const ALL_STATUSES: PlayerStatus[] = ['AVAILABLE', 'LIVE', 'SOLD', 'UNSOLD', 'SKIPPED']

const STRINGS = {
  en: {
    defaultPick: 'Default',
    nameRequired: 'Player name is required.',
    pickRole: 'Pick a role for the player.',
    priceAboveZero: 'Base price must be above ৳0.',
    addedToPool: (name: string) => `${name} added to the pool`,
    couldNotAdd: 'Could not add player',
    playerUpdated: 'Player updated',
    couldNotUpdate: 'Could not update player',
    removed: (name: string) => `${name} removed`,
    deleteFailed: 'Delete failed',
    templateFailed: 'Template download failed',
    searchPlaceholder: 'Search players…',
    searchAria: 'Search players',
    filterCategory: 'Filter by category',
    category: 'Category',
    allCats: 'All cats',
    catShort: (c: string) => `Cat ${c}`,
    filterStatus: 'Filter by status',
    status: 'Status',
    allStatuses: 'All statuses',
    statusLabel: {
      AVAILABLE: 'Available',
      LIVE: 'Live',
      SOLD: 'Sold',
      UNSOLD: 'Unsold',
      SKIPPED: 'Skipped',
    } as Record<PlayerStatus, string>,
    filterRole: 'Filter by role',
    role: 'Role',
    allRoles: 'All roles',
    importCsv: 'Import CSV',
    addPlayer: 'Add player',
    inPool: (n: number) => `${n} players in the pool`,
    shownOf: (shown: number, total: number) => `${shown} of ${total} players shown`,
    noPlayersYet: 'No players yet',
    noMatch: 'No players match these filters',
    emptyHelp: 'Add players one by one, or import a CSV with names, roles and base prices.',
    clearFilters: 'Try clearing the search or filters.',
    colPlayer: 'Player',
    colRole: 'Role',
    colCat: 'Cat',
    colBase: 'Base',
    colStatus: 'Status',
    colSold: 'Sold',
    colActions: 'Actions',
    exTeam: (team: string) => `ex ${team}`,
    editAria: (name: string) => `Edit ${name}`,
    deleteAria: (name: string) => `Delete ${name}`,
    soldNoDelete: 'Sold players can’t be deleted — re-auction them from the room first',
    liveNoDelete: 'This player is on the block right now',
    baseAmount: (amount: string) => `Base ${amount}`,
    soldAmount: (amount: string) => `Sold ${amount}`,
    edit: 'Edit',
    delete: 'Delete',
    addDesc: 'New players join the pool with the next free number.',
    cancel: 'Cancel',
    editTitle: (name: string) => `Edit ${name}`,
    editDesc: 'Players can be edited any time before they go under the hammer.',
    saveChanges: 'Save changes',
    removeTitle: 'Remove player?',
    removeDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'This player'} will be permanently removed from the pool. Players that are live on the block or already sold cannot be deleted.`,
    removing: 'Removing…',
    removePlayer: 'Remove player',
    photoOptional: 'Photo (optional)',
    name: 'Name',
    namePlaceholder: 'e.g. Shakib Hasan',
    roleAria: 'Player role',
    pickRolePlaceholder: 'Pick a role',
    categoryAria: 'Player category',
    categoryN: (c: string) => `Category ${c}`,
    basePrice: 'Base price (৳)',
    lockedPrice: 'Locked — this player is sold. Re-auction them from the room to change the price.',
    phone: 'Phone',
    optional: '(optional)',
    previousTeam: 'Previous team',
    prevPlaceholder: 'e.g. Mirpur Club',
    readFailed: 'Could not read that file',
    pasteFirst: 'Paste CSV text or choose a file first.',
    imported: (n: number) => `Imported ${n} player${n === 1 ? '' : 's'}`,
    nothingImported: 'Nothing imported — check the errors below.',
    importFailed: 'Import failed',
    bulkTitle: 'Bulk import players',
    bulkDesc: 'Paste CSV text or upload a .csv file. Headers:',
    downloadTemplate: 'Download CSV template',
    uploadFile: 'Upload file',
    orPaste: '…or paste CSV',
    created: (n: number) => `Created ${n} players`,
    rowsSkipped: (n: number) => `${n} row(s) skipped:`,
    rowError: (row: number, error: string) => `Row ${row}: ${error}`,
    close: 'Close',
    importPlayers: 'Import players',
  },
  bn: {
    defaultPick: 'ডিফল্ট',
    nameRequired: 'খেলোয়াড়ের নাম দিতে হবে।',
    pickRole: 'খেলোয়াড়ের রোল বেছে নিন।',
    priceAboveZero: 'বেস প্রাইস ৳0-এর বেশি হতে হবে।',
    addedToPool: (name: string) => `${name} পুলে যোগ হয়েছে`,
    couldNotAdd: 'খেলোয়াড় যোগ করা যায়নি',
    playerUpdated: 'খেলোয়াড়ের তথ্য আপডেট হয়েছে',
    couldNotUpdate: 'খেলোয়াড়ের তথ্য আপডেট করা যায়নি',
    removed: (name: string) => `${name} বাদ দেওয়া হয়েছে`,
    deleteFailed: 'মুছে ফেলা যায়নি',
    templateFailed: 'টেমপ্লেট ডাউনলোড করা যায়নি',
    searchPlaceholder: 'খেলোয়াড় খুঁজুন…',
    searchAria: 'খেলোয়াড় খুঁজুন',
    filterCategory: 'ক্যাটাগরি দিয়ে ফিল্টার',
    category: 'ক্যাটাগরি',
    allCats: 'সব ক্যাটাগরি',
    catShort: (c: string) => `ক্যাট ${c}`,
    filterStatus: 'স্ট্যাটাস দিয়ে ফিল্টার',
    status: 'স্ট্যাটাস',
    allStatuses: 'সব স্ট্যাটাস',
    statusLabel: {
      AVAILABLE: 'উপলব্ধ',
      LIVE: 'লাইভ',
      SOLD: 'বিক্রি',
      UNSOLD: 'অবিক্রিত',
      SKIPPED: 'বাদ',
    } as Record<PlayerStatus, string>,
    filterRole: 'রোল দিয়ে ফিল্টার',
    role: 'রোল',
    allRoles: 'সব রোল',
    importCsv: 'CSV ইমপোর্ট',
    addPlayer: 'খেলোয়াড় যোগ করুন',
    inPool: (n: number) => `পুলে ${n} জন খেলোয়াড়`,
    shownOf: (shown: number, total: number) => `${total} জনের মধ্যে ${shown} জন দেখানো হচ্ছে`,
    noPlayersYet: 'এখনো কোনো খেলোয়াড় নেই',
    noMatch: 'এই ফিল্টারে কোনো খেলোয়াড় নেই',
    emptyHelp: 'একজন একজন করে খেলোয়াড় যোগ করুন, অথবা নাম, রোল ও বেস প্রাইসসহ একটি CSV ইমপোর্ট করুন।',
    clearFilters: 'সার্চ বা ফিল্টার মুছে আবার দেখুন।',
    colPlayer: 'খেলোয়াড়',
    colRole: 'রোল',
    colCat: 'ক্যাট',
    colBase: 'বেস',
    colStatus: 'স্ট্যাটাস',
    colSold: 'বিক্রি',
    colActions: 'অ্যাকশন',
    exTeam: (team: string) => `সাবেক ${team}`,
    editAria: (name: string) => `${name} সম্পাদনা`,
    deleteAria: (name: string) => `${name} মুছুন`,
    soldNoDelete: 'বিক্রি হওয়া খেলোয়াড় মোছা যায় না — আগে রুম থেকে পুনরায় নিলাম করুন',
    liveNoDelete: 'এই খেলোয়াড় এখন নিলামে আছে',
    baseAmount: (amount: string) => `বেস ${amount}`,
    soldAmount: (amount: string) => `বিক্রি ${amount}`,
    edit: 'সম্পাদনা',
    delete: 'মুছুন',
    addDesc: 'নতুন খেলোয়াড় পরের খালি নম্বর নিয়ে পুলে যোগ হবে।',
    cancel: 'বাতিল',
    editTitle: (name: string) => `${name} সম্পাদনা`,
    editDesc: 'নিলামে ওঠার আগে যেকোনো সময় খেলোয়াড়ের তথ্য বদলানো যায়।',
    saveChanges: 'পরিবর্তন সংরক্ষণ',
    removeTitle: 'খেলোয়াড় বাদ দেবেন?',
    removeDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'এই খেলোয়াড়'} পুল থেকে স্থায়ীভাবে মুছে যাবে। নিলামে থাকা বা বিক্রি হয়ে যাওয়া খেলোয়াড় মোছা যায় না।`,
    removing: 'বাদ দেওয়া হচ্ছে…',
    removePlayer: 'খেলোয়াড় বাদ দিন',
    photoOptional: 'ছবি (ঐচ্ছিক)',
    name: 'নাম',
    namePlaceholder: 'যেমন: Shakib Hasan',
    roleAria: 'খেলোয়াড়ের রোল',
    pickRolePlaceholder: 'রোল বেছে নিন',
    categoryAria: 'খেলোয়াড়ের ক্যাটাগরি',
    categoryN: (c: string) => `ক্যাটাগরি ${c}`,
    basePrice: 'বেস প্রাইস (৳)',
    lockedPrice: 'লক করা — এই খেলোয়াড় বিক্রি হয়ে গেছে। দাম বদলাতে রুম থেকে পুনরায় নিলাম করুন।',
    phone: 'ফোন',
    optional: '(ঐচ্ছিক)',
    previousTeam: 'আগের দল',
    prevPlaceholder: 'যেমন: Mirpur Club',
    readFailed: 'ফাইলটি পড়া যায়নি',
    pasteFirst: 'আগে CSV লেখা পেস্ট করুন বা একটি ফাইল বেছে নিন।',
    imported: (n: number) => `${n} জন খেলোয়াড় ইমপোর্ট হয়েছে`,
    nothingImported: 'কিছুই ইমপোর্ট হয়নি — নিচের ত্রুটিগুলো দেখুন।',
    importFailed: 'ইমপোর্ট করা যায়নি',
    bulkTitle: 'একসাথে খেলোয়াড় ইমপোর্ট',
    bulkDesc: 'CSV লেখা পেস্ট করুন বা একটি .csv ফাইল আপলোড করুন। কলামের নাম:',
    downloadTemplate: 'CSV টেমপ্লেট ডাউনলোড',
    uploadFile: 'ফাইল আপলোড',
    orPaste: '…অথবা CSV পেস্ট করুন',
    created: (n: number) => `${n} জন খেলোয়াড় তৈরি হয়েছে`,
    rowsSkipped: (n: number) => `${n}টি সারি বাদ পড়েছে:`,
    rowError: (row: number, error: string) => `সারি ${row}: ${error}`,
    close: 'বন্ধ করুন',
    importPlayers: 'খেলোয়াড় ইমপোর্ট করুন',
  },
} satisfies Strings<{
  defaultPick: string
  nameRequired: string
  pickRole: string
  priceAboveZero: string
  addedToPool: (name: string) => string
  couldNotAdd: string
  playerUpdated: string
  couldNotUpdate: string
  removed: (name: string) => string
  deleteFailed: string
  templateFailed: string
  searchPlaceholder: string
  searchAria: string
  filterCategory: string
  category: string
  allCats: string
  catShort: (c: string) => string
  filterStatus: string
  status: string
  allStatuses: string
  statusLabel: Record<PlayerStatus, string>
  filterRole: string
  role: string
  allRoles: string
  importCsv: string
  addPlayer: string
  inPool: (n: number) => string
  shownOf: (shown: number, total: number) => string
  noPlayersYet: string
  noMatch: string
  emptyHelp: string
  clearFilters: string
  colPlayer: string
  colRole: string
  colCat: string
  colBase: string
  colStatus: string
  colSold: string
  colActions: string
  exTeam: (team: string) => string
  editAria: (name: string) => string
  deleteAria: (name: string) => string
  soldNoDelete: string
  liveNoDelete: string
  baseAmount: (amount: string) => string
  soldAmount: (amount: string) => string
  edit: string
  delete: string
  addDesc: string
  cancel: string
  editTitle: (name: string) => string
  editDesc: string
  saveChanges: string
  removeTitle: string
  removeDesc: (name: string | null) => string
  removing: string
  removePlayer: string
  photoOptional: string
  name: string
  namePlaceholder: string
  roleAria: string
  pickRolePlaceholder: string
  categoryAria: string
  categoryN: (c: string) => string
  basePrice: string
  lockedPrice: string
  phone: string
  optional: string
  previousTeam: string
  prevPlaceholder: string
  readFailed: string
  pasteFirst: string
  imported: (n: number) => string
  nothingImported: string
  importFailed: string
  bulkTitle: string
  bulkDesc: string
  downloadTemplate: string
  uploadFile: string
  orPaste: string
  created: (n: number) => string
  rowsSkipped: (n: number) => string
  rowError: (row: number, error: string) => string
  close: string
  importPlayers: string
}>

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
  playerRoles,
  auctionMode,
  basePrice,
  players,
  refetch,
  loading,
}: {
  tournamentId: string
  sport: Sport
  /** An "Others" tournament's own roles (empty → the sport's defaults). */
  playerRoles?: string[]
  auctionMode: AuctionMode
  basePrice: number
  players: PlayerDTO[]
  refetch: () => Promise<void>
  loading: boolean
}) {
  const t = useStrings(STRINGS)
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

  const roles = rolesForTournament({ sport, playerRoles })

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
      : [{ label: t.defaultPick, value: basePrice || 5000 }]

  const setPrice = (v: number) => setForm((f) => ({ ...f, basePrice: String(v) }))

  const addPlayer = async () => {
    if (form.name.trim().length < 2) return toast.error(t.nameRequired)
    if (!form.role) return toast.error(t.pickRole)
    const price = parseInt(form.basePrice, 10)
    if (!Number.isFinite(price) || price <= 0) return toast.error(t.priceAboveZero)

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
      toast.success(t.addedToPool(form.name.trim()))
      setAddOpen(false)
      setForm(emptyForm(auctionMode, basePrice))
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotAdd)
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
    if (editForm.name.trim().length < 2) return toast.error(t.nameRequired)
    if (!editForm.role) return toast.error(t.pickRole)
    const price = parseInt(editForm.basePrice, 10)
    if (editTarget.status !== 'SOLD' && (!Number.isFinite(price) || price <= 0)) {
      return toast.error(t.priceAboveZero)
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
      toast.success(t.playerUpdated)
      setEditTarget(null)
      setEditForm(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotUpdate)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/players/${deleteTarget.id}`)
      toast.success(t.removed(deleteTarget.name))
      setDeleteTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      await apiDownload(`/api/tournaments/${tournamentId}/export?type=template`, 'neelamghor-players-template.csv')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.templateFailed)
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
              placeholder={t.searchPlaceholder}
              aria-label={t.searchAria}
              className="h-10 pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            {auctionMode === 'CATEGORY' ? (
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger size="sm" className="h-10 w-full lg:w-28" aria-label={t.filterCategory}>
                  <SelectValue placeholder={t.category} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.allCats}</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t.catShort(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="h-10 w-full lg:w-32" aria-label={t.filterStatus}>
                <SelectValue placeholder={t.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.allStatuses}</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.statusLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger size="sm" className="h-10 w-full lg:w-36" aria-label={t.filterRole}>
                <SelectValue placeholder={t.role} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.allRoles}</SelectItem>
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
              <Upload className="mr-1.5 h-4 w-4" aria-hidden /> {t.importCsv}
            </Button>
            <Button className="min-h-10 flex-1 lg:flex-none" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t.addPlayer}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length === players.length
            ? t.inPool(players.length)
            : t.shownOf(filtered.length, players.length)}
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
            <p className="font-semibold">{players.length === 0 ? t.noPlayersYet : t.noMatch}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {players.length === 0
                ? t.emptyHelp
                : t.clearFilters}
            </p>
            {players.length === 0 ? (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <FileUp className="mr-1.5 h-4 w-4" aria-hidden /> {t.importCsv}
                </Button>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t.addPlayer}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table — scrolls with the page; the header sticks under the site header.
              A plain <table>: the shared Table's overflow wrapper would stop the header sticking. */}
          <div className="hidden rounded-lg border lg:block">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-14 z-10 bg-background shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{t.colPlayer}</TableHead>
                  <TableHead>{t.colRole}</TableHead>
                  {auctionMode === 'CATEGORY' ? <TableHead>{t.colCat}</TableHead> : null}
                  <TableHead>{t.colBase}</TableHead>
                  <TableHead>{t.colStatus}</TableHead>
                  <TableHead>{t.colSold}</TableHead>
                  <TableHead className="w-20 text-right">{t.colActions}</TableHead>
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
                            <p className="truncate text-xs text-muted-foreground">{t.exTeam(p.previousTeam)}</p>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t.editAria(p.name)} onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-600 hover:text-rose-700"
                          aria-label={t.deleteAria(p.name)}
                          // Sold players and the one on the block can't be deleted (server-enforced).
                          disabled={p.status === 'SOLD' || p.status === 'LIVE'}
                          title={
                            p.status === 'SOLD'
                              ? t.soldNoDelete
                              : p.status === 'LIVE'
                                ? t.liveNoDelete
                                : undefined
                          }
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>

          {/* Phone & tablet cards */}
          <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
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
                      {p.category ? <Badge variant="secondary" className="px-1.5 py-0">{t.catShort(p.category)}</Badge> : null}
                      <span>{t.baseAmount(formatBDT(p.basePrice))}</span>
                      {p.status === 'SOLD' ? (
                        <span className="font-semibold text-teal-700">
                          {t.soldAmount(formatBDT(p.soldPrice))}{p.soldToTeamName ? ` · ${p.soldToTeamName}` : ''}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => openEdit(p)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden /> {t.edit}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 text-rose-600 hover:text-rose-700"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> {t.delete}
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
            <DialogTitle>{t.addPlayer}</DialogTitle>
            <DialogDescription>{t.addDesc}</DialogDescription>
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
              {t.cancel}
            </Button>
            <Button onClick={() => void addPlayer()} disabled={saving} className="min-h-10">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
              {t.addPlayer}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Edit dialog ---------------- */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.editTitle(editTarget?.name ?? '')}</DialogTitle>
            <DialogDescription>{t.editDesc}</DialogDescription>
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
              {t.cancel}
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving} className="min-h-10">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Delete confirm ---------------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.removeDesc(deleteTarget?.name ?? null)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? t.removing : t.removePlayer}
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
  const t = useStrings(STRINGS)
  const set = (patch: Partial<PlayerFormState>) => onChange({ ...form, ...patch })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ImageUpload
        className="sm:col-span-2"
        label={t.photoOptional}
        kind="PHOTO"
        value={form.photoUrl}
        onChange={(url) => set({ photoUrl: url })}
      />

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="p-name">
          {t.name} <span className="text-rose-600">*</span>
        </Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t.namePlaceholder}
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t.role}</Label>
        <Select value={form.role} onValueChange={(v) => set({ role: v })}>
          <SelectTrigger className="h-10 w-full" aria-label={t.roleAria}>
            <SelectValue placeholder={t.pickRolePlaceholder} />
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
          <Label>{t.category}</Label>
          <Select value={form.category} onValueChange={(v) => set({ category: v })} disabled={pricingLocked}>
            <SelectTrigger className="h-10 w-full" aria-label={t.categoryAria}>
              <SelectValue placeholder={t.category} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t.categoryN(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="p-base">{t.basePrice}</Label>
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
            {t.lockedPrice}
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
          {t.phone} <span className="font-normal text-muted-foreground">{t.optional}</span>
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
          {t.previousTeam} <span className="font-normal text-muted-foreground">{t.optional}</span>
        </Label>
        <Input
          id="p-prev"
          value={form.previousTeam}
          onChange={(e) => set({ previousTeam: e.target.value })}
          placeholder={t.prevPlaceholder}
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
  const t = useStrings(STRINGS)
  const [csv, setCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null)

  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ''))
    reader.onerror = () => toast.error(t.readFailed)
    reader.readAsText(file)
  }

  const runImport = async () => {
    if (!csv.trim()) return toast.error(t.pasteFirst)
    setImporting(true)
    setResult(null)
    try {
      const res = await apiPost<{ created: number; errors: { row: number; error: string }[] }>(
        `/api/tournaments/${tournamentId}/players/import`,
        { csv },
      )
      setResult(res)
      if (res.created > 0) {
        toast.success(t.imported(res.created))
        await refetch()
        setCsv('')
      } else {
        toast.error(t.nothingImported)
      }
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.importFailed)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.bulkTitle}</DialogTitle>
          <DialogDescription>
            {t.bulkDesc} <code className="rounded bg-muted px-1">Name, Phone, Role, Category, Base Price, Previous Team</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            type="button"
            onClick={templateDownload}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Download className="h-4 w-4" aria-hidden /> {t.downloadTemplate}
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="csv-file">{t.uploadFile}</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="h-11 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="csv-text">{t.orPaste}</Label>
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
              <p className="font-semibold text-emerald-700">{t.created(result.created)}</p>
              {result.errors.length > 0 ? (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  <p className="text-xs font-semibold text-rose-700">{t.rowsSkipped(result.errors.length)}</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {t.rowError(e.row, e.error)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t.close}
          </Button>
          <Button onClick={() => void runImport()} disabled={importing} className="min-h-10">
            {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-4 w-4" aria-hidden />}
            {t.importPlayers}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
