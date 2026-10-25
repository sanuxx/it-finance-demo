import type { DemoDatabase, ExpenseClaim, Invoice, Project, WidgetType } from '@/domain'
import { EXPENSE_CATEGORY } from './ids'

interface Ctx {
  day: (offset: number) => string
  ts: (date: string, hour?: number) => string
  created: string
  invoices: Invoice[]
  expenses: ExpenseClaim[]
  projects: Project[]
}

export const DEFAULT_DASHBOARD_WIDGETS: { type: WidgetType; title: string; size: 'sm' | 'md' | 'lg' }[] = [
  { type: 'kpi_revenue', title: 'Revenue', size: 'sm' },
  { type: 'kpi_expenses', title: 'Expenses', size: 'sm' },
  { type: 'kpi_profit', title: 'Net profit', size: 'sm' },
  { type: 'kpi_cash', title: 'Cash position', size: 'sm' },
  { type: 'chart_income_expense', title: 'Income vs expenses', size: 'lg' },
  { type: 'chart_revenue_mix', title: 'Revenue by service', size: 'md' },
  { type: 'kpi_receivables', title: 'Outstanding receivables', size: 'sm' },
  { type: 'kpi_payables', title: 'Outstanding payables', size: 'sm' },
  { type: 'kpi_overdue', title: 'Overdue invoices', size: 'sm' },
  { type: 'kpi_budget', title: 'Budget utilisation', size: 'sm' },
  { type: 'table_top_projects', title: 'Top projects by profitability', size: 'md' },
  { type: 'list_pending_approvals', title: 'Pending approvals', size: 'md' },
  { type: 'table_recent_transactions', title: 'Recent transactions', size: 'md' },
  { type: 'list_upcoming_obligations', title: 'Upcoming obligations', size: 'md' },
  { type: 'list_activity', title: 'Recent activity', size: 'md' },
]

export function defaultDashboard(updatedAt: string): DemoDatabase['dashboards'][number] {
  return {
    id: 'dash-executive',
    name: 'Executive dashboard',
    updatedAt,
    widgets: DEFAULT_DASHBOARD_WIDGETS.map((w, i) => ({ id: `w-${i + 1}`, ...w, months: w.type === 'chart_income_expense' ? 12 : undefined })),
  }
}

