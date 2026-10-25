import type { LucideIcon } from 'lucide-react'
import { BarChart3, Cloud, FolderKanban, Landmark, LayoutDashboard, Receipt, Settings, ShieldCheck, ShoppingCart, SlidersHorizontal, Target } from 'lucide-react'
import type { Permission } from '@/lib/permissions'

export interface NavItem {
  label: string
  path: string
  description: string
  permission?: Permission
}

export interface NavGroup {
  key: string
  label: string
  icon: LucideIcon
  permission?: Permission
  items: NavItem[]
}

/** Sidebar structure. Every item maps to a route in routes.tsx. */
export const NAVIGATION: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      { label: 'Executive dashboard', path: '/dashboard', description: 'Company-wide revenue, profitability, cash and obligations.', permission: 'dashboard.executive' },
      { label: 'Finance dashboard', path: '/dashboard/finance', description: 'Receivables, payables, cash flow and expense trends.', permission: 'finance.view' },
      { label: 'Project financials', path: '/dashboard/projects', description: 'Portfolio health of software delivery projects.', permission: 'projects.view' },
      { label: 'SaaS & infrastructure', path: '/dashboard/saas', description: 'Recurring revenue, cloud and AI cost overview.', permission: 'saas.view' },
      { label: 'Approvals inbox', path: '/approvals', description: 'Pending actions across expenses, purchasing, bills and budgets.' },
      { label: 'Notifications', path: '/notifications', description: 'Alerts and activity from rules and workflows.' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: Landmark,
    permission: 'finance.view',
    items: [
      { label: 'Income & revenue', path: '/finance/revenue', description: 'Revenue by service, customer and month, derived from invoices.' },
      { label: 'General ledger', path: '/finance/ledger', description: 'Illustrative ledger postings by account.' },
      { label: 'Journal entries', path: '/finance/journals', description: 'Illustrative double-entry journals.' },
      { label: 'Chart of accounts', path: '/finance/accounts', description: 'Ledger account structure.' },
      { label: 'Cash & bank', path: '/finance/banking', description: 'Simulated bank accounts and balances.' },
      { label: 'Bank reconciliation', path: '/finance/reconciliation', description: 'Match statement lines to recorded payments.' },
      { label: 'Financial periods', path: '/finance/periods', description: 'Open, closing and closed accounting periods.' },
      { label: 'Receivables', path: '/finance/receivables', description: 'Outstanding customer balances and ageing.' },
      { label: 'Payables', path: '/finance/payables', description: 'Outstanding supplier balances and due dates.' },
      { label: 'Expenses', path: '/finance/expenses', description: 'Employee expense claims and approvals.', permission: 'expenses.submit' },
      { label: 'Reimbursements', path: '/finance/reimbursements', description: 'Approved claims awaiting simulated reimbursement.' },
      { label: 'Transactions', path: '/finance/transactions', description: 'All simulated money movements.' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales & billing',
    icon: Receipt,
    permission: 'sales.view',
    items: [
      { label: 'Customers', path: '/sales/customers', description: 'Customer accounts, balances and activity.' },
      { label: 'Contracts', path: '/sales/contracts', description: 'Statements of work, retainers and subscriptions.' },
      { label: 'Quotations', path: '/sales/quotations', description: 'Estimates and proposals.' },
      { label: 'Invoices', path: '/sales/invoices', description: 'Create, issue and track customer invoices.' },
      { label: 'Credit notes', path: '/sales/credit-notes', description: 'Credits applied to customer invoices.' },
      { label: 'Payments', path: '/sales/payments', description: 'Simulated receipts and supplier payments.' },
      { label: 'Recurring billing', path: '/sales/recurring', description: 'Retainer and subscription billing schedules.' },
      { label: 'Billing schedules', path: '/sales/billing-schedules', description: 'Upcoming milestone and recurring billing.' },
      { label: 'Revenue recognition', path: '/sales/revenue-recognition', description: 'Illustrative recognised vs invoiced revenue.' },
      { label: 'Work in progress', path: '/sales/wip', description: 'Unbilled work and deferred revenue by project.' },
    ],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    icon: ShoppingCart,
    permission: 'procurement.view',
    items: [
      { label: 'Suppliers', path: '/procurement/suppliers', description: 'Suppliers and software vendors.' },
      { label: 'Purchase requests', path: '/procurement/requests', description: 'Internal requests to buy.' },
      { label: 'Purchase orders', path: '/procurement/purchase-orders', description: 'Orders placed with suppliers.' },
      { label: 'Supplier bills', path: '/procurement/bills', description: 'Bills to approve and pay.' },
      { label: 'Vendor spending', path: '/procurement/vendor-spend', description: 'Spend by supplier and category.' },
      { label: 'Supplier subscriptions', path: '/procurement/vendor-subscriptions', description: 'Recurring software and service subscriptions by vendor.' },
    ],
  },
  {
    key: 'projects',
    label: 'Projects & costing',
    icon: FolderKanban,
    permission: 'projects.view',
    items: [
      { label: 'Projects', path: '/projects', description: 'Software delivery projects and their financial profiles.' },
      { label: 'Project budgets', path: '/projects/budgets', description: 'Budget, actual, committed and forecast by project.' },
      { label: 'Cost entries', path: '/projects/costs', description: 'Direct project costs and commitments.' },
      { label: 'Labour costing', path: '/projects/labour', description: 'Labour cost from timesheets at cost rates.', permission: 'costs.sensitive' },
      { label: 'Timesheets', path: '/projects/timesheets', description: 'Logged hours, billable split and approvals.' },
      { label: 'Resource utilisation', path: '/projects/utilisation', description: 'Capacity vs logged hours by person and team.' },
      { label: 'Contract profitability', path: '/projects/contract-profitability', description: 'Margin by contract and billing model.' },
      { label: 'Project profitability', path: '/projects/profitability', description: 'Estimated profit and margin across the portfolio.' },
      { label: 'People cost profiles', path: '/resources/employees', description: 'Fictional employee and contractor cost profiles.', permission: 'costs.sensitive' },
      { label: 'Roles & rates', path: '/resources/roles', description: 'Average cost and bill rates by role.', permission: 'costs.sensitive' },
    ],
  },
  {
    key: 'saas',
    label: 'SaaS & technology',
    icon: Cloud,
    permission: 'saas.view',
    items: [
      { label: 'Software products', path: '/saas/products', description: 'Products, services and pricing plans.' },
      { label: 'Customer subscriptions', path: '/saas/subscriptions', description: 'Live, trial and cancelled subscriptions.' },
      { label: 'Recurring revenue', path: '/saas/metrics', description: 'MRR, ARR, churn and retention.' },
      { label: 'Cloud expenditure', path: '/saas/cloud', description: 'Cloud spend by provider, category, product and project.' },
      { label: 'AI & API usage', path: '/saas/ai', description: 'Model usage, tokens and cost allocation.' },
      { label: 'Software licences', path: '/saas/licences', description: 'Seat-based tools and utilisation.' },
      { label: 'Infrastructure budgets', path: '/saas/infrastructure-budgets', description: 'Cloud and AI budget vs actual.' },
      { label: 'Product profitability', path: '/saas/product-profitability', description: 'Subscription revenue vs attributed infrastructure cost.' },
    ],
  },
  {
    key: 'planning',
    label: 'Planning & forecasting',
    icon: Target,
    permission: 'budgets.view',
    items: [
      { label: 'Budgets', path: '/planning/budgets', description: 'Company, department, project, cloud and personnel budgets.' },
      { label: 'Revenue forecast', path: '/planning/revenue-forecast', description: 'Illustrative revenue projection.' },
      { label: 'Expense forecast', path: '/planning/expense-forecast', description: 'Illustrative expense projection.' },
      { label: 'Cash flow forecast', path: '/planning/cash-flow', description: 'Projected cash position by month.' },
      { label: 'Scenarios', path: '/planning/scenarios', description: 'Base, best-case and conservative assumptions.' },
      { label: 'Cost to complete', path: '/planning/cost-to-complete', description: 'Remaining cost estimates for active projects.' },
    ],
  },
  {
    key: 'assets',
    label: 'Assets & compliance',
    icon: ShieldCheck,
    permission: 'assets.view',
    items: [
      { label: 'Fixed assets', path: '/assets', description: 'Asset register and book values.' },
      { label: 'Depreciation', path: '/assets/depreciation', description: 'Monthly depreciation schedules.' },
      { label: 'R&D expenditure', path: '/compliance/rnd', description: 'Research and development spend tracking.' },
      { label: 'Tax configuration', path: '/compliance/tax', description: 'Illustrative tax rates.' },
      { label: 'Multi-currency', path: '/compliance/currencies', description: 'Currencies and illustrative exchange rates.' },
      { label: 'Financial policies', path: '/compliance/policies', description: 'Spending and approval policies.' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & analytics',
    icon: BarChart3,
    permission: 'reports.view',
    items: [
      { label: 'Report centre', path: '/reports', description: 'Financial statements, project, customer, product and cost reports.' },
      { label: 'Custom report builder', path: '/reports/builder', description: 'Build reports from approved demo datasets.', permission: 'reports.build' },
      { label: 'Saved reports', path: '/reports/saved', description: 'Report definitions saved in this browser.' },
    ],
  },
  {
    key: 'config',
    label: 'Configuration centre',
    icon: SlidersHorizontal,
    permission: 'config.view',
    items: [
      { label: 'Overview', path: '/config', description: 'No-code configuration for forms, rules, workflows and more.' },
      { label: 'Master data', path: '/config/master-data', description: 'Categories, departments, cost codes and other lists.' },
      { label: 'Custom fields', path: '/config/custom-fields', description: 'Extra fields on customers, projects, expenses and more.' },
      { label: 'Form builder', path: '/config/forms', description: 'Design custom forms with drag and drop.' },
      { label: 'Rules builder', path: '/config/rules', description: 'Condition and action business rules.' },
      { label: 'Workflow builder', path: '/config/workflows', description: 'Approval workflows and simulations.' },
      { label: 'Formula builder', path: '/config/formulas', description: 'Safe calculated fields.' },
      { label: 'Document templates', path: '/config/templates', description: 'Invoice, receipt, PO and email templates.' },
      { label: 'Dashboard builder', path: '/config/dashboard-builder', description: 'Choose and arrange dashboard widgets.' },
      { label: 'System preferences', path: '/config/preferences', description: 'Defaults for numbering, terms and display.' },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: Settings,
    permission: 'admin.view',
    items: [
      { label: 'Users & roles', path: '/admin/users', description: 'Demo users and their roles.' },
      { label: 'Permissions', path: '/admin/permissions', description: 'Simulated permission matrix.' },
      { label: 'Organisation', path: '/admin/organization', description: 'Company profile and fiscal settings.' },
      { label: 'Import & export', path: '/admin/import-export', description: 'Export data to CSV or JSON, or import a JSON backup.' },
      { label: 'Integrations', path: '/admin/integrations', description: 'Preview of planned integrations.' },
      { label: 'Audit log', path: '/admin/audit-log', description: 'Every change made in this browser.' },
      { label: 'App preferences', path: '/admin/preferences', description: 'Theme, density and personal preferences.' },
      { label: 'Demo data', path: '/admin/demo-data', description: 'Reset or inspect the browser-side demo dataset.' },
    ],
  },
]

/** Flattened lookup used for breadcrumbs and search. */
export const NAV_INDEX: { group: NavGroup; item: NavItem }[] = NAVIGATION.flatMap((group) => group.items.map((item) => ({ group, item })))

export function findNavItem(pathname: string): { group: NavGroup; item: NavItem } | undefined {
  const exact = NAV_INDEX.find((n) => n.item.path === pathname)
  if (exact) return exact
  // Longest matching prefix (detail pages such as /projects/prj-101).
  return [...NAV_INDEX].sort((a, b) => b.item.path.length - a.item.path.length).find((n) => pathname.startsWith(`${n.item.path}/`))
}
