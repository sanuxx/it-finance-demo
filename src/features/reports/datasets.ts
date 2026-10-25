import type { AggregateFn, DemoDatabase, ReportDatasetKey, ReportFilter, SavedReport } from '@/domain'
import { billBalance } from '@/lib/calculations/bills'
import { invoiceBalance, invoiceDisplayStatus, invoiceTotals } from '@/lib/calculations/invoices'
import { add, divide, round2 } from '@/lib/calculations/money'
import { projectFinancials } from '@/lib/calculations/projects'
import { subscriptionMrr } from '@/lib/calculations/saas'
import { todayISO } from '@/lib/dates'
import type { CellFormat, ReportResult, ReportRow } from './registry'

/**
 * Controlled datasets for the custom report builder. Users can only pick from
 * these whitelisted fields — there is no free-form query language or SQL.
 */
export type FieldType = 'text' | 'currency' | 'number' | 'date' | 'percent'

export interface DatasetField {
  key: string
  label: string
  type: FieldType
}

export interface DatasetDefinition {
  key: ReportDatasetKey
  label: string
  description: string
  /** Field used by the date-range filter. */
  dateField: string
  fields: DatasetField[]
  rows: (db: DemoDatabase) => Record<string, string | number | null>[]
}

function lookups(db: DemoDatabase) {
  return {
    customer: new Map(db.customers.map((c) => [c.id, c.name])),
    supplier: new Map(db.suppliers.map((s) => [s.id, s.name])),
    project: new Map(db.projects.map((p) => [p.id, `${p.code} ${p.name}`])),
    employee: new Map(db.employees.map((e) => [e.id, e.name])),
    master: new Map(db.masterData.map((m) => [m.id, m.name])),
    product: new Map(db.products.map((p) => [p.id, p.name])),
  }
}

