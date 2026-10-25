import { buildSeed } from '@/data/seed'
import { expenseLedger, revenueLedger } from '@/lib/calculations/ledgers'
import { sum } from '@/lib/calculations/money'
import { computeDashboardMetrics } from './metrics'
import { collectApprovals } from './approvals'

const db = buildSeed(new Date(2026, 9, 24))
const asOf = '2026-10-24'

describe('dashboard metrics', () => {
  it('derives period totals from the shared ledgers', () => {
    const range = { from: '2026-01-01', to: '2026-10-31' }
    const m = computeDashboardMetrics(db, range, asOf)
    expect(m.current.revenue).toBe(sum(revenueLedger(db, range), (r) => r.amount))
    expect(m.current.expenses).toBe(sum(expenseLedger(db, range, asOf), (r) => r.amount))
    expect(m.current.profit).toBeCloseTo(m.current.revenue - m.current.expenses, 2)
    // Year to date would compare against a period before the seeded history, so no comparison is offered.
    expect(m.hasComparison).toBe(false)
  })

  it('offers a comparison only when the previous period lies inside the seeded history', () => {
    const recent = computeDashboardMetrics(db, { from: '2026-05-01', to: '2026-10-31' }, asOf)
    expect(recent.hasComparison).toBe(true)
    const wide = computeDashboardMetrics(db, { from: '2025-11-01', to: '2026-10-31' }, asOf)
    expect(wide.hasComparison).toBe(false)
  })

  it('reports receivables, overdue and approvals consistently', () => {
    const m = computeDashboardMetrics(db, {}, asOf)
    expect(m.receivables.outstanding).toBeGreaterThan(0)
    expect(m.overdue.amount).toBeLessThanOrEqual(m.receivables.outstanding)
    expect(m.hasComparison).toBe(false)
    expect(m.approvals.length).toBe(collectApprovals(db).length)
    expect(m.approvals.every((a) => a.link.startsWith('/'))).toBe(true)
    expect(m.monthly).toHaveLength(24)
  })
})
