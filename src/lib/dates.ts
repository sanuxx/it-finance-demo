import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns'
import type { ISODate } from '@/domain'

/** Format a Date as an ISO calendar date (yyyy-MM-dd) in local time. */
export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function parseDate(value: ISODate | undefined | null): Date | null {
  if (!value) return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

/** Inclusive date-range test on ISO strings (lexicographic compare is safe for yyyy-MM-dd). */
export function inRange(date: ISODate, from?: ISODate, to?: ISODate): boolean {
  const d = date.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

/** "2026-03" month key. */
export function monthKey(date: ISODate): string {
  return date.slice(0, 7)
}

export function monthStartISO(date: Date): ISODate {
  return toISODate(startOfMonth(date))
}

export function monthEndISO(date: Date): ISODate {
  return toISODate(endOfMonth(date))
}

/** List of month keys (yyyy-MM) ending at `end` (inclusive), `count` long. */
export function lastNMonths(count: number, end: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(format(addMonths(startOfMonth(end), -i), 'yyyy-MM'))
  return out
}

/** Month keys from `from` to `to` inclusive. */
export function monthsBetween(from: ISODate, to: ISODate): string[] {
  const out: string[] = []
  let cursor = startOfMonth(parseISO(from))
  const last = startOfMonth(parseISO(to))
  let guard = 0
  while (cursor <= last && guard++ < 240) {
    out.push(format(cursor, 'yyyy-MM'))
    cursor = addMonths(cursor, 1)
  }
  return out
}

export function monthLabel(key: string): string {
  const d = parseISO(`${key}-01`)
  return isValid(d) ? format(d, 'MMM yy') : key
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseDate(from)
  const b = parseDate(to)
  if (!a || !b) return 0
  return differenceInCalendarDays(b, a)
}

export type DatePreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_12_months' | 'ytd' | 'all'

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  last_12_months: 'Last 12 months',
  ytd: 'Year to date',
  all: 'All time',
}

export interface DateRange {
  from?: ISODate
  to?: ISODate
}

export function presetRange(preset: DatePreset, now: Date = new Date()): DateRange {
  const som = startOfMonth(now)
  switch (preset) {
    case 'this_month':
      return { from: toISODate(som), to: toISODate(endOfMonth(now)) }
    case 'last_month':
      return { from: toISODate(addMonths(som, -1)), to: toISODate(endOfMonth(addMonths(som, -1))) }
    case 'last_3_months':
      return { from: toISODate(addMonths(som, -2)), to: toISODate(endOfMonth(now)) }
    case 'last_6_months':
      return { from: toISODate(addMonths(som, -5)), to: toISODate(endOfMonth(now)) }
    case 'last_12_months':
      return { from: toISODate(addMonths(som, -11)), to: toISODate(endOfMonth(now)) }
    case 'ytd':
      return { from: `${now.getFullYear()}-01-01`, to: toISODate(endOfMonth(now)) }
    case 'all':
      return {}
  }
}

/** The equally long range immediately before `range` (for period comparisons). */
export function previousRange(range: DateRange): DateRange {
  if (!range.from || !range.to) return {}
  const from = parseISO(range.from)
  const to = parseISO(range.to)
  const months = Math.max(1, Math.round(differenceInCalendarDays(to, from) / 30.4))
  return { from: toISODate(addMonths(from, -months)), to: toISODate(endOfMonth(addMonths(from, -1))) }
}
