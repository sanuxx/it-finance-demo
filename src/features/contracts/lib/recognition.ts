import type { Contract, DemoDatabase } from '@/domain'
import { documentTotals } from '@/lib/calculations/invoices'
import { divide, max0, multiply, subtract, sum } from '@/lib/calculations/money'
import { projectFinancials, type ProjectDb } from '@/lib/calculations/projects'
import { daysBetween } from '@/lib/dates'

export interface ContractRecognition {
  contract: Contract
  /** Net invoiced to date (excl. tax, less credit notes). */
  invoiced: number
  /** Illustrative recognised revenue to date. */
  recognised: number
  method: string
  /** recognised − invoiced: positive = unbilled WIP, negative = deferred revenue. */
  difference: number
  percentComplete: number
}

type Db = ProjectDb & Pick<DemoDatabase, 'projects' | 'contracts' | 'revenueSchedules'>

/** Net invoiced for a contract: issued/part-paid/paid invoices net of tax, less credit notes (net). */
export function contractInvoiced(contractId: string, db: Pick<DemoDatabase, 'invoices' | 'creditNotes'>): number {
  const invs = db.invoices.filter((i) => i.contractId === contractId && i.status !== 'draft' && i.status !== 'void')
  const net = sum(invs, (i) => documentTotals(i.lines, i.discountPercent).netAmount)
  const credits = sum(
    db.creditNotes.filter((c) => c.status !== 'draft' && invs.some((i) => i.id === c.invoiceId)),
    (c) => {
      const inv = invs.find((i) => i.id === c.invoiceId)!
      const t = documentTotals(inv.lines, inv.discountPercent)
      return t.total > 0 ? multiply(c.amount, divide(t.netAmount, t.total, 6)) : c.amount
    },
  )
  return subtract(net, credits)
}

/**
 * Illustrative revenue recognition per contract.
 * - Project-linked fixed price / milestone: % complete × contract value (from projectFinancials).
 * - Project-linked T&M: recognised = invoiced.
 * - Retainer / subscription without project: straight-line over the contract term.
 */
export function contractRecognition(db: Db, asOf: string): ContractRecognition[] {
  return db.contracts
    .filter((c) => c.status !== 'draft')
    .map((contract) => {
      const invoiced = contractInvoiced(contract.id, db)
      const project = contract.projectId ? db.projects.find((p) => p.id === contract.projectId) : undefined
      let recognised = invoiced
      let method = 'As invoiced'
      let percentComplete = 0
      if (project && (project.billingModel === 'fixed_price' || project.billingModel === 'milestone')) {
        recognised = projectFinancials(project, db, asOf).recognisedRevenue
        method = '% complete'
        percentComplete = project.percentComplete
      } else if (project && project.billingModel === 'time_and_materials') {
        method = 'As invoiced (T&M)'
        percentComplete = project.percentComplete
      } else {
        const total = daysBetween(contract.startDate, contract.endDate)
        const elapsed = Math.min(Math.max(daysBetween(contract.startDate, asOf), 0), total)
        const share = total > 0 ? elapsed / total : 1
        recognised = multiply(contract.value, share)
        method = 'Straight line'
        percentComplete = Math.round(share * 100)
      }
      if (contract.status === 'completed' && project?.billingModel !== 'time_and_materials') recognised = Math.max(recognised, invoiced)
      return { contract, invoiced, recognised, method, difference: subtract(recognised, invoiced), percentComplete }
    })
}

export const wipOf = (r: ContractRecognition) => max0(r.difference)
export const deferredOf = (r: ContractRecognition) => max0(-r.difference)
