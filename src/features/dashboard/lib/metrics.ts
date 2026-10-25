import { addDays, addMonths, endOfMonth, format, parseISO } from 'date-fns'
import type { DemoDatabase, Payment } from '@/domain'
import { billBalance, isBillIncurred, isBillOverdue } from '@/lib/calculations/bills'
import { companyBudgetUtilisation } from '@/lib/calculations/budgets'
import { cashPosition } from '@/lib/calculations/cash'
import { invoiceBalance, invoiceDisplayStatus } from '@/lib/calculations/invoices'
import { expenseLedger, groupSum, monthlyIncomeExpense, revenueLedger, type ExpenseItem, type MonthlyPoint, type RevenueItem } from '@/lib/calculations/ledgers'
import { divide, multiply, percentOf, subtract, sum } from '@/lib/calculations/money'
import { projectFinancials, type ProjectFinancials } from '@/lib/calculations/projects'
import { saasMetrics } from '@/lib/calculations/saas'
import { inRange, lastNMonths, previousRange, todayISO, type DateRange } from '@/lib/dates'
import { collectApprovals, type ApprovalItem } from './approvals'

export interface PeriodTotals {
  revenue: number
  expenses: number
  profit: number
  marginPercent: number | null
}

export function periodTotals(revenue: RevenueItem[], expenses: ExpenseItem[], range: DateRange): PeriodTotals {
  const r = sum(
    revenue.filter((i) => inRange(i.date, range.from, range.to)),
    (i) => i.amount,
  )
  const e = sum(
    expenses.filter((i) => inRange(i.date, range.from, range.to)),
    (i) => i.amount,
  )
  const profit = subtract(r, e)
  return { revenue: r, expenses: e, profit, marginPercent: percentOf(profit, r) }
}

