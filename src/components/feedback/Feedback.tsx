import type { ReactNode } from 'react'
import { FlaskConical, Inbox, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center', className)}>
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full [&_svg]:size-5">{icon ?? <Inbox />}</div>
      <p className="font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Callout used wherever an action is simulated (payments, emails, approvals, postings). */
export function SimulatedNotice({ children, className, tone = 'info' }: { children: ReactNode; className?: string; tone?: 'info' | 'warning' | 'demo' }) {
  const Icon = tone === 'warning' ? TriangleAlert : tone === 'demo' ? FlaskConical : Info
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed',
        tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'border-info/30 bg-info/5',
        className,
      )}
    >
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', tone === 'warning' ? 'text-warning' : 'text-info')} aria-hidden />
      <div className="text-foreground/80">{children}</div>
    </div>
  )
}

export function DemoBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', className)}>
      <FlaskConical className="size-3" aria-hidden />
      {compact ? 'Demo' : 'Interactive Demo — Sample Data'}
    </span>
  )
}

export function EstimateTag({ label = 'Illustrative estimate' }: { label?: string }) {
  return <span className="text-muted-foreground rounded border border-dashed px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">{label}</span>
}
