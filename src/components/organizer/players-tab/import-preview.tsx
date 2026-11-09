'use client'

import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBDT } from '@/lib/format'
import { type Strings, useStrings } from '@/lib/i18n'
import { SHARED_STRINGS, type SharedPlayersStrings } from './strings'

export interface ImportPreviewRow {
  row: number
  ok: boolean
  errors: string[]
  duplicateOf?: 'existing' | 'file'
  data: {
    name: string
    phone: string | null
    role: string
    category: string | null
    basePrice: number | null
    previousTeam: string | null
  }
}

export interface ImportPreview {
  results: ImportPreviewRow[]
  counts: { total: number; ready: number; withErrors: number; duplicates: number }
}

/** Rows shown in the preview table; the counts and the import cover every row. */
const PREVIEW_LIMIT = 200

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    countReady: (n: number) => `${n} ready`,
    countErrors: (n: number) => `${n} with errors`,
    countDuplicates: (n: number) => `${n} duplicates`,
    skipDuplicates: 'Skip duplicates',
    skipDuplicatesHelp: 'Same phone number, or same name and role, as a player already here or earlier in the file.',
    dupExisting: 'Already in this tournament',
    dupFile: 'Repeated in this file',
    includeRow: (row: number) => `Include row ${row}`,
    colRow: 'Row',
    colIssues: 'Issues',
    showingFirst: (shown: number, total: number) => `Showing the first ${shown} of ${total} rows — the rest are imported unless they have errors.`,
  },
  bn: {
    ...SHARED_STRINGS.bn,
    countReady: (n: number) => `${n}টি প্রস্তুত`,
    countErrors: (n: number) => `${n}টিতে ত্রুটি`,
    countDuplicates: (n: number) => `${n}টি ডুপ্লিকেট`,
    skipDuplicates: 'ডুপ্লিকেট বাদ দিন',
    skipDuplicatesHelp: 'এখানে আগে থেকে থাকা বা ফাইলের আগের সারির কোনো খেলোয়াড়ের সাথে একই ফোন নম্বর, অথবা একই নাম ও রোল।',
    dupExisting: 'এই টুর্নামেন্টে আগেই আছে',
    dupFile: 'ফাইলে আবার এসেছে',
    includeRow: (row: number) => `সারি ${row} রাখুন`,
    colRow: 'সারি',
    colIssues: 'সমস্যা',
    showingFirst: (shown: number, total: number) => `${total}টি সারির প্রথম ${shown}টি দেখানো হচ্ছে — ত্রুটি না থাকলে বাকিগুলোও ইমপোর্ট হবে।`,
  },
} satisfies Strings<
  SharedPlayersStrings & {
    countReady: (n: number) => string
    countErrors: (n: number) => string
    countDuplicates: (n: number) => string
    skipDuplicates: string
    skipDuplicatesHelp: string
    dupExisting: string
    dupFile: string
    includeRow: (row: number) => string
    colRow: string
    colIssues: string
    showingFirst: (shown: number, total: number) => string
  }
>

/** The dry run's verdict: counts, the skip-duplicates switch and the per-row table. */
export function ImportPreviewPanel({
  preview,
  skipDuplicates,
  setSkipDuplicates,
  isIncluded,
  toggleRow,
}: {
  preview: ImportPreview
  skipDuplicates: boolean
  setSkipDuplicates: (v: boolean) => void
  isIncluded: (r: ImportPreviewRow) => boolean
  toggleRow: (row: number, include: boolean) => void
}) {
  const t = useStrings(STRINGS)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">{t.countReady(preview.counts.ready)}</Badge>
        <Badge variant="secondary" className="bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200">{t.countErrors(preview.counts.withErrors)}</Badge>
        <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">{t.countDuplicates(preview.counts.duplicates)}</Badge>
        <label className="ml-auto flex items-center gap-2 text-sm font-medium">
          <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
          {t.skipDuplicates}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t.skipDuplicatesHelp}</p>

      <div className="max-h-[50vh] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="w-14">{t.colRow}</TableHead>
              <TableHead>{t.name}</TableHead>
              <TableHead>{t.colRole}</TableHead>
              <TableHead>{t.colCat}</TableHead>
              <TableHead>{t.colBase}</TableHead>
              <TableHead>{t.phone}</TableHead>
              <TableHead>{t.colIssues}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.results.slice(0, PREVIEW_LIMIT).map((r) => {
              const lockedOut = !r.ok || (skipDuplicates && !!r.duplicateOf)
              return (
                  <TableRow key={r.row} className={!r.ok ? 'bg-rose-50/60 dark:bg-rose-950/20' : r.duplicateOf ? 'bg-amber-50/60 dark:bg-amber-950/20' : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--primary)]"
                        aria-label={t.includeRow(r.row)}
                        checked={isIncluded(r)}
                        disabled={lockedOut}
                        onChange={(e) => toggleRow(r.row, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{r.row}</TableCell>
                    <TableCell className="max-w-40 truncate font-medium">{r.data.name || '—'}</TableCell>
                    <TableCell className="max-w-28 truncate">{r.data.role || '—'}</TableCell>
                    <TableCell>{r.data.category ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {r.data.basePrice !== null ? formatBDT(r.data.basePrice) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{r.data.phone ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {r.errors.length > 0 ? (
                        <span className="text-rose-700 dark:text-rose-400">{r.errors.join('; ')}</span>
                      ) : r.duplicateOf ? (
                        <span className="text-amber-800 dark:text-amber-400">
                          {r.duplicateOf === 'existing' ? t.dupExisting : t.dupFile}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
              )
            })}
          </TableBody>
        </table>
      </div>
      {preview.results.length > PREVIEW_LIMIT ? (
        <p className="text-xs text-muted-foreground">{t.showingFirst(PREVIEW_LIMIT, preview.results.length)}</p>
      ) : null}
    </div>
  )
}
