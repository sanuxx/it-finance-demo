import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions, meta, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground max-w-3xl text-sm">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Titled card section used throughout detail pages. */
export function Section({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card text-card-foreground rounded-2xl border border-border/70 shadow-sm', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-6 py-4">
          <div>
            {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
            {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  )
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
}
