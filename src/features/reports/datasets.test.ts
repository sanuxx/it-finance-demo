import { buildSeed } from '@/data/seed'
import { invoiceTotals } from '@/lib/calculations/invoices'
import { sum } from '@/lib/calculations/money'
import { DATASETS, aggregate, matchesFilter, runCustomReport } from './datasets'
import { REPORTS } from './registry'

const db = buildSeed(new Date(2026, 9, 24))

describe('report builder datasets', () => {
  it('every dataset produces rows containing all declared fields', () => {
    for (const ds of DATASETS) {
      const rows = ds.rows(db)
      expect(rows.length).toBeGreaterThan(0)
      for (const f of ds.fields) expect(rows[0]).toHaveProperty(f.key)
      expect(ds.fields.some((f) => f.key === ds.dateField)).toBe(true)
    }
  })

  it('aggregates safely', () => {
    expect(aggregate([], 'sum')).toBe(0)
    expect(aggregate([0.1, 0.2], 'sum')).toBe(0.3)
    expect(aggregate([1, 2, 4], 'avg')).toBe(2.33)
    expect(aggregate([5, 2, 9], 'count')).toBe(3)
    expect(aggregate([5, 2, 9], 'min')).toBe(2)
  })

  it('filters by operator and type', () => {
    expect(matchesFilter({ amount: 100 }, { id: 'a', field: 'amount', operator: 'gte', value: '50' }, 'currency')).toBe(true)
    expect(matchesFilter({ amount: 10 }, { id: 'a', field: 'amount', operator: 'gte', value: '50' }, 'currency')).toBe(false)
    expect(matchesFilter({ name: 'Orchid Retail' }, { id: 'a', field: 'name', operator: 'contains', value: 'orchid' }, 'text')).toBe(true)
    expect(matchesFilter({ name: 'x' }, { id: 'a', field: 'name', operator: 'eq', value: '' }, 'text')).toBe(true)
  })

  it('grouped totals reconcile with the underlying invoices', () => {
    const result = runCustomReport(db, { dataset: 'invoices', columns: [], groupBy: 'customer', metric: { field: 'netAmount', fn: 'sum' }, filters: [], presentation: 'bar' })
    const expected = sum(db.invoices, (i) => invoiceTotals(i).netAmount)
    expect(result.totals?.value).toBe(expected)
    expect(sum(result.rows, (r) => Number(r.value))).toBe(expected)
    expect(result.chart?.rows.length).toBe(result.rows.length)
  })

  it('applies date range and filters to flat reports', () => {
    const result = runCustomReport(db, {
      dataset: 'expenses',
      columns: ['number', 'status', 'amount'],
      filters: [{ id: 'f', field: 'status', operator: 'eq', value: 'rejected' }],
      dateRange: { from: '2026-01-01' },
      presentation: 'table',
    })
    expect(result.rows.every((r) => r.status === 'rejected')).toBe(true)
    expect(result.columns.map((c) => c.key)).toEqual(['number', 'status', 'amount'])
    expect(result.totals?.amount).toBe(sum(result.rows, (r) => Number(r.amount)))
  })
})

describe('report registry', () => {
  it('builds every report without errors', () => {
    for (const r of REPORTS) {
      const res = r.build(db, { range: { from: '2026-01-01', to: '2026-10-31' }, asOf: '2026-10-24' })
      expect(res.columns.length).toBeGreaterThan(0)
    }
  })

  it('trial balance and general ledger balance', () => {
    const tb = REPORTS.find((r) => r.key === 'trial-balance')!.build(db, { range: {}, asOf: '2026-10-24' })
    expect(tb.check?.ok).toBe(true)
    const gl = REPORTS.find((r) => r.key === 'general-ledger')!.build(db, { range: {}, asOf: '2026-10-24' })
    expect(gl.check?.ok).toBe(true)
  })
})
