import { addMonths, format, getDaysInMonth, parseISO, startOfMonth } from 'date-fns'
import type { DemoDatabase, ID, ISODate } from '@/domain'
import { EXPENSE_CATEGORY, INCOME_CATEGORY } from '@/data/seed/ids'
import { inRange, todayISO, type DateRange } from '@/lib/dates'
import { divide, multiply, round2, subtract, sum } from './money'
import { documentTotals, lineTotals } from './invoices'
import { isBillIncurred } from './bills'
import { monthlyDepreciation } from './depreciation'

/**
 * Normalised revenue and expense "ledgers".
 *
 * Every financial aggregate in the app (dashboards, P&L, budgets, cost
 * analysis, reports) is derived from these two functions so that the same
 * underlying value is never computed two different ways.
 */

export interface RevenueItem {
  id: string
  date: ISODate
  /** Revenue net of tax and discounts. Credit notes are negative. */
  amount: number
  categoryId: ID
  customerId: ID
  projectId?: ID
  productId?: ID
  invoiceId?: ID
  source: 'invoice' | 'credit_note'
  label: string
}

export type ExpenseSource = 'personnel' | 'licence' | 'depreciation' | 'expense' | 'bill' | 'cloud' | 'ai'

export interface ExpenseItem {
  id: string
  date: ISODate
  amount: number
  categoryId: ID
  departmentId?: ID
  projectId?: ID
  productId?: ID
  supplierId?: ID
  source: ExpenseSource
  sourceId?: ID
  label: string
}

type RevenueDb = Pick<DemoDatabase, 'invoices' | 'creditNotes' | 'products'>

export function revenueLedger(db: RevenueDb, range: DateRange = {}): RevenueItem[] {
  const productCategory = new Map(db.products.map((p) => [p.id, p.incomeCategoryId]))
  const out: RevenueItem[] = []
  for (const inv of db.invoices) {
    if (inv.status === 'draft' || inv.status === 'void') continue
    if (!inRange(inv.issueDate, range.from, range.to)) continue
    inv.lines.forEach((line, i) => {
      const { net } = lineTotals(line)
      const amount = subtract(net, multiply(net, (inv.discountPercent || 0) / 100))
      out.push({
        id: `${inv.id}:${i}`,
        date: inv.issueDate,
        amount,
        categoryId: (line.productId && productCategory.get(line.productId)) || INCOME_CATEGORY.development,
        customerId: inv.customerId,
        projectId: inv.projectId,
        productId: line.productId,
        invoiceId: inv.id,
        source: 'invoice',
        label: `${inv.number} — ${line.description}`,
      })
    })
  }
  const invoiceById = new Map(db.invoices.map((i) => [i.id, i]))
  for (const cn of db.creditNotes) {
    if (cn.status === 'draft') continue
    if (!inRange(cn.date, range.from, range.to)) continue
    const inv = cn.invoiceId ? invoiceById.get(cn.invoiceId) : undefined
    // Credit notes are stored gross; strip tax using the related invoice's effective tax ratio.
    let net = cn.amount
    let categoryId: string = INCOME_CATEGORY.development
    let productId: string | undefined
    if (inv) {
      const t = documentTotals(inv.lines, inv.discountPercent)
      net = t.total > 0 ? round2((cn.amount * t.netAmount) / t.total) : cn.amount
      productId = inv.lines[0]?.productId
      categoryId = (productId && productCategory.get(productId)) || categoryId
    }
    out.push({
      id: cn.id,
      date: cn.date,
      amount: -net,
      categoryId,
      customerId: cn.customerId,
      projectId: inv?.projectId,
      productId,
      invoiceId: inv?.id,
      source: 'credit_note',
      label: `${cn.number} — ${cn.reason}`,
    })
  }
  return out
}

type ExpenseDb = Pick<
  DemoDatabase,
  'employees' | 'licences' | 'assets' | 'expenses' | 'supplierBills' | 'cloudCosts' | 'aiUsage' | 'meta'
>

function monthsInScope(range: DateRange, earliest: ISODate, asOf: ISODate): string[] {
  const start = range.from && range.from > earliest ? range.from : earliest
  const capTo = range.to && range.to < asOf ? range.to : asOf
  const out: string[] = []
  let cursor = startOfMonth(parseISO(start))
  const last = startOfMonth(parseISO(capTo))
  let guard = 0
  while (cursor <= last && guard++ < 240) {
    out.push(format(cursor, 'yyyy-MM-dd'))
    cursor = addMonths(cursor, 1)
  }
  return out
}

/**
 * All recognised operating expenses.
 * Personnel, licences and depreciation are accrued monthly (on the 1st) up to `asOf`.
 */
