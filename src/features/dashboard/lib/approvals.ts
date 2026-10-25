import type { DemoDatabase } from '@/domain'
import { documentTotals } from '@/lib/calculations/invoices'
import { add, sum } from '@/lib/calculations/money'
import { budgetTotal } from '@/lib/calculations/budgets'
import type { Permission } from '@/lib/permissions'

export type ApprovalKind = 'expense' | 'purchase_order' | 'supplier_bill' | 'purchase_request' | 'budget'

export interface ApprovalItem {
  id: string
  kind: ApprovalKind
  number: string
  title: string
  requester: string
  amount: number
  date: string
  link: string
  /** Permission required to act on it (simulated). */
  permission: Permission
  flagged?: boolean
}

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  expense: 'Expense claim',
  purchase_order: 'Purchase order',
  supplier_bill: 'Supplier bill',
  purchase_request: 'Purchase request',
  budget: 'Budget',
}

/** Everything currently waiting for a decision, newest first. */
export function collectApprovals(db: Pick<DemoDatabase, 'expenses' | 'purchaseOrders' | 'supplierBills' | 'purchaseRequests' | 'budgets' | 'employees' | 'suppliers' | 'users'>): ApprovalItem[] {
  const emp = new Map(db.employees.map((e) => [e.id, e.name]))
  const sup = new Map(db.suppliers.map((s) => [s.id, s.name]))
  const user = new Map(db.users.map((u) => [u.id, u.name]))
  const out: ApprovalItem[] = []
  for (const e of db.expenses) {
    if (e.status !== 'submitted') continue
    out.push({ id: e.id, kind: 'expense', number: e.number, title: e.description, requester: emp.get(e.employeeId) ?? '—', amount: e.amount, date: e.date, link: `/finance/expenses/${e.id}`, permission: 'expenses.approve', flagged: e.flaggedForReview })
  }
  for (const p of db.purchaseOrders) {
    if (p.status !== 'pending_approval') continue
    out.push({ id: p.id, kind: 'purchase_order', number: p.number, title: `${sup.get(p.supplierId) ?? 'Supplier'} — ${p.lines[0]?.description ?? 'order'}`, requester: p.history[0]?.by ?? '—', amount: documentTotals(p.lines, 0).total, date: p.orderDate, link: '/procurement/purchase-orders', permission: 'procurement.approve' })
  }
  for (const b of db.supplierBills) {
    if (b.status !== 'awaiting_approval') continue
    out.push({ id: b.id, kind: 'supplier_bill', number: b.number, title: `${sup.get(b.supplierId) ?? 'Supplier'} — ${b.description}`, requester: b.history[0]?.by ?? '—', amount: add(b.subtotal, b.taxAmount), date: b.billDate, link: '/procurement/bills', permission: 'procurement.approve' })
  }
  for (const r of db.purchaseRequests) {
    if (r.status !== 'submitted') continue
    out.push({ id: r.id, kind: 'purchase_request', number: r.number, title: r.title, requester: emp.get(r.requesterId) ?? '—', amount: r.estimatedAmount, date: r.createdAt.slice(0, 10), link: '/procurement/requests', permission: 'procurement.approve' })
  }
  for (const b of db.budgets) {
    if (b.status !== 'submitted') continue
    out.push({ id: b.id, kind: 'budget', number: `FY${b.fiscalYear}`, title: b.name, requester: user.get(b.ownerId) ?? '—', amount: budgetTotal(b), date: b.updatedAt.slice(0, 10), link: `/planning/budgets/${b.id}`, permission: 'budgets.approve' })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

export function approvalsTotal(items: ApprovalItem[]) {
  return sum(items, (i) => i.amount)
}
