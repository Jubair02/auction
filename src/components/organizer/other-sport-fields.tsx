'use client'

// Details of an "Others" tournament — which game, its player roles and team
// sizes. Shared by the create wizard and the edit dialog.
import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OTHER_SPORT_LIMITS, type TournamentSummary } from '@/lib/types'
import { type Lang, type Strings, useStrings } from '@/lib/i18n'

const STRINGS = {
  en: {
    errName: 'Enter the sport name (e.g. Kabaddi).',
    errNameMax: (max: number) => `Sport name can be at most ${max} characters.`,
    errRange: (label: string, max: number) => `${label} must be between 1 and ${max}.`,
    errOnField: 'Playing on field cannot be more than players per team.',
    sportName: 'Sport name',
    sportNamePlaceholder: 'e.g. Kabaddi',
    popular: 'Popular:',
    playerRoles: 'Player roles',
    rolesHint: 'Used to filter players in the auction and to balance teams. Leave empty for Attacker · Defender · All-rounder · Player.',
    removeRole: (role: string) => `Remove role ${role}`,
    roleLimit: 'Role limit reached',
    rolePlaceholder: 'Type a role and press Enter',
    playersPerTeam: 'Players per team',
    playersPerTeamHint: 'Default max squad for new teams',
    playersPerTeamPlaceholder: 'e.g. 12',
    playersOnField: 'Playing on field',
    playersOnFieldHint: 'How many play at once',
    playersOnFieldPlaceholder: 'e.g. 7',
  },
  bn: {
    errName: 'খেলার নাম লিখুন (যেমন কাবাডি)।',
    errNameMax: (max: number) => `খেলার নাম সর্বোচ্চ ${max} অক্ষরের হতে পারে।`,
    errRange: (label: string, max: number) => `${label} 1 থেকে ${max}-এর মধ্যে হতে হবে।`,
    errOnField: 'মাঠে খেলোয়াড়ের সংখ্যা দলের মোট খেলোয়াড়ের চেয়ে বেশি হতে পারে না।',
    sportName: 'খেলার নাম',
    sportNamePlaceholder: 'যেমন Kabaddi',
    popular: 'জনপ্রিয়:',
    playerRoles: 'খেলোয়াড়ের ভূমিকা',
    rolesHint: 'নিলামে খেলোয়াড় ফিল্টার করতে ও দল ভারসাম্য করতে ব্যবহার হয়। খালি রাখলে Attacker · Defender · All-rounder · Player থাকবে।',
    removeRole: (role: string) => `${role} ভূমিকা সরান`,
    roleLimit: 'আর ভূমিকা যোগ করা যাবে না',
    rolePlaceholder: 'ভূমিকা লিখে Enter চাপুন',
    playersPerTeam: 'দলপ্রতি খেলোয়াড়',
    playersPerTeamHint: 'নতুন দলের ডিফল্ট সর্বোচ্চ স্কোয়াড',
    playersPerTeamPlaceholder: 'যেমন 12',
    playersOnField: 'মাঠে খেলে',
    playersOnFieldHint: 'একসাথে কতজন খেলে',
    playersOnFieldPlaceholder: 'যেমন 7',
  },
} satisfies Strings<{
  errName: string
  errNameMax: (max: number) => string
  errRange: (label: string, max: number) => string
  errOnField: string
  sportName: string
  sportNamePlaceholder: string
  popular: string
  playerRoles: string
  rolesHint: string
  removeRole: (role: string) => string
  roleLimit: string
  rolePlaceholder: string
  playersPerTeam: string
  playersPerTeamHint: string
  playersPerTeamPlaceholder: string
  playersOnField: string
  playersOnFieldHint: string
  playersOnFieldPlaceholder: string
}>

export interface OtherSportValue {
  sportName: string
  playerRoles: string[]
  playersPerTeam: string
  playersOnField: string
}

export const EMPTY_OTHER_SPORT: OtherSportValue = { sportName: '', playerRoles: [], playersPerTeam: '', playersOnField: '' }

export function otherSportFrom(t: Pick<TournamentSummary, 'sportName' | 'playerRoles' | 'playersPerTeam' | 'playersOnField'>): OtherSportValue {
  return {
    sportName: t.sportName ?? '',
    playerRoles: t.playerRoles ?? [],
    playersPerTeam: t.playersPerTeam ? String(t.playersPerTeam) : '',
    playersOnField: t.playersOnField ? String(t.playersOnField) : '',
  }
}

