'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { api, apiGet } from '@/lib/api'
import { ballsToOvers, oversToBalls } from '@/lib/league'
import { type Strings, useStrings } from '@/lib/i18n'
import { PlayerRole } from '@/components/shared/player-role'
import type { LeagueData, MatchDTO, MatchStatDTO } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadError } from '@/components/shared/load-error'
import { sideInfo, teamMap, useLeagueLabels } from './labels'

type Field = Exclude<keyof MatchStatDTO, 'playerId' | 'teamId'>
/** Bowling is typed in overs ("3.2") and stored as balls. */
type Column = { key: Field; overs?: boolean }

const COLUMNS: Record<string, Column[]> = {
  CRICKET: [
    { key: 'runs' },
    { key: 'ballsFaced' },
    { key: 'fours' },
    { key: 'sixes' },
    { key: 'ballsBowled', overs: true },
    { key: 'runsConceded' },
    { key: 'wickets' },
    { key: 'catches' },
  ],
  FOOTBALL: [{ key: 'goals' }, { key: 'assists' }, { key: 'yellowCards' }, { key: 'redCards' }, { key: 'saves' }],
  OTHER: [{ key: 'points' }],
}

const STRINGS = {
  en: {
    title: (n: number) => `Player stats — match ${n}`,
    desc: 'Fill in what you have; empty boxes are not counted. Saving replaces this match’s stats.',
    statsWhat: 'player stats',
    player: 'Player',
    col: {
      runs: 'Runs', ballsFaced: 'Balls', fours: '4s', sixes: '6s', ballsBowled: 'Overs', runsConceded: 'Runs given',
      wickets: 'Wkts', catches: 'Catches', goals: 'Goals', assists: 'Assists', yellowCards: 'Yellow', redCards: 'Red',
      saves: 'Saves', points: 'Points',
    } as Record<Field, string>,
    noSquad: 'No players were bought by this team.',
    save: 'Save stats',
    cancel: 'Cancel',
    saved: (n: number) => `Stats saved for ${n} player${n === 1 ? '' : 's'}`,
    badOvers: (name: string) => `${name}: overs must look like 3.2 (0–5 balls after the dot)`,
  },
  bn: {
    title: (n: number) => `খেলোয়াড়ের পরিসংখ্যান — ম্যাচ ${n}`,
    desc: 'যা জানেন তা লিখুন; খালি ঘর গোনা হবে না। সেভ করলে এই ম্যাচের আগের পরিসংখ্যান বদলে যাবে।',
    statsWhat: 'খেলোয়াড়ের পরিসংখ্যান',
    player: 'খেলোয়াড়',
    col: {
      runs: 'রান', ballsFaced: 'বল', fours: 'চার', sixes: 'ছক্কা', ballsBowled: 'ওভার', runsConceded: 'রান দিয়েছে',
      wickets: 'উইকেট', catches: 'ক্যাচ', goals: 'গোল', assists: 'অ্যাসিস্ট', yellowCards: 'হলুদ', redCards: 'লাল',
      saves: 'সেভ', points: 'পয়েন্ট',
    } as Record<Field, string>,
    noSquad: 'এই দল কোনো খেলোয়াড় কেনেনি।',
    save: 'পরিসংখ্যান সেভ করুন',
    cancel: 'বাতিল',
    saved: (n: number) => `${n} জন খেলোয়াড়ের পরিসংখ্যান সেভ হয়েছে`,
    badOvers: (name: string) => `${name}: ওভার লিখুন 3.2 এভাবে (দশমিকের পরে 0–5 বল)`,
  },
} satisfies Strings<{
  title: (n: number) => string
  desc: string
  statsWhat: string
  player: string
  col: Record<Field, string>
  noSquad: string
  save: string
  cancel: string
  saved: (n: number) => string
  badOvers: (name: string) => string
}>

