import { formatCurrency, formatDate, formatMonth, formatNumber, formatPercent, humanize } from '@/lib/formatting'
import type { CellFormat, ReportResult, ReportRow } from '../registry'

export function formatCell(value: unknown, format: CellFormat = 'text'): string {
  if (value === null || value === undefined || value === '') return '—'
  switch (format) {
    case 'currency':
      return formatCurrency(Number(value))
    case 'percent':
      return formatPercent(Number(value))
    case 'number':
      return formatNumber(Number(value))
    case 'date':
      return formatDate(String(value))
    case 'month':
      return /^\d{4}-\d{2}/.test(String(value)) ? formatMonth(String(value)) : String(value)
    default:
      return typeof value === 'string' && /^[a-z]+(_[a-z]+)*$/.test(value) ? humanize(value) : String(value)
  }
}

/** Flatten a report result for CSV export. */
export function reportExportColumns(result: ReportResult) {
  return result.columns.map((c) => ({ header: c.header, value: (r: ReportRow) => (r[c.key] ?? '') as string | number }))
}
