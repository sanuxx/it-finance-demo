import type { RoleKey } from '@/domain'

/**
 * Simulated, UI-only permission model.
 *
 * This only changes what the interface shows. It is NOT security: everything
 * runs in the visitor's browser. The future NestJS backend must enforce real
 * authorisation independently.
 */
export type Permission =
  | 'dashboard.executive'
  | 'finance.view'
  | 'finance.edit'
  | 'ledger.post'
  | 'periods.manage'
  | 'sales.view'
  | 'sales.edit'
  | 'invoices.issue'
  | 'payments.record'
  | 'expenses.submit'
  | 'expenses.approve'
  | 'procurement.view'
  | 'procurement.edit'
  | 'procurement.approve'
  | 'projects.view'
  | 'projects.edit'
  | 'costs.sensitive'
  | 'timesheets.approve'
  | 'saas.view'
  | 'saas.edit'
  | 'budgets.view'
  | 'budgets.edit'
  | 'budgets.approve'
  | 'assets.view'
  | 'assets.edit'
  | 'reports.view'
  | 'reports.build'
  | 'config.view'
  | 'config.edit'
  | 'admin.view'
  | 'admin.manage'

const ALL: Permission[] = [
  'dashboard.executive', 'finance.view', 'finance.edit', 'ledger.post', 'periods.manage', 'sales.view', 'sales.edit', 'invoices.issue',
  'payments.record', 'expenses.submit', 'expenses.approve', 'procurement.view', 'procurement.edit', 'procurement.approve', 'projects.view',
  'projects.edit', 'costs.sensitive', 'timesheets.approve', 'saas.view', 'saas.edit', 'budgets.view', 'budgets.edit', 'budgets.approve',
  'assets.view', 'assets.edit', 'reports.view', 'reports.build', 'config.view', 'config.edit', 'admin.view', 'admin.manage',
]

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  director: ALL,
  finance_manager: ALL,
  accountant: [
    'dashboard.executive', 'finance.view', 'finance.edit', 'ledger.post', 'sales.view', 'sales.edit', 'invoices.issue', 'payments.record',
    'expenses.submit', 'procurement.view', 'procurement.edit', 'projects.view', 'saas.view', 'saas.edit', 'budgets.view', 'assets.view',
    'assets.edit', 'reports.view', 'reports.build', 'config.view', 'admin.view',
  ],
  project_manager: [
    'projects.view', 'projects.edit', 'timesheets.approve', 'expenses.submit', 'expenses.approve', 'procurement.view', 'procurement.edit',
    'sales.view', 'budgets.view', 'saas.view', 'reports.view', 'reports.build',
  ],
  employee: ['expenses.submit', 'projects.view'],
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.executive': 'View executive dashboards',
  'finance.view': 'View finance records',
  'finance.edit': 'Edit finance records',
  'ledger.post': 'Post journal entries (illustrative)',
  'periods.manage': 'Open and close financial periods',
  'sales.view': 'View customers, contracts and invoices',
  'sales.edit': 'Create and edit sales documents',
  'invoices.issue': 'Issue invoices (simulated)',
  'payments.record': 'Record simulated payments',
  'expenses.submit': 'Submit expense claims',
  'expenses.approve': 'Approve or reject expense claims',
  'procurement.view': 'View procurement',
  'procurement.edit': 'Raise purchase requests and orders',
  'procurement.approve': 'Approve purchases and supplier bills',
  'projects.view': 'View projects',
  'projects.edit': 'Create and edit projects and costs',
  'costs.sensitive': 'View employee cost rates',
  'timesheets.approve': 'Approve timesheets',
  'saas.view': 'View SaaS and technology costs',
  'saas.edit': 'Edit subscriptions and cloud costs',
  'budgets.view': 'View budgets and forecasts',
  'budgets.edit': 'Create and edit budgets',
  'budgets.approve': 'Approve budgets',
  'assets.view': 'View assets and compliance',
  'assets.edit': 'Edit assets and compliance settings',
  'reports.view': 'View reports',
  'reports.build': 'Build and save custom reports',
  'config.view': 'View configuration centre',
  'config.edit': 'Change no-code configuration',
  'admin.view': 'View administration',
  'admin.manage': 'Manage users, settings and demo data',
}

export function can(role: RoleKey, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
