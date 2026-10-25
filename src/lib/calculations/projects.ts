import type { CostType, DemoDatabase, Project } from '@/domain'
import { documentTotals } from './invoices'
import { isBillIncurred } from './bills'
import { add, divide, max0, multiply, percentOf, subtract, sum } from './money'
import { todayISO } from '@/lib/dates'

export type ProjectHealth = 'on_track' | 'at_risk' | 'over_budget' | 'not_started'

export interface ProjectCostBreakdown {
  labour: number
  infrastructure: number
  software: number
  subcontractor: number
  travel: number
  other: number
}

export interface ProjectFinancials {
  projectId: string
  contractValue: number
  budget: number
  /** Incurred costs from all sources (labour + direct costs). */
  actualCost: number
  /** Costs committed (e.g. open POs) but not yet incurred. */
  committedCost: number
  breakdown: ProjectCostBreakdown
  billableCost: number
  nonBillableCost: number
  labourHours: number
  billableHours: number
  /** Invoiced revenue, net of tax (issued, part-paid and paid invoices less credit notes). */
  invoiced: number
  /** Cash received against project invoices (includes tax). */
  collected: number
  /** Illustrative recognised revenue: % complete × contract value for fixed price/milestone, otherwise invoiced. */
  recognisedRevenue: number
  remainingBudget: number
  /** Estimate at completion — illustrative. */
  forecastCost: number
  costToComplete: number
  estimatedProfit: number
  /** Direct-cost margin (before allocated overhead), percent. */
  estimatedMarginPercent: number | null
  budgetConsumptionPercent: number | null
  health: ProjectHealth
}

export type ProjectDb = Pick<
  DemoDatabase,
  | 'projectCosts'
  | 'timesheets'
  | 'employees'
  | 'expenses'
  | 'supplierBills'
  | 'cloudCosts'
  | 'aiUsage'
  | 'invoices'
  | 'payments'
  | 'creditNotes'
>

const COST_TYPE_KEY: Record<CostType, keyof ProjectCostBreakdown> = {
  labour: 'labour',
  infrastructure: 'infrastructure',
  software: 'software',
  subcontractor: 'subcontractor',
  travel: 'travel',
  other: 'other',
}

/** Labour cost of approved/submitted timesheet hours at each employee's cost rate. */
export function timesheetLabour(db: Pick<DemoDatabase, 'timesheets' | 'employees'>, projectId: string) {
  const rate = new Map(db.employees.map((e) => [e.id, e.hourlyCostRate]))
  const rows = db.timesheets.filter((t) => t.projectId === projectId && t.status !== 'rejected' && t.status !== 'draft')
  const cost = sum(rows, (t) => multiply(t.hours, rate.get(t.employeeId) ?? 0))
  const billableCost = sum(
    rows.filter((t) => t.billable),
    (t) => multiply(t.hours, rate.get(t.employeeId) ?? 0),
  )
  return {
    cost,
    billableCost,
    hours: sum(rows, (t) => t.hours),
    billableHours: sum(
      rows.filter((t) => t.billable),
      (t) => t.hours,
    ),
  }
}

