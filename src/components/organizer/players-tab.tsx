'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { UpgradeDialog } from '@/components/organizer/upgrade-dialog'
import { apiDelete, apiDownload, apiPatch, apiPost, ApiError } from '@/lib/api'
import { useCachedGet } from '@/lib/api-cache'
import {
  rolesForTournament,
  DEFAULT_CATEGORY_BASE_PRICES,
  type AuctionMode,
  type Plan,
  type PlayerDTO,
  type Sport,
} from '@/lib/types'

import { type Strings, useStrings } from '@/lib/i18n'
import { emptyForm, type PlayerFormState } from './players-tab/player-form'
import { PlayersToolbar } from './players-tab/players-toolbar'
import { PlayersList } from './players-tab/players-list'
import { AddPlayerDialog, DeletePlayerDialog, EditPlayerDialog } from './players-tab/player-dialogs'
import { ImportDialog } from './players-tab/import-dialog'
import { SHARED_STRINGS, type SharedPlayersStrings } from './players-tab/strings'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
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
  },
  bn: {
    ...SHARED_STRINGS.bn,
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
  },
} satisfies Strings<
  SharedPlayersStrings & {
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
  }
>

export function PlayersTab({
  tournamentId,
  sport,
  playerRoles,
  auctionMode,
  basePrice,
  players,
  refetch,
  loading,
  readOnly = false,
  plan = 'PRO',
  canUpgrade = false,
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
  /** Auctioneers: browse the pool, no add / edit / delete / import. */
  readOnly?: boolean
  plan?: Plan
  /** Owner/ADMIN: may open the Pro upgrade dialog (billing). */
  canUpgrade?: boolean
}) {
  const t = useStrings(STRINGS)
  const { data: plans } = useCachedGet<{ freeMaxPlayers: number }>('/api/plans')
  const freeMax = plan === 'FREE' && plans?.freeMaxPlayers ? plans.freeMaxPlayers : null
  const [upgradeOpen, setUpgradeOpen] = useState(false)
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
      const overPlan = ex instanceof ApiError && ex.status === 402
      toast.error(ex instanceof ApiError ? ex.message : t.couldNotAdd, {
        description: overPlan ? (canUpgrade ? t.upgradeHint : t.upgradeAskOwner) : undefined,
        action: overPlan && canUpgrade ? { label: t.upgrade, onClick: () => setUpgradeOpen(true) } : undefined,
      })
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
      <PlayersToolbar
        query={query}
        setQuery={setQuery}
        catFilter={catFilter}
        setCatFilter={setCatFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        auctionMode={auctionMode}
        roles={roles}
        readOnly={readOnly}
        shownCount={filtered.length}
        totalCount={players.length}
        freeMax={freeMax}
        canUpgrade={canUpgrade}
        onImport={() => setImportOpen(true)}
        onAdd={() => setAddOpen(true)}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      {/* List */}
      <PlayersList
        loading={loading}
        players={players}
        filtered={filtered}
        auctionMode={auctionMode}
        readOnly={readOnly}
        onImport={() => setImportOpen(true)}
        onAdd={() => setAddOpen(true)}
        onEdit={openEdit}
        onDelete={(p) => setDeleteTarget(p)}
      />

      {/* ---------------- Add dialog ---------------- */}
      <AddPlayerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        form={form}
        onChange={setForm}
        saving={saving}
        onSubmit={() => void addPlayer()}
        roles={roles}
        auctionMode={auctionMode}
        quickPicks={quickPicks}
      />

      {/* ---------------- Edit dialog ---------------- */}
      <EditPlayerDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        form={editForm}
        onChange={setEditForm}
        saving={saving}
        onSubmit={() => void saveEdit()}
        roles={roles}
        auctionMode={auctionMode}
        quickPicks={quickPicks}
      />

      {/* ---------------- Delete confirm ---------------- */}
      <DeletePlayerDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        deleting={deleting}
        onConfirm={() => void confirmDelete()}
      />

      {/* ---------------- Import dialog ---------------- */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tournamentId={tournamentId}
        templateDownload={() => void downloadTemplate()}
        refetch={refetch}
        onUpgrade={
          canUpgrade
            ? () => {
                setImportOpen(false)
                setUpgradeOpen(true)
              }
            : undefined
        }
      />

      {canUpgrade ? (
        <UpgradeDialog tournamentId={tournamentId} open={upgradeOpen} onOpenChange={setUpgradeOpen} onSubmitted={() => void refetch()} />
      ) : null}
    </div>
  )
}
