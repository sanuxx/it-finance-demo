import type { BaseRecord, ID, ISODate } from '../shared/types'

export type BudgetScope = 'company' | 'department' | 'project' | 'cloud' | 'personnel'
export type BudgetKind = 'expense' | 'revenue'
export type BudgetStatus = 'draft' | 'submitted' | 'approved' | 'revision'

export interface BudgetLine {
  id: ID
  /** Expense / income category id from master data. */
  categoryId: ID
  amount: number
}

export interface Budget extends BaseRecord {
  name: string
  scope: BudgetScope
  kind: BudgetKind
  fiscalYear: number
  periodStart: ISODate
  periodEnd: ISODate
  departmentId?: ID
  projectId?: ID
  ownerId: ID
  status: BudgetStatus
  lines: BudgetLine[]
  notes?: string
}

export interface ForecastScenario extends BaseRecord {
  name: string
  description: string
  revenueGrowthPercent: number // monthly growth applied to baseline revenue
  expenseGrowthPercent: number
  collectionRatePercent: number // share of revenue collected in month
  oneOffItems: { id: ID; month: ISODate; label: string; amount: number }[]
  isDefault: boolean
}
