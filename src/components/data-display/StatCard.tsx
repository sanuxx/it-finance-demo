import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Term } from './Term'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Glossary term for the label tooltip (defaults to the label). */
  term?: string
  hint?: ReactNode
  /** Percentage change vs. comparison period. */
  delta?: number | null
  /** When true, a decrease is good (e.g. expenses). */
  invertDelta?: boolean
  deltaLabel?: string
  icon?: ReactNode
  to?: string
  estimate?: boolean
  className?: string
}

/** KPI tile. Links to the underlying records when `to` is set (drill-down). */
export function StatCard({ label, value, term, hint, delta, invertDelta, deltaLabel = 'vs previous period', icon, to, estimate, className }: StatCardProps) {
  const good = delta === null || delta === undefined ? null : invertDelta ? delta < 0 : delta > 0
  const content = (
    <Card className={cn('gap-2 p-4 h-full transition-colors', to && 'hover:border-primary/40 hover:bg-accent/30', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          <Term term={term ?? label}>{label}</Term>
        </div>
        {icon ? <div className="text-muted-foreground [&_svg]:size-4">{icon}</div> : null}
      </div>
      <div className="tabular text-2xl font-semibold tracking-tight">
        {value}
        {estimate ? (
          <span className="text-muted-foreground ml-2 align-middle text-[10px] font-medium tracking-wide uppercase">est.</span>
        ) : null}
      </div>
      <div className="flex min-h-5 items-center justify-between gap-2 text-xs">
        {delta !== undefined && delta !== null ? (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-success' : delta === 0 ? 'text-muted-foreground' : 'text-destructive')}>
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
            {Math.abs(delta).toFixed(1)}%<span className="text-muted-foreground ml-1 font-normal">{deltaLabel}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{hint}</span>
        )}
        {to ? <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden /> : null}
      </div>
      {delta !== undefined && delta !== null && hint ? <div className="text-muted-foreground -mt-1 text-xs">{hint}</div> : null}
    </Card>
  )
  return to ? (
    <Link to={to} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${label} — view details`}>
      {content}
    </Link>
  ) : (
    content
  )
}
