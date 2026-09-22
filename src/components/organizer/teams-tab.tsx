'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Crown, Loader2, Pencil, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TeamAvatar } from '@/components/shared/avatars'
import { EmptyState } from '@/components/shared/empty-state'
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'
import { TEAM_PALETTE } from '@/lib/format'
import type { TeamDTO } from '@/lib/types'

interface TeamFormState {
  name: string
  color: string
  captainName: string
  budget: string
  maxSquad: string
  minSquad: string
}

interface ManagerOption {
  id: string
  name: string
  email: string
}

/** Sentinel for the "no manager" option — Radix Select forbids an empty value. */
const NO_MANAGER = '__none__'

export function TeamsTab({
  tournamentId,
  teams,
  refetch,
  loading,
}: {
  tournamentId: string
  teams: TeamDTO[]
  refetch: () => Promise<void>
  loading: boolean
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamDTO | null>(null)
  const [editForm, setEditForm] = useState<TeamFormState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamDTO | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [managers, setManagers] = useState<ManagerOption[] | null>(null)
  const [editManagerId, setEditManagerId] = useState<string>(NO_MANAGER)

  const loadManagers = useCallback(async () => {
    try {
      const res = await apiGet<{ managers: ManagerOption[] }>('/api/users/managers')
      setManagers(res.managers)
    } catch {
      setManagers([])
    }
  }, [])

  useEffect(() => {
    if (editTarget && managers === null) void loadManagers()
  }, [editTarget, managers, loadManagers])

  // Suggest a palette color not already used by an existing team.
  const suggestedColor = useMemo(() => {
    const used = new Set(teams.map((t) => t.color))
    return TEAM_PALETTE.find((c) => !used.has(c)) ?? TEAM_PALETTE[teams.length % TEAM_PALETTE.length]
  }, [teams])

  const validate = (f: TeamFormState): string | null => {
    if (f.name.trim().length < 2) return 'Team name must be at least 2 characters.'
    const budget = parseInt(f.budget, 10)
    if (!Number.isFinite(budget) || budget <= 0) return 'Budget must be above ৳0.'
    const max = parseInt(f.maxSquad, 10)
    const min = parseInt(f.minSquad, 10)
    if (!Number.isFinite(max) || max <= 0) return 'Max squad size must be at least 1.'
    if (!Number.isFinite(min) || min < 0) return 'Min squad size cannot be negative.'
    if (min > max) return 'Min squad size cannot exceed max squad size.'
    return null
  }

  const addTeam = async (f: TeamFormState) => {
    const err = validate(f)
    if (err) {
      toast.error(err)
      return
    }
    setSaving(true)
    try {
      await apiPost(`/api/tournaments/${tournamentId}/teams`, {
        teams: [
          {
            name: f.name.trim(),
            color: f.color || undefined,
            captainName: f.captainName.trim() || undefined,
            budget: parseInt(f.budget, 10),
            maxSquad: parseInt(f.maxSquad, 10),
            minSquad: parseInt(f.minSquad, 10),
          },
        ],
      })
      toast.success(`${f.name.trim()} created`)
      setAddOpen(false)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not create team')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (t: TeamDTO) => {
    setEditTarget(t)
    setEditManagerId(t.managerUserId ?? NO_MANAGER)
    setEditForm({
      name: t.name,
      color: t.color ?? '#0F766E',
      captainName: t.captainName ?? '',
      budget: String(t.budget),
      maxSquad: String(t.maxSquad),
      minSquad: String(t.minSquad),
    })
  }

  const saveEdit = async () => {
    if (!editTarget || !editForm) return
    const err = validate(editForm)
    if (err) {
      toast.error(err)
      return
    }
    setSaving(true)
    try {
      await apiPatch(`/api/teams/${editTarget.id}`, {
        name: editForm.name.trim(),
        color: editForm.color,
        captainName: editForm.captainName.trim() || null,
        budget: parseInt(editForm.budget, 10),
        maxSquad: parseInt(editForm.maxSquad, 10),
        minSquad: parseInt(editForm.minSquad, 10),
        managerUserId: editManagerId === NO_MANAGER ? null : editManagerId,
      })
      toast.success('Team updated')
      setEditTarget(null)
      setEditForm(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not update team')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/teams/${deleteTarget.id}`)
      toast.success(`${deleteTarget.name} removed`)
      setDeleteTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {teams.length} team{teams.length === 1 ? '' : 's'} registered
        </p>
        <Button className="min-h-10" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add team
        </Button>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No teams yet"
          description="Create the teams that will bid in your auction. Give each a purse and squad limits — the engine enforces them live."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add your first team
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const spentPct = t.budget > 0 ? Math.min(100, Math.round((t.spent / t.budget) * 100)) : 0
            return (
              <Card key={t.id} className="flex h-full flex-col transition-shadow hover:shadow-md">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <TeamAvatar name={t.name} color={t.color} logoUrl={t.logoUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{t.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.captainName ? (
                            <span className="inline-flex items-center gap-1">
                              <Crown className="h-3 w-3 shrink-0 text-amber-600" aria-hidden /> {t.captainName}
                            </span>
                          ) : (
                            'No captain set'
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${t.name}`} onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-semibold tabular-nums">{formatBDT(t.budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <p className="font-semibold tabular-nums text-emerald-700">{formatBDT(t.remaining)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Spent {formatBDT(t.spent)}</span>
                      <span className="font-semibold tabular-nums">{spentPct}%</span>
                    </div>
                    <Progress value={spentPct} aria-label={`${t.name} has spent ${spentPct}% of budget`} />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      Squad {t.squadCount} / {t.maxSquad}
                    </Badge>
                    {t.managerUserId ? (
                      <Badge
                        className="max-w-[60%] truncate bg-amber-100 text-amber-900 hover:bg-amber-100"
                        title={t.managerEmail ?? undefined}
                      >
                        <UserCheck className="mr-1 h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{t.managerName ?? 'Manager linked'}</span>
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Open to claim
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add dialog — mounted only while open so the form starts fresh each time */}
      {addOpen ? (
        <AddTeamDialog
          onClose={() => setAddOpen(false)}
          suggestedColor={suggestedColor}
          saving={saving}
          onSubmit={addTeam}
        />
      ) : null}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.name}</DialogTitle>
            <DialogDescription>Budget can be raised any time; lowering below spent is blocked.</DialogDescription>
          </DialogHeader>
          {editForm ? <TeamFormFields form={editForm} onChange={setEditForm} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="tm-manager" className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden /> Team manager
            </Label>
            <Select value={editManagerId} onValueChange={setEditManagerId} disabled={managers === null}>
              <SelectTrigger id="tm-manager" className="h-10 w-full">
                <SelectValue placeholder={managers === null ? 'Loading managers…' : 'No manager linked'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MANAGER}>No manager — open to claim</SelectItem>
                {(managers ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} · {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {managers !== null && managers.length === 0
                ? 'No manager accounts exist yet — ask them to register as a Team Manager first.'
                : 'Linking a manager account lets them bid from their own login and see the squad under “My team”.'}
            </p>
          </div>

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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}"` : 'This team'} and its bid history will be removed. Teams
              that have already bought players cannot be deleted.
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
              {deleting ? 'Deleting…' : 'Delete team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TeamFormFields({ form, onChange }: { form: TeamFormState; onChange: (f: TeamFormState) => void }) {
  const set = (patch: Partial<TeamFormState>) => onChange({ ...form, ...patch })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tm-name">
          Team name <span className="text-rose-600">*</span>
        </Label>
        <Input
          id="tm-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Dhaka Dominators"
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-captain">Captain name</Label>
        <Input
          id="tm-captain"
          value={form.captainName}
          onChange={(e) => set({ captainName: e.target.value })}
          placeholder="e.g. Rakib Hasan"
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-color">Team color</Label>
        <div className="flex items-center gap-2">
          <input
            id="tm-color"
            type="color"
            value={form.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            aria-label="Team color picker"
          />
          <Input value={form.color} onChange={(e) => set({ color: e.target.value })} className="h-10 font-mono text-xs" aria-label="Team color hex" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-budget">Budget (৳)</Label>
        <Input
          id="tm-budget"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.budget}
          onChange={(e) => set({ budget: e.target.value })}
          className="h-10"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tm-max">Max squad</Label>
          <Input
            id="tm-max"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.maxSquad}
            onChange={(e) => set({ maxSquad: e.target.value })}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tm-min">Min squad</Label>
          <Input
            id="tm-min"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.minSquad}
            onChange={(e) => set({ minSquad: e.target.value })}
            className="h-10"
          />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AddTeamDialog({
  onClose,
  suggestedColor,
  saving,
  onSubmit,
}: {
  onClose: () => void
  suggestedColor: string
  saving: boolean
  onSubmit: (f: TeamFormState) => Promise<void>
}) {
  const [form, setForm] = useState<TeamFormState>(() => ({
    name: '',
    color: suggestedColor,
    captainName: '',
    budget: '200000',
    maxSquad: '12',
    minSquad: '9',
  }))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add team</DialogTitle>
          <DialogDescription>
            Every team gets a purse and squad limits — bids that break them are rejected automatically.
          </DialogDescription>
        </DialogHeader>
        <TeamFormFields form={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit(form)} disabled={saving} className="min-h-10">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
