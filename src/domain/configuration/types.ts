import type { BaseRecord, ID, ISODateTime, RoleKey } from '../shared/types'

/* ---------------------------------------------------------------- master data */

export type MasterListKey =
  | 'incomeCategories'
  | 'expenseCategories'
  | 'departments'
  | 'costCentres'
  | 'projectCategories'
  | 'costCodes'
  | 'billingModels'
  | 'paymentTerms'
  | 'supplierCategories'
  | 'assetClasses'
  | 'taxCategories'
  | 'employeeRoles'

export interface MasterRecord extends BaseRecord {
  list: MasterListKey
  code: string
  name: string
  description?: string
  active: boolean
  /** Optional typed attributes, e.g. `days` for payment terms or `usefulLifeMonths` for asset classes. */
  attributes?: Record<string, string | number | boolean>
}

/* -------------------------------------------------------------- custom fields */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'email'
  | 'url'
  | 'file'

export type CustomFieldEntity = 'customer' | 'project' | 'expense' | 'invoice' | 'supplier'

export interface CustomFieldDefinition extends BaseRecord {
  entity: CustomFieldEntity
  key: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]
  helpText?: string
  active: boolean
}

/* --------------------------------------------------------------- form builder */

export interface FieldValidation {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  patternMessage?: string
}

export interface VisibilityCondition {
  fieldId: ID
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'is_checked' | 'is_not_empty'
  value?: string
}

export interface FormFieldDefinition {
  id: ID
  type: FieldType
  label: string
  description?: string
  placeholder?: string
  required: boolean
  defaultValue?: string
  options?: string[]
  validation?: FieldValidation
  visibleWhen?: VisibilityCondition
  sectionId: ID
  width: 'full' | 'half'
}

export interface FormSection {
  id: ID
  title: string
  description?: string
}

export interface FormDefinition extends BaseRecord {
  name: string
  description: string
  entity: 'expense_request' | 'project_intake' | 'purchase_request' | 'vendor_onboarding' | 'custom'
  layout: 'sections' | 'tabs'
  sections: FormSection[]
  fields: FormFieldDefinition[]
  status: 'draft' | 'published'
}

export interface FormSubmission extends BaseRecord {
  formId: ID
  values: Record<string, unknown>
  submittedBy: string
}

/* -------------------------------------------------------------- rules builder */

export type RuleEntity = 'expense' | 'invoice' | 'purchase_order' | 'supplier_bill' | 'project'

export type RuleField =
  | 'amount'
  | 'categoryId'
  | 'projectId'
  | 'departmentId'
  | 'budgetConsumptionPercent'
  | 'daysUntilDue'
  | 'status'
  | 'billable'

export type RuleOperator = 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq' | 'in'

export interface RuleCondition {
  id: ID
  field: RuleField
  operator: RuleOperator
  value: string | number | boolean | string[]
}

export type RuleActionType = 'notify' | 'flag_for_review' | 'escalate_approval' | 'budget_warning'

export interface RuleAction {
  id: ID
  type: RuleActionType
  message: string
  targetRole?: RoleKey
}

export interface BusinessRule extends BaseRecord {
  name: string
  description: string
  entity: RuleEntity
  match: 'all' | 'any'
  conditions: RuleCondition[]
  actions: RuleAction[]
  enabled: boolean
  priority: number
}

/* ------------------------------------------------------------ workflow builder */

export type WorkflowEntity = 'expense' | 'purchase_order' | 'invoice' | 'budget' | 'purchase_request'

export interface WorkflowStageCondition {
  field: 'amount' | 'departmentId' | 'categoryId' | 'projectId'
  operator: 'gte' | 'lt' | 'eq'
  value: string | number
}

export interface WorkflowStage {
  id: ID
  name: string
  type: 'approval' | 'review' | 'notification'
  assigneeRole: RoleKey
  /** Stage only runs when the condition holds; otherwise it is skipped. */
  condition?: WorkflowStageCondition
  slaHours: number
  requireComment: boolean
}

