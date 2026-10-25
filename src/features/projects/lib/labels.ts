import type { BillingModel, CostType, MilestoneStatus, ProjectStatus } from '@/domain'

export const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
  fixed_price: 'Fixed price',
  time_and_materials: 'Time & materials',
  retainer: 'Retainer',
  subscription: 'Subscription',
  milestone: 'Milestone',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const COST_TYPE_LABELS: Record<CostType, string> = {
  labour: 'Labour',
  infrastructure: 'Infrastructure',
  software: 'Software',
  subcontractor: 'Subcontractor',
  travel: 'Travel',
  other: 'Other',
}

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
}

export const toOptions = <K extends string>(labels: Record<K, string>) => (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }))
