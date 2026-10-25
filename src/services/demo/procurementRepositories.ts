import type { BillStatus, Payment, PurchaseOrder, PurchaseOrderStatus, PurchaseRequest, SupplierBill } from '@/domain'
import { billBalance, deriveBillStatus } from '@/lib/calculations/bills'
import { documentTotals } from '@/lib/calculations/invoices'
import { round2 } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import { evaluateRules } from '@/lib/rules/engine'
import type { PurchaseOrderRepository, PurchaseRequestRepository, SupplierBillRepository } from '@/services/repositories/types'
import { validatePaymentAmount } from './billingRepositories'
import { getDb, newId, nextNumber, useDemoStore } from './demoStore'
import { DemoValidationError, auditEntry, createLocalRepository, getActor, nowStamp, replaceIn, withAudit, withNotification } from './localRepository'

export const supplierRepository = createLocalRepository('suppliers', {
  prefix: 'sup',
  entity: 'supplier',
  canDelete: (s, db) =>
    db.supplierBills.some((b) => b.supplierId === s.id) || db.purchaseOrders.some((p) => p.supplierId === s.id)
      ? 'This supplier has bills or purchase orders. Mark it inactive instead.'
      : null,
})

/* ------------------------------------------------------------------- bills */

const billBase = createLocalRepository('supplierBills', {
  prefix: 'bill',
  entity: 'supplier_bill',
  label: (b) => b.number,
  canDelete: (b) => (b.status === 'draft' ? null : 'Only draft bills can be deleted. Void the bill instead.'),
})

function findBill(id: string): SupplierBill {
  const b = getDb().supplierBills.find((x) => x.id === id)
  if (!b) throw new DemoValidationError('Supplier bill not found.')
  return b
}

function billTransition(b: SupplierBill, status: BillStatus, note?: string): SupplierBill {
  return { ...b, status, updatedAt: nowStamp(), history: [...b.history, { status, at: nowStamp(), by: getActor().name, note }] }
}

export const supplierBillRepository: SupplierBillRepository = {
  ...billBase,
  async create(input) {
    if (!(input.subtotal > 0)) throw new DemoValidationError('Subtotal must be greater than zero.')
    const db = getDb()
    return billBase.create({
      ...input,
      number: nextNumber(db.supplierBills.map((b) => b.number), 'BILL-', 4),
      status: 'draft',
      history: [{ status: 'draft', at: nowStamp(), by: getActor().name }],
    })
  },
  async submitForApproval(id) {
    const b = findBill(id)
    if (b.status !== 'draft') throw new DemoValidationError('Only draft bills can be submitted for approval.')
    const updated = billTransition(b, 'awaiting_approval')
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'supplierBills', updated), auditEntry('submit', 'supplier_bill', `Submitted ${b.number} for approval`, id)))
    return updated
  },
  async approve(id, note) {
    const b = findBill(id)
    if (b.status !== 'awaiting_approval' && b.status !== 'draft') throw new DemoValidationError('This bill is not awaiting approval.')
    const updated = billTransition(b, 'approved', note ?? 'Approved (simulated)')
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'supplierBills', updated), auditEntry('approve', 'supplier_bill', `Approved ${b.number}`, id)))
    return updated
  },
  async void(id, reason) {
    const b = findBill(id)
    if (getDb().payments.some((p) => p.billId === id)) throw new DemoValidationError('Payments exist for this bill. Delete them before voiding.')
    const updated = billTransition(b, 'void', reason)
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'supplierBills', updated), auditEntry('void', 'supplier_bill', `Voided ${b.number}: ${reason}`, id)))
    return updated
  },
  async recordPayment(id, input) {
    const b = findBill(id)
    if (b.status !== 'approved' && b.status !== 'partially_paid') throw new DemoValidationError('Only approved bills can be paid.')
    const db = getDb()
    const balance = billBalance(b, db.payments)
    const amount = round2(input.amount)
    validatePaymentAmount(amount, balance.outstanding)
    const stamp = nowStamp()
    const payment: Payment = {
      id: newId('pay'),
      number: nextNumber(db.payments.map((p) => p.number), 'PAY-', 5),
      direction: 'outgoing',
      category: 'supplier_payment',
      date: input.date,
      amount,
      currency: b.currency,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      bankAccountId: input.bankAccountId,
      supplierId: b.supplierId,
      billId: b.id,
      createdAt: stamp,
      updatedAt: stamp,
    }
    const status = deriveBillStatus(b, billBalance(b, [...db.payments, payment]))
    const updated = billTransition(b, status, `Simulated payment ${payment.number} of ${formatCurrency(amount)} — no money moved`)
    useDemoStore.getState().mutate((d) =>
      withAudit({ ...replaceIn(d, 'supplierBills', updated), payments: [...d.payments, payment] }, auditEntry('record_payment', 'supplier_bill', `Recorded simulated payment of ${formatCurrency(amount)} on ${b.number}`, id)),
    )
    return payment
  },
}

/* --------------------------------------------------------- purchase requests */

const PR_TRANSITIONS: Record<PurchaseRequest['status'], PurchaseRequest['status'][]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['converted'],
  rejected: ['draft'],
  converted: [],
}

