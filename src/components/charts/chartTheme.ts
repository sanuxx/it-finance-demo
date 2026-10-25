import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/lib/formatting'

/**
 * Chart conventions (see docs): categorical colours are assigned in a fixed
 * order from the validated palette, never cycled past 8 — fold extras into
 * "Other". One y-axis per chart. Recessive grid and axes.
 */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'] as const

export function seriesColor(index: number): string {
  return SERIES[Math.min(index, SERIES.length - 1)]!
}

/** Keep the top N categories and fold the rest into "Other". */
export function foldOther<T extends { name: string; value: number }>(items: T[], max = 6): { name: string; value: number }[] {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return sorted
  const head = sorted.slice(0, max - 1)
  const rest = sorted.slice(max - 1).reduce((s, i) => s + i.value, 0)
  return [...head, { name: 'Other', value: Math.round(rest * 100) / 100 }]
}

export const axisProps = {
  stroke: 'var(--muted-foreground)',
  tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const gridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  vertical: false,
} as const

export const currencyTick = (v: number) => formatCompactCurrency(v).replace('LKR ', '')

export type ValueFormat = 'currency' | 'number' | 'percent'

export function formatValue(v: number, format: ValueFormat = 'currency') {
  return format === 'currency' ? formatCurrency(v) : format === 'percent' ? formatPercent(v) : formatNumber(v)
}
