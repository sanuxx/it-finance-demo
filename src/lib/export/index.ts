/** CSV / JSON export helpers. Files are generated in the browser only. */

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const header = columns.map((c) => escapeCsv(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCsv(c.value(r))).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCsv<T>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  // BOM so spreadsheet tools detect UTF-8 (e.g. "—" and "•").
  downloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, `﻿${toCsv(rows, columns)}`, 'text/csv')
}

export function exportJson(filename: string, data: unknown) {
  downloadFile(filename.endsWith('.json') ? filename : `${filename}.json`, JSON.stringify(data, null, 2), 'application/json')
}

export function timestampedName(base: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}`
}
