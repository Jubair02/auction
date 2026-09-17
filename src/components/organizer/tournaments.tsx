'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  Gavel,
  History,
  LayoutList,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { EmptyState } from '@/components/shared/empty-state'
import { TournamentCard, copyRoomCode } from '@/components/organizer/tournament-card'
import { apiDelete, apiDownload, apiGet, ApiError } from '@/lib/api'
import { navigate } from '@/lib/router'
import type { TournamentSummary } from '@/lib/types'

const EXPORT_TYPES: { type: string; label: string }[] = [
  { type: 'players', label: 'Players' },
  { type: 'sold', label: 'Sold' },
  { type: 'unsold', label: 'Unsold' },
  { type: 'squads', label: 'Squads' },
  { type: 'bids', label: 'History' },
  { type: 'spending', label: 'Spending' },
]

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tournament'
}

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [sport, setSport] = useState('ALL')
  const [status, setStatus] = useState('ALL')

  const [deleteTarget, setDeleteTarget] = useState<TournamentSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ tournaments: TournamentSummary[] }>('/api/tournaments')
      setTournaments(res.tournaments)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Could not load tournaments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false
      if (sport !== 'ALL' && t.sport !== sport) return false
      if (status !== 'ALL' && t.status !== status) return false
      return true
    })
  }, [tournaments, query, sport, status])

  const downloadExport = async (t: TournamentSummary, type: string) => {
    try {
      await apiDownload(`/api/tournaments/${t.id}/export?type=${type}`, `${slugify(t.name)}-${type}.csv`)
      toast.success(`Exported ${type} CSV`)
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Export failed')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/tournaments/${deleteTarget.id}`)
      toast.success(`Deleted "${deleteTarget.name}"`)
      setDeleteTarget(null)
      void load()
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tournaments</h1>
          <p className="mt-1 text-sm text-muted-foreground">All auctions you organize, in one place.</p>
        </div>
        <Button size="lg" className="min-h-11" onClick={() => navigate('/tournaments/new')}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tournament
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search tournaments by name"
            className="h-11 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="h-11 w-full sm:w-40" aria-label="Filter by sport">
              <SelectValue placeholder="Sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sports</SelectItem>
              <SelectItem value="CRICKET">Cricket</SelectItem>
              <SelectItem value="FOOTBALL">Football</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-11 w-full sm:w-40" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">DRAFT</SelectItem>
              <SelectItem value="READY">READY</SelectItem>
              <SelectItem value="LIVE">LIVE</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {tournaments.length}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={tournaments.length === 0 ? Trophy : Search}
          title={tournaments.length === 0 ? 'No tournaments yet' : 'No matches for these filters'}
          description={
            tournaments.length === 0
              ? 'Create your first tournament to start adding players and teams.'
              : 'Try a different name, sport or status.'
          }
          action={
            tournaments.length === 0 ? (
              <Button onClick={() => navigate('/tournaments/new')}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New tournament
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setSport('ALL')
                  setStatus('ALL')
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              actions={
                <>
                  <Button className="min-h-10 flex-1" onClick={() => navigate(`/tournaments/${t.id}`)}>
                    <LayoutList className="mr-1.5 h-4 w-4" aria-hidden /> Manage
                  </Button>
                  {t.roomCode ? (
                    <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label={`Copy room code ${t.roomCode}`} onClick={() => copyRoomCode(t.roomCode as string)}>
                      <Gavel className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label={`More actions for ${t.name}`}>
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => navigate(`/tournaments/${t.id}`)}>
                        <LayoutList className="mr-2 h-4 w-4" /> Manage
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/tournaments/${t.id}/history`)}>
                        <History className="mr-2 h-4 w-4" /> Auction history
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/results/${t.id}`)}>
                        <Trophy className="mr-2 h-4 w-4" /> Results
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Download className="mr-2 h-4 w-4" /> Export
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {EXPORT_TYPES.map((e) => (
                            <DropdownMenuItem key={e.type} onClick={() => void downloadExport(t, e.type)}>
                              <FileSpreadsheet className="mr-2 h-4 w-4" /> {e.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}"` : 'This tournament'} and all its players, teams and bid
              history will be permanently removed. This cannot be undone.
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
              {deleting ? 'Deleting…' : 'Delete tournament'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
