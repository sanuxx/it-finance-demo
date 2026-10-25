import type { ReactNode } from 'react'
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

interface TooltipPayloadItem {
  name?: string | number
  value?: number | string
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

/** Tooltip body for Recharts: `<Tooltip content={<ChartTooltip />} />`. */
export function ChartTooltip({ active, payload, label, format = 'currency', labelFormatter }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: ReactNode; format?: ValueFormat; labelFormatter?: (label: ReactNode) => ReactNode }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover text-popover-foreground min-w-40 rounded-md border px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== '' ? <div className="mb-1 font-medium">{labelFormatter ? labelFormatter(label) : label}</div> : null}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="tabular font-medium">{typeof p.value === 'number' ? formatValue(p.value, format) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Simple legend row (always shown for ≥ 2 series). */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 text-xs">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm" style={i.dashed ? { border: `1.5px dashed ${i.color}` } : { background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
