import type { ReactNode } from 'react'
import type { StatusChange } from '@/domain'
import { formatCurrency, formatDateTime } from '@/lib/formatting'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'

export interface DetailItem {
  label: ReactNode
  value: ReactNode
  full?: boolean
}

/** Key/value description list for record overviews. */
export function DetailList({ items, columns = 2, className }: { items: DetailItem[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3', className)}>
      {items.map((item, i) => (
        <div key={i} className={cn('min-w-0', item.full && 'sm:col-span-full')}>
          <dt className="text-muted-foreground text-xs font-medium">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words">{item.value ?? <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Currency amount with tabular figures; negatives in red with a minus sign (not colour alone). */
export function Money({ value, currency = 'LKR', compact, className, signed }: { value: number | null | undefined; currency?: string; compact?: boolean; className?: string; signed?: boolean }) {
  const negative = typeof value === 'number' && value < 0
  return (
    <span className={cn('tabular whitespace-nowrap', signed && negative && 'text-destructive', className)}>
      {formatCurrency(value, currency, { compact })}
    </span>
  )
}

/** Vertical status history timeline. */
export function ActivityTimeline({ items, empty = 'No activity yet.' }: { items: (StatusChange & { title?: string })[]; empty?: string }) {
  if (!items.length) return <p className="text-muted-foreground text-sm">{empty}</p>
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {[...items].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className="bg-background ring-border absolute top-1 -left-[25px] size-2.5 rounded-full ring-2" aria-hidden />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {h.title ? <span className="font-medium">{h.title}</span> : <StatusBadge status={h.status} />}
            <span className="text-muted-foreground text-xs">
              {h.by} · {formatDateTime(h.at)}
            </span>
          </div>
          {h.note ? <p className="text-muted-foreground mt-1 text-sm">{h.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}

/** Thin labelled progress bar with value text (accessible). */
export function ProgressBar({ value, max = 100, label, tone, className }: { value: number | null | undefined; max?: number; label?: string; tone?: 'auto' | 'primary'; className?: string }) {
  const pct = value === null || value === undefined || !max ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  const raw = value === null || value === undefined || !max ? 0 : (value / max) * 100
  const color = tone === 'primary' ? 'bg-primary' : raw > 100 ? 'bg-destructive' : raw > 85 ? 'bg-warning' : 'bg-success'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full" role="progressbar" aria-valuenow={Math.round(raw)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-muted-foreground w-11 shrink-0 text-right text-xs">{value === null || value === undefined ? '—' : `${raw.toFixed(0)}%`}</span>
    </div>
  )
}