export const DATASETS: DatasetDefinition[] = [
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Customer invoices with totals and balances.',
    dateField: 'issueDate',
    fields: [
      { key: 'number', label: 'Invoice number', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'project', label: 'Project', type: 'text' },
      { key: 'issueDate', label: 'Issue date', type: 'date' },
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'month', label: 'Issue month', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'netAmount', label: 'Net amount', type: 'currency' },
      { key: 'tax', label: 'Tax', type: 'currency' },
      { key: 'total', label: 'Total', type: 'currency' },
      { key: 'paid', label: 'Paid', type: 'currency' },
      { key: 'outstanding', label: 'Outstanding', type: 'currency' },
    ],
    rows: (db) => {
      const l = lookups(db)
      const today = todayISO()
      return db.invoices.map((i) => {
        const t = invoiceTotals(i)
        const b = invoiceBalance(i, db.payments, db.creditNotes)
        return {
          number: i.number,
          customer: l.customer.get(i.customerId) ?? '',
          project: i.projectId ? (l.project.get(i.projectId) ?? '') : '',
          issueDate: i.issueDate,
          dueDate: i.dueDate,
          month: i.issueDate.slice(0, 7),
          status: invoiceDisplayStatus(i, b, today),
          netAmount: t.netAmount,
          tax: t.taxTotal,
          total: t.total,
          paid: b.paid,
          outstanding: b.outstanding,
        }
      })
    },
  },
  {
    key: 'expenses',
    label: 'Expense claims',
    description: 'Employee expense claims and their approval status.',
    dateField: 'date',
    fields: [
      { key: 'number', label: 'Claim number', type: 'text' },
      { key: 'employee', label: 'Employee', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'project', label: 'Project', type: 'text' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'billable', label: 'Billable', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.expenses.map((e) => ({
        number: e.number,
        employee: l.employee.get(e.employeeId) ?? '',
        date: e.date,
        month: e.date.slice(0, 7),
        category: l.master.get(e.categoryId) ?? '',
        department: l.master.get(e.departmentId) ?? '',
        project: e.projectId ? (l.project.get(e.projectId) ?? '') : '',
        description: e.description,
        billable: e.billable ? 'Yes' : 'No',
        status: e.status,
        amount: e.amount,
      }))
    },
  },
  {
    key: 'payments',
    label: 'Payments (simulated)',
    description: 'Simulated receipts and payments.',
    dateField: 'date',
    fields: [
      { key: 'number', label: 'Payment number', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'direction', label: 'Direction', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'party', label: 'Customer / supplier', type: 'text' },
      { key: 'method', label: 'Method', type: 'text' },
      { key: 'reference', label: 'Reference', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.payments.map((p) => ({
        number: p.number,
        date: p.date,
        month: p.date.slice(0, 7),
        direction: p.direction,
        category: p.category,
        party: p.customerId ? (l.customer.get(p.customerId) ?? '') : p.supplierId ? (l.supplier.get(p.supplierId) ?? '') : '',
        method: p.method,
        reference: p.reference ?? '',
        amount: p.amount,
      }))
    },
  },
  {
    key: 'projects',
    label: 'Projects',
    description: 'Project financial profiles (illustrative estimates).',
    dateField: 'startDate',
    fields: [
      { key: 'code', label: 'Code', type: 'text' },
      { key: 'name', label: 'Project', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'billingModel', label: 'Billing model', type: 'text' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'contractValue', label: 'Contract value', type: 'currency' },
      { key: 'budget', label: 'Budget', type: 'currency' },
      { key: 'actualCost', label: 'Actual cost', type: 'currency' },
      { key: 'forecastCost', label: 'Forecast cost', type: 'currency' },
      { key: 'invoiced', label: 'Invoiced', type: 'currency' },
      { key: 'estimatedProfit', label: 'Estimated profit', type: 'currency' },
      { key: 'margin', label: 'Estimated margin %', type: 'percent' },
      { key: 'percentComplete', label: '% complete', type: 'number' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.projects.map((p) => {
        const f = projectFinancials(p, db)
        return {
          code: p.code,
          name: p.name,
          customer: p.isInternal ? 'Internal' : (l.customer.get(p.customerId) ?? ''),
          status: p.status,
          billingModel: p.billingModel,
          startDate: p.startDate,
          contractValue: p.contractValue,
          budget: p.budget,
          actualCost: f.actualCost,
          forecastCost: f.forecastCost,
          invoiced: f.invoiced,
          estimatedProfit: f.estimatedProfit,
          margin: f.estimatedMarginPercent,
          percentComplete: p.percentComplete,
        }
      })
    },
  },
  {
    key: 'cloudCosts',
    label: 'Cloud costs',
    description: 'Monthly cloud provider spend.',
    dateField: 'month',
    fields: [
      { key: 'month', label: 'Month', type: 'date' },
      { key: 'provider', label: 'Provider', type: 'text' },
      { key: 'service', label: 'Service', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'environment', label: 'Environment', type: 'text' },
      { key: 'allocation', label: 'Allocated to', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.cloudCosts.map((c) => ({
        month: c.month,
        provider: c.provider,
        service: c.service,
        category: c.category,
        environment: c.environment,
        allocation: c.productId ? (l.product.get(c.productId) ?? '') : c.projectId ? (l.project.get(c.projectId) ?? '') : 'Shared',
        amount: c.amount,
      }))
    },
  },
  {
    key: 'subscriptions',
    label: 'Customer subscriptions',
    description: 'SaaS subscriptions with normalised MRR.',
    dateField: 'startDate',
    fields: [
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'product', label: 'Product', type: 'text' },
      { key: 'plan', label: 'Plan', type: 'text' },
      { key: 'cycle', label: 'Billing cycle', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'renewalDate', label: 'Renewal date', type: 'date' },
      { key: 'seats', label: 'Seats', type: 'number' },
      { key: 'mrr', label: 'MRR', type: 'currency' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.subscriptions.map((s) => ({
        customer: l.customer.get(s.customerId) ?? '',
        product: l.product.get(s.productId) ?? '',
        plan: db.products.find((p) => p.id === s.productId)?.plans.find((p) => p.id === s.planId)?.name ?? '',
        cycle: s.billingCycle,
        status: s.status,
        startDate: s.startDate,
        renewalDate: s.renewalDate,
        seats: s.seats,
        mrr: s.status === 'cancelled' || s.status === 'trial' ? 0 : subscriptionMrr(s),
      }))
    },
  },
  {
    key: 'supplierBills',
    label: 'Supplier bills',
    description: 'Supplier bills with balances.',
    dateField: 'billDate',
    fields: [
      { key: 'number', label: 'Bill number', type: 'text' },
      { key: 'supplier', label: 'Supplier', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'billDate', label: 'Bill date', type: 'date' },
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'month', label: 'Bill month', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'subtotal', label: 'Subtotal', type: 'currency' },
      { key: 'total', label: 'Total', type: 'currency' },
      { key: 'outstanding', label: 'Outstanding', type: 'currency' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.supplierBills.map((b) => {
        const bal = billBalance(b, db.payments)
        return {
          number: b.number,
          supplier: l.supplier.get(b.supplierId) ?? '',
          category: l.master.get(b.categoryId) ?? '',
          department: l.master.get(b.departmentId) ?? '',
          billDate: b.billDate,
          dueDate: b.dueDate,
          month: b.billDate.slice(0, 7),
          status: b.status,
          subtotal: b.subtotal,
          total: add(b.subtotal, b.taxAmount),
          outstanding: bal.outstanding,
        }
      })
    },
  },
  {
    key: 'timesheets',
    label: 'Timesheets',
    description: 'Logged hours by person and project.',
    dateField: 'date',
    fields: [
      { key: 'date', label: 'Week starting', type: 'date' },
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'employee', label: 'Person', type: 'text' },
      { key: 'project', label: 'Project', type: 'text' },
      { key: 'billable', label: 'Billable', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'hours', label: 'Hours', type: 'number' },
    ],
    rows: (db) => {
      const l = lookups(db)
      return db.timesheets.map((t) => ({
        date: t.date,
        month: t.date.slice(0, 7),
        employee: l.employee.get(t.employeeId) ?? '',
        project: l.project.get(t.projectId) ?? '',
        billable: t.billable ? 'Yes' : 'No',
        status: t.status,
        hours: t.hours,
      }))
    },
  },
]

export const DATASET_BY_KEY = new Map(DATASETS.map((d) => [d.key, d]))

export const NUMERIC_TYPES: FieldType[] = ['currency', 'number', 'percent']

export const OPERATORS_BY_TYPE: Record<FieldType, { value: ReportFilter['operator']; label: string }[]> = {
  text: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
  ],
  date: [
    { value: 'gte', label: 'on or after' },
    { value: 'lte', label: 'on or before' },
    { value: 'eq', label: 'equals' },
  ],
  currency: [
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
  ],
  number: [
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'eq', label: '=' },
    { value: 'neq', label: '≠' },
  ],
  percent: [
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
  ],
}

