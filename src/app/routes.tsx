import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'

const ExecutiveDashboardPage = lazy(() => import('@/features/dashboard/pages/ExecutiveDashboardPage'))
const FinanceDashboardPage = lazy(() => import('@/features/dashboard/pages/FinanceDashboardPage'))
const ProjectsDashboardPage = lazy(() => import('@/features/dashboard/pages/ProjectsDashboardPage'))
const SaasDashboardPage = lazy(() => import('@/features/dashboard/pages/SaasDashboardPage'))
const ApprovalsPage = lazy(() => import('@/features/dashboard/pages/ApprovalsPage'))
const NotificationsPage = lazy(() => import('@/features/dashboard/pages/NotificationsPage'))
const RevenuePage = lazy(() => import('@/features/finance/pages/RevenuePage'))
const GeneralLedgerPage = lazy(() => import('@/features/general-ledger/pages/GeneralLedgerPage'))
const JournalEntriesPage = lazy(() => import('@/features/general-ledger/pages/JournalEntriesPage'))
const ChartOfAccountsPage = lazy(() => import('@/features/general-ledger/pages/ChartOfAccountsPage'))
const BankAccountsPage = lazy(() => import('@/features/finance/pages/BankAccountsPage'))
const BankReconciliationPage = lazy(() => import('@/features/finance/pages/BankReconciliationPage'))
const FinancialPeriodsPage = lazy(() => import('@/features/general-ledger/pages/FinancialPeriodsPage'))
const ReceivablesPage = lazy(() => import('@/features/receivables/pages/ReceivablesPage'))
const PayablesPage = lazy(() => import('@/features/payables/pages/PayablesPage'))
const ExpensesPage = lazy(() => import('@/features/expenses/pages/ExpensesPage'))
const ReimbursementsPage = lazy(() => import('@/features/expenses/pages/ReimbursementsPage'))
const TransactionsPage = lazy(() => import('@/features/finance/pages/TransactionsPage'))
const CustomersPage = lazy(() => import('@/features/invoicing/pages/CustomersPage'))
const ContractsPage = lazy(() => import('@/features/contracts/pages/ContractsPage'))
const QuotationsPage = lazy(() => import('@/features/invoicing/pages/QuotationsPage'))
const InvoicesPage = lazy(() => import('@/features/invoicing/pages/InvoicesPage'))
const CreditNotesPage = lazy(() => import('@/features/invoicing/pages/CreditNotesPage'))
const PaymentsPage = lazy(() => import('@/features/invoicing/pages/PaymentsPage'))
const RecurringBillingPage = lazy(() => import('@/features/invoicing/pages/RecurringBillingPage'))
const BillingSchedulesPage = lazy(() => import('@/features/invoicing/pages/BillingSchedulesPage'))
const RevenueRecognitionPage = lazy(() => import('@/features/contracts/pages/RevenueRecognitionPage'))
const WorkInProgressPage = lazy(() => import('@/features/contracts/pages/WorkInProgressPage'))
const SuppliersPage = lazy(() => import('@/features/procurement/pages/SuppliersPage'))
const PurchaseRequestsPage = lazy(() => import('@/features/procurement/pages/PurchaseRequestsPage'))
const PurchaseOrdersPage = lazy(() => import('@/features/procurement/pages/PurchaseOrdersPage'))
const SupplierBillsPage = lazy(() => import('@/features/payables/pages/SupplierBillsPage'))
const VendorSpendPage = lazy(() => import('@/features/procurement/pages/VendorSpendPage'))
const VendorSubscriptionsPage = lazy(() => import('@/features/procurement/pages/VendorSubscriptionsPage'))
const ProjectsPage = lazy(() => import('@/features/projects/pages/ProjectsPage'))
const ProjectBudgetsPage = lazy(() => import('@/features/projects/pages/ProjectBudgetsPage'))
const CostEntriesPage = lazy(() => import('@/features/projects/pages/CostEntriesPage'))
const LabourCostingPage = lazy(() => import('@/features/resource-costing/pages/LabourCostingPage'))
const TimesheetsPage = lazy(() => import('@/features/resource-costing/pages/TimesheetsPage'))
const UtilisationPage = lazy(() => import('@/features/resource-costing/pages/UtilisationPage'))
const ContractProfitabilityPage = lazy(() => import('@/features/projects/pages/ContractProfitabilityPage'))
const ProjectProfitabilityPage = lazy(() => import('@/features/projects/pages/ProjectProfitabilityPage'))
const EmployeesPage = lazy(() => import('@/features/resource-costing/pages/EmployeesPage'))
const RolesRatesPage = lazy(() => import('@/features/resource-costing/pages/RolesRatesPage'))
const ProductsPage = lazy(() => import('@/features/subscriptions/pages/ProductsPage'))
const SubscriptionsPage = lazy(() => import('@/features/subscriptions/pages/SubscriptionsPage'))
const RecurringRevenuePage = lazy(() => import('@/features/subscriptions/pages/RecurringRevenuePage'))
const CloudCostsPage = lazy(() => import('@/features/cloud-costs/pages/CloudCostsPage'))
const AiUsagePage = lazy(() => import('@/features/cloud-costs/pages/AiUsagePage'))
const LicencesPage = lazy(() => import('@/features/cloud-costs/pages/LicencesPage'))
const InfrastructureBudgetsPage = lazy(() => import('@/features/cloud-costs/pages/InfrastructureBudgetsPage'))
const ProductProfitabilityPage = lazy(() => import('@/features/subscriptions/pages/ProductProfitabilityPage'))
const BudgetsPage = lazy(() => import('@/features/budgeting/pages/BudgetsPage'))
const RevenueForecastPage = lazy(() => import('@/features/forecasting/pages/RevenueForecastPage'))
const ExpenseForecastPage = lazy(() => import('@/features/forecasting/pages/ExpenseForecastPage'))
const CashFlowForecastPage = lazy(() => import('@/features/forecasting/pages/CashFlowForecastPage'))
const ScenariosPage = lazy(() => import('@/features/forecasting/pages/ScenariosPage'))
const CostToCompletePage = lazy(() => import('@/features/forecasting/pages/CostToCompletePage'))
const FixedAssetsPage = lazy(() => import('@/features/assets/pages/FixedAssetsPage'))
const DepreciationPage = lazy(() => import('@/features/assets/pages/DepreciationPage'))
const RdExpenditurePage = lazy(() => import('@/features/tax/pages/RdExpenditurePage'))
const TaxConfigPage = lazy(() => import('@/features/tax/pages/TaxConfigPage'))
const CurrenciesPage = lazy(() => import('@/features/tax/pages/CurrenciesPage'))
const PoliciesPage = lazy(() => import('@/features/tax/pages/PoliciesPage'))
const ReportCentrePage = lazy(() => import('@/features/reports/pages/ReportCentrePage'))
const ReportBuilderPage = lazy(() => import('@/features/reports/pages/ReportBuilderPage'))
const SavedReportsPage = lazy(() => import('@/features/reports/pages/SavedReportsPage'))
const ConfigurationHomePage = lazy(() => import('@/features/configuration/pages/ConfigurationHomePage'))
const MasterDataPage = lazy(() => import('@/features/configuration/pages/MasterDataPage'))
const CustomFieldsPage = lazy(() => import('@/features/custom-fields/pages/CustomFieldsPage'))
const FormsPage = lazy(() => import('@/features/configuration/pages/FormsPage'))
const RulesPage = lazy(() => import('@/features/rules/pages/RulesPage'))
const WorkflowsPage = lazy(() => import('@/features/workflows/pages/WorkflowsPage'))
const FormulasPage = lazy(() => import('@/features/configuration/pages/FormulasPage'))
const TemplatesPage = lazy(() => import('@/features/configuration/pages/TemplatesPage'))
const DashboardBuilderPage = lazy(() => import('@/features/configuration/pages/DashboardBuilderPage'))
const SystemPreferencesPage = lazy(() => import('@/features/configuration/pages/SystemPreferencesPage'))
const UsersPage = lazy(() => import('@/features/administration/pages/UsersPage'))
const PermissionsPage = lazy(() => import('@/features/administration/pages/PermissionsPage'))
const OrganizationPage = lazy(() => import('@/features/administration/pages/OrganizationPage'))
const ImportExportPage = lazy(() => import('@/features/administration/pages/ImportExportPage'))
const IntegrationsPage = lazy(() => import('@/features/integrations/pages/IntegrationsPage'))
const AuditLogPage = lazy(() => import('@/features/administration/pages/AuditLogPage'))
const PreferencesPage = lazy(() => import('@/features/administration/pages/PreferencesPage'))
const DemoDataPage = lazy(() => import('@/features/administration/pages/DemoDataPage'))
const ExpenseDetailPage = lazy(() => import('@/features/expenses/pages/ExpenseDetailPage'))
const CustomerDetailPage = lazy(() => import('@/features/invoicing/pages/CustomerDetailPage'))
const InvoiceEditorPage = lazy(() => import('@/features/invoicing/pages/InvoiceEditorPage'))
const InvoiceDetailPage = lazy(() => import('@/features/invoicing/pages/InvoiceDetailPage'))
const InvoicePrintPage = lazy(() => import('@/features/invoicing/pages/InvoicePrintPage'))
const SupplierDetailPage = lazy(() => import('@/features/procurement/pages/SupplierDetailPage'))
const ProjectDetailPage = lazy(() => import('@/features/projects/pages/ProjectDetailPage'))
const BudgetDetailPage = lazy(() => import('@/features/budgeting/pages/BudgetDetailPage'))
const AssetDetailPage = lazy(() => import('@/features/assets/pages/AssetDetailPage'))
const ReportViewerPage = lazy(() => import('@/features/reports/pages/ReportViewerPage'))
const FormBuilderPage = lazy(() => import('@/features/configuration/pages/FormBuilderPage'))
const RuleEditorPage = lazy(() => import('@/features/rules/pages/RuleEditorPage'))
const WorkflowEditorPage = lazy(() => import('@/features/workflows/pages/WorkflowEditorPage'))
const SearchPage = lazy(() => import('@/features/search/pages/SearchPage'))