/** Typical setups — one tap fills the name, roles and team sizes. */
const PRESETS: { name: string; roles: string[]; perTeam: number; onField: number }[] = [
  { name: 'Kabaddi', roles: ['Raider', 'Defender', 'All-rounder'], perTeam: 12, onField: 7 },
  { name: 'Badminton', roles: ['Singles', 'Doubles', 'All-rounder'], perTeam: 6, onField: 2 },
  { name: 'Volleyball', roles: ['Setter', 'Spiker', 'Blocker', 'Libero'], perTeam: 12, onField: 6 },
  { name: 'Basketball', roles: ['Guard', 'Forward', 'Center'], perTeam: 12, onField: 5 },
  { name: 'Hockey', roles: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'], perTeam: 16, onField: 11 },
]

const toInt = (v: string) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Why the value can't be saved yet, or null when it's fine. Pass the UI language for a Bangla message. */
export function otherSportError(v: OtherSportValue, lang: Lang = 'en'): string | null {
  const s = STRINGS[lang]
  const name = v.sportName.trim()
  if (name.length < 2) return s.errName
  if (name.length > OTHER_SPORT_LIMITS.nameMax) return s.errNameMax(OTHER_SPORT_LIMITS.nameMax)
  for (const [raw, label] of [[v.playersPerTeam, s.playersPerTeam], [v.playersOnField, s.playersOnField]] as const) {
    if (raw === '') continue
    const n = toInt(raw)
    if (!n || n > OTHER_SPORT_LIMITS.teamMax) return s.errRange(label, OTHER_SPORT_LIMITS.teamMax)
  }
  const perTeam = toInt(v.playersPerTeam)
  const onField = toInt(v.playersOnField)
  if (perTeam && onField && onField > perTeam) return s.errOnField
  return null
}

/** The request-body fields for the API. */
export function otherSportPayload(v: OtherSportValue) {
  return {
    sportName: v.sportName.trim(),
    playerRoles: v.playerRoles,
    playersPerTeam: toInt(v.playersPerTeam),
    playersOnField: toInt(v.playersOnField),
  }
}

export function OtherSportFields({
  value,
  onChange,
  idPrefix,
}: {
  value: OtherSportValue
  onChange: (v: OtherSportValue) => void
  idPrefix: string
}) {
  const t = useStrings(STRINGS)
  const [roleDraft, setRoleDraft] = useState('')
  const set = (patch: Partial<OtherSportValue>) => onChange({ ...value, ...patch })

  const addRole = (raw: string) => {
    const role = raw.trim().slice(0, OTHER_SPORT_LIMITS.roleMax)
    setRoleDraft('')
    if (!role || value.playerRoles.length >= OTHER_SPORT_LIMITS.roles) return
    if (value.playerRoles.some((r) => r.toLowerCase() === role.toLowerCase())) return
    set({ playerRoles: [...value.playerRoles, role] })
  }
  const removeRole = (role: string) => set({ playerRoles: value.playerRoles.filter((r) => r !== role) })

  const current = value.sportName.trim().toLowerCase()
  const presets = PRESETS.filter((p) => p.name.toLowerCase() !== current)

  return (
    <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-primary/[0.03] p-4 sm:p-5">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-sport-name`}>
          {t.sportName} <span className="text-rose-600 dark:text-rose-400">*</span>
        </Label>
        <Input
          id={`${idPrefix}-sport-name`}
          value={value.sportName}
          onChange={(e) => set({ sportName: e.target.value })}
          placeholder={t.sportNamePlaceholder}
          className="h-11"
          maxLength={OTHER_SPORT_LIMITS.nameMax}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.popular}</span>
          {presets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() =>
                set({ sportName: p.name, playerRoles: p.roles, playersPerTeam: String(p.perTeam), playersOnField: String(p.onField) })
              }
              className="min-h-9 rounded-full border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label htmlFor={`${idPrefix}-role-input`}>{t.playerRoles}</Label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.rolesHint}
          </p>
        </div>
        <div
          className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring"
          onClick={() => document.getElementById(`${idPrefix}-role-input`)?.focus()}
        >
          {value.playerRoles.map((role) => (
            <span key={role} className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-1 pl-2.5 pr-1 text-sm font-medium text-primary">
              {role}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeRole(role)
                }}
                className="rounded p-0.5 hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={t.removeRole(role)}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <input
            id={`${idPrefix}-role-input`}
            value={roleDraft}
            onChange={(e) => {
              // A comma also finishes a role, so a pasted "A, B, C" becomes three.
              const parts = e.target.value.split(',')
              if (parts.length > 1) parts.slice(0, -1).forEach(addRole)
              setRoleDraft(parts[parts.length - 1])
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addRole(roleDraft)
              } else if (e.key === 'Backspace' && roleDraft === '' && value.playerRoles.length > 0) {
                removeRole(value.playerRoles[value.playerRoles.length - 1])
              }
            }}
            onBlur={() => roleDraft.trim() && addRole(roleDraft)}
            placeholder={value.playerRoles.length >= OTHER_SPORT_LIMITS.roles ? t.roleLimit : t.rolePlaceholder}
            disabled={value.playerRoles.length >= OTHER_SPORT_LIMITS.roles}
            className="h-8 min-w-40 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { key: 'playersPerTeam', label: t.playersPerTeam, hint: t.playersPerTeamHint, placeholder: t.playersPerTeamPlaceholder },
            { key: 'playersOnField', label: t.playersOnField, hint: t.playersOnFieldHint, placeholder: t.playersOnFieldPlaceholder },
          ] as const
        ).map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</Label>
            <Input
              id={`${idPrefix}-${f.key}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={OTHER_SPORT_LIMITS.teamMax}
              value={value[f.key]}
              onChange={(e) => set({ [f.key]: e.target.value } as Partial<OtherSportValue>)}
              placeholder={f.placeholder}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">{f.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