export const AGGREGATE_LABELS: Record<AggregateFn, string> = { sum: 'Sum', count: 'Count', avg: 'Average', min: 'Minimum', max: 'Maximum' }

type Row = Record<string, string | number | null>

export function matchesFilter(row: Row, filter: ReportFilter, type: FieldType): boolean {
  const actual = row[filter.field]
  const expected = filter.value
  if (expected === '' || expected === undefined) return true
  if (NUMERIC_TYPES.includes(type)) {
    const a = Number(actual ?? 0)
    const b = Number(expected)
    if (!Number.isFinite(b)) return true
    return filter.operator === 'gte' ? a >= b : filter.operator === 'lte' ? a <= b : filter.operator === 'eq' ? a === b : filter.operator === 'neq' ? a !== b : true
  }
  const a = String(actual ?? '').toLowerCase()
  const b = expected.toLowerCase()
  switch (filter.operator) {
    case 'eq':
      return a === b
    case 'neq':
      return a !== b
    case 'contains':
      return a.includes(b)
    case 'gte':
      return a >= b
    case 'lte':
      return a <= b
  }
}

export function aggregate(values: number[], fn: AggregateFn): number {
  if (fn === 'count') return values.length
  if (!values.length) return 0
  if (fn === 'sum') return add(...values)
  if (fn === 'avg') return divide(add(...values), values.length)
  if (fn === 'min') return round2(Math.min(...values))
  return round2(Math.max(...values))
}

const toFormat = (t: FieldType): CellFormat => (t === 'text' ? 'text' : t === 'date' ? 'date' : t)

export type ReportSpec = Pick<SavedReport, 'dataset' | 'columns' | 'groupBy' | 'metric' | 'filters' | 'dateRange' | 'presentation'>

