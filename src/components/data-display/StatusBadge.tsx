import { cn } from '@/lib/utils'
import { statusLabel, statusTone, type Tone } from './statusMeta'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground border-border',
  muted: 'bg-muted text-muted-foreground border-border',
  info: 'bg-info/10 text-info border-info/25',
  primary: 'bg-primary/10 text-primary border-primary/25',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/15 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))] border-warning/30',
  danger: 'bg-destructive/10 text-destructive border-destructive/25',
}

const DOT_CLASS: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  muted: 'bg-muted-foreground/60',
  info: 'bg-info',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

/** Status pill: always text + dot, never colour alone. */
export function StatusBadge({ status, label, tone, className }: { status: string; label?: string; tone?: Tone; className?: string }) {
  const t = tone ?? statusTone(status)
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONE_CLASS[t], className)}
      data-status={status}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT_CLASS[t])} />
      {label ?? statusLabel(status)}
    </span>
  )
}