export function expenseLedger(db: ExpenseDb, range: DateRange = {}, asOf: ISODate = todayISO()): ExpenseItem[] {
  const out: ExpenseItem[] = []
  const earliest = format(addMonths(parseISO(db.meta.anchorDate), -18), 'yyyy-MM-01')
  const months = monthsInScope(range, earliest, asOf)

  const currentMonth = `${asOf.slice(0, 7)}-01`
  for (const month of months) {
    const monthEnd = format(addMonths(parseISO(month), 1), 'yyyy-MM-dd')
    // The current month is accrued pro rata to `asOf` so month-to-date figures are comparable.
    const accrual = month === currentMonth ? Number(asOf.slice(8, 10)) / getDaysInMonth(parseISO(month)) : 1
    for (const e of db.employees) {
      if (!e.active || e.startDate >= monthEnd) continue
      out.push({
        id: `pay:${e.id}:${month}`,
        date: month,
        amount: multiply(e.monthlyCost, accrual),
        categoryId: e.employmentType === 'contractor' ? EXPENSE_CATEGORY.contractors : EXPENSE_CATEGORY.salaries,
        departmentId: e.departmentId,
        source: 'personnel',
        sourceId: e.id,
        label: `Personnel cost — ${e.name}`,
      })
    }
    for (const l of db.licences) {
      if (l.status === 'cancelled' || l.startDate >= monthEnd) continue
      const monthly = l.billingCycle === 'annual' ? divide(multiply(l.seats, l.costPerSeat), 12) : multiply(l.seats, l.costPerSeat)
      out.push({
        id: `lic:${l.id}:${month}`,
        date: month,
        amount: multiply(monthly, accrual),
        categoryId: EXPENSE_CATEGORY.software,
        departmentId: l.departmentId,
        supplierId: l.vendorId,
        source: 'licence',
        sourceId: l.id,
        label: `Licence — ${l.name}`,
      })
    }
    for (const a of db.assets) {
      const dep = monthlyDepreciation(a, month)
      if (dep <= 0) continue
      out.push({
        id: `dep:${a.id}:${month}`,
        date: month,
        amount: multiply(dep, accrual),
        categoryId: EXPENSE_CATEGORY.depreciation,
        departmentId: a.departmentId,
        source: 'depreciation',
        sourceId: a.id,
        label: `Depreciation — ${a.name}`,
      })
    }
  }

  for (const x of db.expenses) {
    if (x.status !== 'approved' && x.status !== 'reimbursed') continue
    if (!inRange(x.date, range.from, range.to)) continue
    out.push({
      id: x.id,
      date: x.date,
      amount: x.amount,
      categoryId: x.categoryId,
      departmentId: x.departmentId,
      projectId: x.projectId,
      source: 'expense',
      sourceId: x.id,
      label: `${x.number} — ${x.description}`,
    })
  }
  for (const b of db.supplierBills) {
    if (!isBillIncurred(b)) continue
    if (!inRange(b.billDate, range.from, range.to)) continue
    out.push({
      id: b.id,
      date: b.billDate,
      amount: b.subtotal,
      categoryId: b.categoryId,
      departmentId: b.departmentId,
      projectId: b.projectId,
      supplierId: b.supplierId,
      source: 'bill',
      sourceId: b.id,
      label: `${b.number} — ${b.description}`,
    })
  }
  for (const c of db.cloudCosts) {
    if (!inRange(c.month, range.from, range.to) || c.month > asOf) continue
    out.push({
      id: c.id,
      date: c.month,
      amount: c.amount,
      categoryId: EXPENSE_CATEGORY.cloud,
      departmentId: c.departmentId,
      projectId: c.projectId,
      productId: c.productId,
      source: 'cloud',
      sourceId: c.id,
      label: `${c.provider} — ${c.service}`,
    })
  }
  for (const a of db.aiUsage) {
    if (!inRange(a.month, range.from, range.to) || a.month > asOf) continue
    out.push({
      id: a.id,
      date: a.month,
      amount: a.amount,
      categoryId: EXPENSE_CATEGORY.ai,
      projectId: a.projectId,
      productId: a.productId,
      source: 'ai',
      sourceId: a.id,
      label: `${a.provider} ${a.model} — ${a.useCase}`,
    })
  }
  return out
}

export interface MonthlyPoint {
  month: string // yyyy-MM
  revenue: number
  expenses: number
  profit: number
}

export function monthlyIncomeExpense(revenue: RevenueItem[], expenses: ExpenseItem[], months: string[]): MonthlyPoint[] {
  const rev = new Map<string, RevenueItem[]>()
  const exp = new Map<string, ExpenseItem[]>()
  for (const r of revenue) {
    const k = r.date.slice(0, 7)
    const list = rev.get(k)
    if (list) list.push(r)
    else rev.set(k, [r])
  }
  for (const e of expenses) {
    const k = e.date.slice(0, 7)
    const list = exp.get(k)
    if (list) list.push(e)
    else exp.set(k, [e])
  }
  return months.map((month) => {
    const r = sum(rev.get(month) ?? [], (x) => x.amount)
    const e = sum(exp.get(month) ?? [], (x) => x.amount)
    return { month, revenue: r, expenses: e, profit: subtract(r, e) }
  })
}

/** Group items by a key and sum amounts, sorted descending. */
export function groupSum<T extends { amount: number }>(items: T[], key: (item: T) => string | undefined) {
  const map = new Map<string, number>()
  for (const item of items) {
    const k = key(item) ?? 'unassigned'
    map.set(k, round2((map.get(k) ?? 0) + item.amount))
  }
  return [...map.entries()].map(([k, amount]) => ({ key: k, amount })).sort((a, b) => b.amount - a.amount)
}