/** All application routes (rendered inside the app shell). */
export const ROUTES: RouteObject[] = [
  { path: '/dashboard', element: <ExecutiveDashboardPage /> },
  { path: '/dashboard/finance', element: <FinanceDashboardPage /> },
  { path: '/dashboard/projects', element: <ProjectsDashboardPage /> },
  { path: '/dashboard/saas', element: <SaasDashboardPage /> },
  { path: '/approvals', element: <ApprovalsPage /> },
  { path: '/notifications', element: <NotificationsPage /> },
  { path: '/finance/revenue', element: <RevenuePage /> },
  { path: '/finance/ledger', element: <GeneralLedgerPage /> },
  { path: '/finance/journals', element: <JournalEntriesPage /> },
  { path: '/finance/accounts', element: <ChartOfAccountsPage /> },
  { path: '/finance/banking', element: <BankAccountsPage /> },
  { path: '/finance/reconciliation', element: <BankReconciliationPage /> },
  { path: '/finance/periods', element: <FinancialPeriodsPage /> },
  { path: '/finance/receivables', element: <ReceivablesPage /> },
  { path: '/finance/payables', element: <PayablesPage /> },
  { path: '/finance/expenses', element: <ExpensesPage /> },
  { path: '/finance/reimbursements', element: <ReimbursementsPage /> },
  { path: '/finance/transactions', element: <TransactionsPage /> },
  { path: '/sales/customers', element: <CustomersPage /> },
  { path: '/sales/contracts', element: <ContractsPage /> },
  { path: '/sales/quotations', element: <QuotationsPage /> },
  { path: '/sales/invoices', element: <InvoicesPage /> },
  { path: '/sales/credit-notes', element: <CreditNotesPage /> },
  { path: '/sales/payments', element: <PaymentsPage /> },
  { path: '/sales/recurring', element: <RecurringBillingPage /> },
  { path: '/sales/billing-schedules', element: <BillingSchedulesPage /> },
  { path: '/sales/revenue-recognition', element: <RevenueRecognitionPage /> },
  { path: '/sales/wip', element: <WorkInProgressPage /> },
  { path: '/procurement/suppliers', element: <SuppliersPage /> },
  { path: '/procurement/requests', element: <PurchaseRequestsPage /> },
  { path: '/procurement/purchase-orders', element: <PurchaseOrdersPage /> },
  { path: '/procurement/bills', element: <SupplierBillsPage /> },
  { path: '/procurement/vendor-spend', element: <VendorSpendPage /> },
  { path: '/procurement/vendor-subscriptions', element: <VendorSubscriptionsPage /> },
  { path: '/projects', element: <ProjectsPage /> },
  { path: '/projects/budgets', element: <ProjectBudgetsPage /> },
  { path: '/projects/costs', element: <CostEntriesPage /> },
  { path: '/projects/labour', element: <LabourCostingPage /> },
  { path: '/projects/timesheets', element: <TimesheetsPage /> },
  { path: '/projects/utilisation', element: <UtilisationPage /> },
  { path: '/projects/contract-profitability', element: <ContractProfitabilityPage /> },
  { path: '/projects/profitability', element: <ProjectProfitabilityPage /> },
  { path: '/resources/employees', element: <EmployeesPage /> },
  { path: '/resources/roles', element: <RolesRatesPage /> },
  { path: '/saas/products', element: <ProductsPage /> },
  { path: '/saas/subscriptions', element: <SubscriptionsPage /> },
  { path: '/saas/metrics', element: <RecurringRevenuePage /> },
  { path: '/saas/cloud', element: <CloudCostsPage /> },
  { path: '/saas/ai', element: <AiUsagePage /> },
  { path: '/saas/licences', element: <LicencesPage /> },
  { path: '/saas/infrastructure-budgets', element: <InfrastructureBudgetsPage /> },
  { path: '/saas/product-profitability', element: <ProductProfitabilityPage /> },
  { path: '/planning/budgets', element: <BudgetsPage /> },
  { path: '/planning/revenue-forecast', element: <RevenueForecastPage /> },
  { path: '/planning/expense-forecast', element: <ExpenseForecastPage /> },
  { path: '/planning/cash-flow', element: <CashFlowForecastPage /> },
  { path: '/planning/scenarios', element: <ScenariosPage /> },
  { path: '/planning/cost-to-complete', element: <CostToCompletePage /> },
  { path: '/assets', element: <FixedAssetsPage /> },
  { path: '/assets/depreciation', element: <DepreciationPage /> },
  { path: '/compliance/rnd', element: <RdExpenditurePage /> },
  { path: '/compliance/tax', element: <TaxConfigPage /> },
  { path: '/compliance/currencies', element: <CurrenciesPage /> },
  { path: '/compliance/policies', element: <PoliciesPage /> },
  { path: '/reports', element: <ReportCentrePage /> },
  { path: '/reports/builder', element: <ReportBuilderPage /> },
  { path: '/reports/saved', element: <SavedReportsPage /> },
  { path: '/config', element: <ConfigurationHomePage /> },
  { path: '/config/master-data', element: <MasterDataPage /> },
  { path: '/config/custom-fields', element: <CustomFieldsPage /> },
  { path: '/config/forms', element: <FormsPage /> },
  { path: '/config/rules', element: <RulesPage /> },
  { path: '/config/workflows', element: <WorkflowsPage /> },
  { path: '/config/formulas', element: <FormulasPage /> },
  { path: '/config/templates', element: <TemplatesPage /> },
  { path: '/config/dashboard-builder', element: <DashboardBuilderPage /> },
  { path: '/config/preferences', element: <SystemPreferencesPage /> },
  { path: '/admin/users', element: <UsersPage /> },
  { path: '/admin/permissions', element: <PermissionsPage /> },
  { path: '/admin/organization', element: <OrganizationPage /> },
  { path: '/admin/import-export', element: <ImportExportPage /> },
  { path: '/admin/integrations', element: <IntegrationsPage /> },
  { path: '/admin/audit-log', element: <AuditLogPage /> },
  { path: '/admin/preferences', element: <PreferencesPage /> },
  { path: '/admin/demo-data', element: <DemoDataPage /> },
  { path: '/finance/expenses/:id', element: <ExpenseDetailPage /> },
  { path: '/sales/customers/:id', element: <CustomerDetailPage /> },
  { path: '/sales/invoices/new', element: <InvoiceEditorPage /> },
  { path: '/sales/invoices/:id', element: <InvoiceDetailPage /> },
  { path: '/sales/invoices/:id/edit', element: <InvoiceEditorPage /> },
  { path: '/sales/invoices/:id/print', element: <InvoicePrintPage /> },
  { path: '/procurement/suppliers/:id', element: <SupplierDetailPage /> },
  { path: '/projects/:id', element: <ProjectDetailPage /> },
  { path: '/planning/budgets/:id', element: <BudgetDetailPage /> },
  { path: '/assets/:id', element: <AssetDetailPage /> },
  { path: '/reports/view/:reportKey', element: <ReportViewerPage /> },
  { path: '/config/master-data/:list', element: <MasterDataPage /> },
  { path: '/config/forms/:id', element: <FormBuilderPage /> },
  { path: '/config/rules/:id', element: <RuleEditorPage /> },
  { path: '/config/workflows/:id', element: <WorkflowEditorPage /> },
  { path: '/search', element: <SearchPage /> },
]
