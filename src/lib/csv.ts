// Minimal dependency-free CSV utilities (server + client safe)
// Handles quoted fields, escaped quotes ("") and \r\n line breaks. Strips BOM.

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field.trim())
      field = ''
    } else if (ch === '\n') {
      row.push(field.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // skip — handled by \n
    } else {
      field += ch
    }
  }
  row.push(field.trim())
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

export interface CsvParseResult {
  headers: string[]
  rows: Record<string, string>[]
}

/** Parse CSV into objects keyed by (normalized) header names. */
export function parseCsvObjects(input: string): CsvParseResult {
  const matrix = parseCsv(input)
  if (matrix.length === 0) return { headers: [], rows: [] }
  const headers = matrix[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))
  const rows = matrix.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim()
    })
    return obj
  })
  return { headers, rows }
}

/**
 * Spreadsheet apps execute a cell that starts with = + - @ (or a tab/CR) as a
 * formula, and names in our exports come from organizers' CSV imports. Such
 * text cells are prefixed with ' so they display as text. Plain numbers and
 * phone-style values (+880 1712-345678, -5) are left alone — they evaluate to
 * a harmless number at worst and must stay readable.
 */
export function neutralizeFormula(s: string): string {
  if (/^[=@\t\r]/.test(s)) return `'${s}`
  if (/^[+-]/.test(s) && !/^[+-][\d\s().-]*$/.test(s)) return `'${s}`
  return s
}

/** Serialize rows to CSV string with optional header row. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : typeof v === 'string' ? neutralizeFormula(v) : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(esc).join(',')]
  for (const row of rows) lines.push(row.map(esc).join(','))
  return lines.join('\r\n')
}
