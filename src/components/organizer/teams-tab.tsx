'use client'

import { useMemo, useState } from 'react'
import { Copy, Crown, Link2, Loader2, Pencil, Plus, Search, Trash2, UserCheck, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/clipboard'
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
import { type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    lookupFailed: 'Could not look up that manager',
    inviteFailed: 'Could not create the invite link',
    inviteCopied: 'Invite link copied',
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
    addTeam: 'Add team',
    noTeamsTitle: 'No teams yet',
    noTeamsDesc:
      'Create the teams that will bid in your auction. Give each a purse and squad limits — the engine enforces them live.',
    addFirstTeam: 'Add your first team',
    noCaptain: 'No captain set',
    editAria: (name: string) => `Edit ${name}`,
    deleteAria: (name: string) => `Delete ${name}`,
    budget: 'Budget',
    remaining: 'Remaining',
    spent: (amount: string) => `Spent ${amount}`,
    spentAria: (name: string, pct: number) => `${name} has spent ${pct}% of budget`,
    squad: (count: number, max: number) => `Squad ${count} / ${max}`,
    managerLinked: 'Manager linked',
    noManagerYet: 'No manager yet',
    newInviteLink: 'New manager invite link',
    inviteManager: 'Invite manager',
    inviteTitle: (team: string) => `Invite a manager for ${team}`,
    inviteDesc:
      'Send this link to the team’s manager. They log in (or sign up) as a team manager and the team is linked to their account. It works once and expires in 7 days; making a new link cancels this one.',
    inviteReplaces: ' Accepting it replaces the current manager.',
    inviteLinkAria: 'Manager invite link',
    aTeam: 'a team',
    whatsappText: (team: string, url: string) => `You're invited to manage ${team} on NeelamGhor. Accept here: ${url}`,
    shareWhatsapp: 'Share on WhatsApp',
    copyLink: 'Copy link',
    editTitle: (name: string) => `Edit ${name}`,
    editDesc:
      'Budget can be raised any time; lowering below spent is blocked. While the auction is running, budgets and squad caps can only go up.',
    teamManager: 'Team manager',
    unlinkAria: 'Unlink manager',
    unlink: 'Unlink',
    link: 'Link',
    linkedHelp: 'This account bids for the team from its own login and sees the squad under “My team”. Save to apply.',
    unlinkedHelp: 'No manager linked. Enter the email they registered with, or send an invite link from the team card.',
    cancel: 'Cancel',
    saveChanges: 'Save changes',
    deleteTitle: 'Delete team?',
    deleteDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'This team'} will be removed. A team that has bought players or placed bids can’t be deleted — its bids are part of the auction record — and no team can be deleted while the auction is running.`,
    deleting: 'Deleting…',
    deleteTeam: 'Delete team',
    logoOptional: 'Team logo (optional)',
    teamName: 'Team name',
    teamNamePlaceholder: 'e.g. Dhaka Dominators',
    captainName: 'Captain name',
    captainPlaceholder: 'e.g. Rakib Hasan',
    teamColor: 'Team color',
    colorPickerAria: 'Team color picker',
    colorHexAria: 'Team color hex',
    budgetTaka: 'Budget (৳)',
    maxSquad: 'Max squad',
    minSquad: 'Min squad',
    addDesc: 'Every team gets a purse and squad limits — bids that break them are rejected automatically.',
    createTeam: 'Create team',
  },
  bn: {
    lookupFailed: 'এই ম্যানেজারকে খুঁজে পাওয়া যায়নি',
    inviteFailed: 'আমন্ত্রণ লিংক তৈরি করা যায়নি',
    inviteCopied: 'আমন্ত্রণ লিংক কপি হয়েছে',
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
    addTeam: 'দল যোগ করুন',
    noTeamsTitle: 'এখনো কোনো দল নেই',
    noTeamsDesc:
      'যে দলগুলো আপনার নিলামে বিড করবে সেগুলো তৈরি করুন। প্রতিটি দলকে বাজেট ও স্কোয়াডের সীমা দিন — নিলাম চলার সময় সিস্টেম নিজেই তা মেনে চলবে।',
    addFirstTeam: 'প্রথম দল যোগ করুন',
    noCaptain: 'অধিনায়ক ঠিক করা হয়নি',
    editAria: (name: string) => `${name} সম্পাদনা`,
    deleteAria: (name: string) => `${name} মুছুন`,
    budget: 'বাজেট',
    remaining: 'বাকি',
    spent: (amount: string) => `খরচ ${amount}`,
    spentAria: (name: string, pct: number) => `${name} বাজেটের ${pct}% খরচ করেছে`,
    squad: (count: number, max: number) => `স্কোয়াড ${count} / ${max}`,
    managerLinked: 'ম্যানেজার যুক্ত',
    noManagerYet: 'এখনো ম্যানেজার নেই',
    newInviteLink: 'ম্যানেজারের নতুন আমন্ত্রণ লিংক',
    inviteManager: 'ম্যানেজারকে আমন্ত্রণ',
    inviteTitle: (team: string) => `${team}-এর জন্য ম্যানেজারকে আমন্ত্রণ`,
    inviteDesc:
      'এই লিংকটি দলের ম্যানেজারকে পাঠান। তিনি টিম ম্যানেজার হিসেবে লগইন (বা সাইন আপ) করলে দলটি তার অ্যাকাউন্টে যুক্ত হয়ে যাবে। লিংকটি একবারই কাজ করে এবং ৭ দিন পর মেয়াদ শেষ হয়; নতুন লিংক বানালে এটি বাতিল হয়ে যাবে।',
    inviteReplaces: ' এটি গ্রহণ করলে বর্তমান ম্যানেজার বদলে যাবে।',
    inviteLinkAria: 'ম্যানেজারের আমন্ত্রণ লিংক',
    aTeam: 'একটি দল',
    whatsappText: (team: string, url: string) =>
      `NeelamGhor-এ ${team} পরিচালনার জন্য আপনাকে আমন্ত্রণ জানানো হয়েছে। এখানে গ্রহণ করুন: ${url}`,
    shareWhatsapp: 'WhatsApp-এ শেয়ার করুন',
    copyLink: 'লিংক কপি করুন',
    editTitle: (name: string) => `${name} সম্পাদনা`,
    editDesc:
      'বাজেট যেকোনো সময় বাড়ানো যায়; খরচের চেয়ে কমানো যায় না। নিলাম চলার সময় বাজেট ও স্কোয়াডের সীমা শুধু বাড়ানো যায়।',
    teamManager: 'টিম ম্যানেজার',
    unlinkAria: 'ম্যানেজারকে সরিয়ে দিন',
    unlink: 'সরিয়ে দিন',
    link: 'যুক্ত করুন',
    linkedHelp: 'এই অ্যাকাউন্ট নিজের লগইন থেকে দলের হয়ে বিড করবে এবং “আমার দল”-এ স্কোয়াড দেখতে পাবে। চালু করতে সংরক্ষণ করুন।',
    unlinkedHelp: 'কোনো ম্যানেজার যুক্ত নেই। তিনি যে ইমেইল দিয়ে নিবন্ধন করেছেন সেটি লিখুন, অথবা দলের কার্ড থেকে আমন্ত্রণ লিংক পাঠান।',
    cancel: 'বাতিল',
    saveChanges: 'পরিবর্তন সংরক্ষণ',
    deleteTitle: 'দল মুছে ফেলবেন?',
    deleteDesc: (name: string | null) =>
      `${name ? `"${name}"` : 'এই দল'} মুছে ফেলা হবে। যে দল খেলোয়াড় কিনেছে বা বিড করেছে তা মোছা যায় না — তার বিডগুলো নিলামের রেকর্ডের অংশ — আর নিলাম চলার সময় কোনো দলই মোছা যায় না।`,
    deleting: 'মুছে ফেলা হচ্ছে…',
    deleteTeam: 'দল মুছুন',
    logoOptional: 'দলের লোগো (ঐচ্ছিক)',
    teamName: 'দলের নাম',
    teamNamePlaceholder: 'যেমন: Dhaka Dominators',
    captainName: 'অধিনায়কের নাম',
    captainPlaceholder: 'যেমন: Rakib Hasan',
    teamColor: 'দলের রং',
    colorPickerAria: 'দলের রং বাছাই',
    colorHexAria: 'দলের রঙের হেক্স কোড',
    budgetTaka: 'বাজেট (৳)',
    maxSquad: 'সর্বোচ্চ স্কোয়াড',
    minSquad: 'সর্বনিম্ন স্কোয়াড',
    addDesc: 'প্রতিটি দল একটি বাজেট ও স্কোয়াডের সীমা পায় — সীমা ভাঙে এমন বিড নিজে থেকেই বাতিল হয়।',
    createTeam: 'দল তৈরি করুন',
  },
} satisfies Strings<{
  lookupFailed: string
  inviteFailed: string
  inviteCopied: string
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
  addTeam: string
  noTeamsTitle: string
  noTeamsDesc: string
  addFirstTeam: string
  noCaptain: string
  editAria: (name: string) => string
  deleteAria: (name: string) => string
  budget: string
  remaining: string
  spent: (amount: string) => string
  spentAria: (name: string, pct: number) => string
  squad: (count: number, max: number) => string
  managerLinked: string
  noManagerYet: string
  newInviteLink: string
  inviteManager: string
  inviteTitle: (team: string) => string
  inviteDesc: string
  inviteReplaces: string
  inviteLinkAria: string
  aTeam: string
  whatsappText: (team: string, url: string) => string
  shareWhatsapp: string
  copyLink: string
  editTitle: (name: string) => string
  editDesc: string
  teamManager: string
  unlinkAria: string
  unlink: string
  link: string
  linkedHelp: string
  unlinkedHelp: string
  cancel: string
  saveChanges: string
  deleteTitle: string
  deleteDesc: (name: string | null) => string
  deleting: string
  deleteTeam: string
  logoOptional: string
  teamName: string
  teamNamePlaceholder: string
  captainName: string
  captainPlaceholder: string
  teamColor: string
  colorPickerAria: string
  colorHexAria: string
  budgetTaka: string
  maxSquad: string
  minSquad: string
  addDesc: string
  createTeam: string
}>

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
  const [invite, setInvite] = useState<{ team: TeamDTO; url: string; expiresAt: string } | null>(null)

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

  const copyInvite = () => {
    if (invite) copyText(invite.url, tx.inviteCopied)
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
      await refetch()
    } catch (ex) {
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tx.teamsRegistered(teams.length)}
        </p>
        <Button className="min-h-10" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {tx.addTeam}
        </Button>
      </div>

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
                            tx.noCaptain
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={tx.editAria(t.name)} onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-600 hover:text-rose-700"
                        aria-label={tx.deleteAria(t.name)}
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{tx.budget}</p>
                      <p className="font-semibold tabular-nums">{formatBDT(t.budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{tx.remaining}</p>
                      <p className="font-semibold tabular-nums text-emerald-700">{formatBDT(t.remaining)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{tx.spent(formatBDT(t.spent))}</span>
                      <span className="font-semibold tabular-nums">{spentPct}%</span>
                    </div>
                    <Progress value={spentPct} aria-label={tx.spentAria(t.name, spentPct)} />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      {tx.squad(t.squadCount, t.maxSquad)}
                    </Badge>
                    {t.managerUserId ? (
                      <Badge
                        className="max-w-[60%] truncate bg-amber-100 text-amber-900 hover:bg-amber-100"
                        title={t.managerEmail ?? undefined}
                      >
                        <UserCheck className="mr-1 h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{t.managerName ?? tx.managerLinked}</span>
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {tx.noManagerYet}
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
                    {t.managerUserId ? tx.newInviteLink : tx.inviteManager}
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
            <DialogTitle>{tx.inviteTitle(invite?.team.name ?? '')}</DialogTitle>
            <DialogDescription>
              {tx.inviteDesc}
              {invite?.team.managerUserId
                ? tx.inviteReplaces
                : ''}
            </DialogDescription>
          </DialogHeader>
          <Input readOnly aria-label={tx.inviteLinkAria} value={invite?.url ?? ''} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  tx.whatsappText(invite?.team.name ?? tx.aTeam, invite?.url ?? ''),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tx.shareWhatsapp}
              </a>
            </Button>
            <Button onClick={copyInvite}>
              <Copy className="mr-1.5 h-4 w-4" aria-hidden /> {tx.copyLink}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tx.editTitle(editTarget?.name ?? '')}</DialogTitle>
            <DialogDescription>
              {tx.editDesc}
            </DialogDescription>
          </DialogHeader>
          {editForm ? <TeamFormFields form={editForm} onChange={setEditForm} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="tm-manager" className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden /> {tx.teamManager}
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
                  aria-label={tx.unlinkAria}
                >
                  <X className="mr-1 h-3.5 w-3.5" aria-hidden /> {tx.unlink}
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
                  {tx.link}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {editManager
                ? tx.linkedHelp
                : tx.unlinkedHelp}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              {tx.cancel}
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving} className="min-h-10">
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {tx.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tx.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {tx.deleteDesc(deleteTarget?.name ?? null)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tx.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? tx.deleting : tx.deleteTeam}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TeamFormFields({ form, onChange }: { form: TeamFormState; onChange: (f: TeamFormState) => void }) {
  const tx = useStrings(STRINGS)
  const set = (patch: Partial<TeamFormState>) => onChange({ ...form, ...patch })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ImageUpload
        className="sm:col-span-2"
        label={tx.logoOptional}
        kind="LOGO"
        value={form.logoUrl}
        onChange={(url) => set({ logoUrl: url })}
      />
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="tm-name">
          {tx.teamName} <span className="text-rose-600">*</span>
        </Label>
        <Input
          id="tm-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={tx.teamNamePlaceholder}
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-captain">{tx.captainName}</Label>
        <Input
          id="tm-captain"
          value={form.captainName}
          onChange={(e) => set({ captainName: e.target.value })}
          placeholder={tx.captainPlaceholder}
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-color">{tx.teamColor}</Label>
        <div className="flex items-center gap-2">
          <input
            id="tm-color"
            type="color"
            value={form.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1"
            aria-label={tx.colorPickerAria}
          />
          <Input value={form.color} onChange={(e) => set({ color: e.target.value })} className="h-10 font-mono text-xs" aria-label={tx.colorHexAria} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tm-budget">{tx.budgetTaka}</Label>
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
          <Label htmlFor="tm-max">{tx.maxSquad}</Label>
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
          <Label htmlFor="tm-min">{tx.minSquad}</Label>
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
  defaultMaxSquad,
  saving,
  onSubmit,
}: {
  onClose: () => void
  suggestedColor: string
  defaultMaxSquad?: number | null
  saving: boolean
  onSubmit: (f: TeamFormState) => Promise<void>
}) {
  const tx = useStrings(STRINGS)
  const [form, setForm] = useState<TeamFormState>(() => ({
    name: '',
    color: suggestedColor,
    captainName: '',
    logoUrl: null,
    budget: '200000',
    maxSquad: String(defaultMaxSquad ?? 12),
    minSquad: String(Math.min(9, defaultMaxSquad ?? 12)),
  }))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx.addTeam}</DialogTitle>
          <DialogDescription>
            {tx.addDesc}
          </DialogDescription>
        </DialogHeader>
        <TeamFormFields form={form} onChange={setForm} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {tx.cancel}
          </Button>
          <Button onClick={() => void onSubmit(form)} disabled={saving} className="min-h-10">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden />}
            {tx.createTeam}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
