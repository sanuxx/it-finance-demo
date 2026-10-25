import { formatCurrency, formatPercent } from '@/lib/formatting'
import { percentOf } from '@/lib/calculations/money'

/** Ranked list with a thin magnitude bar — a compact alternative to a pie chart. */
export function BreakdownList({ items, empty = 'No data for this period.', max = 8 }: { items: { key: string; label: string; amount: number; hint?: string }[]; empty?: string; max?: number }) {
  if (!items.length) return <p className="text-muted-foreground text-sm">{empty}</p>
  const total = items.reduce((s, i) => s + i.amount, 0)
  const top = items[0]?.amount || 1
  const shown = items.slice(0, max)
  const rest = items.slice(max)
  const rows = rest.length ? [...shown, { key: '__other', label: `Other (${rest.length})`, amount: rest.reduce((s, i) => s + i.amount, 0) }] : shown
  return (
    <ul className="space-y-2.5">
      {rows.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {i.label}
              {'hint' in i && i.hint ? <span className="text-muted-foreground ml-1 text-xs">{i.hint}</span> : null}
            </span>
            <span className="tabular shrink-0">
              {formatCurrency(i.amount)}
              <span className="text-muted-foreground ml-2 inline-block w-11 text-right text-xs">{formatPercent(percentOf(i.amount, total))}</span>
            </span>
          </div>
          <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div className="bg-chart-1 h-full rounded-full" style={{ width: `${Math.max(2, (i.amount / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