/** Run a report definition against the controlled dataset. Pure and deterministic. */
export function runCustomReport(db: DemoDatabase, spec: ReportSpec, limit = 1000): ReportResult & { rowCount: number } {
  const ds = DATASET_BY_KEY.get(spec.dataset)
  if (!ds) return { columns: [], rows: [], rowCount: 0, notes: ['Unknown dataset.'] }
  const fieldMap = new Map(ds.fields.map((f) => [f.key, f]))
  let rows = ds.rows(db)
  const from = spec.dateRange?.from
  const to = spec.dateRange?.to
  if (from || to) {
    rows = rows.filter((r) => {
      const d = String(r[ds.dateField] ?? '').slice(0, 10)
      return (!from || d >= from) && (!to || d <= to)
    })
  }
  for (const f of spec.filters) {
    const field = fieldMap.get(f.field)
    if (field) rows = rows.filter((r) => matchesFilter(r, f, field.type))
  }
  const rowCount = rows.length

  if (spec.groupBy && spec.metric && fieldMap.has(spec.groupBy)) {
    const metricField = fieldMap.get(spec.metric.field)
    const groupField = fieldMap.get(spec.groupBy)!
    const groups = new Map<string, number[]>()
    for (const r of rows) {
      const k = String(r[spec.groupBy] ?? '—') || '—'
      const list = groups.get(k) ?? []
      list.push(Number(r[spec.metric.field] ?? 0))
      groups.set(k, list)
    }
    const metricLabel = `${AGGREGATE_LABELS[spec.metric.fn]} of ${spec.metric.fn === 'count' ? 'records' : (metricField?.label ?? spec.metric.field)}`
    const metricFormat: CellFormat = spec.metric.fn === 'count' ? 'number' : metricField ? toFormat(metricField.type) : 'number'
    const out: ReportRow[] = [...groups.entries()].map(([k, vals]) => ({ group: k, value: aggregate(vals, spec.metric!.fn), records: vals.length }))
    const sortByLabel = groupField.type === 'date' || spec.groupBy === 'month'
    out.sort((a, b) => (sortByLabel ? String(a.group).localeCompare(String(b.group)) : Number(b.value) - Number(a.value)))
    const allValues = rows.map((r) => Number(r[spec.metric!.field] ?? 0))
    return {
      columns: [
        { key: 'group', header: groupField.label, format: groupField.type === 'date' ? 'date' : 'text' },
        { key: 'value', header: metricLabel, format: metricFormat },
        { key: 'records', header: 'Records', format: 'number' },
      ],
      rows: out,
      totals: { group: 'Total', value: aggregate(allValues, spec.metric.fn), records: rowCount, _kind: 'total' },
      chart:
        spec.presentation === 'table'
          ? undefined
          : { type: spec.presentation === 'line' ? 'line' : spec.presentation === 'pie' ? 'pie' : 'bar', x: 'group', series: [{ key: 'value', label: metricLabel }], rows: out.map((r) => ({ group: String(r.group), value: Number(r.value) })) },
      rowCount,
    }
  }

  const cols = (spec.columns.length ? spec.columns : ds.fields.slice(0, 5).map((f) => f.key)).filter((c) => fieldMap.has(c))
  const columns = cols.map((c) => ({ key: c, header: fieldMap.get(c)!.label, format: toFormat(fieldMap.get(c)!.type) }))
  const totals: ReportRow = { _kind: 'total' }
  let hasTotals = false
  columns.forEach((c, i) => {
    if (c.format === 'currency' || (c.format === 'number' && fieldMap.get(c.key)!.type === 'number')) {
      totals[c.key] = add(...rows.map((r) => Number(r[c.key] ?? 0)), 0)
      hasTotals = true
    } else if (i === 0) totals[c.key] = 'Total'
  })
  return { columns, rows: rows.slice(0, limit) as ReportRow[], totals: hasTotals ? totals : undefined, rowCount, notes: rowCount > limit ? [`Preview limited to ${limit.toLocaleString()} rows; export includes them all.`] : undefined }
}

/** All matching rows (for export) with the selected columns only. */
export function exportRows(db: DemoDatabase, spec: ReportSpec) {
  const result = runCustomReport(db, spec, Number.POSITIVE_INFINITY)
  return result.rows.map((r) => Object.fromEntries(result.columns.map((c) => [c.header, r[c.key] ?? null])))
}

