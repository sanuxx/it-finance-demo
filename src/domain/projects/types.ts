import type { BaseRecord, ID, ISODate } from '../shared/types'
import type { BillingModel } from '../billing/types'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

export interface Project extends BaseRecord {
  code: string
  name: string
  customerId: ID
  contractId?: ID
  categoryId: ID
  managerId: ID
  departmentId: ID
  billingModel: BillingModel
  status: ProjectStatus
  startDate: ISODate
  endDate: ISODate
  contractValue: number
  /** Approved cost budget. */
  budget: number
  /** Planned labour / infrastructure / other split of the cost budget. */
  plannedLabour: number
  plannedInfrastructure: number
  plannedOther: number
  /** Manager's estimate of completion, 0-100. */
  percentComplete: number
  description?: string
  isInternal: boolean
  customFields?: Record<string, unknown>
}

export type CostType = 'labour' | 'infrastructure' | 'software' | 'subcontractor' | 'travel' | 'other'

export interface ProjectCostEntry extends BaseRecord {
  projectId: ID
  date: ISODate
  type: CostType
  costCodeId?: ID
  description: string
  amount: number
  billable: boolean
  /** Committed (e.g. PO raised) but not yet incurred. */
  committed: boolean
  sourceType?: 'manual' | 'expense' | 'bill' | 'cloud' | 'timesheet'
  sourceId?: ID
}

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'invoiced'

export interface Milestone extends BaseRecord {
  projectId: ID
  name: string
  dueDate: ISODate
  amount: number
  status: MilestoneStatus
  invoiceId?: ID
}

export type EmploymentType = 'employee' | 'contractor'

/** Fictional cost profile — no real payroll data. */
export interface EmployeeProfile extends BaseRecord {
  code: string
  name: string
  email: string
  roleId: ID
  departmentId: ID
  employmentType: EmploymentType
  monthlyCost: number
  hourlyCostRate: number
  hourlyBillRate: number
  capacityHoursPerWeek: number
  startDate: ISODate
  active: boolean
}

export interface ProjectAllocation extends BaseRecord {
  projectId: ID
  employeeId: ID
  plannedHours: number
  startDate: ISODate
  endDate: ISODate
  roleOnProject: string
}

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface TimesheetEntry extends BaseRecord {
  employeeId: ID
  projectId: ID
  date: ISODate
  hours: number
  billable: boolean
  description: string
  status: TimesheetStatus
}
