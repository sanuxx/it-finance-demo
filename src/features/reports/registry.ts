import { addMonths, format, parseISO } from 'date-fns'
import type { DemoDatabase } from '@/domain'
import { AGEING_LABELS, ageingBucket, invoiceBalance, type AgeingBucket } from '@/lib/calculations/invoices'
import { billBalance, isBillIncurred } from '@/lib/calculations/bills'
import { allBudgetActuals } from '@/lib/calculations/budgets'
import { monthlyCashFlow, signedPayment } from '@/lib/calculations/cash'
import { assetBookValue, monthlyDepreciation } from '@/lib/calculations/depreciation'
import { expenseLedger, groupSum, monthlyIncomeExpense, revenueLedger } from '@/lib/calculations/ledgers'
import { add, divide, multiply, percentOf, round2, subtract, sum } from '@/lib/calculations/money'
import { projectFinancials } from '@/lib/calculations/projects'
import { isSubscriptionLive, mrrTrend, subscriptionMrr } from '@/lib/calculations/saas'
import { lastNMonths, monthsBetween, todayISO, type DateRange } from '@/lib/dates'
import type { Permission } from '@/lib/permissions'

/* ------------------------------------------------------------------ types */

export type CellFormat = 'text' | 'currency' | 'percent' | 'number' | 'date' | 'month'

export interface ReportColumn {
  key: string
  header: string
  format?: CellFormat
}

export type ReportRow = Record<string, string | number | null | undefined> & { _kind?: 'section' | 'total' | 'subtotal' }

export interface ReportChart {
  type: 'bar' | 'line' | 'pie' | 'stacked'
  x: string
  xFormat?: CellFormat
  series: { key: string; label: string }[]
  rows: Record<string, string | number>[]
}

export interface ReportResult {
  columns: ReportColumn[]
  rows: ReportRow[]
  totals?: ReportRow
  chart?: ReportChart
  summary?: { label: string; value: number | string | null; format?: CellFormat }[]
  notes?: string[]
  check?: { ok: boolean; message: string }
}

export type ReportGroup = 'Financial statements' | 'Receivables & payables' | 'Project reports' | 'Customer & product' | 'Cost analysis' | 'Budget & forecast' | 'Assets'

export interface ReportDefinition {
  key: string
  title: string
  group: ReportGroup
  description: string
  /** 'range' uses the date filter; 'asOf' reports are calculated at today's date. */
  dateMode: 'range' | 'asOf'
  permission?: Permission
  build: (db: DemoDatabase, ctx: { range: DateRange; asOf: string }) => ReportResult
}

export const REPORT_GROUPS: ReportGroup[] = ['Financial statements', 'Receivables & payables', 'Project reports', 'Customer & product', 'Cost analysis', 'Budget & forecast', 'Assets']

/* ---------------------------------------------------------------- helpers */

function rangeMonths(range: DateRange, asOf: string, db: DemoDatabase): string[] {
  const from = range.from ?? format(addMonths(parseISO(db.meta.anchorDate), -18), 'yyyy-MM-01')
  const to = range.to && range.to < asOf ? range.to : asOf
  return monthsBetween(from, to)
}

const BUCKETS: AgeingBucket[] = ['current', '1_30', '31_60', '61_90', '90_plus']

function names(db: DemoDatabase) {
  return {
    master: new Map(db.masterData.map((m) => [m.id, m.name])),
    customer: new Map(db.customers.map((c) => [c.id, c.name])),
    supplier: new Map(db.suppliers.map((s) => [s.id, s.name])),
    account: new Map(db.accounts.map((a) => [a.id, a])),
    product: new Map(db.products.map((p) => [p.id, p.name])),
  }
}

/* --------------------------------------------------------------- reports */

