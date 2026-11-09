'use client'

import { useMemo, useState } from 'react'
import { Crown, Plus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '@/lib/api'
import { TEAM_PALETTE } from '@/lib/format'
import { peekCached, useCachedGet } from '@/lib/api-cache'
import { tournamentDetailUrl } from '@/lib/tournament-prefetch'
import { PLANS_URL, UpgradeDialog } from '@/components/organizer/upgrade-dialog'
import type { PlanInfo, TeamDTO, TournamentDetail } from '@/lib/types'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS } from './teams-tab/strings'
import type { ManagerOption, TeamFormState } from './teams-tab/types'
import { TeamCard } from './teams-tab/team-card'
import { InviteDialog, type TeamInvite } from './teams-tab/invite-dialog'
import { AddTeamDialog } from './teams-tab/add-team-dialog'
import { EditTeamDialog } from './teams-tab/edit-team-dialog'
import { DeleteTeamDialog } from './teams-tab/delete-team-dialog'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    lookupFailed: 'Could not look up that manager',
    inviteFailed: 'Could not create the invite link',
    nameMin: 'Team name must be at least 2 characters.',
    budgetAboveZero: 'Budget must be above ৳0.',
    maxMin: 'Max squad size must be at least 1.',
    minNegative: 'Min squad size cannot be negative.',
    minOverMax: 'Min squad size cannot exceed max squad size.',
    created: (name: string) => `${name} created`,
    createFailed: 'Could not create team',
    linkedManager: 'Linked manager',
    teamUpdated: 'Team updated',
    updateFailed: 'Could not update team',
    removed: (name: string) => `${name} removed`,
    deleteFailed: 'Delete failed',
    teamsRegistered: (n: number) => `${n} team${n === 1 ? '' : 's'} registered`,
    noTeamsTitle: 'No teams yet',
    noTeamsDesc:
      'Create the teams that will bid in your auction. Give each a purse and squad limits — the engine enforces them live.',
    addFirstTeam: 'Add your first team',
    freeUsage: (n: number, max: number) => `${n} / ${max} teams on the Free plan`,
    upgrade: 'Upgrade to Pro',
    askOwnerUpgrade: 'Ask the tournament owner to upgrade to Pro for more.',
  },
  bn: {
    ...SHARED_STRINGS.bn,
    lookupFailed: 'এই ম্যানেজারকে খুঁজে পাওয়া যায়নি',
    inviteFailed: 'আমন্ত্রণ লিংক তৈরি করা যায়নি',
    nameMin: 'দলের নাম অন্তত ২ অক্ষরের হতে হবে।',
    budgetAboveZero: 'বাজেট ৳0-এর বেশি হতে হবে।',
    maxMin: 'সর্বোচ্চ স্কোয়াড অন্তত ১ জনের হতে হবে।',
    minNegative: 'সর্বনিম্ন স্কোয়াড ঋণাত্মক হতে পারে না।',
    minOverMax: 'সর্বনিম্ন স্কোয়াড সর্বোচ্চ স্কোয়াডের চেয়ে বেশি হতে পারে না।',
    created: (name: string) => `${name} তৈরি হয়েছে`,
    createFailed: 'দল তৈরি করা যায়নি',
    linkedManager: 'যুক্ত ম্যানেজার',
    teamUpdated: 'দলের তথ্য আপডেট হয়েছে',
    updateFailed: 'দলের তথ্য আপডেট করা যায়নি',
    removed: (name: string) => `${name} মুছে ফেলা হয়েছে`,
    deleteFailed: 'মুছে ফেলা যায়নি',
    teamsRegistered: (n: number) => `${n}টি দল নিবন্ধিত`,
    noTeamsTitle: 'এখনো কোনো দল নেই',
    noTeamsDesc:
      'যে দলগুলো আপনার নিলামে বিড করবে সেগুলো তৈরি করুন। প্রতিটি দলকে বাজেট ও স্কোয়াডের সীমা দিন — নিলাম চলার সময় সিস্টেম নিজেই তা মেনে চলবে।',
    addFirstTeam: 'প্রথম দল যোগ করুন',
    freeUsage: (n: number, max: number) => `ফ্রি প্ল্যানে ${max}টির মধ্যে ${n}টি দল`,
    upgrade: 'Pro-তে আপগ্রেড করুন',
    askOwnerUpgrade: 'আরও দল লাগলে টুর্নামেন্টের মালিককে Pro-তে আপগ্রেড করতে বলুন।',
  },
} satisfies Strings<{
  addTeam: string
  cancel: string
  lookupFailed: string
  inviteFailed: string
  nameMin: string
  budgetAboveZero: string
  maxMin: string
  minNegative: string
  minOverMax: string
  created: (name: string) => string
  createFailed: string
  linkedManager: string
  teamUpdated: string
  updateFailed: string
  removed: (name: string) => string
  deleteFailed: string
  teamsRegistered: (n: number) => string
  noTeamsTitle: string
  noTeamsDesc: string
  addFirstTeam: string
  freeUsage: (n: number, max: number) => string
  upgrade: string
  askOwnerUpgrade: string
}>

