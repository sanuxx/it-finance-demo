import type { DemoUser, ISODate, Organization } from './shared/types'
import type {
  BankAccount,
  BankStatementLine,
  CurrencySetting,
  ExpenseClaim,
  FinancialPeriod,
  FinancialPolicy,
  FixedAsset,
  JournalEntry,
  LedgerAccount,
  RdExpenditure,
  TaxRate,
} from './finance/types'
import type {
  Contract,
  CreditNote,
  Customer,
  Invoice,
  Payment,
  Quotation,
  RecurringSchedule,
  RevenueSchedule,
  Supplier,
} from './billing/types'
import type { PurchaseOrder, PurchaseRequest, SupplierBill } from './procurement/types'
import type {
  EmployeeProfile,
  Milestone,
  Project,
  ProjectAllocation,
  ProjectCostEntry,
  TimesheetEntry,
} from './projects/types'
import type { AiUsageEntry, CloudCostEntry, CustomerSubscription, SoftwareLicence, SoftwareProduct } from './saas/types'
import type { Budget, ForecastScenario } from './planning/types'
import type {
  AppNotification,
  AuditEntry,
  BusinessRule,
  CustomFieldDefinition,
  DashboardConfig,
  DocumentTemplate,
  FormDefinition,
  FormSubmission,
  FormulaDefinition,
  IntegrationSetting,
  MasterRecord,
  SavedReport,
  WorkflowDefinition,
  WorkflowRun,
} from './configuration/types'

/**
 * The complete browser-side demonstration dataset.
 *
 * Every array is a "collection" and maps 1:1 to a future REST resource
 * (see docs/FRONTEND_ARCHITECTURE.md). The shape is intentionally decoupled
 * from any future Prisma schema.
 */
export interface DemoDatabase {
  meta: {
    schemaVersion: number
    seededAt: string
    /** Anchor date used to generate relative seed dates. */
    anchorDate: ISODate
  }
  organization: Organization
  users: DemoUser[]

  // finance
  accounts: LedgerAccount[]
  journalEntries: JournalEntry[]
  bankAccounts: BankAccount[]
  bankStatementLines: BankStatementLine[]
  periods: FinancialPeriod[]
  expenses: ExpenseClaim[]
  assets: FixedAsset[]
  rdExpenditure: RdExpenditure[]
  taxRates: TaxRate[]
  currencies: CurrencySetting[]
  policies: FinancialPolicy[]

  // sales & billing
  customers: Customer[]
  contracts: Contract[]
  quotations: Quotation[]
  invoices: Invoice[]
  creditNotes: CreditNote[]
  payments: Payment[]
  recurringSchedules: RecurringSchedule[]
  revenueSchedules: RevenueSchedule[]

  // procurement
  suppliers: Supplier[]
  purchaseRequests: PurchaseRequest[]
  purchaseOrders: PurchaseOrder[]
  supplierBills: SupplierBill[]

  // projects & resources
  projects: Project[]
  projectCosts: ProjectCostEntry[]
  milestones: Milestone[]
  employees: EmployeeProfile[]
  allocations: ProjectAllocation[]
  timesheets: TimesheetEntry[]

  // SaaS & technology
  products: SoftwareProduct[]
  subscriptions: CustomerSubscription[]
  cloudCosts: CloudCostEntry[]
  aiUsage: AiUsageEntry[]
  licences: SoftwareLicence[]

  // planning
  budgets: Budget[]
  scenarios: ForecastScenario[]

  // configuration
  masterData: MasterRecord[]
  customFields: CustomFieldDefinition[]
  forms: FormDefinition[]
  formSubmissions: FormSubmission[]
  rules: BusinessRule[]
  workflows: WorkflowDefinition[]
  workflowRuns: WorkflowRun[]
  formulas: FormulaDefinition[]
  templates: DocumentTemplate[]
  dashboards: DashboardConfig[]
  savedReports: SavedReport[]
  integrations: IntegrationSetting[]

  // system
  notifications: AppNotification[]
  auditLog: AuditEntry[]
}

/** Keys of `DemoDatabase` whose value is an array of records with an `id`. */
export type CollectionKey = {
  [K in keyof DemoDatabase]: DemoDatabase[K] extends Array<{ id: string }> ? K : never
}[keyof DemoDatabase]

export type CollectionItem<K extends CollectionKey> = DemoDatabase[K][number]