const profitAndLoss: ReportDefinition = {
  key: 'profit-and-loss',
  title: 'Profit and loss',
  group: 'Financial statements',
  description: 'Revenue by income category less operating expenses by category for the period.',
  dateMode: 'range',
  build(db, { range, asOf }) {
    const n = names(db)
    const revenue = revenueLedger(db, range)
    const expenses = expenseLedger(db, range, asOf)
    const totalRevenue = sum(revenue, (r) => r.amount)
    const totalExpenses = sum(expenses, (e) => e.amount)
    const pct = (v: number) => percentOf(v, totalRevenue)
    const rows: ReportRow[] = [{ line: 'Revenue', _kind: 'section' }]
    for (const g of groupSum(revenue, (r) => r.categoryId)) rows.push({ line: n.master.get(g.key) ?? g.key, amount: g.amount, share: pct(g.amount) })
    rows.push({ line: 'Total revenue', amount: totalRevenue, share: pct(totalRevenue), _kind: 'subtotal' })
    rows.push({ line: 'Operating expenses', _kind: 'section' })
    for (const g of groupSum(expenses, (e) => e.categoryId)) rows.push({ line: n.master.get(g.key) ?? g.key, amount: g.amount, share: pct(g.amount) })
    rows.push({ line: 'Total operating expenses', amount: totalExpenses, share: pct(totalExpenses), _kind: 'subtotal' })
    const profit = subtract(totalRevenue, totalExpenses)
    const months = rangeMonths(range, asOf, db)
    return {
      columns: [
        { key: 'line', header: 'Line' },
        { key: 'amount', header: 'Amount (LKR)', format: 'currency' },
        { key: 'share', header: '% of revenue', format: 'percent' },
      ],
      rows,
      totals: { line: 'Net profit (before tax)', amount: profit, share: pct(profit), _kind: 'total' },
      summary: [
        { label: 'Revenue', value: totalRevenue, format: 'currency' },
        { label: 'Expenses', value: totalExpenses, format: 'currency' },
        { label: 'Net profit', value: profit, format: 'currency' },
        { label: 'Net margin', value: pct(profit), format: 'percent' },
      ],
      chart: { type: 'bar', x: 'month', xFormat: 'month', series: [{ key: 'revenue', label: 'Revenue' }, { key: 'expenses', label: 'Expenses' }], rows: monthlyIncomeExpense(revenue, expenses, months.slice(-24)) as unknown as Record<string, string | number>[] },
      notes: ['Revenue is invoiced revenue net of tax and credit notes (accrual basis). Personnel, licence and depreciation costs are accrued monthly.'],
    }
  },
}

const cashFlowSummary: ReportDefinition = {
  key: 'cash-flow-summary',
  title: 'Cash flow summary',
  group: 'Financial statements',
  description: 'Opening cash, money in and out by category, and closing cash for each month.',
  dateMode: 'range',
  build(db, { range, asOf }) {
    const months = rangeMonths(range, asOf, db)
    const opening0 = add(
      sum(
        db.bankAccounts.filter((a) => a.active),
        (a) => a.openingBalance,
      ),
      sum(
        db.payments.filter((p) => p.date < `${months[0] ?? '0000-00'}-01`),
        signedPayment,
      ),
    )
    let opening = opening0
    const flows = monthlyCashFlow(db.payments, months)
    const rows: ReportRow[] = flows.map((f) => {
      const closing = add(opening, f.net)
      const row: ReportRow = { month: f.month, opening, inflow: f.inflow, outflow: f.outflow, net: f.net, closing }
      opening = closing
      return row
    })
    const inPeriod = db.payments.filter((p) => months.includes(p.date.slice(0, 7)))
    const byCategory = groupSum(
      inPeriod.map((p) => ({ amount: p.direction === 'incoming' ? p.amount : -p.amount, category: p.category })),
      (p) => p.category,
    )
    return {
      columns: [
        { key: 'month', header: 'Month', format: 'month' },
        { key: 'opening', header: 'Opening', format: 'currency' },
        { key: 'inflow', header: 'Money in', format: 'currency' },
        { key: 'outflow', header: 'Money out', format: 'currency' },
        { key: 'net', header: 'Net flow', format: 'currency' },
        { key: 'closing', header: 'Closing', format: 'currency' },
      ],
      rows,
      totals: { month: 'Period', opening: opening0, inflow: sum(flows, (f) => f.inflow), outflow: sum(flows, (f) => f.outflow), net: sum(flows, (f) => f.net), closing: opening, _kind: 'total' },
      summary: byCategory.map((c) => ({ label: c.key.replace(/_/g, ' '), value: c.amount, format: 'currency' as const })),
      chart: { type: 'line', x: 'month', xFormat: 'month', series: [{ key: 'closing', label: 'Closing cash' }], rows: rows as Record<string, string | number>[] },
      notes: ['Based on simulated payments recorded in this browser. No real bank data is used.'],
    }
  },
}

const generalLedger: ReportDefinition = {
  key: 'general-ledger',
  title: 'General ledger (demonstration)',
  group: 'Financial statements',
  description: 'Illustrative journal lines by account for the period.',
  dateMode: 'range',
  build(db, { range }) {
    const n = names(db)
    const rows: ReportRow[] = []
    for (const je of db.journalEntries) {
      if (je.status !== 'posted') continue
      if ((range.from && je.date < range.from) || (range.to && je.date > range.to)) continue
      for (const l of je.lines) {
        const acc = n.account.get(l.accountId)
        rows.push({ date: je.date, journal: je.number, account: acc ? `${acc.code} ${acc.name}` : l.accountId, memo: l.description ?? je.memo, debit: l.debit || null, credit: l.credit || null })
      }
    }
    rows.sort((a, b) => String(a.account).localeCompare(String(b.account)) || String(a.date).localeCompare(String(b.date)))
    const debit = sum(rows, (r) => Number(r.debit ?? 0))
    const credit = sum(rows, (r) => Number(r.credit ?? 0))
    return {
      columns: [
        { key: 'account', header: 'Account' },
        { key: 'date', header: 'Date', format: 'date' },
        { key: 'journal', header: 'Journal' },
        { key: 'memo', header: 'Memo' },
        { key: 'debit', header: 'Debit', format: 'currency' },
        { key: 'credit', header: 'Credit', format: 'currency' },
      ],
      rows,
      totals: { account: 'Total', debit, credit, _kind: 'total' },
      check: { ok: round2(debit) === round2(credit), message: round2(debit) === round2(credit) ? 'Debits equal credits for the period.' : `Out of balance by ${round2(debit - credit)}.` },
      notes: ['Sample journals generated for recent invoices, payments and bills. Illustrative only — not a secure accounting ledger.'],
    }
  },
}

