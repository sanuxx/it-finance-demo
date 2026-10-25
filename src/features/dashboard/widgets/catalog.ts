import type { DashboardWidget, WidgetType } from '@/domain'

export interface WidgetCatalogEntry {
  type: WidgetType
  title: string
  description: string
  size: DashboardWidget['size']
  kind: 'kpi' | 'chart' | 'table' | 'list'
  /** Supports a configurable history length in months. */
  hasMonths?: boolean
}

export const WIDGET_CATALOG: Record<WidgetType, WidgetCatalogEntry> = {
  kpi_revenue: { type: 'kpi_revenue', title: 'Revenue', description: 'Invoiced revenue net of tax and credit notes for the period.', size: 'sm', kind: 'kpi' },
  kpi_expenses: { type: 'kpi_expenses', title: 'Expenses', description: 'Operating expenses from personnel, bills, claims, cloud, AI, licences and depreciation.', size: 'sm', kind: 'kpi' },
  kpi_profit: { type: 'kpi_profit', title: 'Net profit', description: 'Revenue less expenses for the period (illustrative).', size: 'sm', kind: 'kpi' },
  kpi_margin: { type: 'kpi_margin', title: 'Profit margin', description: 'Net profit as a percentage of revenue.', size: 'sm', kind: 'kpi' },
  kpi_cash: { type: 'kpi_cash', title: 'Cash position', description: 'Simulated bank balances today.', size: 'sm', kind: 'kpi' },
  kpi_receivables: { type: 'kpi_receivables', title: 'Outstanding receivables', description: 'Unpaid balances on issued invoices.', size: 'sm', kind: 'kpi' },
  kpi_payables: { type: 'kpi_payables', title: 'Outstanding payables', description: 'Unpaid balances on approved supplier bills.', size: 'sm', kind: 'kpi' },
  kpi_overdue: { type: 'kpi_overdue', title: 'Overdue invoices', description: 'Invoices past their due date with a balance.', size: 'sm', kind: 'kpi' },
  kpi_budget: { type: 'kpi_budget', title: 'Budget utilisation', description: 'Actual spend against approved company operating budgets this fiscal year.', size: 'sm', kind: 'kpi' },
  kpi_mrr: { type: 'kpi_mrr', title: 'Monthly recurring revenue', description: 'Normalised monthly value of live SaaS subscriptions.', size: 'sm', kind: 'kpi' },
  chart_income_expense: { type: 'chart_income_expense', title: 'Income vs expenses', description: 'Monthly revenue and expenses with net profit.', size: 'lg', kind: 'chart', hasMonths: true },
  chart_revenue_mix: { type: 'chart_revenue_mix', title: 'Revenue by service', description: 'Revenue split by income category for the period.', size: 'md', kind: 'chart' },
  chart_cloud_trend: { type: 'chart_cloud_trend', title: 'Cloud & AI spend', description: 'Monthly cloud and AI cost.', size: 'md', kind: 'chart', hasMonths: true },
  table_top_projects: { type: 'table_top_projects', title: 'Top projects by profitability', description: 'Highest estimated profit (direct-cost margin).', size: 'md', kind: 'table' },
  table_recent_transactions: { type: 'table_recent_transactions', title: 'Recent transactions', description: 'Latest simulated receipts and payments.', size: 'md', kind: 'table' },
  list_pending_approvals: { type: 'list_pending_approvals', title: 'Pending approvals', description: 'Requests waiting for a decision.', size: 'md', kind: 'list' },
  list_upcoming_obligations: { type: 'list_upcoming_obligations', title: 'Upcoming obligations', description: 'Bills, renewals and payroll due in the next 30 days.', size: 'md', kind: 'list' },
  list_activity: { type: 'list_activity', title: 'Recent activity', description: 'Latest changes recorded in the audit log.', size: 'md', kind: 'list' },
}

export const WIDGET_TYPES = Object.keys(WIDGET_CATALOG) as WidgetType[]

/** Grid span classes for a 4-column dashboard grid. */
export const SIZE_CLASS: Record<DashboardWidget['size'], string> = {
  sm: 'col-span-4 sm:col-span-2 xl:col-span-1',
  md: 'col-span-4 xl:col-span-2',
  lg: 'col-span-4',
}

export const SIZE_LABEL: Record<DashboardWidget['size'], string> = { sm: 'Small (¼ width)', md: 'Medium (½ width)', lg: 'Large (full width)' }