export function buildConfiguration({ day, ts, created, invoices, expenses, projects }: Ctx) {
  const customFields: DemoDatabase['customFields'] = [
    { id: 'cf-1', entity: 'project', key: 'deliveryRegion', label: 'Delivery region', type: 'select', required: false, options: ['Colombo', 'Kandy', 'Remote', 'Offshore'], active: true, createdAt: created, updatedAt: created },
    { id: 'cf-2', entity: 'customer', key: 'accountTier', label: 'Account tier', type: 'select', required: false, options: ['Strategic', 'Growth', 'Standard'], active: true, createdAt: created, updatedAt: created },
    { id: 'cf-3', entity: 'expense', key: 'clientRechargeable', label: 'Client rechargeable reference', type: 'text', required: false, helpText: 'PO or SOW reference if rechargeable', active: true, createdAt: created, updatedAt: created },
    { id: 'cf-4', entity: 'invoice', key: 'clientPoNumber', label: 'Client PO number', type: 'text', required: false, active: true, createdAt: created, updatedAt: created },
    { id: 'cf-5', entity: 'supplier', key: 'securityReviewed', label: 'Security review completed', type: 'checkbox', required: false, active: true, createdAt: created, updatedAt: created },
  ]

  const forms: DemoDatabase['forms'] = [
    {
      id: 'form-expense', name: 'Expense request (custom)', description: 'Pre-approval request for unusual or high-value spend.', entity: 'expense_request', layout: 'sections', status: 'published',
      sections: [
        { id: 'sec-1', title: 'Request details' },
        { id: 'sec-2', title: 'Cost & approval', description: 'Amounts are illustrative.' },
      ],
      fields: [
        { id: 'f-1', type: 'text', label: 'What do you need?', required: true, sectionId: 'sec-1', width: 'full', placeholder: 'e.g. Conference ticket', validation: { minLength: 4, maxLength: 120 } },
        { id: 'f-2', type: 'select', label: 'Category', required: true, sectionId: 'sec-1', width: 'half', options: ['Travel', 'Training', 'Equipment', 'Software', 'Other'] },
        { id: 'f-3', type: 'date', label: 'Needed by', required: false, sectionId: 'sec-1', width: 'half' },
        { id: 'f-4', type: 'textarea', label: 'Business justification', required: true, sectionId: 'sec-1', width: 'full', validation: { minLength: 20 } },
        { id: 'f-5', type: 'currency', label: 'Estimated amount (LKR)', required: true, sectionId: 'sec-2', width: 'half', validation: { min: 1, max: 5_000_000 } },
        { id: 'f-6', type: 'checkbox', label: 'Rechargeable to a client', required: false, sectionId: 'sec-2', width: 'half' },
        { id: 'f-7', type: 'text', label: 'Client PO / SOW reference', required: true, sectionId: 'sec-2', width: 'full', visibleWhen: { fieldId: 'f-6', operator: 'is_checked' } },
        { id: 'f-8', type: 'file', label: 'Supporting quote', required: false, sectionId: 'sec-2', width: 'full', description: 'Only the file name is stored in this demo.' },
      ],
      createdAt: created, updatedAt: ts(day(-12)),
    },
    {
      id: 'form-intake', name: 'Project intake', description: 'Capture commercial details before a project is created.', entity: 'project_intake', layout: 'tabs', status: 'draft',
      sections: [
        { id: 'sec-a', title: 'Client & scope' },
        { id: 'sec-b', title: 'Commercials' },
      ],
      fields: [
        { id: 'g-1', type: 'text', label: 'Project name', required: true, sectionId: 'sec-a', width: 'full' },
        { id: 'g-2', type: 'email', label: 'Client contact email', required: true, sectionId: 'sec-a', width: 'half' },
        { id: 'g-3', type: 'url', label: 'Client website', required: false, sectionId: 'sec-a', width: 'half' },
        { id: 'g-4', type: 'multiselect', label: 'Platforms', required: false, sectionId: 'sec-a', width: 'full', options: ['Web', 'iOS', 'Android', 'API', 'Data platform'] },
        { id: 'g-5', type: 'select', label: 'Billing model', required: true, sectionId: 'sec-b', width: 'half', options: ['Fixed price', 'Time & materials', 'Retainer', 'Milestone'] },
        { id: 'g-6', type: 'currency', label: 'Estimated contract value', required: true, sectionId: 'sec-b', width: 'half', validation: { min: 100_000 } },
        { id: 'g-7', type: 'percentage', label: 'Target margin', required: false, sectionId: 'sec-b', width: 'half', defaultValue: '30', validation: { min: 0, max: 80 } },
        { id: 'g-8', type: 'number', label: 'Estimated team size', required: false, sectionId: 'sec-b', width: 'half', validation: { min: 1, max: 40 } },
      ],
      createdAt: created, updatedAt: ts(day(-30)),
    },
  ]

  const rules: DemoDatabase['rules'] = [
    { id: 'rule-1', name: 'High-value expense review', description: 'Flag expense claims of LKR 50,000 or more for finance review.', entity: 'expense', match: 'all', priority: 1, enabled: true, conditions: [{ id: 'c-1', field: 'amount', operator: 'gte', value: 50_000 }], actions: [{ id: 'a-1', type: 'flag_for_review', message: 'High-value claim — finance review required' }, { id: 'a-2', type: 'notify', message: 'A high-value expense claim was submitted', targetRole: 'finance_manager' }], createdAt: created, updatedAt: created },
    { id: 'rule-2', name: 'Travel on client projects', description: 'Travel claims linked to a project must be checked for recharge.', entity: 'expense', match: 'all', priority: 2, enabled: true, conditions: [{ id: 'c-2', field: 'categoryId', operator: 'eq', value: EXPENSE_CATEGORY.travel }, { id: 'c-3', field: 'projectId', operator: 'neq', value: '' }], actions: [{ id: 'a-3', type: 'notify', message: 'Confirm whether this travel is rechargeable to the client', targetRole: 'project_manager' }], createdAt: created, updatedAt: created },
    { id: 'rule-3', name: 'Project budget warning at 85%', description: 'Warn when a project consumes 85% or more of its approved budget.', entity: 'project', match: 'all', priority: 1, enabled: true, conditions: [{ id: 'c-4', field: 'budgetConsumptionPercent', operator: 'gte', value: 85 }], actions: [{ id: 'a-4', type: 'budget_warning', message: 'Project has consumed 85% of budget' }], createdAt: created, updatedAt: created },
    { id: 'rule-4', name: 'Large purchase escalation', description: 'Escalate purchase orders of LKR 1.5M or more to the director.', entity: 'purchase_order', match: 'any', priority: 1, enabled: true, conditions: [{ id: 'c-5', field: 'amount', operator: 'gte', value: 1_500_000 }], actions: [{ id: 'a-5', type: 'escalate_approval', message: 'Escalated to Company Director (simulated)', targetRole: 'director' }], createdAt: created, updatedAt: created },
    { id: 'rule-5', name: 'Invoice due soon reminder', description: 'Notify finance about invoices due within 5 days.', entity: 'invoice', match: 'all', priority: 3, enabled: false, conditions: [{ id: 'c-6', field: 'daysUntilDue', operator: 'lte', value: 5 }, { id: 'c-7', field: 'status', operator: 'neq', value: 'paid' }], actions: [{ id: 'a-6', type: 'notify', message: 'Invoice due within 5 days — consider a reminder (simulated)', targetRole: 'accountant' }], createdAt: created, updatedAt: created },
  ]

  const workflows: DemoDatabase['workflows'] = [
    { id: 'wf-expense', name: 'Expense approval', description: 'Line manager, then finance for larger claims.', entity: 'expense', status: 'published', version: 3, createdAt: created, updatedAt: ts(day(-40)),
      stages: [
        { id: 'st-1', name: 'Project manager review', type: 'approval', assigneeRole: 'project_manager', slaHours: 24, requireComment: false },
        { id: 'st-2', name: 'Finance approval', type: 'approval', assigneeRole: 'finance_manager', condition: { field: 'amount', operator: 'gte', value: 25_000 }, slaHours: 48, requireComment: false },
        { id: 'st-3', name: 'Notify accountant for reimbursement', type: 'notification', assigneeRole: 'accountant', slaHours: 0, requireComment: false },
      ] },
    { id: 'wf-purchase', name: 'Purchase approval', description: 'Thresholds aligned to the purchase approval policy.', entity: 'purchase_order', status: 'published', version: 2, createdAt: created, updatedAt: ts(day(-60)),
      stages: [
        { id: 'st-4', name: 'Budget holder approval', type: 'approval', assigneeRole: 'project_manager', slaHours: 24, requireComment: false },
        { id: 'st-5', name: 'Finance manager approval', type: 'approval', assigneeRole: 'finance_manager', condition: { field: 'amount', operator: 'gte', value: 250_000 }, slaHours: 48, requireComment: true },
        { id: 'st-6', name: 'Director approval', type: 'approval', assigneeRole: 'director', condition: { field: 'amount', operator: 'gte', value: 1_500_000 }, slaHours: 72, requireComment: true },
      ] },
    { id: 'wf-invoice', name: 'Invoice review', description: 'Accountant prepares, finance manager reviews before issue.', entity: 'invoice', status: 'published', version: 1, createdAt: created, updatedAt: created,
      stages: [
        { id: 'st-7', name: 'Accountant check', type: 'review', assigneeRole: 'accountant', slaHours: 8, requireComment: false },
        { id: 'st-8', name: 'Finance manager sign-off', type: 'approval', assigneeRole: 'finance_manager', condition: { field: 'amount', operator: 'gte', value: 1_000_000 }, slaHours: 24, requireComment: false },
      ] },
    { id: 'wf-budget', name: 'Budget revision approval', description: 'Department budget changes need finance and director approval.', entity: 'budget', status: 'draft', version: 1, createdAt: created, updatedAt: ts(day(-5)),
      stages: [
        { id: 'st-9', name: 'Finance manager review', type: 'review', assigneeRole: 'finance_manager', slaHours: 48, requireComment: true },
        { id: 'st-10', name: 'Director approval', type: 'approval', assigneeRole: 'director', slaHours: 72, requireComment: true },
      ] },
  ]

  const sampleExpense = expenses.find((e) => e.status === 'approved') ?? expenses[0]
  const workflowRuns: DemoDatabase['workflowRuns'] = sampleExpense
    ? [
        { id: 'run-1', workflowId: 'wf-expense', workflowName: 'Expense approval', entity: 'expense', recordId: sampleExpense.id, recordLabel: `${sampleExpense.number} — ${sampleExpense.description}`, sample: { amount: sampleExpense.amount }, simulated: false, outcome: 'approved', createdAt: sampleExpense.createdAt, updatedAt: sampleExpense.updatedAt,
          steps: [
            { stageId: 'st-1', stageName: 'Project manager review', assigneeRole: 'project_manager', outcome: 'approved', at: sampleExpense.createdAt },
            { stageId: 'st-2', stageName: 'Finance approval', assigneeRole: 'finance_manager', outcome: sampleExpense.amount >= 25_000 ? 'approved' : 'skipped', reason: sampleExpense.amount >= 25_000 ? undefined : 'Amount below LKR 25,000', at: sampleExpense.updatedAt },
            { stageId: 'st-3', stageName: 'Notify accountant for reimbursement', assigneeRole: 'accountant', outcome: 'notified', at: sampleExpense.updatedAt },
          ] },
        { id: 'run-2', workflowId: 'wf-purchase', workflowName: 'Purchase approval', entity: 'purchase_order', recordLabel: 'Sandbox — LKR 1,850,000 GPU workstation', sample: { amount: 1_850_000 }, simulated: true, outcome: 'approved', createdAt: ts(day(-3)), updatedAt: ts(day(-3)),
          steps: [
            { stageId: 'st-4', stageName: 'Budget holder approval', assigneeRole: 'project_manager', outcome: 'approved', at: ts(day(-3)) },
            { stageId: 'st-5', stageName: 'Finance manager approval', assigneeRole: 'finance_manager', outcome: 'approved', at: ts(day(-3)) },
            { stageId: 'st-6', stageName: 'Director approval', assigneeRole: 'director', outcome: 'approved', at: ts(day(-3)) },
          ] },
      ]
    : []

  const formulas: DemoDatabase['formulas'] = [
    { id: 'fx-1', name: 'Gross profit', description: 'Revenue less direct costs.', expression: 'revenue - direct_costs', format: 'currency', variables: [{ key: 'revenue', label: 'Revenue', sampleValue: 4_500_000 }, { key: 'direct_costs', label: 'Direct costs', sampleValue: 3_100_000 }], createdAt: created, updatedAt: created },
    { id: 'fx-2', name: 'Gross margin %', description: 'Gross profit as a share of revenue.', expression: 'IF(revenue > 0, (revenue - direct_costs) / revenue * 100, 0)', format: 'percent', variables: [{ key: 'revenue', label: 'Revenue', sampleValue: 4_500_000 }, { key: 'direct_costs', label: 'Direct costs', sampleValue: 3_100_000 }], createdAt: created, updatedAt: created },
    { id: 'fx-3', name: 'Budget utilisation %', description: 'Eligible actual expenditure / approved budget.', expression: 'IF(budget > 0, actual / budget * 100, 0)', format: 'percent', variables: [{ key: 'actual', label: 'Actual expenditure', sampleValue: 8_250_000 }, { key: 'budget', label: 'Approved budget', sampleValue: 11_000_000 }], createdAt: created, updatedAt: created },
    { id: 'fx-4', name: 'Remaining budget', description: 'Approved budget less actuals and commitments.', expression: 'budget - actual - committed', format: 'currency', variables: [{ key: 'budget', label: 'Approved budget', sampleValue: 11_000_000 }, { key: 'actual', label: 'Actual', sampleValue: 8_250_000 }, { key: 'committed', label: 'Committed', sampleValue: 600_000 }], createdAt: created, updatedAt: created },
    { id: 'fx-5', name: 'Cost per project hour', description: 'Total project cost divided by logged hours.', expression: 'IF(hours > 0, total_cost / hours, 0)', format: 'currency', variables: [{ key: 'total_cost', label: 'Total project cost', sampleValue: 6_400_000 }, { key: 'hours', label: 'Hours logged', sampleValue: 1_420 }], createdAt: created, updatedAt: created },
  ]

  const templates: DemoDatabase['templates'] = [
    { id: 'tpl-invoice', name: 'Standard invoice', kind: 'invoice', channel: 'document', accentColor: '#1d4ed8', isDefault: true, body: 'Thank you for your business, {{customer.name}}.\nPayment of {{invoice.total}} is due by {{invoice.dueDate}}.\nPlease quote {{invoice.number}} with your payment.', createdAt: created, updatedAt: created },
    { id: 'tpl-receipt', name: 'Payment receipt', kind: 'receipt', channel: 'document', accentColor: '#047857', isDefault: true, body: 'We have recorded a payment of {{payment.amount}} from {{customer.name}} on {{payment.date}} against {{invoice.number}}.\nRemaining balance: {{invoice.balance}}.', createdAt: created, updatedAt: created },
    { id: 'tpl-statement', name: 'Customer statement', kind: 'statement', channel: 'document', accentColor: '#334155', isDefault: true, body: 'Statement for {{customer.name}} as at {{today}}.\nTotal outstanding: {{customer.outstanding}}.', createdAt: created, updatedAt: created },
    { id: 'tpl-po', name: 'Purchase order', kind: 'purchase_order', channel: 'document', accentColor: '#7c3aed', isDefault: true, body: 'Please supply the items below to {{organization.name}}.\nQuote PO number {{po.number}} on your invoice.', createdAt: created, updatedAt: created },
    { id: 'tpl-approval', name: 'Approval request email', kind: 'approval_email', channel: 'email', subject: 'Approval needed: {{record.label}}', accentColor: '#1d4ed8', isDefault: true, body: 'Hi {{approver.name}},\n\n{{requester.name}} has requested approval for {{record.label}} ({{record.amount}}).\n\nOpen the finance hub to review. (Simulated — this demo never sends email.)', createdAt: created, updatedAt: created },
    { id: 'tpl-overdue', name: 'Overdue reminder email', kind: 'overdue_email', channel: 'email', subject: 'Reminder: {{invoice.number}} is overdue', accentColor: '#b91c1c', isDefault: true, body: 'Dear {{customer.contact}},\n\nOur records show {{invoice.number}} for {{invoice.total}} was due on {{invoice.dueDate}} and {{invoice.balance}} remains outstanding.\n\nKind regards,\n{{organization.name}}', createdAt: created, updatedAt: created },
  ]

  const savedReports: DemoDatabase['savedReports'] = [
    { id: 'rep-1', name: 'Revenue by customer (last 12 months)', dataset: 'invoices', columns: ['number', 'customer', 'issueDate', 'netAmount', 'status'], groupBy: 'customer', metric: { field: 'netAmount', fn: 'sum' }, filters: [], presentation: 'bar', ownerName: 'Ruwan Fernando', createdAt: ts(day(-20)), updatedAt: ts(day(-20)) },
    { id: 'rep-2', name: 'Cloud spend by provider', dataset: 'cloudCosts', columns: ['month', 'provider', 'service', 'amount'], groupBy: 'provider', metric: { field: 'amount', fn: 'sum' }, filters: [], presentation: 'pie', ownerName: 'Dilini Jayasekara', createdAt: ts(day(-9)), updatedAt: ts(day(-9)) },
    { id: 'rep-3', name: 'Rejected expense claims', dataset: 'expenses', columns: ['number', 'employee', 'date', 'category', 'amount', 'status'], filters: [{ id: 'rf-1', field: 'status', operator: 'eq', value: 'rejected' }], presentation: 'table', ownerName: 'Tharushi Silva', createdAt: ts(day(-4)), updatedAt: ts(day(-4)) },
  ]

  const integrations: DemoDatabase['integrations'] = [
    { id: 'int-1', key: 'bank-feed', name: 'Bank statement feed', category: 'banking', description: 'Import statement lines automatically for reconciliation.', status: 'connected_demo', lastSyncAt: ts(day(-1), 6), settings: { syncFrequency: 'daily', autoMatch: true }, createdAt: created, updatedAt: created },
    { id: 'int-2', key: 'cloud-billing', name: 'Cloud billing exports', category: 'cloud', description: 'Ingest monthly cost and usage reports from cloud providers.', status: 'connected_demo', lastSyncAt: ts(day(-2), 3), settings: { providers: 'AWS, Azure, Google Cloud', tagKey: 'project' }, createdAt: created, updatedAt: created },
    { id: 'int-3', key: 'ai-usage', name: 'AI provider usage', category: 'ai', description: 'Pull token and request usage for cost allocation.', status: 'not_connected', settings: { allocateBy: 'product' }, createdAt: created, updatedAt: created },
    { id: 'int-4', key: 'payments-gateway', name: 'Online payments gateway', category: 'payments', description: 'Let customers pay invoices online.', status: 'coming_soon', settings: {}, createdAt: created, updatedAt: created },
    { id: 'int-5', key: 'email', name: 'Transactional email', category: 'communication', description: 'Send invoices, reminders and approval emails.', status: 'not_connected', settings: { fromName: 'Kelani Byte Labs Finance' }, createdAt: created, updatedAt: created },
    { id: 'int-6', key: 'hris', name: 'HR & payroll system', category: 'hr', description: 'Sync employee cost profiles and departments.', status: 'not_connected', settings: {}, createdAt: created, updatedAt: created },
    { id: 'int-7', key: 'accounting-export', name: 'Accounting package export', category: 'accounting', description: 'Export journals to an external general ledger.', status: 'coming_soon', settings: { format: 'CSV' }, createdAt: created, updatedAt: created },
    { id: 'int-8', key: 'chat', name: 'Team chat notifications', category: 'communication', description: 'Post approval requests to a chat channel.', status: 'not_connected', settings: { channel: '#finance-approvals' }, createdAt: created, updatedAt: created },
  ]

  const overdue = invoices.filter((i) => i.status === 'issued' || i.status === 'partially_paid').slice(0, 1)[0]
  const notifications: DemoDatabase['notifications'] = [
    { id: 'n-1', at: ts(day(0), 8), title: 'Expense claims awaiting approval', body: 'Several expense claims are waiting for your review.', kind: 'approval', read: false, link: '/finance/expenses?status=submitted' },
    { id: 'n-2', at: ts(day(-1), 16), title: 'Project budget warning', body: 'Claims automation suite has consumed more than 85% of its budget.', kind: 'warning', read: false, link: '/projects/prj-104' },
    { id: 'n-3', at: ts(day(-2), 11), title: 'Purchase order pending approval', body: 'PO-0121 for Pixelcraft Design Studio needs approval.', kind: 'approval', read: false, link: '/procurement/purchase-orders' },
    { id: 'n-4', at: ts(day(-3), 9), title: 'Cloud spend trending up', body: 'IoT farm data platform cloud costs grew 7% month on month.', kind: 'info', read: true, link: '/saas/cloud' },
    { id: 'n-5', at: ts(day(-5), 14), title: 'Payment recorded (simulated)', body: overdue ? `A part payment was recorded for ${overdue.number}.` : 'A payment was recorded.', kind: 'success', read: true, link: '/sales/payments' },
    { id: 'n-6', at: ts(day(-6), 10), title: 'Subscription past due', body: 'Hill Country Crafts ShopSphere subscription is past due.', kind: 'warning', read: true, link: '/saas/subscriptions' },
  ]

  const projectNames = new Map(projects.map((p) => [p.id, p.name]))
  const auditLog: DemoDatabase['auditLog'] = [
    { id: 'au-1', at: ts(day(-1), 15), actor: 'Ruwan Fernando', role: 'finance_manager', action: 'approve', entity: 'expense', summary: 'Approved an expense claim (seed history)' },
    { id: 'au-2', at: ts(day(-2), 11), actor: 'Rashmi Alwis', role: 'project_manager', action: 'create', entity: 'purchase_order', entityId: 'po-4', summary: 'Raised PO-0121 for booking engine UX discovery' },
    { id: 'au-3', at: ts(day(-3), 10), actor: 'Kasun Wickramasinghe', role: 'project_manager', action: 'update', entity: 'project', entityId: 'prj-103', summary: `Updated % complete on ${projectNames.get('prj-103')}` },
    { id: 'au-4', at: ts(day(-4), 9), actor: 'Tharushi Silva', role: 'accountant', action: 'issue', entity: 'invoice', summary: 'Issued recurring retainer invoices (simulated, no email sent)' },
    { id: 'au-5', at: ts(day(-5), 17), actor: 'Ruwan Fernando', role: 'finance_manager', action: 'submit', entity: 'budget', entityId: 'bud-people', summary: 'Submitted the people & culture budget for approval' },
    { id: 'au-6', at: ts(day(-9), 12), actor: 'Dilini Jayasekara', role: 'director', action: 'create', entity: 'saved_report', entityId: 'rep-2', summary: 'Saved report "Cloud spend by provider"' },
    { id: 'au-7', at: ts(day(-12), 14), actor: 'Ruwan Fernando', role: 'finance_manager', action: 'publish', entity: 'form', entityId: 'form-expense', summary: 'Published the custom expense request form' },
  ]

  return {
    customFields,
    forms,
    formSubmissions: [] as DemoDatabase['formSubmissions'],
    rules,
    workflows,
    workflowRuns,
    formulas,
    templates,
    dashboards: [defaultDashboard(created)],
    savedReports,
    integrations,
    notifications,
    auditLog,
  }
}

