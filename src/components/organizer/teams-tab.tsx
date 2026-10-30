'use client'

import { useMemo, useState } from 'react'
import { Copy, Crown, Link2, Loader2, Pencil, Plus, Search, Trash2, UserCheck, UserPlus, X } from 'lucide-react'
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
import { TeamAvatar } from '@/components/shared/avatars'
import { ImageUpload } from '@/components/shared/image-upload'
import { EmptyState } from '@/components/shared/empty-state'
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { formatBDT } from '@/lib/format'
import { TEAM_PALETTE } from '@/lib/format'
import type { TeamDTO } from '@/lib/types'

interface TeamFormState {
  name: string
  color: string
  captainName: string
  logoUrl: string | null
  budget: string
  maxSquad: string
  minSquad: string
}

interface ManagerOption {
  id: string
  name: string
  email: string
}

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
  // Linking is by exact login email — organizers are never shown a directory of managers.
  const [editManager, setEditManager] = useState<ManagerOption | null>(null)
  const [managerEmail, setManagerEmail] = useState('')
  const [findingManager, setFindingManager] = useState(false)

  const findManager = async () => {
    const email = managerEmail.trim()
    if (!email) return
    setFindingManager(true)
    try {
      const res = await apiGet<{ manager: ManagerOption }>(`/api/users/managers?email=${encodeURIComponent(email)}`)
      setEditManager(res.manager)
      setManagerEmail('')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not look up that manager')
    } finally {
      setFindingManager(false)
    }
  }

  // Manager invite links: single use, 7 days. Shown in a dialog to copy or share.
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ team: TeamDTO; url: string; expiresAt: string } | null>(null)

  const createInvite = async (t: TeamDTO) => {
    setInvitingId(t.id)
    try {
      const res = await apiPost<{ token: string; expiresAt: string }>(`/api/teams/${t.id}/invite`, {})
      setInvite({ team: t, url: `${window.location.origin}/invite#${res.token}`, expiresAt: res.expiresAt })
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not create the invite link')
    } finally {
      setInvitingId(null)
    }
  }

  const copyInvite = async () => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.url)
      toast.success('Invite link copied')
    } catch {
      toast.error('Copy failed — select the link and copy it manually')
    }
  }

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
            logoUrl: f.logoUrl ?? undefined,
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
    setEditManager(
      t.managerUserId ? { id: t.managerUserId, name: t.managerName ?? 'Linked manager', email: t.managerEmail ?? '' } : null,
    )
    setManagerEmail('')
    setEditForm({
      name: t.name,
      color: t.color ?? '#0F766E',
      captainName: t.captainName ?? '',
      logoUrl: t.logoUrl,
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
        logoUrl: editForm.logoUrl,
        budget: parseInt(editForm.budget, 10),
        maxSquad: parseInt(editForm.maxSquad, 10),
        minSquad: parseInt(editForm.minSquad, 10),
        managerUserId: editManager?.id ?? null,
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
                        No manager yet
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full"
                    disabled={invitingId === t.id}
                    onClick={() => void createInvite(t)}
                  >
                    {invitingId === t.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Link2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    )}
                    {t.managerUserId ? 'New manager invite link' : 'Invite manager'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Invite link dialog */}
      <Dialog open={!!invite} onOpenChange={(open) => !open && setInvite(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite a manager for {invite?.team.name}</DialogTitle>
            <DialogDescription>
              Send this link to the team&apos;s manager. They log in (or sign up) as a team manager and the team is
              linked to their account. It works once and expires in 7 days; making a new link cancels this one.
              {invite?.team.managerUserId
                ? ' Accepting it replaces the current manager.'
                : ''}
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={invite?.url ?? ''} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `You're invited to manage ${invite?.team.name ?? 'a team'} on NeelamGhor. Accept here: ${invite?.url ?? ''}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share on WhatsApp
              </a>
            </Button>
            <Button onClick={() => void copyInvite()}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden /> Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogDescription>
              Budget can be raised any time; lowering below spent is blocked. While the auction is running, budgets
              and squad caps can only go up.
            </DialogDescription>
          </DialogHeader>
          {editForm ? <TeamFormFields form={editForm} onChange={setEditForm} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="tm-manager" className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden /> Team manager
            </Label>
            {editManager ? (
              <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  <span className="font-semibold">{editManager.name}</span>
                  {editManager.email ? <span className="text-muted-foreground"> · {editManager.email}</span> : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => setEditManager(null)}
                  aria-label="Unlink manager"
                >
                  <X className="mr-1 h-3.5 w-3.5" aria-hidden /> Unlink
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  id="tm-manager"
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void findManager()
                    }
                  }}
                  placeholder="manager@example.com"
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0"
                  disabled={findingManager || !managerEmail.trim()}
                  onClick={() => void findManager()}
                >
                  {findingManager ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Search className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  Link
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {editManager
                ? 'This account bids for the team from its own login and sees the squad under “My team”. Save to apply.'
                : 'No manager linked. Enter the email they registered with, or send an invite link from the team card.'}
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
      <ImageUpload
        className="sm:col-span-2"
        label="Team logo (optional)"
        kind="LOGO"
        value={form.logoUrl}
        onChange={(url) => set({ logoUrl: url })}
      />
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
    logoUrl: null,
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