export function StatsDialog({
  data,
  match,
  onClose,
  onSaved,
}: {
  data: LeagueData
  match: MatchDTO | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {match ? <StatsForm key={match.id} data={data} match={match} onClose={onClose} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

type Values = Record<string, Partial<Record<Field, string>>>

function StatsForm({
  data,
  match,
  onClose,
  onSaved,
}: {
  data: LeagueData
  match: MatchDTO
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const t = useStrings(STRINGS)
  const l = useLeagueLabels()
  const teams = teamMap(data)
  const columns = COLUMNS[data.tournament.sport] ?? COLUMNS.OTHER
  const [values, setValues] = useState<Values | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const res = await apiGet<{ stats: MatchStatDTO[] }>(`/api/matches/${match.id}/stats`)
      const next: Values = {}
      for (const s of res.stats) {
        next[s.playerId] = Object.fromEntries(
          columns.map((c) => [c.key, s[c.key] === null ? '' : c.overs ? ballsToOvers(s[c.key]) : String(s[c.key])]),
        )
      }
      setValues(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }
  useEffect(() => {
    void load()
    // Loads once per match (the form is keyed by match id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sides = (['home', 'away'] as const).map((side) => {
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId
    return {
      side,
      name: sideInfo(match, side, teams, l).name,
      players: data.squads.find((s) => s.teamId === teamId)?.players ?? [],
    }
  })

  const set = (playerId: string, key: Field, v: string) =>
    setValues((prev) => ({ ...(prev ?? {}), [playerId]: { ...(prev?.[playerId] ?? {}), [key]: v } }))

  async function save() {
    if (!values) return
    const stats: Array<Record<string, unknown>> = []
    for (const { players } of sides) {
      for (const p of players) {
        const row = values[p.id]
        if (!row) continue
        const line: Record<string, unknown> = { playerId: p.id }
        let any = false
        for (const c of columns) {
          const raw = (row[c.key] ?? '').trim()
          if (raw === '') continue
          if (c.overs) {
            const balls = oversToBalls(raw)
            if (balls === null) {
              toast.error(t.badOvers(p.name))
              return
            }
            line[c.key] = balls
          } else line[c.key] = Number(raw)
          any = true
        }
        if (any) stats.push(line)
      }
    }
    setBusy(true)
    try {
      const res = await api<{ saved: number }>(`/api/matches/${match.id}/stats`, { method: 'PUT', body: { stats } })
      toast.success(t.saved(res.saved))
      await onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.title(match.matchNumber)}</DialogTitle>
        <DialogDescription>{t.desc}</DialogDescription>
      </DialogHeader>

      {error ? (
        <LoadError what={t.statsWhat} error={error} onRetry={load} />
      ) : !values ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          {sides.map(({ side, name, players }) => (
            <section key={side}>
              <h3 className="mb-2 text-sm font-bold">{name}</h3>
              {players.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{t.noSquad}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th scope="col" className="sticky left-0 z-10 min-w-36 bg-muted px-2 py-2 text-left font-semibold">{t.player}</th>
                        {columns.map((c) => (
                          <th key={c.key} scope="col" className="px-1 py-2 text-center font-semibold">{t.col[c.key]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {players.map((p) => (
                        <tr key={p.id}>
                          <th scope="row" className="sticky left-0 z-10 bg-background px-2 py-1 text-left font-medium">
                            <span className="block max-w-40 truncate">{p.name}</span>
                            <span className="block text-[11px] font-normal text-muted-foreground"><PlayerRole role={p.role} /></span>
                          </th>
                          {columns.map((c) => (
                            <td key={c.key} className="px-1 py-1">
                              <input
                                aria-label={`${p.name} — ${t.col[c.key]}`}
                                inputMode={c.overs ? 'decimal' : 'numeric'}
                                className="h-9 w-14 rounded-md border bg-background px-1.5 text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={values[p.id]?.[c.key] ?? ''}
                                onChange={(e) => set(p.id, c.key, e.target.value.replace(c.overs ? /[^\d.]/g : /\D/g, ''))}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t.cancel}
        </Button>
        <Button onClick={() => void save()} disabled={busy || !values}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t.save}
        </Button>
      </DialogFooter>
    </>
  )
}
