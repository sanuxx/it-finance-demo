import { humanize } from '@/lib/formatting'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'primary'

/** Shared status → tone mapping so the same status looks identical everywhere. */
export const STATUS_TONE: Record<string, Tone> = {
  draft: 'muted',
  planning: 'muted',
  pending: 'warning',
  pending_approval: 'warning',
  awaiting_approval: 'warning',
  submitted: 'warning',
  in_progress: 'info',
  issued: 'info',
  sent: 'info',
  open: 'info',
  closing: 'warning',
  trial: 'info',
  revision: 'warning',
  on_hold: 'warning',
  at_risk: 'warning',
  partially_paid: 'primary',
  approved: 'success',
  accepted: 'success',
  active: 'success',
  paid: 'success',
  completed: 'success',
  received: 'success',
  reimbursed: 'success',
  applied: 'success',
  published: 'success',
  posted: 'success',
  on_track: 'success',
  connected_demo: 'success',
  invoiced: 'success',
  converted: 'success',
  reconciled: 'success',
  closed: 'neutral',
  inactive: 'neutral',
  not_connected: 'neutral',
  coming_soon: 'neutral',
  prospect: 'info',
  not_started: 'muted',
  fully_depreciated: 'neutral',
  disposed: 'neutral',
  reversed: 'neutral',
  overdue: 'danger',
  past_due: 'danger',
  rejected: 'danger',
  declined: 'danger',
  void: 'danger',
  cancelled: 'danger',
  terminated: 'danger',
  expired: 'neutral',
  over_budget: 'danger',
  exceeded: 'danger',
  over_pace: 'warning',
  on_pace: 'success',
  under: 'info',
}

export const STATUS_LABELS: Record<string, string> = {
  partially_paid: 'Part paid',
  pending_approval: 'Pending approval',
  awaiting_approval: 'Awaiting approval',
  connected_demo: 'Connected (demo)',
  not_connected: 'Not connected',
  on_track: 'On track',
  at_risk: 'At risk',
  over_budget: 'Over budget',
  not_started: 'Not started',
  past_due: 'Past due',
  over_pace: 'Ahead of plan',
  on_pace: 'On plan',
  under: 'Under budget',
  exceeded: 'Exceeded',
  fully_depreciated: 'Fully depreciated',
}

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] ?? 'neutral'
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? humanize(status)
}
