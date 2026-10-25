import type { RuleActionType, RuleCondition, RuleEntity, RuleField } from '@/domain'
import { RULE_FIELD_LABELS, RULE_OPERATOR_LABELS } from '@/lib/rules/engine'
import type { Lookups } from '@/hooks/useData'

export const ENTITY_LABELS: Record<RuleEntity, string> = {
  expense: 'Expense claims',
  invoice: 'Invoices',
  purchase_order: 'Purchase orders',
  supplier_bill: 'Supplier bills',
  project: 'Projects',
}

export const ACTION_LABELS: Record<RuleActionType, string> = {
  notify: 'Show a notification',
  flag_for_review: 'Mark for review',
  escalate_approval: 'Escalate approval (simulated)',
  budget_warning: 'Display a budget warning',
}

/** Fields that make sense for each record type. */
export const ENTITY_FIELDS: Record<RuleEntity, RuleField[]> = {
  expense: ['amount', 'categoryId', 'projectId', 'departmentId', 'status', 'billable', 'budgetConsumptionPercent'],
  invoice: ['amount', 'projectId', 'status', 'daysUntilDue'],
  purchase_order: ['amount', 'projectId', 'departmentId', 'status'],
  supplier_bill: ['amount', 'categoryId', 'projectId', 'departmentId', 'status', 'daysUntilDue'],
  project: ['budgetConsumptionPercent', 'amount', 'departmentId', 'status'],
}

export const STATUS_OPTIONS: Record<RuleEntity, string[]> = {
  expense: ['draft', 'submitted', 'approved', 'rejected', 'reimbursed'],
  invoice: ['draft', 'issued', 'partially_paid', 'paid', 'void'],
  purchase_order: ['draft', 'pending_approval', 'approved', 'sent', 'received', 'closed', 'cancelled'],
  supplier_bill: ['draft', 'awaiting_approval', 'approved', 'partially_paid', 'paid', 'void'],
  project: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
}

export function describeValue(field: RuleField, value: RuleCondition['value'], lookups: Lookups): string {
  if (Array.isArray(value)) return value.map((v) => describeValue(field, v, lookups)).join(', ')
  if (value === '' || value === undefined || value === null) return '(none)'
  if (field === 'categoryId' || field === 'departmentId') return lookups.master(String(value))
  if (field === 'projectId') return lookups.projectCode(String(value))
  if (field === 'amount') return `LKR ${Number(value).toLocaleString('en-LK')}`
  if (field === 'budgetConsumptionPercent') return `${value}%`
  if (field === 'billable') return value === true || value === 'true' ? 'Yes' : 'No'
  return String(value).replace(/_/g, ' ')
}

export function describeCondition(c: RuleCondition, lookups: Lookups): string {
  return `${RULE_FIELD_LABELS[c.field]} ${RULE_OPERATOR_LABELS[c.operator]} ${describeValue(c.field, c.value, lookups)}`
}