const trialBalance: ReportDefinition = {
  key: 'trial-balance',
  title: 'Trial balance (demonstration)',
  group: 'Financial statements',
  description: 'Debit and credit totals per account from posted demo journals.',
  dateMode: 'asOf',
  build(db, { asOf }) {
    const totals = new Map<string, { debit: number; credit: number }>()
    for (const je of db.journalEntries) {
      if (je.status !== 'posted' || je.date > asOf) continue
      for (const l of je.lines) {
        const t = totals.get(l.accountId) ?? { debit: 0, credit: 0 }
        totals.set(l.accountId, { debit: add(t.debit, l.debit), credit: add(t.credit, l.credit) })
      }
    }
    const rows: ReportRow[] = db.accounts
      .filter((a) => totals.has(a.id))
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((a) => {
        const t = totals.get(a.id)!
        const net = subtract(t.debit, t.credit)
        return { code: a.code, account: a.name, type: a.type, debit: net > 0 ? net : null, credit: net < 0 ? -net : null }
      })
    const debit = sum(rows, (r) => Number(r.debit ?? 0))
    const credit = sum(rows, (r) => Number(r.credit ?? 0))
    const ok = round2(debit) === round2(credit)
    return {
      columns: [
        { key: 'code', header: 'Code' },
        { key: 'account', header: 'Account' },
        { key: 'type', header: 'Type' },
        { key: 'debit', header: 'Debit', format: 'currency' },
        { key: 'credit', header: 'Credit', format: 'currency' },
      ],
      rows,
      totals: { code: '', account: 'Total', debit, credit, _kind: 'total' },
      check: { ok, message: ok ? 'Total debits equal total credits.' : `Debits and credits differ by ${round2(debit - credit)}.` },
      notes: ['Covers only the sample journals in the demo ledger, so balances are partial and illustrative.'],
    }
  },
}

function ageingReport(kind: 'ar' | 'ap'): ReportDefinition {
  return {
    key: kind === 'ar' ? 'ar-ageing' : 'ap-ageing',
    title: kind === 'ar' ? 'Receivables ageing' : 'Payables ageing',
    group: 'Receivables & payables',
    description: kind === 'ar' ? 'Outstanding customer balances by days past due.' : 'Outstanding supplier bill balances by days past due.',
    dateMode: 'asOf',
    build(db, { asOf }) {
      const n = names(db)
      const byParty = new Map<string, Record<AgeingBucket, number>>()
      const bump = (party: string, bucket: AgeingBucket, amount: number) => {
        const row = byParty.get(party) ?? { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 }
        row[bucket] = add(row[bucket], amount)
        byParty.set(party, row)
      }
      if (kind === 'ar') {
        for (const inv of db.invoices) {
          if (inv.status === 'draft' || inv.status === 'void') continue
          const bal = invoiceBalance(inv, db.payments, db.creditNotes)
          if (bal.outstanding > 0) bump(inv.customerId, ageingBucket(inv.dueDate, asOf), bal.outstanding)
        }
      } else {
        for (const b of db.supplierBills) {
          if (!isBillIncurred(b)) continue
          const bal = billBalance(b, db.payments)
          if (bal.outstanding > 0) bump(b.supplierId, ageingBucket(b.dueDate, asOf), bal.outstanding)
        }
      }
      const rows: ReportRow[] = [...byParty.entries()].map(([party, r]) => ({
        party: (kind === 'ar' ? n.customer.get(party) : n.supplier.get(party)) ?? party,
        ...r,
        total: add(...BUCKETS.map((b) => r[b])),
      }))
      rows.sort((a, b) => Number(b.total) - Number(a.total))
      const totals: ReportRow = { party: 'Total', _kind: 'total' }
      for (const b of [...BUCKETS, 'total']) totals[b] = sum(rows, (r) => Number(r[b] ?? 0))
      const overdue = subtract(Number(totals.total), Number(totals.current))
      return {
        columns: [{ key: 'party', header: kind === 'ar' ? 'Customer' : 'Supplier' }, ...BUCKETS.map((b) => ({ key: b, header: AGEING_LABELS[b], format: 'currency' as const })), { key: 'total', header: 'Total', format: 'currency' }],
        rows,
        totals,
        summary: [
          { label: 'Total outstanding', value: Number(totals.total), format: 'currency' },
          { label: 'Overdue', value: overdue, format: 'currency' },
          { label: 'Overdue share', value: percentOf(overdue, Number(totals.total)), format: 'percent' },
        ],
        chart: { type: 'bar', x: 'bucket', series: [{ key: 'amount', label: 'Outstanding' }], rows: BUCKETS.map((b) => ({ bucket: AGEING_LABELS[b], amount: Number(totals[b]) })) },
      }
    },
  }
}

