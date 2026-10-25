import type { CostType, DemoDatabase, Project } from '@/domain'
import { isBillIncurred } from '@/lib/calculations/bills'
import { multiply, round2 } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'

/** One incurred or committed cost attributed to a project, from any source. */
export interface ProjectCostLine {
  id: string
  date: string
  source: 'Manual entry' | 'Timesheets' | 'Expense claim' | 'Supplier bill' | 'Cloud' | 'AI usage'
  type: CostType
  description: string
  amount: number
  billable: boolean
  committed: boolean
  /** Set for manual entries, which can be edited here. */
  entryId?: string
}

export type ProjectCostDb = Pick<DemoDatabase, 'projectCosts' | 'timesheets' | 'employees' | 'expenses' | 'supplierBills' | 'cloudCosts' | 'aiUsage'>

/**
 * Itemised version of the sources used by `projectFinancials` so the cost
 * breakdown table reconciles to the project's actual + committed cost.
 * Timesheet labour is grouped per month to keep the list readable.
 */
export function projectCostLines(project: Project, db: ProjectCostDb, asOf: string = todayISO()): ProjectCostLine[] {
  const out: ProjectCostLine[] = []
  const rate = new Map(db.employees.map((e) => [e.id, e.hourlyCostRate]))
  const labour = new Map<string, { billable: number; nonBillable: number; hours: number }>()
  for (const t of db.timesheets) {
    if (t.projectId !== project.id || t.status === 'rejected' || t.status === 'draft') continue
    const month = t.date.slice(0, 7)
    const cost = multiply(t.hours, rate.get(t.employeeId) ?? 0)
    const bucket = labour.get(month) ?? { billable: 0, nonBillable: 0, hours: 0 }
    if (t.billable) bucket.billable = round2(bucket.billable + cost)
    else bucket.nonBillable = round2(bucket.nonBillable + cost)
    bucket.hours += t.hours
    labour.set(month, bucket)
  }
  for (const [month, b] of labour) {
    if (b.billable) out.push({ id: `lab:${month}:b`, date: `${month}-01`, source: 'Timesheets', type: 'labour', description: `Labour — ${month} (billable hours)`, amount: b.billable, billable: true, committed: false })
    if (b.nonBillable) out.push({ id: `lab:${month}:n`, date: `${month}-01`, source: 'Timesheets', type: 'labour', description: `Labour — ${month} (non-billable hours)`, amount: b.nonBillable, billable: false, committed: false })
  }
  for (const c of db.projectCosts) {
    if (c.projectId !== project.id) continue
    out.push({ id: c.id, date: c.date, source: 'Manual entry', type: c.type, description: c.description, amount: c.amount, billable: c.billable, committed: c.committed, entryId: c.id })
  }
  for (const x of db.expenses) {
    if (x.projectId !== project.id || (x.status !== 'approved' && x.status !== 'reimbursed')) continue
    out.push({ id: x.id, date: x.date, source: 'Expense claim', type: x.categoryId === 'exp-travel' ? 'travel' : 'other', description: `${x.number} — ${x.description}`, amount: x.amount, billable: x.billable, committed: false })
  }
  for (const b of db.supplierBills) {
    if (b.projectId !== project.id || !isBillIncurred(b)) continue
    const type: CostType = b.categoryId === 'exp-contractors' || b.categoryId === 'exp-professional' ? 'subcontractor' : b.categoryId === 'exp-software' ? 'software' : 'other'
    out.push({ id: b.id, date: b.billDate, source: 'Supplier bill', type, description: `${b.number} — ${b.description}`, amount: b.subtotal, billable: false, committed: false })
  }
  for (const c of db.cloudCosts) {
    if (c.projectId !== project.id || c.month > asOf) continue
    out.push({ id: c.id, date: c.month, source: 'Cloud', type: 'infrastructure', description: `${c.provider} — ${c.service}`, amount: c.amount, billable: true, committed: false })
  }
  for (const a of db.aiUsage) {
    if (a.projectId !== project.id || a.month > asOf) continue
    out.push({ id: a.id, date: a.month, source: 'AI usage', type: 'infrastructure', description: `${a.provider} ${a.model} — ${a.useCase}`, amount: a.amount, billable: true, committed: false })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Cumulative incurred cost by month (for budget burn charts). */
export function cumulativeCostByMonth(lines: ProjectCostLine[]): { month: string; cost: number; cumulative: number }[] {
  const byMonth = new Map<string, number>()
  for (const l of lines) {
    if (l.committed) continue
    const m = l.date.slice(0, 7)
    byMonth.set(m, round2((byMonth.get(m) ?? 0) + l.amount))
  }
  let running = 0
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cost]) => {
      running = round2(running + cost)
      return { month, cost, cumulative: running }
    })
}
