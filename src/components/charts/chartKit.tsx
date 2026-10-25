import type { ReactNode } from 'react'
import { formatValue, type ValueFormat } from './chartTheme'

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
