import type { Budget, DemoDatabase } from '@/domain'
import { expenseLedger, revenueLedger, type ExpenseItem, type RevenueItem } from './ledgers'
import { percentOf, subtract, sum } from './money'
import { projectFinancials, type ProjectDb } from './projects'
import { EXPENSE_CATEGORY } from '@/data/seed/ids'
import { todayISO } from '@/lib/dates'

export interface BudgetLineActual {
  lineId: string
  categoryId: string
  budget: number
  actual: number
  remaining: number
  utilisationPercent: number | null
}

export interface BudgetActuals {
  budgetId: string
  total: number
  actual: number
  remaining: number
  /** eligible actual / approved budget × 100 — null when the budget is zero. */
  utilisationPercent: number | null
  /** Share of the budget period that has elapsed, for pacing comparisons. */
  elapsedPercent: number
  lines: BudgetLineActual[]
  status: 'under' | 'on_pace' | 'over_pace' | 'exceeded'
}

export function budgetTotal(budget: Pick<Budget, 'lines'>): number {
  return sum(budget.lines, (l) => l.amount)
}

/**
 * Which ledger items are eligible for a budget: same period and (where set) same
 * department or project. Cloud and personnel budgets restrict to their categories.
 */
function eligibleExpenses(budget: Budget, items: ExpenseItem[]): ExpenseItem[] {
  return items.filter((i) => {
    if (i.date < budget.periodStart || i.date > budget.periodEnd) return false
    if (budget.departmentId && i.departmentId !== budget.departmentId) return false
    if (budget.projectId && i.projectId !== budget.projectId) return false
    if (budget.scope === 'cloud' && i.categoryId !== EXPENSE_CATEGORY.cloud && i.categoryId !== EXPENSE_CATEGORY.ai) return false
    if (budget.scope === 'personnel' && i.categoryId !== EXPENSE_CATEGORY.salaries && i.categoryId !== EXPENSE_CATEGORY.contractors)
      return false
    return true
  })
}

function eligibleRevenue(budget: Budget, items: RevenueItem[]): RevenueItem[] {
  return items.filter((i) => {
    if (i.date < budget.periodStart || i.date > budget.periodEnd) return false
    if (budget.projectId && i.projectId !== budget.projectId) return false
    return true
  })
}

export function budgetActuals(
  budget: Budget,
  ledgers: { expenses: ExpenseItem[]; revenue: RevenueItem[] },
  asOf: string = todayISO(),
): BudgetActuals {
  const items: { categoryId: string; amount: number }[] =
    budget.kind === 'revenue' ? eligibleRevenue(budget, ledgers.revenue) : eligibleExpenses(budget, ledgers.expenses)
  const lineCategories = new Set(budget.lines.map((l) => l.categoryId))
  const lines: BudgetLineActual[] = budget.lines.map((l) => {
    const actual = sum(
      items.filter((i) => i.categoryId === l.categoryId),
      (i) => i.amount,
    )
    return {
      lineId: l.id,
      categoryId: l.categoryId,
      budget: l.amount,
      actual,
      remaining: subtract(l.amount, actual),
      utilisationPercent: percentOf(actual, l.amount),
    }
  })
  // Project budgets with a single "all costs" style line count every eligible item.
  const total = budgetTotal(budget)
  const actual = sum(
    items.filter((i) => lineCategories.has(i.categoryId)),
    (i) => i.amount,
  )
  const start = new Date(budget.periodStart).getTime()
  const end = new Date(budget.periodEnd).getTime()
  const now = new Date(asOf).getTime()
  const elapsedPercent = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 100
  const utilisationPercent = percentOf(actual, total)
  let status: BudgetActuals['status'] = 'under'
  if (utilisationPercent !== null && actual > 0) {
    if (utilisationPercent > 100) status = 'exceeded'
    else if (utilisationPercent > elapsedPercent + 10) status = 'over_pace'
    else if (utilisationPercent >= elapsedPercent - 10) status = 'on_pace'
  }
  return { budgetId: budget.id, total, actual, remaining: subtract(total, actual), utilisationPercent, elapsedPercent, lines, status }
}

/** Convenience: build ledgers once for many budgets. */
export function allBudgetActuals(db: DemoDatabase, asOf: string = todayISO()): Map<string, BudgetActuals> {
  const expenses = expenseLedger(db, {}, asOf)
  const revenue = revenueLedger(db)
  return new Map(db.budgets.map((b) => [b.id, budgetActuals(b, { expenses, revenue }, asOf)]))
}

/** Company-wide utilisation of approved expense budgets in the current fiscal year. */
export function companyBudgetUtilisation(db: DemoDatabase, asOf: string = todayISO()) {
  const year = Number(asOf.slice(0, 4))
  const approved = db.budgets.filter((b) => b.status === 'approved' && b.kind === 'expense' && b.scope === 'company' && b.fiscalYear === year)
  const map = allBudgetActuals({ ...db, budgets: approved }, asOf)
  const total = sum([...map.values()], (b) => b.total)
  const actual = sum([...map.values()], (b) => b.actual)
  return { total, actual, utilisationPercent: percentOf(actual, total) }
}

export function projectBudgetSummary(db: ProjectDb & Pick<DemoDatabase, 'projects'>) {
  return db.projects.map((p) => ({ project: p, fin: projectFinancials(p, db) }))
}