const expensesByCategory: ReportDefinition = {
  key: 'expenses-by-category',
  title: 'Expenses by category',
  group: 'Cost analysis',
  description: 'All recognised operating expenses grouped by expense category.',
  dateMode: 'range',
  build(db, { range, asOf }) {
    const n = names(db)
    const items = expenseLedger(db, range, asOf)
    const total = sum(items, (i) => i.amount)
    const counts = new Map<string, number>()
    for (const i of items) counts.set(i.categoryId, (counts.get(i.categoryId) ?? 0) + 1)
    const rows: ReportRow[] = groupSum(items, (i) => i.categoryId).map((g) => ({ category: n.master.get(g.key) ?? g.key, entries: counts.get(g.key) ?? 0, amount: g.amount, share: percentOf(g.amount, total) }))
    return {
      columns: [
        { key: 'category', header: 'Category' },
        { key: 'entries', header: 'Entries', format: 'number' },
        { key: 'amount', header: 'Amount', format: 'currency' },
        { key: 'share', header: 'Share', format: 'percent' },
      ],
      rows,
      totals: { category: 'Total', entries: items.length, amount: total, share: 100, _kind: 'total' },
      chart: { type: 'pie', x: 'category', series: [{ key: 'amount', label: 'Amount' }], rows: rows.map((r) => ({ category: String(r.category), amount: Number(r.amount) })) },
    }
  },
}

const budgetVsActual: ReportDefinition = {
  key: 'budget-vs-actual',
  title: 'Budget vs actual',
  group: 'Budget & forecast',
  description: 'Approved and draft budgets against eligible actual expenditure or revenue.',
  dateMode: 'asOf',
  build(db, { asOf }) {
    const actuals = allBudgetActuals(db, asOf)
    const rows: ReportRow[] = db.budgets.map((b) => {
      const a = actuals.get(b.id)!
      return { budget: b.name, scope: b.scope, kind: b.kind, status: b.status, total: a.total, actual: a.actual, remaining: a.remaining, utilisation: a.utilisationPercent, elapsed: round2(a.elapsedPercent) }
    })
    return {
      columns: [
        { key: 'budget', header: 'Budget' },
        { key: 'scope', header: 'Scope' },
        { key: 'kind', header: 'Type' },
        { key: 'status', header: 'Status' },
        { key: 'total', header: 'Budget', format: 'currency' },
        { key: 'actual', header: 'Actual', format: 'currency' },
        { key: 'remaining', header: 'Remaining', format: 'currency' },
        { key: 'utilisation', header: 'Used', format: 'percent' },
        { key: 'elapsed', header: 'Period elapsed', format: 'percent' },
      ],
      rows,
      chart: { type: 'bar', x: 'budget', series: [{ key: 'total', label: 'Budget' }, { key: 'actual', label: 'Actual' }], rows: rows.map((r) => ({ budget: String(r.budget), total: Number(r.total), actual: Number(r.actual) })) },
      notes: ['Budget utilisation = eligible actual expenditure ÷ approved budget. Zero budgets show no utilisation.'],
    }
  },
}