export interface WorkflowDefinition extends BaseRecord {
  name: string
  description: string
  entity: WorkflowEntity
  stages: WorkflowStage[]
  status: 'draft' | 'published'
  version: number
}

export interface WorkflowRunStep {
  stageId: ID
  stageName: string
  assigneeRole: RoleKey
  outcome: 'approved' | 'rejected' | 'skipped' | 'notified' | 'pending'
  reason?: string
  at: ISODateTime
}

export interface WorkflowRun extends BaseRecord {
  workflowId: ID
  workflowName: string
  entity: WorkflowEntity
  /** Either a real demo record or a sandbox simulation. */
  recordId?: ID
  recordLabel: string
  sample: Record<string, string | number>
  steps: WorkflowRunStep[]
  outcome: 'approved' | 'rejected' | 'in_progress'
  simulated: boolean
}

/* ------------------------------------------------------------- formula builder */

export interface FormulaVariable {
  key: string
  label: string
  sampleValue: number
}

export interface FormulaDefinition extends BaseRecord {
  name: string
  description: string
  expression: string
  format: 'currency' | 'percent' | 'number'
  variables: FormulaVariable[]
}

/* ------------------------------------------------------------------ templates */

export type TemplateKind = 'invoice' | 'receipt' | 'statement' | 'purchase_order' | 'approval_email' | 'overdue_email'

export interface DocumentTemplate extends BaseRecord {
  name: string
  kind: TemplateKind
  channel: 'document' | 'email'
  subject?: string
  body: string
  accentColor: string
  isDefault: boolean
}

/* ------------------------------------------------------------------ dashboard */

export type WidgetType =
  | 'kpi_revenue'
  | 'kpi_expenses'
  | 'kpi_profit'
  | 'kpi_margin'
  | 'kpi_cash'
  | 'kpi_receivables'
  | 'kpi_payables'
  | 'kpi_overdue'
  | 'kpi_budget'
  | 'kpi_mrr'
  | 'chart_income_expense'
  | 'chart_revenue_mix'
  | 'chart_cloud_trend'
  | 'table_top_projects'
  | 'table_recent_transactions'
  | 'list_pending_approvals'
  | 'list_upcoming_obligations'
  | 'list_activity'

export interface DashboardWidget {
  id: ID
  type: WidgetType
  title: string
  size: 'sm' | 'md' | 'lg'
  /** Months of history the widget should show where relevant. */
  months?: number
}

export interface DashboardConfig {
  id: ID
  name: string
  widgets: DashboardWidget[]
  updatedAt: ISODateTime
}

/* -------------------------------------------------------------- report builder */

export type ReportDatasetKey =
  | 'invoices'
  | 'expenses'
  | 'payments'
  | 'projects'
  | 'cloudCosts'
  | 'subscriptions'
  | 'supplierBills'
  | 'timesheets'

export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max'

export interface ReportFilter {
  id: ID
  field: string
  operator: 'eq' | 'neq' | 'gte' | 'lte' | 'contains'
  value: string
}

export interface SavedReport extends BaseRecord {
  name: string
  description?: string
  dataset: ReportDatasetKey
  columns: string[]
  groupBy?: string
  metric?: { field: string; fn: AggregateFn }
  filters: ReportFilter[]
  dateRange?: { from?: string; to?: string }
  presentation: 'table' | 'bar' | 'line' | 'pie'
  ownerName: string
}

/* -------------------------------------------------------- notifications/audit */

export interface AppNotification {
  id: ID
  at: ISODateTime
  title: string
  body: string
  kind: 'info' | 'warning' | 'success' | 'approval'
  read: boolean
  link?: string
}

export interface AuditEntry {
  id: ID
  at: ISODateTime
  actor: string
  role: RoleKey
  action: string
  entity: string
  entityId?: ID
  summary: string
}

export interface IntegrationSetting extends BaseRecord {
  key: string
  name: string
  category: 'accounting' | 'banking' | 'cloud' | 'payments' | 'communication' | 'hr' | 'ai'
  description: string
  status: 'not_connected' | 'connected_demo' | 'coming_soon'
  lastSyncAt?: ISODateTime
  settings: Record<string, string | boolean>
}