export function projectFinancials(project: Project, db: ProjectDb, asOf: string = todayISO()): ProjectFinancials {
  const breakdown: ProjectCostBreakdown = { labour: 0, infrastructure: 0, software: 0, subcontractor: 0, travel: 0, other: 0 }
  let billable = 0
  let nonBillable = 0
  let committed = 0

  const labour = timesheetLabour(db, project.id)
  breakdown.labour = labour.cost
  billable = add(billable, labour.billableCost)
  nonBillable = add(nonBillable, subtract(labour.cost, labour.billableCost))

  for (const c of db.projectCosts) {
    if (c.projectId !== project.id) continue
    if (c.committed) {
      committed = add(committed, c.amount)
      continue
    }
    const key = COST_TYPE_KEY[c.type]
    breakdown[key] = add(breakdown[key], c.amount)
    if (c.billable) billable = add(billable, c.amount)
    else nonBillable = add(nonBillable, c.amount)
  }
  for (const x of db.expenses) {
    if (x.projectId !== project.id || (x.status !== 'approved' && x.status !== 'reimbursed')) continue
    const key: keyof ProjectCostBreakdown = x.categoryId === 'exp-travel' ? 'travel' : 'other'
    breakdown[key] = add(breakdown[key], x.amount)
    if (x.billable) billable = add(billable, x.amount)
    else nonBillable = add(nonBillable, x.amount)
  }
  for (const b of db.supplierBills) {
    if (b.projectId !== project.id || !isBillIncurred(b)) continue
    const key: keyof ProjectCostBreakdown =
      b.categoryId === 'exp-contractors' || b.categoryId === 'exp-professional' ? 'subcontractor' : b.categoryId === 'exp-software' ? 'software' : 'other'
    breakdown[key] = add(breakdown[key], b.subtotal)
    nonBillable = add(nonBillable, b.subtotal)
  }
  for (const c of db.cloudCosts) {
    if (c.projectId !== project.id || c.month > asOf) continue
    breakdown.infrastructure = add(breakdown.infrastructure, c.amount)
    billable = add(billable, c.amount)
  }
  for (const a of db.aiUsage) {
    if (a.projectId !== project.id || a.month > asOf) continue
    breakdown.infrastructure = add(breakdown.infrastructure, a.amount)
    billable = add(billable, a.amount)
  }

  const actualCost = add(...Object.values(breakdown))

  const projectInvoices = db.invoices.filter((i) => i.projectId === project.id && i.status !== 'draft' && i.status !== 'void')
  const invoiceIds = new Set(projectInvoices.map((i) => i.id))
  const credits = db.creditNotes.filter((c) => c.invoiceId && invoiceIds.has(c.invoiceId) && c.status !== 'draft')
  const invoicedGross = sum(projectInvoices, (i) => documentTotals(i.lines, i.discountPercent).total)
  const invoicedNet = sum(projectInvoices, (i) => documentTotals(i.lines, i.discountPercent).netAmount)
  const creditNet = sum(credits, (c) => (invoicedGross > 0 ? multiply(c.amount, divide(invoicedNet, invoicedGross, 6)) : c.amount))
  const invoiced = subtract(invoicedNet, creditNet)
  const collected = sum(
    db.payments.filter((p) => p.direction === 'incoming' && p.invoiceId && invoiceIds.has(p.invoiceId)),
    (p) => p.amount,
  )

  const pct = Math.min(Math.max(project.percentComplete, 0), 100)
  const recognisedRevenue =
    project.billingModel === 'fixed_price' || project.billingModel === 'milestone'
      ? multiply(project.contractValue, pct / 100)
      : invoiced

  // Estimate at completion: cost-performance based once work has started, else budget.
  const spentAndCommitted = add(actualCost, committed)
  let forecastCost = project.budget
  if (pct >= 5 && actualCost > 0) forecastCost = Math.max(divide(actualCost, pct / 100), spentAndCommitted)
  else forecastCost = Math.max(project.budget, spentAndCommitted)
  if (project.status === 'completed') forecastCost = spentAndCommitted
  const costToComplete = max0(subtract(forecastCost, actualCost))
  const revenueBase = project.isInternal ? 0 : project.contractValue
  const estimatedProfit = subtract(revenueBase, forecastCost)
  const budgetConsumptionPercent = percentOf(actualCost, project.budget)

  let health: ProjectHealth = 'on_track'
  if (actualCost === 0 && (project.status === 'planning' || pct === 0)) health = 'not_started'
  else if (forecastCost > project.budget * 1.0001 || (budgetConsumptionPercent ?? 0) > 100) health = 'over_budget'
  else if ((budgetConsumptionPercent ?? 0) > pct + 10 || forecastCost > project.budget * 0.95) health = 'at_risk'

  return {
    projectId: project.id,
    contractValue: project.contractValue,
    budget: project.budget,
    actualCost,
    committedCost: committed,
    breakdown,
    billableCost: billable,
    nonBillableCost: nonBillable,
    labourHours: labour.hours,
    billableHours: labour.billableHours,
    invoiced,
    collected,
    recognisedRevenue,
    remainingBudget: subtract(project.budget, actualCost),
    forecastCost,
    costToComplete,
    estimatedProfit,
    estimatedMarginPercent: revenueBase > 0 ? percentOf(estimatedProfit, revenueBase) : null,
    budgetConsumptionPercent,
    health,
  }
}

export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  over_budget: 'Over budget',
  not_started: 'Not started',
}
