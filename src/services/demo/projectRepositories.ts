import type { Budget, BudgetStatus, Project } from '@/domain'
import type { BudgetRepository, ProjectRepository } from '@/services/repositories/types'
import { getDb, newId, useDemoStore } from './demoStore'
import { DemoValidationError, auditEntry, createLocalRepository, getActor, nowStamp, replaceIn, withAudit } from './localRepository'

const projectBase = createLocalRepository('projects', {
  prefix: 'prj',
  entity: 'project',
  label: (p) => `${p.code} ${p.name}`,
  canDelete: (p, db) =>
    db.invoices.some((i) => i.projectId === p.id) || db.timesheets.some((t) => t.projectId === p.id) || db.projectCosts.some((c) => c.projectId === p.id)
      ? 'This project has invoices, timesheets or costs. Cancel or complete it instead of deleting.'
      : null,
})

export const projectRepository: ProjectRepository = {
  ...projectBase,
  async create(input) {
    const db = getDb()
    if (db.projects.some((p) => p.code.toLowerCase() === input.code.toLowerCase())) throw new DemoValidationError(`Project code ${input.code} is already used.`)
    if (input.endDate < input.startDate) throw new DemoValidationError('End date must be on or after the start date.')
    return projectBase.create(input)
  },
  async update(id, patch) {
    if (patch.startDate && patch.endDate && patch.endDate < patch.startDate) throw new DemoValidationError('End date must be on or after the start date.')
    if (patch.code && getDb().projects.some((p) => p.id !== id && p.code.toLowerCase() === patch.code!.toLowerCase())) {
      throw new DemoValidationError(`Project code ${patch.code} is already used.`)
    }
    return projectBase.update(id, patch)
  },
  async setStatus(id, status: Project['status']) {
    const p = getDb().projects.find((x) => x.id === id)
    if (!p) throw new DemoValidationError('Project not found.')
    const updated: Project = { ...p, status, percentComplete: status === 'completed' ? 100 : p.percentComplete, updatedAt: nowStamp() }
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'projects', updated), auditEntry('status', 'project', `${p.code} status → ${status.replace('_', ' ')}`, id)))
    return updated
  },
}

export const projectCostRepository = createLocalRepository('projectCosts', { prefix: 'pc', entity: 'project_cost', label: (c) => c.description })
export const milestoneRepository = createLocalRepository('milestones', {
  prefix: 'ms',
  entity: 'milestone',
  canDelete: (m) => (m.status === 'invoiced' ? 'Invoiced milestones cannot be deleted.' : null),
})
export const employeeRepository = createLocalRepository('employees', {
  prefix: 'emp',
  entity: 'employee_profile',
  canDelete: (e, db) => (db.timesheets.some((t) => t.employeeId === e.id) ? 'This person has timesheets. Mark the profile inactive instead.' : null),
})
export const allocationRepository = createLocalRepository('allocations', { prefix: 'alloc', entity: 'allocation', label: (a) => a.roleOnProject })
export const timesheetRepository = createLocalRepository('timesheets', {
  prefix: 'ts',
  entity: 'timesheet',
  label: (t) => `${t.hours}h on ${t.date}`,
  canDelete: (t) => (t.status === 'approved' ? 'Approved timesheets cannot be deleted.' : null),
})

/* ------------------------------------------------------------------ budgets */

const BUDGET_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'revision'],
  approved: ['revision'],
  revision: ['submitted', 'draft'],
}

export function budgetAllowedTransitions(status: BudgetStatus): BudgetStatus[] {
  return BUDGET_TRANSITIONS[status]
}

const budgetBase = createLocalRepository('budgets', {
  prefix: 'bud',
  entity: 'budget',
  canDelete: (b) => (b.status === 'approved' ? 'Approved budgets cannot be deleted. Request a revision instead.' : null),
})

export const budgetRepository: BudgetRepository = {
  ...budgetBase,
  async create(input) {
    if (input.periodEnd < input.periodStart) throw new DemoValidationError('Period end must be after period start.')
    if (input.lines.some((l) => !(l.amount >= 0))) throw new DemoValidationError('Budget line amounts cannot be negative.')
    return budgetBase.create(input)
  },
  async setStatus(id, status, note) {
    const b = getDb().budgets.find((x) => x.id === id)
    if (!b) throw new DemoValidationError('Budget not found.')
    if (!BUDGET_TRANSITIONS[b.status].includes(status)) throw new DemoValidationError(`Cannot move a ${b.status} budget to ${status}.`)
    const updated: Budget = { ...b, status, notes: note ? `${note}` : b.notes, updatedAt: nowStamp() }
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'budgets', updated), auditEntry(status, 'budget', `${b.name} → ${status} by ${getActor().name}`, id)))
    return updated
  },
  async duplicate(id, fiscalYear) {
    const b = getDb().budgets.find((x) => x.id === id)
    if (!b) throw new DemoValidationError('Budget not found.')
    const shift = (d: string) => `${fiscalYear}${d.slice(4)}`
    return budgetBase.create({
      ...b,
      name: b.name.replace(String(b.fiscalYear), String(fiscalYear)).concat(b.name.includes(String(b.fiscalYear)) ? '' : ` (FY${fiscalYear})`),
      fiscalYear,
      periodStart: shift(b.periodStart),
      periodEnd: shift(b.periodEnd),
      status: 'draft',
      lines: b.lines.map((l) => ({ ...l, id: newId('bl') })),
    })
  },
}

export const scenarioRepository = createLocalRepository('scenarios', { prefix: 'scn', entity: 'forecast_scenario' })
