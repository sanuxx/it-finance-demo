import type { WorkflowDefinition, WorkflowEntity } from '@/domain'

export type WorkflowTemplate = Pick<WorkflowDefinition, 'name' | 'description' | 'entity' | 'stages'> & { key: string }

export const WORKFLOW_ENTITY_LABELS: Record<WorkflowEntity, string> = {
  expense: 'Expense claims',
  purchase_order: 'Purchase orders',
  invoice: 'Invoices',
  budget: 'Budgets',
  purchase_request: 'Purchase requests',
}

const s = (id: string, rest: Omit<WorkflowDefinition['stages'][number], 'id'>) => ({ id, ...rest })

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'expense',
    name: 'Expense approval',
    description: 'Line manager approval, finance approval above LKR 25,000, then accountant notified.',
    entity: 'expense',
    stages: [
      s('t1', { name: 'Line manager approval', type: 'approval', assigneeRole: 'project_manager', slaHours: 24, requireComment: false }),
      s('t2', { name: 'Finance approval', type: 'approval', assigneeRole: 'finance_manager', condition: { field: 'amount', operator: 'gte', value: 25_000 }, slaHours: 48, requireComment: false }),
      s('t3', { name: 'Notify accountant', type: 'notification', assigneeRole: 'accountant', slaHours: 0, requireComment: false }),
    ],
  },
  {
    key: 'purchase',
    name: 'Purchase approval',
    description: 'Budget holder, finance above LKR 250,000 and director above LKR 1.5M.',
    entity: 'purchase_order',
    stages: [
      s('t1', { name: 'Budget holder approval', type: 'approval', assigneeRole: 'project_manager', slaHours: 24, requireComment: false }),
      s('t2', { name: 'Finance manager approval', type: 'approval', assigneeRole: 'finance_manager', condition: { field: 'amount', operator: 'gte', value: 250_000 }, slaHours: 48, requireComment: true }),
      s('t3', { name: 'Director approval', type: 'approval', assigneeRole: 'director', condition: { field: 'amount', operator: 'gte', value: 1_500_000 }, slaHours: 72, requireComment: true }),
    ],
  },
  {
    key: 'invoice',
    name: 'Invoice review',
    description: 'Accountant check, with finance sign-off for invoices of LKR 1M or more.',
    entity: 'invoice',
    stages: [
      s('t1', { name: 'Accountant check', type: 'review', assigneeRole: 'accountant', slaHours: 8, requireComment: false }),
      s('t2', { name: 'Finance manager sign-off', type: 'approval', assigneeRole: 'finance_manager', condition: { field: 'amount', operator: 'gte', value: 1_000_000 }, slaHours: 24, requireComment: false }),
    ],
  },
  {
    key: 'budget',
    name: 'Budget revision approval',
    description: 'Finance review followed by director approval for budget changes.',
    entity: 'budget',
    stages: [
      s('t1', { name: 'Finance manager review', type: 'review', assigneeRole: 'finance_manager', slaHours: 48, requireComment: true }),
      s('t2', { name: 'Director approval', type: 'approval', assigneeRole: 'director', slaHours: 72, requireComment: true }),
    ],
  },
]
