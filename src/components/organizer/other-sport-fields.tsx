'use client'

// Details of an "Others" tournament — which game, its player roles and team
// sizes. Shared by the create wizard and the edit dialog.
import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OTHER_SPORT_LIMITS, type TournamentSummary } from '@/lib/types'

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

/** Why the value can't be saved yet, or null when it's fine. */
export function otherSportError(v: OtherSportValue): string | null {
  const name = v.sportName.trim()
  if (name.length < 2) return 'Enter the sport name (e.g. Kabaddi).'
  if (name.length > OTHER_SPORT_LIMITS.nameMax) return `Sport name can be at most ${OTHER_SPORT_LIMITS.nameMax} characters.`
  for (const [raw, label] of [[v.playersPerTeam, 'Players per team'], [v.playersOnField, 'Playing on field']] as const) {
    if (raw === '') continue
    const n = toInt(raw)
    if (!n || n > OTHER_SPORT_LIMITS.teamMax) return `${label} must be between 1 and ${OTHER_SPORT_LIMITS.teamMax}.`
  }
  const perTeam = toInt(v.playersPerTeam)
  const onField = toInt(v.playersOnField)
  if (perTeam && onField && onField > perTeam) return 'Playing on field cannot be more than players per team.'
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
          Sport name <span className="text-rose-600">*</span>
        </Label>
        <Input
          id={`${idPrefix}-sport-name`}
          value={value.sportName}
          onChange={(e) => set({ sportName: e.target.value })}
          placeholder="e.g. Kabaddi"
          className="h-11"
          maxLength={OTHER_SPORT_LIMITS.nameMax}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Popular:</span>
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
          <Label htmlFor={`${idPrefix}-role-input`}>Player roles</Label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Used to filter players in the auction and to balance teams. Leave empty for Attacker · Defender · All-rounder · Player.
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
                aria-label={`Remove role ${role}`}
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
            placeholder={value.playerRoles.length >= OTHER_SPORT_LIMITS.roles ? 'Role limit reached' : 'Type a role and press Enter'}
            disabled={value.playerRoles.length >= OTHER_SPORT_LIMITS.roles}
            className="h-8 min-w-40 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { key: 'playersPerTeam', label: 'Players per team', hint: 'Default max squad for new teams', placeholder: 'e.g. 12' },
            { key: 'playersOnField', label: 'Playing on field', hint: 'How many play at once', placeholder: 'e.g. 7' },
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