/** Percentage change, null when there is no meaningful baseline. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export interface Obligation {
  id: string
  date: string
  label: string
  detail: string
  amount: number
  kind: 'bill' | 'licence' | 'payroll'
  estimate?: boolean
  overdue?: boolean
  link: string
}

export interface DashboardMetrics {
  range: DateRange
  hasComparison: boolean
  current: PeriodTotals
  previous: PeriodTotals
  cash: number
  receivables: { outstanding: number; count: number }
  overdue: { count: number; amount: number }
  payables: { outstanding: number; count: number; overdueCount: number }
  budget: ReturnType<typeof companyBudgetUtilisation>
  mrr: number
  monthly: MonthlyPoint[]
  revenueMix: { categoryId: string; name: string; amount: number }[]
  projects: { id: string; code: string; name: string; customer: string; fin: ProjectFinancials; status: string }[]
  recentPayments: Payment[]
  approvals: ApprovalItem[]
  obligations: Obligation[]
}

export function computeDashboardMetrics(db: DemoDatabase, range: DateRange, asOf: string = todayISO()): DashboardMetrics {
  const revenue = revenueLedger(db)
  const expenses = expenseLedger(db, {}, asOf)
  const prevRange = previousRange(range)
  // Only compare when the earlier period lies inside the history the demo actually has (≈12 months),
  // otherwise the percentage change would be misleading.
  const historyStart = format(addMonths(parseISO(db.meta.anchorDate), -12), 'yyyy-MM-01')
  const hasComparison = !!(prevRange.from && prevRange.to && prevRange.from >= historyStart)
  const masterName = new Map(db.masterData.map((m) => [m.id, m.name]))
  const customerName = new Map(db.customers.map((c) => [c.id, c.name]))

  let receivables = 0
  let receivableCount = 0
  let overdueCount = 0
  let overdueAmount = 0
  for (const inv of db.invoices) {
    const bal = invoiceBalance(inv, db.payments, db.creditNotes)
    const status = invoiceDisplayStatus(inv, bal, asOf)
    if (bal.outstanding > 0 && inv.status !== 'draft' && inv.status !== 'void') {
      receivables += bal.outstanding
      receivableCount++
    }
    if (status === 'overdue') {
      overdueCount++
      overdueAmount += bal.outstanding
    }
  }

  let payables = 0
  let payableCount = 0
  let payableOverdue = 0
  const obligations: Obligation[] = []
  const horizon = format(addDays(parseISO(asOf), 30), 'yyyy-MM-dd')
  const supplierName = new Map(db.suppliers.map((s) => [s.id, s.name]))
  for (const b of db.supplierBills) {
    if (!isBillIncurred(b)) continue
    const bal = billBalance(b, db.payments)
    if (bal.outstanding <= 0) continue
    payables += bal.outstanding
    payableCount++
    const overdue = isBillOverdue(b, bal, asOf)
    if (overdue) payableOverdue++
    if (b.dueDate <= horizon) {
      obligations.push({ id: b.id, date: b.dueDate, label: `${b.number} · ${supplierName.get(b.supplierId) ?? 'Supplier'}`, detail: b.description, amount: bal.outstanding, kind: 'bill', overdue, link: '/procurement/bills' })
    }
  }
  for (const l of db.licences) {
    if (l.status === 'cancelled' || l.renewalDate < asOf || l.renewalDate > horizon) continue
    obligations.push({ id: l.id, date: l.renewalDate, label: `Renewal · ${l.name}`, detail: `${l.seats} seats, ${l.billingCycle}`, amount: multiply(l.seats, l.costPerSeat), kind: 'licence', link: '/saas/licences' })
  }
  const payrollDate = format(addDays(endOfMonth(parseISO(asOf)), -3), 'yyyy-MM-dd')
  const payrollDue = payrollDate >= asOf ? payrollDate : format(addDays(endOfMonth(addMonths(parseISO(asOf), 1)), -3), 'yyyy-MM-dd')
  obligations.push({
    id: 'payroll',
    date: payrollDue,
    label: 'Payroll run (estimate)',
    detail: 'Sum of active cost profiles — fictional',
    amount: sum(
      db.employees.filter((e) => e.active),
      (e) => e.monthlyCost,
    ),
    kind: 'payroll',
    estimate: true,
    link: '/resources/employees',
  })
  obligations.sort((a, b) => a.date.localeCompare(b.date))

  const inPeriodRevenue = revenue.filter((i) => inRange(i.date, range.from, range.to))
  const revenueMix = groupSum(inPeriodRevenue, (i) => i.categoryId).map((g) => ({ categoryId: g.key, name: masterName.get(g.key) ?? g.key, amount: g.amount }))

  const projects = db.projects
    .filter((p) => !p.isInternal && p.status !== 'cancelled' && p.status !== 'planning')
    .map((p) => ({ id: p.id, code: p.code, name: p.name, customer: customerName.get(p.customerId) ?? '—', fin: projectFinancials(p, db, asOf), status: p.status }))
    .sort((a, b) => b.fin.estimatedProfit - a.fin.estimatedProfit)

  return {
    range,
    hasComparison,
    current: periodTotals(revenue, expenses, range),
    previous: hasComparison ? periodTotals(revenue, expenses, prevRange) : { revenue: 0, expenses: 0, profit: 0, marginPercent: null },
    cash: cashPosition(db, asOf),
    receivables: { outstanding: Math.round(receivables * 100) / 100, count: receivableCount },
    overdue: { count: overdueCount, amount: Math.round(overdueAmount * 100) / 100 },
    payables: { outstanding: Math.round(payables * 100) / 100, count: payableCount, overdueCount: payableOverdue },
    budget: companyBudgetUtilisation(db, asOf),
    mrr: saasMetrics(db.subscriptions, asOf).mrr,
    monthly: monthlyIncomeExpense(revenue, expenses, lastNMonths(24, parseISO(asOf))),
    revenueMix,
    projects,
    recentPayments: [...db.payments].filter((p) => p.date <= asOf).sort((a, b) => (b.date === a.date ? b.number.localeCompare(a.number) : b.date.localeCompare(a.date))).slice(0, 10),
    approvals: collectApprovals(db),
    obligations: obligations.slice(0, 12),
  }
}

/** Days sales outstanding (illustrative): receivables ÷ revenue over the last 90 days × 90. */
export function illustrativeDso(receivables: number, revenueLast90: number): number | null {
  if (revenueLast90 <= 0) return null
  return Math.round(multiply(divide(receivables, revenueLast90, 6), 90))
}