export function TeamsTab({
  tournamentId,
  teams,
  refetch,
  loading,
  defaultMaxSquad,
}: {
  tournamentId: string
  teams: TeamDTO[]
  refetch: () => Promise<void>
  loading: boolean
  /** An "Others" tournament's players per team: pre-fills new teams' max squad. */
  defaultMaxSquad?: number | null
}) {
  const tx = useStrings(STRINGS)
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

  // Plan limits: the detail page already loaded the tournament (plan + the caller's
  // access), so read it from the cache instead of fetching it again.
  const detail = peekCached<TournamentDetail>(tournamentDetailUrl(tournamentId))
  const isFree = detail?.tournament.plan === 'FREE'
  const canUpgrade = detail?.myAccess === 'OWNER' || detail?.myAccess === 'ADMIN'
  const plans = useCachedGet<PlanInfo>(PLANS_URL)
  const freeMaxTeams = isFree ? plans.data?.freeMaxTeams : undefined
  const atLimit = freeMaxTeams !== undefined && teams.length >= freeMaxTeams
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  /** The server's "free plan allows up to N teams" message, after a 402. */
  const [limitError, setLimitError] = useState<string | null>(null)

  const findManager = async () => {
    const email = managerEmail.trim()
    if (!email) return
    setFindingManager(true)
    try {
      const res = await apiGet<{ manager: ManagerOption }>(`/api/users/managers?email=${encodeURIComponent(email)}`)
      setEditManager(res.manager)
      setManagerEmail('')
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : tx.lookupFailed)
    } finally {
      setFindingManager(false)
    }
  }

  // Manager invite links: single use, 7 days. Shown in a dialog to copy or share.
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [invite, setInvite] = useState<TeamInvite | null>(null)

  const createInvite = async (t: TeamDTO) => {
    setInvitingId(t.id)
    try {
      const res = await apiPost<{ token: string; expiresAt: string }>(`/api/teams/${t.id}/invite`, {})
      setInvite({ team: t, url: `${window.location.origin}/invite#${res.token}`, expiresAt: res.expiresAt })
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : tx.inviteFailed)
    } finally {
      setInvitingId(null)
    }
  }

  // Suggest a palette color not already used by an existing team.
  const suggestedColor = useMemo(() => {
    const used = new Set(teams.map((t) => t.color))
    return TEAM_PALETTE.find((c) => !used.has(c)) ?? TEAM_PALETTE[teams.length % TEAM_PALETTE.length]
  }, [teams])

  const validate = (f: TeamFormState): string | null => {
    if (f.name.trim().length < 2) return tx.nameMin
    const budget = parseInt(f.budget, 10)
    if (!Number.isFinite(budget) || budget <= 0) return tx.budgetAboveZero
    const max = parseInt(f.maxSquad, 10)
    const min = parseInt(f.minSquad, 10)
    if (!Number.isFinite(max) || max <= 0) return tx.maxMin
    if (!Number.isFinite(min) || min < 0) return tx.minNegative
    if (min > max) return tx.minOverMax
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
      toast.success(tx.created(f.name.trim()))
      setAddOpen(false)
      setLimitError(null)
      await refetch()
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 402) {
        // Over the Free plan's team limit: say so next to "Add team", with the way out.
        setAddOpen(false)
        setLimitError(ex.message)
        toast.error(ex.message, canUpgrade ? { action: { label: tx.upgrade, onClick: () => setUpgradeOpen(true) } } : undefined)
        return
      }
      toast.error(ex instanceof ApiError ? ex.message : tx.createFailed)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (t: TeamDTO) => {
    setEditTarget(t)
    setEditManager(
      t.managerUserId ? { id: t.managerUserId, name: t.managerName ?? tx.linkedManager, email: t.managerEmail ?? '' } : null,
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
      toast.success(tx.teamUpdated)
      setEditTarget(null)
      setEditForm(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : tx.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/teams/${deleteTarget.id}`)
      toast.success(tx.removed(deleteTarget.name))
      setDeleteTarget(null)
      await refetch()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : tx.deleteFailed)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{tx.teamsRegistered(teams.length)}</p>
          {freeMaxTeams !== undefined ? (
            <p className={atLimit ? 'text-xs font-semibold text-rose-700 dark:text-rose-400' : 'text-xs text-muted-foreground'}>
              {tx.freeUsage(teams.length, freeMaxTeams)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {isFree && canUpgrade && (atLimit || limitError) ? (
            <Button variant="outline" className="min-h-10 border-amber-400 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40" onClick={() => setUpgradeOpen(true)}>
              <Crown className="mr-1.5 h-4 w-4" aria-hidden /> {tx.upgrade}
            </Button>
          ) : null}
          <Button className="min-h-10" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {tx.addTeam}
          </Button>
        </div>
      </div>

      {limitError && isFree ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {limitError}
          {canUpgrade ? null : <span className="block text-xs">{tx.askOwnerUpgrade}</span>}
        </div>
      ) : null}

      {canUpgrade ? <UpgradeDialog tournamentId={tournamentId} open={upgradeOpen} onOpenChange={setUpgradeOpen} /> : null}

      {teams.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={tx.noTeamsTitle}
          description={tx.noTeamsDesc}
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {tx.addFirstTeam}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              inviting={invitingId === t.id}
              onEdit={() => openEdit(t)}
              onDelete={() => setDeleteTarget(t)}
              onInvite={() => void createInvite(t)}
            />
          ))}
        </div>
      )}

      {/* Invite link dialog */}
      <InviteDialog invite={invite} onClose={() => setInvite(null)} />

      {/* Add dialog — mounted only while open so the form starts fresh each time */}
      {addOpen ? (
        <AddTeamDialog
          onClose={() => setAddOpen(false)}
          suggestedColor={suggestedColor}
          defaultMaxSquad={defaultMaxSquad}
          saving={saving}
          onSubmit={addTeam}
        />
      ) : null}

      {/* Edit dialog */}
      <EditTeamDialog
        editTarget={editTarget}
        editForm={editForm}
        onFormChange={setEditForm}
        editManager={editManager}
        onManagerChange={setEditManager}
        managerEmail={managerEmail}
        onManagerEmailChange={setManagerEmail}
        findingManager={findingManager}
        findManager={findManager}
        saving={saving}
        onClose={() => setEditTarget(null)}
        onSave={saveEdit}
      />

      {/* Delete confirm */}
      <DeleteTeamDialog
        deleteTarget={deleteTarget}
        deleting={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
