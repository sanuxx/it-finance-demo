import { buildSeed } from '@/data/seed'
import { projectFinancials } from '@/lib/calculations/projects'
import { add, sum } from '@/lib/calculations/money'
import { cumulativeCostByMonth, projectCostLines } from './projectCosts'

describe('project cost lines', () => {
  const asOf = '2026-10-24'
  const db = buildSeed(new Date(2026, 9, 24))

  it('reconcile to projectFinancials actual and committed cost for every project', () => {
    for (const p of db.projects) {
      const fin = projectFinancials(p, db, asOf)
      const lines = projectCostLines(p, db, asOf)
      const actual = sum(lines.filter((l) => !l.committed), (l) => l.amount)
      const committed = sum(lines.filter((l) => l.committed), (l) => l.amount)
      // Labour is grouped per month, so allow rounding differences of a few cents per month.
      expect(Math.abs(actual - fin.actualCost)).toBeLessThan(1)
      expect(committed).toBeCloseTo(fin.committedCost, 2)
    }
  })

  it('builds a monotonically increasing cumulative burn series', () => {
    const p = db.projects.find((x) => x.id === 'prj-101')!
    const series = cumulativeCostByMonth(projectCostLines(p, db, asOf))
    expect(series.length).toBeGreaterThan(3)
    for (let i = 1; i < series.length; i++) expect(series[i]!.cumulative).toBeGreaterThanOrEqual(series[i - 1]!.cumulative)
    expect(series.at(-1)!.cumulative).toBeCloseTo(add(...series.map((s) => s.cost)), 2)
  })

  it('handles projects with zero budget safely', () => {
    const p = { ...db.projects[0]!, id: 'prj-empty', budget: 0 }
    const fin = projectFinancials(p, db, asOf)
    expect(fin.actualCost).toBe(0)
    expect(fin.budgetConsumptionPercent).toBeNull()
  })
})