const projectProfitability: ReportDefinition = {
  key: 'project-profitability',
  title: 'Project profitability',
  group: 'Project reports',
  description: 'Contract value, cost, forecast and estimated direct-cost margin per project.',
  dateMode: 'asOf',
  build(db, { asOf }) {
    const n = names(db)
    const rows: ReportRow[] = db.projects.map((p) => {
      const f = projectFinancials(p, db, asOf)
      return { project: `${p.code} ${p.name}`, customer: p.isInternal ? 'Internal' : (n.customer.get(p.customerId) ?? ''), status: p.status, contract: p.contractValue, invoiced: f.invoiced, recognised: f.recognisedRevenue, actual: f.actualCost, forecast: f.forecastCost, profit: p.isInternal ? null : f.estimatedProfit, margin: f.estimatedMarginPercent }
    })
    const ext = rows.filter((r) => r.customer !== 'Internal')
    return {
      columns: [
        { key: 'project', header: 'Project' },
        { key: 'customer', header: 'Customer' },
        { key: 'status', header: 'Status' },
        { key: 'contract', header: 'Contract value', format: 'currency' },
        { key: 'invoiced', header: 'Invoiced', format: 'currency' },
        { key: 'recognised', header: 'Recognised', format: 'currency' },
        { key: 'actual', header: 'Actual cost', format: 'currency' },
        { key: 'forecast', header: 'Forecast cost', format: 'currency' },
        { key: 'profit', header: 'Est. profit', format: 'currency' },
        { key: 'margin', header: 'Est. margin', format: 'percent' },
      ],
      rows,
      totals: { project: 'Total (client projects)', contract: sum(ext, (r) => Number(r.contract)), invoiced: sum(ext, (r) => Number(r.invoiced)), recognised: sum(ext, (r) => Number(r.recognised)), actual: sum(rows, (r) => Number(r.actual)), forecast: sum(rows, (r) => Number(r.forecast)), profit: sum(ext, (r) => Number(r.profit ?? 0)), _kind: 'total' },
      chart: { type: 'bar', x: 'project', series: [{ key: 'profit', label: 'Est. profit' }], rows: ext.map((r) => ({ project: String(r.project).split(' ')[0]!, profit: Number(r.profit ?? 0) })) },
      notes: ['Estimates are illustrative: forecast cost uses actual ÷ % complete once work has started. Margin is before allocated overhead.'],
    }
  },
}

