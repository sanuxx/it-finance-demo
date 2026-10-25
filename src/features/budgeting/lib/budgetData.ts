import { useMemo } from 'react'
import type { Budget, BudgetScope } from '@/domain'
import { EXPENSE_CATEGORY } from '@/data/seed/ids'
import { useDbSlice, useLedgers, useProjectFinancials } from '@/hooks/useData'
import { budgetActuals, type BudgetActuals, type BudgetLineActual } from '@/lib/calculations/budgets'
import type { ExpenseItem, RevenueItem } from '@/lib/calculations/ledgers'
import type { ProjectCostBreakdown, ProjectFinancials } from '@/lib/calculations/projects'
import { add, percentOf, subtract, sum } from '@/lib/calculations/money'
import { monthsBetween, todayISO } from '@/lib/dates'

export const SCOPE_LABELS: Record<BudgetScope, string> = {
  company: 'Company',
  department: 'Department',
  project: 'Project',
  cloud: 'Cloud & AI',
  personnel: 'Personnel',
}

/** Expense category → project cost bucket, used for project-scope budgets. */
const PROJECT_BUCKET: Record<string, keyof ProjectCostBreakdown> = {
  [EXPENSE_CATEGORY.salaries]: 'labour',
  [EXPENSE_CATEGORY.contractors]: 'subcontractor',
  [EXPENSE_CATEGORY.professional]: 'subcontractor',
  [EXPENSE_CATEGORY.cloud]: 'infrastructure',
  [EXPENSE_CATEGORY.ai]: 'infrastructure',
  [EXPENSE_CATEGORY.software]: 'software',
  [EXPENSE_CATEGORY.travel]: 'travel',
}

/**
 * Project budgets compare against the project's own cost model (labour from
 * timesheets + direct costs) rather than the company expense ledger.
 */
export function projectBudgetActuals(budget: Budget, fin: ProjectFinancials | undefined, asOf: string = todayISO()): BudgetActuals {
  const remainingBuckets = { ...(fin?.breakdown ?? { labour: 0, infrastructure: 0, software: 0, subcontractor: 0, travel: 0, other: 0 }) }
  const lines: BudgetLineActual[] = budget.lines.map((l) => {
    const bucket = PROJECT_BUCKET[l.categoryId] ?? 'other'
    const actual = remainingBuckets[bucket]
    remainingBuckets[bucket] = 0 // each bucket counts once, against the first matching line
    return { lineId: l.id, categoryId: l.categoryId, budget: l.amount, actual, remaining: subtract(l.amount, actual), utilisationPercent: percentOf(actual, l.amount) }
  })
  const total = sum(budget.lines, (l) => l.amount)
  const actual = sum(lines, (l) => l.actual)
  const start = new Date(budget.periodStart).getTime()
  const end = new Date(budget.periodEnd).getTime()
  const elapsedPercent = end > start ? Math.min(100, Math.max(0, ((new Date(asOf).getTime() - start) / (end - start)) * 100)) : 100
  const utilisationPercent = percentOf(actual, total)
  let status: BudgetActuals['status'] = 'under'
  if (utilisationPercent !== null && actual > 0) {
    if (utilisationPercent > 100) status = 'exceeded'
    else if (utilisationPercent > elapsedPercent + 10) status = 'over_pace'
    else if (utilisationPercent >= elapsedPercent - 10) status = 'on_pace'
  }
  return { budgetId: budget.id, total, actual, remaining: subtract(total, actual), utilisationPercent, elapsedPercent, lines, status }
}

/** Budget vs actual for every budget, from the shared ledgers. */
export function useAllBudgetActuals(): Map<string, BudgetActuals> {
  const { budgets } = useDbSlice('budgets')
  const ledgers = useLedgers()
  const projectFin = useProjectFinancials()
  return useMemo(() => {
    const asOf = todayISO()
    return new Map(budgets.map((b) => [b.id, b.scope === 'project' && b.projectId ? projectBudgetActuals(b, projectFin.get(b.projectId), asOf) : budgetActuals(b, ledgers, asOf)]))
  }, [budgets, ledgers, projectFin])
}

/** Same eligibility rules as lib/calculations/budgets, used for monthly breakdowns. */
export function eligibleItems(budget: Budget, ledgers: { expenses: ExpenseItem[]; revenue: RevenueItem[] }): { date: string; amount: number; categoryId: string }[] {
  const cats = new Set(budget.lines.map((l) => l.categoryId))
  const inPeriod = (d: string) => d >= budget.periodStart && d <= budget.periodEnd
  if (budget.kind === 'revenue') return ledgers.revenue.filter((i) => inPeriod(i.date) && (!budget.projectId || i.projectId === budget.projectId) && cats.has(i.categoryId))
  return ledgers.expenses.filter((i) => {
    if (!inPeriod(i.date) || !cats.has(i.categoryId)) return false
    if (budget.departmentId && i.departmentId !== budget.departmentId) return false
    if (budget.projectId && i.projectId !== budget.projectId) return false
    return true
  })
}

export interface PacingPoint {
  month: string
  actual: number
  cumulativeActual: number | null
  cumulativeBudget: number
  monthlyBudget: number
}

/** Monthly actuals plus cumulative actual vs straight-line budget pacing. */
export function pacingSeries(budget: Budget, items: { date: string; amount: number }[], asOf: string = todayISO()): PacingPoint[] {
  const months = monthsBetween(budget.periodStart, budget.periodEnd)
  const total = sum(budget.lines, (l) => l.amount)
  const monthly = months.length ? total / months.length : 0
  const current = asOf.slice(0, 7)
  let cum = 0
  return months.map((m, i) => {
    const actual = sum(
      items.filter((x) => x.date.slice(0, 7) === m),
      (x) => x.amount,
    )
    cum = add(cum, actual)
    return { month: m, actual, cumulativeActual: m <= current ? cum : null, cumulativeBudget: Math.round(monthly * (i + 1) * 100) / 100, monthlyBudget: Math.round(monthly * 100) / 100 }
  })
}
