import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import type { CurrencyCode } from '@/domain'
import { usePreferences } from '@/app/state/preferences'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

function currencyFormatter(currency: string, compact: boolean, decimals: number) {
  const key = `${currency}|${compact}|${decimals}`
  let f = currencyFormatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'LKR' ? 'code' : 'narrowSymbol',
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: compact ? 0 : decimals,
      maximumFractionDigits: compact ? 1 : decimals,
    })
    currencyFormatters.set(key, f)
  }
  return f
}

/** "LKR 1,250,000.00" (or compact "LKR 1.3M"). Non-breaking space after the code. */
export function formatCurrency(
  amount: number | null | undefined,
  currency: CurrencyCode | string = 'LKR',
  options: { compact?: boolean; decimals?: number } = {},
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
  const value = Object.is(amount, -0) ? 0 : amount
  return currencyFormatter(currency, !!options.compact, options.decimals ?? 2).format(value).replace(/\s/g, ' ')
}

export function formatCompactCurrency(amount: number | null | undefined, currency: CurrencyCode | string = 'LKR'): string {
  return formatCurrency(amount, currency, { compact: true })
}

const numberFormat = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 })
const compactNumber = new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 })

export function formatNumber(value: number | null | undefined, options: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return (options.compact ? compactNumber : numberFormat).format(value)
}

/** Percentage from a percent value (12.5 → "12.5%"). */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

export function formatDate(value: string | null | undefined, pattern?: string): string {
  if (!value) return '—'
  const d = parseISO(value)
  if (!isValid(d)) return value
  return format(d, pattern ?? usePreferences.getState().dateFormat)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = parseISO(value)
  if (!isValid(d)) return value
  return format(d, `${usePreferences.getState().dateFormat}, HH:mm`)
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const d = parseISO(value)
  if (!isValid(d)) return value
  return `${formatDistanceToNowStrict(d)} ago`
}

export function formatMonth(key: string): string {
  const d = parseISO(key.length === 7 ? `${key}-01` : key)
  return isValid(d) ? format(d, 'MMM yyyy') : key
}

/** "draft" / "partially_paid" → "Draft" / "Partially paid". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  const s = value.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
