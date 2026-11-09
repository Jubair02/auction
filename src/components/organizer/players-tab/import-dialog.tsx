'use client'

import { useState } from 'react'
import { AlertTriangle, Download, FileUp, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { apiPost, ApiError } from '@/lib/api'
import { parseCsvObjects } from '@/lib/csv'
import { type Strings, useStrings } from '@/lib/i18n'
import { ImportPreviewPanel, type ImportPreview, type ImportPreviewRow } from './import-preview'
import { SHARED_STRINGS, type SharedPlayersStrings } from './strings'

const STRINGS = {
  en: {
    ...SHARED_STRINGS.en,
    readFailed: 'Could not read that file',
    pasteFirst: 'Paste CSV text or choose a file first.',
    imported: (n: number) => `Imported ${n} player${n === 1 ? '' : 's'}`,
    nothingImported: 'Nothing imported — check the errors below.',
    importFailed: 'Import failed',
    bulkTitle: 'Bulk import players',
    bulkDesc: 'Paste CSV text or upload a .csv file. Headers:',
    downloadTemplate: 'Download CSV template',
    uploadFile: 'Upload file',
    orPaste: '…or paste CSV',
    created: (n: number) => `Created ${n} players`,
    rowsSkipped: (n: number) => `${n} row(s) skipped:`,
    rowError: (row: number, error: string) => `Row ${row}: ${error}`,
    close: 'Close',
    importPlayers: 'Import players',
    previewRows: 'Preview rows',
    checking: 'Checking…',
    tooManyRows: 'A CSV can have at most 2000 rows.',
    noRows: 'No player rows found in this CSV.',
    importN: (n: number) => `Import ${n} player${n === 1 ? '' : 's'}`,
    editCsv: 'Back to CSV',
    skippedN: (n: number) => `${n} duplicate${n === 1 ? '' : 's'} skipped`,
  },
  bn: {
    ...SHARED_STRINGS.bn,
    readFailed: 'ফাইলটি পড়া যায়নি',
    pasteFirst: 'আগে CSV লেখা পেস্ট করুন বা একটি ফাইল বেছে নিন।',
    imported: (n: number) => `${n} জন খেলোয়াড় ইমপোর্ট হয়েছে`,
    nothingImported: 'কিছুই ইমপোর্ট হয়নি — নিচের ত্রুটিগুলো দেখুন।',
    importFailed: 'ইমপোর্ট করা যায়নি',
    bulkTitle: 'একসাথে খেলোয়াড় ইমপোর্ট',
    bulkDesc: 'CSV লেখা পেস্ট করুন বা একটি .csv ফাইল আপলোড করুন। কলামের নাম:',
    downloadTemplate: 'CSV টেমপ্লেট ডাউনলোড',
    uploadFile: 'ফাইল আপলোড',
    orPaste: '…অথবা CSV পেস্ট করুন',
    created: (n: number) => `${n} জন খেলোয়াড় তৈরি হয়েছে`,
    rowsSkipped: (n: number) => `${n}টি সারি বাদ পড়েছে:`,
    rowError: (row: number, error: string) => `সারি ${row}: ${error}`,
    close: 'বন্ধ করুন',
    importPlayers: 'খেলোয়াড় ইমপোর্ট করুন',
    previewRows: 'সারিগুলো দেখে নিন',
    checking: 'যাচাই হচ্ছে…',
    tooManyRows: 'একটি CSV-তে সর্বোচ্চ ২০০০টি সারি থাকতে পারে।',
    noRows: 'এই CSV-তে কোনো খেলোয়াড়ের সারি পাওয়া যায়নি।',
    importN: (n: number) => `${n} জন খেলোয়াড় ইমপোর্ট করুন`,
    editCsv: 'CSV-তে ফিরে যান',
    skippedN: (n: number) => `${n}টি ডুপ্লিকেট বাদ পড়েছে`,
  },
} satisfies Strings<
  SharedPlayersStrings & {
    readFailed: string
    pasteFirst: string
    imported: (n: number) => string
    nothingImported: string
    importFailed: string
    bulkTitle: string
    bulkDesc: string
    downloadTemplate: string
    uploadFile: string
    orPaste: string
    created: (n: number) => string
    rowsSkipped: (n: number) => string
    rowError: (row: number, error: string) => string
    close: string
    importPlayers: string
    previewRows: string
    checking: string
    tooManyRows: string
    noRows: string
    importN: (n: number) => string
    editCsv: string
    skippedN: (n: number) => string
  }
>

interface ImportResult {
  created: number
  skipped?: number
  errors: { row: number; error: string }[]
}

const MAX_IMPORT_ROWS = 2000

export function ImportDialog({
  open,
  onOpenChange,
  tournamentId,
  templateDownload,
  refetch,
  onUpgrade,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  templateDownload: () => void
  refetch: () => Promise<void>
  /** Set when the user may buy Pro: shown with a Free-plan limit error. */
  onUpgrade?: () => void
}) {
  const t = useStrings(STRINGS)
  const [csv, setCsvText] = useState('')
  const [busy, setBusy] = useState(false)
  // The dry run's verdict per row, plus the raw rows it was given (sent again on import).
  const [preview, setPreview] = useState<{ data: ImportPreview; raw: Map<number, Record<string, string>> } | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [unchecked, setUnchecked] = useState<Set<number>>(() => new Set())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)

  const setCsv = (text: string) => {
    setCsvText(text)
    setPreview(null)
    setPlanError(null)
  }

  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setCsv(text)
      void runPreview(text) // choosing a file goes straight to the preview
    }
    reader.onerror = () => toast.error(t.readFailed)
    reader.readAsText(file)
  }

  const isIncluded = (r: ImportPreviewRow) => r.ok && !unchecked.has(r.row) && !(skipDuplicates && r.duplicateOf)
  const selected = preview ? preview.data.results.filter(isIncluded) : []

  const runPreview = async (text: string = csv) => {
    if (!text.trim()) return toast.error(t.pasteFirst)
    const parsed = parseCsvObjects(text).rows
      .map((fields, i) => ({ row: i + 2, fields })) // header is row 1
      .filter(({ fields }) => Object.values(fields).some((v) => v.trim() !== ''))
    if (parsed.length === 0) return toast.error(t.noRows)
    if (parsed.length > MAX_IMPORT_ROWS) return toast.error(t.tooManyRows)
    setBusy(true)
    setResult(null)
    setPlanError(null)
    try {
      const data = await apiPost<ImportPreview>(`/api/tournaments/${tournamentId}/players/import`, {
        rows: parsed.map(({ row, fields }) => ({ ...fields, row })),
        dryRun: true,
      })
      setPreview({ data, raw: new Map(parsed.map(({ row, fields }) => [row, fields])) })
      setUnchecked(new Set())
    } catch (ex) {
      toast.error(ex instanceof ApiError ? ex.message : t.importFailed)
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    if (!preview || selected.length === 0) return
    setBusy(true)
    setPlanError(null)
    try {
      const res = await apiPost<ImportResult>(`/api/tournaments/${tournamentId}/players/import`, {
        rows: selected.map((r) => ({ ...preview.raw.get(r.row), row: r.row })),
        skipDuplicates,
      })
      setResult(res)
      if (res.created > 0) {
        toast.success(t.imported(res.created))
        setCsvText('')
        setPreview(null)
        await refetch()
      } else {
        toast.error(t.nothingImported)
      }
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 402) setPlanError(ex.message)
      else toast.error(ex instanceof ApiError ? ex.message : t.importFailed)
    } finally {
      setBusy(false)
    }
  }

  const toggleRow = (row: number, include: boolean) =>
    setUnchecked((prev) => {
      const next = new Set(prev)
      if (include) next.delete(row)
      else next.add(row)
      return next
    })

  const close = (next: boolean) => {
    if (!next) {
      setResult(null)
      setPlanError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={preview ? 'sm:max-w-4xl' : 'sm:max-w-xl'}>
        <DialogHeader>
          <DialogTitle>{t.bulkTitle}</DialogTitle>
          <DialogDescription>
            {t.bulkDesc} <code className="rounded bg-muted px-1">Name, Phone, Role, Category, Base Price, Previous Team</code>
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <ImportPreviewPanel
            preview={preview.data}
            skipDuplicates={skipDuplicates}
            setSkipDuplicates={setSkipDuplicates}
            isIncluded={isIncluded}
            toggleRow={toggleRow}
          />
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={templateDownload}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Download className="h-4 w-4" aria-hidden /> {t.downloadTemplate}
            </button>

            <div className="space-y-1.5">
              <Label htmlFor="csv-file">{t.uploadFile}</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  onFile(e.target.files?.[0] ?? null)
                  e.target.value = '' // choosing the same file again still triggers a preview
                }}
                className="h-11 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-medium file:text-primary-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="csv-text">{t.orPaste}</Label>
              <Textarea
                id="csv-text"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={6}
                placeholder={'Name,Phone,Role,Category,Base Price,Previous Team\nShakib Hasan,01712345678,Batsman,A,50000,Mirpur Club'}
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        {planError ? (
          <div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{planError}</p>
              <p className="mt-0.5 text-xs">{onUpgrade ? t.upgradeHint : t.upgradeAskOwner}</p>
              {onUpgrade ? (
                <Button size="sm" className="mt-2" onClick={onUpgrade}>
                  {t.upgrade}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t.created(result.created)}</p>
            {result.skipped ? <p className="text-xs text-muted-foreground">{t.skippedN(result.skipped)}</p> : null}
            {result.errors.length > 0 ? (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{t.rowsSkipped(result.errors.length)}</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {t.rowError(e.row, e.error)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {preview ? (
            <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
              {t.editCsv}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => close(false)} disabled={busy}>
              {t.close}
            </Button>
          )}
          {preview ? (
            <Button onClick={() => void runImport()} disabled={busy || selected.length === 0} className="min-h-10">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-4 w-4" aria-hidden />}
              {t.importN(selected.length)}
            </Button>
          ) : (
            <Button onClick={() => void runPreview()} disabled={busy} className="min-h-10">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="mr-1.5 h-4 w-4" aria-hidden />}
              {busy ? t.checking : t.previewRows}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