const prBase = createLocalRepository('purchaseRequests', {
  prefix: 'pr',
  entity: 'purchase_request',
  label: (p) => p.number,
  canDelete: (p) => (p.status === 'draft' || p.status === 'rejected' ? null : 'Only draft or rejected requests can be deleted.'),
})

export const purchaseRequestRepository: PurchaseRequestRepository = {
  ...prBase,
  async create(input) {
    if (!(input.estimatedAmount > 0)) throw new DemoValidationError('Estimated amount must be greater than zero.')
    const db = getDb()
    return prBase.create({
      ...input,
      number: nextNumber(db.purchaseRequests.map((p) => p.number), 'PR-', 4),
      status: input.status ?? 'draft',
      history: [{ status: input.status ?? 'draft', at: nowStamp(), by: getActor().name }],
    })
  },
  async transition(id, status, note) {
    const pr = getDb().purchaseRequests.find((p) => p.id === id)
    if (!pr) throw new DemoValidationError('Purchase request not found.')
    if (!PR_TRANSITIONS[pr.status].includes(status)) throw new DemoValidationError(`Cannot move a ${pr.status} request to ${status}.`)
    if (status === 'rejected' && !note?.trim()) throw new DemoValidationError('A reason is required when rejecting.')
    const updated: PurchaseRequest = { ...pr, status, updatedAt: nowStamp(), history: [...pr.history, { status, at: nowStamp(), by: getActor().name, note }] }
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'purchaseRequests', updated), auditEntry(status, 'purchase_request', `${pr.number} → ${status}`, id)))
    return updated
  },
  async convertToOrder(id) {
    const pr = getDb().purchaseRequests.find((p) => p.id === id)
    if (!pr) throw new DemoValidationError('Purchase request not found.')
    if (pr.status !== 'approved') throw new DemoValidationError('Only approved requests can be converted to a purchase order.')
    if (!pr.supplierId) throw new DemoValidationError('Choose a supplier on the request before converting it.')
    const po = await purchaseOrderRepository.create({
      number: '',
      supplierId: pr.supplierId,
      requestId: pr.id,
      projectId: pr.projectId,
      departmentId: pr.departmentId,
      orderDate: nowStamp().slice(0, 10),
      expectedDate: pr.neededBy,
      currency: 'LKR',
      lines: [{ id: newId('poln'), description: pr.title, quantity: 1, unitPrice: pr.estimatedAmount, discountPercent: 0, taxRatePercent: 18 }],
      status: 'draft',
      history: [],
    })
    await purchaseRequestRepository.transition(id, 'converted', `Converted to ${po.number}`)
    return po
  },
}

/* ----------------------------------------------------------- purchase orders */

const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'draft', 'cancelled'],
  approved: ['sent', 'cancelled'],
  sent: ['received', 'cancelled'],
  received: ['closed'],
  closed: [],
  cancelled: [],
}

export function poAllowedTransitions(status: PurchaseOrderStatus): PurchaseOrderStatus[] {
  return PO_TRANSITIONS[status]
}

const poBase = createLocalRepository('purchaseOrders', {
  prefix: 'po',
  entity: 'purchase_order',
  label: (p) => p.number,
  canDelete: (p) => (p.status === 'draft' ? null : 'Only draft purchase orders can be deleted. Cancel it instead.'),
})

export const purchaseOrderRepository: PurchaseOrderRepository = {
  ...poBase,
  async create(input) {
    if (!input.lines.length) throw new DemoValidationError('Add at least one line.')
    const db = getDb()
    return poBase.create({
      ...input,
      number: input.number?.trim() || nextNumber(db.purchaseOrders.map((p) => p.number), 'PO-', 4),
      status: input.status ?? 'draft',
      history: [{ status: input.status ?? 'draft', at: nowStamp(), by: getActor().name }],
    })
  },
  async transition(id, status, note) {
    const po = getDb().purchaseOrders.find((p) => p.id === id)
    if (!po) throw new DemoValidationError('Purchase order not found.')
    if (!PO_TRANSITIONS[po.status].includes(status)) throw new DemoValidationError(`Cannot move a ${po.status.replace('_', ' ')} order to ${status.replace('_', ' ')}.`)
    const updated: PurchaseOrder = { ...po, status, updatedAt: nowStamp(), history: [...po.history, { status, at: nowStamp(), by: getActor().name, note: status === 'sent' ? (note ?? 'Marked as sent (simulated — nothing was emailed)') : note }] }
    useDemoStore.getState().mutate((d) => {
      let next = withAudit(replaceIn(d, 'purchaseOrders', updated), auditEntry(status, 'purchase_order', `${po.number} → ${status.replace('_', ' ')}`, id))
      if (status === 'pending_approval') {
        const amount = documentTotals(po.lines, 0).total
        for (const ev of evaluateRules(d.rules, 'purchase_order', { amount, projectId: po.projectId ?? '', departmentId: po.departmentId, status }).filter((r) => r.triggered)) {
          for (const a of ev.rule.actions) next = withNotification(next, { title: ev.rule.name, body: `${po.number}: ${a.message}`, kind: 'approval', link: '/procurement/purchase-orders' })
        }
      }
      return next
    })
    return updated
  },
}