const customerProfitability: ReportDefinition = {
  key: 'customer-profitability',
  title: 'Customer profitability',
  group: 'Customer & product',
  description: 'Revenue per customer for the period less direct project costs incurred for that customer.',
  dateMode: 'range',
  build(db, { range, asOf }) {
    const revenue = revenueLedger(db, range)
    const expenses = expenseLedger(db, range, asOf)
    const projectCustomer = new Map(db.projects.filter((p) => !p.isInternal).map((p) => [p.id, p.customerId]))
    const rate = new Map(db.employees.map((e) => [e.id, e.hourlyCostRate]))
    const inRange = (d: string) => (!range.from || d >= range.from) && (!range.to || d <= range.to)
    const rows: ReportRow[] = db.customers.map((c) => {
      const rev = sum(
        revenue.filter((r) => r.customerId === c.id),
        (r) => r.amount,
      )
      const labour = sum(
        db.timesheets.filter((t) => projectCustomer.get(t.projectId) === c.id && t.status !== 'draft' && t.status !== 'rejected' && inRange(t.date)),
        (t) => multiply(t.hours, rate.get(t.employeeId) ?? 0),
      )
      const direct = sum(
        expenses.filter((e) => e.projectId && projectCustomer.get(e.projectId) === c.id),
        (e) => e.amount,
      )
      const manual = sum(
        db.projectCosts.filter((pc) => !pc.committed && projectCustomer.get(pc.projectId) === c.id && inRange(pc.date)),
        (pc) => pc.amount,
      )
      const cost = add(labour, direct, manual)
      return { customer: c.name, revenue: rev, labour, other: add(direct, manual), cost, margin: subtract(rev, cost), marginPct: percentOf(subtract(rev, cost), rev) }
    })
    const active = rows.filter((r) => Number(r.revenue) !== 0 || Number(r.cost) !== 0).sort((a, b) => Number(b.revenue) - Number(a.revenue))
    return {
      columns: [
        { key: 'customer', header: 'Customer' },
        { key: 'revenue', header: 'Revenue', format: 'currency' },
        { key: 'labour', header: 'Labour cost', format: 'currency' },
        { key: 'other', header: 'Other direct cost', format: 'currency' },
        { key: 'margin', header: 'Contribution', format: 'currency' },
        { key: 'marginPct', header: 'Contribution %', format: 'percent' },
      ],
      rows: active,
      totals: { customer: 'Total', revenue: sum(active, (r) => Number(r.revenue)), labour: sum(active, (r) => Number(r.labour)), other: sum(active, (r) => Number(r.other)), margin: sum(active, (r) => Number(r.margin)), _kind: 'total' },
      chart: { type: 'bar', x: 'customer', series: [{ key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Direct cost' }], rows: active.slice(0, 10).map((r) => ({ customer: String(r.customer), revenue: Number(r.revenue), cost: Number(r.cost) })) },
      notes: ['Contribution excludes company overhead. SaaS revenue has no project costs attributed here — see product profitability.'],
    }
  },
}

const saasRecurring: ReportDefinition = {
  key: 'saas-recurring-revenue',
  title: 'SaaS recurring revenue',
  group: 'Customer & product',
  description: 'MRR by product and plan, with the monthly MRR trend.',
  dateMode: 'asOf',
  build(db, { asOf }) {
    const n = names(db)
    const live = db.subscriptions.filter((s) => isSubscriptionLive(s, asOf))
    const key = (s: (typeof live)[number]) => `${s.productId}|${s.planId}`
    const groups = new Map<string, typeof live>()
    for (const s of live) groups.set(key(s), [...(groups.get(key(s)) ?? []), s])
    const rows: ReportRow[] = [...groups.entries()].map(([k, subs]) => {
      const [productId, planId] = k.split('|')
      const plan = db.products.find((p) => p.id === productId)?.plans.find((p) => p.id === planId)
      const mrr = sum(subs, subscriptionMrr)
      return { product: n.product.get(productId!) ?? productId, plan: plan?.name ?? planId, subscriptions: subs.length, seats: subs.reduce((a, s) => a + s.seats, 0), mrr, arr: multiply(mrr, 12) }
    })
    rows.sort((a, b) => Number(b.mrr) - Number(a.mrr))
    const total = sum(rows, (r) => Number(r.mrr))
    return {
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'plan', header: 'Plan' },
        { key: 'subscriptions', header: 'Subscriptions', format: 'number' },
        { key: 'seats', header: 'Seats / outlets', format: 'number' },
        { key: 'mrr', header: 'MRR', format: 'currency' },
        { key: 'arr', header: 'ARR', format: 'currency' },
      ],
      rows,
      totals: { product: 'Total', subscriptions: live.length, seats: live.reduce((a, s) => a + s.seats, 0), mrr: total, arr: multiply(total, 12), _kind: 'total' },
      chart: { type: 'line', x: 'month', xFormat: 'month', series: [{ key: 'mrr', label: 'MRR' }], rows: mrrTrend(db.subscriptions, lastNMonths(12, parseISO(asOf))) },
    }
  },
}

const cloudCostAnalysis: ReportDefinition = {
  key: 'cloud-cost-analysis',
  title: 'Cloud cost analysis',
  group: 'Cost analysis',
  description: 'Cloud spend by provider, service, category and environment.',
  dateMode: 'range',
  build(db, { range }) {
    const n = names(db)
    const project = new Map(db.projects.map((p) => [p.id, p.code]))
    const items = db.cloudCosts.filter((c) => (!range.from || c.month >= range.from.slice(0, 7) + '-01') && (!range.to || c.month <= range.to))
    const map = new Map<string, ReportRow>()
    for (const c of items) {
      const k = `${c.provider}|${c.service}`
      const r = map.get(k) ?? { provider: c.provider, service: c.service, category: c.category, environment: c.environment, allocation: c.productId ? (n.product.get(c.productId) ?? '') : c.projectId ? (project.get(c.projectId) ?? '') : 'Shared', amount: 0 }
      r.amount = add(Number(r.amount), c.amount)
      map.set(k, r)
    }
    const rows = [...map.values()].sort((a, b) => Number(b.amount) - Number(a.amount))
    const total = sum(rows, (r) => Number(r.amount))
    for (const r of rows) r.share = percentOf(Number(r.amount), total)
    const byProvider = groupSum(items, (c) => c.provider)
    return {
      columns: [
        { key: 'provider', header: 'Provider' },
        { key: 'service', header: 'Service' },
        { key: 'category', header: 'Category' },
        { key: 'environment', header: 'Environment' },
        { key: 'allocation', header: 'Allocated to' },
        { key: 'amount', header: 'Amount', format: 'currency' },
        { key: 'share', header: 'Share', format: 'percent' },
      ],
      rows,
      totals: { provider: 'Total', amount: total, share: 100, _kind: 'total' },
      summary: byProvider.map((p) => ({ label: p.key, value: p.amount, format: 'currency' as const })),
      chart: { type: 'pie', x: 'provider', series: [{ key: 'amount', label: 'Amount' }], rows: byProvider.map((p) => ({ provider: p.key, amount: p.amount })) },
    }
  },
}

const softwareSpending: ReportDefinition = {
  key: 'software-spending',
  title: 'Software subscription spending',
  group: 'Cost analysis',
  description: 'Seat-based software tools: cost, utilisation and the cost of unused seats.',
  dateMode: 'asOf',
  build(db) {
    const n = names(db)
    const rows: ReportRow[] = db.licences
      .filter((l) => l.status !== 'cancelled')
      .map((l) => {
        const cycleCost = multiply(l.seats, l.costPerSeat)
        const monthly = l.billingCycle === 'annual' ? divide(cycleCost, 12) : cycleCost
        const unused = l.seats > 0 ? multiply(monthly, (l.seats - l.seatsUsed) / l.seats) : 0
        return { tool: l.name, vendor: n.supplier.get(l.vendorId) ?? '', department: n.master.get(l.departmentId) ?? '', cycle: l.billingCycle, seats: l.seats, used: l.seatsUsed, utilisation: percentOf(l.seatsUsed, l.seats), monthly, annual: multiply(monthly, 12), unused: round2(unused), renewal: l.renewalDate }
      })
      .sort((a, b) => Number(b.annual) - Number(a.annual))
    return {
      columns: [
        { key: 'tool', header: 'Tool' },
        { key: 'vendor', header: 'Vendor' },
        { key: 'department', header: 'Department' },
        { key: 'seats', header: 'Seats', format: 'number' },
        { key: 'utilisation', header: 'Utilisation', format: 'percent' },
        { key: 'monthly', header: 'Monthly cost', format: 'currency' },
        { key: 'annual', header: 'Annualised', format: 'currency' },
        { key: 'unused', header: 'Unused seats / month', format: 'currency' },
        { key: 'renewal', header: 'Next renewal', format: 'date' },
      ],
      rows,
      totals: { tool: 'Total', monthly: sum(rows, (r) => Number(r.monthly)), annual: sum(rows, (r) => Number(r.annual)), unused: sum(rows, (r) => Number(r.unused)), _kind: 'total' },
      chart: { type: 'bar', x: 'tool', series: [{ key: 'annual', label: 'Annualised cost' }], rows: rows.map((r) => ({ tool: String(r.tool), annual: Number(r.annual) })) },
    }
  },
}

const employeeCostAllocation: ReportDefinition = {
  key: 'employee-cost-allocation',
  title: 'Employee cost allocation',
  group: 'Cost analysis',
  description: 'Fictional personnel cost for the period and how much was allocated to projects through timesheets.',
  dateMode: 'range',
  permission: 'costs.sensitive',
  build(db, { range, asOf }) {
    const n = names(db)
    const personnel = expenseLedger(db, range, asOf).filter((e) => e.source === 'personnel')
    const inRange = (d: string) => (!range.from || d >= range.from) && (!range.to || d <= range.to)
    const rows: ReportRow[] = db.employees.map((e) => {
      const cost = sum(
        personnel.filter((p) => p.sourceId === e.id),
        (p) => p.amount,
      )
      const ts = db.timesheets.filter((t) => t.employeeId === e.id && t.status !== 'draft' && t.status !== 'rejected' && inRange(t.date))
      const hours = sum(ts, (t) => t.hours)
      const billable = sum(
        ts.filter((t) => t.billable),
        (t) => t.hours,
      )
      const allocated = Math.min(cost, multiply(hours, e.hourlyCostRate))
      return { person: e.name, role: n.master.get(e.roleId) ?? '', department: n.master.get(e.departmentId) ?? '', cost, hours, billable, allocated, unallocated: subtract(cost, allocated), allocatedPct: percentOf(allocated, cost) }
    })
    return {
      columns: [
        { key: 'person', header: 'Person' },
        { key: 'role', header: 'Role' },
        { key: 'department', header: 'Department' },
        { key: 'cost', header: 'Personnel cost', format: 'currency' },
        { key: 'hours', header: 'Hours logged', format: 'number' },
        { key: 'billable', header: 'Billable hours', format: 'number' },
        { key: 'allocated', header: 'Allocated to projects', format: 'currency' },
        { key: 'unallocated', header: 'Unallocated (overhead)', format: 'currency' },
        { key: 'allocatedPct', header: 'Allocated %', format: 'percent' },
      ],
      rows,
      totals: { person: 'Total', cost: sum(rows, (r) => Number(r.cost)), hours: sum(rows, (r) => Number(r.hours)), billable: sum(rows, (r) => Number(r.billable)), allocated: sum(rows, (r) => Number(r.allocated)), unallocated: sum(rows, (r) => Number(r.unallocated)), _kind: 'total' },
      chart: { type: 'stacked', x: 'department', series: [{ key: 'allocated', label: 'Allocated' }, { key: 'unallocated', label: 'Unallocated' }], rows: groupDept(rows) },
      notes: ['All employees and compensation figures are fictional. Visible only to roles with the simulated "view employee cost rates" permission.'],
    }
  },
}

function groupDept(rows: ReportRow[]) {
  const m = new Map<string, { department: string; allocated: number; unallocated: number }>()
  for (const r of rows) {
    const d = String(r.department)
    const x = m.get(d) ?? { department: d, allocated: 0, unallocated: 0 }
    x.allocated = add(x.allocated, Number(r.allocated))
    x.unallocated = add(x.unallocated, Number(r.unallocated))
    m.set(d, x)
  }
  return [...m.values()]
}

const assetSummary: ReportDefinition = {
  key: 'asset-summary',
  title: 'Asset summary',
  group: 'Assets',
  description: 'Fixed asset cost, accumulated depreciation and book value by asset.',
  dateMode: 'asOf',
  build(db, { asOf }) {
    const n = names(db)
    const month = `${asOf.slice(0, 7)}-01`
    const rows: ReportRow[] = db.assets.map((a) => {
      const bv = assetBookValue(a, asOf)
      return { tag: a.tag, asset: a.name, class: n.master.get(a.assetClassId) ?? '', status: a.status, purchased: a.purchaseDate, cost: a.cost, accumulated: bv.accumulated, book: bv.bookValue, monthly: monthlyDepreciation(a, month) }
    })
    const active = rows.filter((r) => r.status !== 'disposed')
    const byClass = groupSum(
      active.map((r) => ({ amount: Number(r.book), cls: String(r.class) })),
      (r) => r.cls,
    )
    return {
      columns: [
        { key: 'tag', header: 'Tag' },
        { key: 'asset', header: 'Asset' },
        { key: 'class', header: 'Class' },
        { key: 'status', header: 'Status' },
        { key: 'purchased', header: 'Purchased', format: 'date' },
        { key: 'cost', header: 'Cost', format: 'currency' },
        { key: 'accumulated', header: 'Accum. depreciation', format: 'currency' },
        { key: 'book', header: 'Book value', format: 'currency' },
        { key: 'monthly', header: 'This month', format: 'currency' },
      ],
      rows,
      totals: { tag: 'Total (excl. disposed)', cost: sum(active, (r) => Number(r.cost)), accumulated: sum(active, (r) => Number(r.accumulated)), book: sum(active, (r) => Number(r.book)), monthly: sum(active, (r) => Number(r.monthly)), _kind: 'total' },
      chart: { type: 'pie', x: 'class', series: [{ key: 'amount', label: 'Book value' }], rows: byClass.map((c) => ({ class: c.key, amount: c.amount })) },
      notes: ['Depreciation is illustrative (straight-line or double-declining) and starts the month after purchase.'],
    }
  },
}

const revenueProjection: ReportDefinition = {
  key: 'revenue-projection',
  title: 'Six-month projection',
  group: 'Budget & forecast',
  description: 'Simple run-rate projection: trailing three-month averages carried forward. Not a statistical forecast.',
  dateMode: 'asOf',
  build(db, { asOf }) {
    const revenue = revenueLedger(db)
    const expenses = expenseLedger(db, {}, asOf)
    const past = lastNMonths(4, parseISO(asOf)).slice(0, 3)
    const hist = monthlyIncomeExpense(revenue, expenses, past)
    const avgRev = divide(sum(hist, (h) => h.revenue), hist.length || 1)
    const avgExp = divide(sum(hist, (h) => h.expenses), hist.length || 1)
    const future = Array.from({ length: 6 }, (_, i) => format(addMonths(parseISO(asOf), i + 1), 'yyyy-MM'))
    const scenario = db.scenarios.find((s) => s.isDefault)
    const g = (scenario?.revenueGrowthPercent ?? 0) / 100
    const ge = (scenario?.expenseGrowthPercent ?? 0) / 100
    const rows: ReportRow[] = future.map((m, i) => {
      const r = round2(avgRev * Math.pow(1 + g, i + 1))
      const e = round2(avgExp * Math.pow(1 + ge, i + 1))
      return { month: m, revenue: r, expenses: e, profit: subtract(r, e) }
    })
    return {
      columns: [
        { key: 'month', header: 'Month', format: 'month' },
        { key: 'revenue', header: 'Projected revenue', format: 'currency' },
        { key: 'expenses', header: 'Projected expenses', format: 'currency' },
        { key: 'profit', header: 'Projected profit', format: 'currency' },
      ],
      rows,
      totals: { month: '6 months', revenue: sum(rows, (r) => Number(r.revenue)), expenses: sum(rows, (r) => Number(r.expenses)), profit: sum(rows, (r) => Number(r.profit)), _kind: 'total' },
      chart: { type: 'bar', x: 'month', xFormat: 'month', series: [{ key: 'revenue', label: 'Projected revenue' }, { key: 'expenses', label: 'Projected expenses' }], rows: rows as Record<string, string | number>[] },
      notes: [`Baseline = average of ${past.join(', ')}. Growth from the "${scenario?.name ?? 'Base'}" scenario (${scenario?.revenueGrowthPercent ?? 0}% revenue / ${scenario?.expenseGrowthPercent ?? 0}% expense per month). Illustrative only.`],
    }
  },
}

export const REPORTS: ReportDefinition[] = [
  profitAndLoss,
  cashFlowSummary,
  generalLedger,
  trialBalance,
  ageingReport('ar'),
  ageingReport('ap'),
  projectProfitability,
  customerProfitability,
  saasRecurring,
  expensesByCategory,
  cloudCostAnalysis,
  softwareSpending,
  employeeCostAllocation,
  budgetVsActual,
  revenueProjection,
  assetSummary,
]

export const REPORT_BY_KEY = new Map(REPORTS.map((r) => [r.key, r]))

export function runReport(key: string, db: DemoDatabase, range: DateRange, asOf: string = todayISO()): ReportResult | undefined {
  return REPORT_BY_KEY.get(key)?.build(db, { range, asOf })
}
