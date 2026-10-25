import type { CreditNote, Invoice, Payment } from '@/domain'
import { derivePaymentStatus, invoiceBalance, invoiceTotals } from '@/lib/calculations/invoices'
import { compare, round2 } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import type { InvoiceRepository, RecordPaymentInput, Repository } from '@/services/repositories/types'
import { getDb, newId, nextNumber, useDemoStore } from './demoStore'
import { DemoValidationError, auditEntry, createLocalRepository, getActor, nowStamp, replaceIn, withAudit } from './localRepository'

const base = createLocalRepository('invoices', {
  prefix: 'inv',
  entity: 'invoice',
  label: (i) => i.number,
  canDelete: (i) => (i.status === 'draft' ? null : 'Only draft invoices can be deleted. Void an issued invoice instead.'),
})

function findInvoice(id: string): Invoice {
  const inv = getDb().invoices.find((i) => i.id === id)
  if (!inv) throw new DemoValidationError('Invoice not found.')
  return inv
}

export function validatePaymentAmount(amount: number, outstanding: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new DemoValidationError('Enter a payment amount greater than zero.')
  if (compare(amount, outstanding) > 0) {
    throw new DemoValidationError(`Amount exceeds the outstanding balance of ${formatCurrency(outstanding)}. Overpayments and customer advances are not supported in this demo.`)
  }
}

export const invoiceRepository: InvoiceRepository = {
  ...base,
  async create(input) {
    const db = getDb()
    const year = (input.issueDate || new Date().toISOString()).slice(0, 4)
    const number = input.number?.trim() || nextNumber(db.invoices.map((i) => i.number), `INV-${year}-`)
    if (db.invoices.some((i) => i.number === number)) throw new DemoValidationError(`Invoice number ${number} already exists.`)
    const actor = getActor()
    return base.create({ ...input, number, status: 'draft', history: [{ status: 'draft', at: nowStamp(), by: actor.name }] })
  },
  async update(id, patch) {
    const inv = findInvoice(id)
    if (inv.status !== 'draft' && (patch.lines || patch.customerId || patch.discountPercent !== undefined)) {
      throw new DemoValidationError('Issued invoices cannot be changed. Raise a credit note or void the invoice instead.')
    }
    return base.update(id, patch)
  },
  async issue(id) {
    const inv = findInvoice(id)
    if (inv.status !== 'draft') throw new DemoValidationError('Only draft invoices can be issued.')
    if (!inv.lines.length || invoiceTotals(inv).total <= 0) throw new DemoValidationError('Add at least one line with a positive amount before issuing.')
    const actor = getActor()
    const updated: Invoice = { ...inv, status: 'issued', updatedAt: nowStamp(), history: [...inv.history, { status: 'issued', at: nowStamp(), by: actor.name, note: 'Marked as issued (simulated — no email was sent)' }] }
    useDemoStore.getState().mutate((db) => withAudit(replaceIn(db, 'invoices', updated), auditEntry('issue', 'invoice', `Issued ${inv.number} (simulated)`, id)))
    return updated
  },
  async void(id, reason) {
    const inv = findInvoice(id)
    const db = getDb()
    if (inv.status === 'void') return inv
    if (db.payments.some((p) => p.invoiceId === id)) throw new DemoValidationError('This invoice has payments recorded. Delete the payments or raise a credit note instead.')
    const actor = getActor()
    const updated: Invoice = { ...inv, status: 'void', updatedAt: nowStamp(), history: [...inv.history, { status: 'void', at: nowStamp(), by: actor.name, note: reason }] }
    useDemoStore.getState().mutate((d) => withAudit(replaceIn(d, 'invoices', updated), auditEntry('void', 'invoice', `Voided ${inv.number}: ${reason}`, id)))
    return updated
  },
  async duplicate(id) {
    const inv = findInvoice(id)
    const today = new Date().toISOString().slice(0, 10)
    return invoiceRepository.create({
      ...inv,
      number: '',
      issueDate: today,
      dueDate: today,
      lines: inv.lines.map((l) => ({ ...l, id: newId('ln') })),
      status: 'draft',
      history: [],
    })
  },
  async recordPayment(id, input: RecordPaymentInput) {
    const inv = findInvoice(id)
    if (inv.status !== 'issued' && inv.status !== 'partially_paid') throw new DemoValidationError('Payments can only be recorded against issued invoices.')
    const db = getDb()
    const balance = invoiceBalance(inv, db.payments, db.creditNotes)
    const amount = round2(input.amount)
    validatePaymentAmount(amount, balance.outstanding)
    const stamp = nowStamp()
    const payment: Payment = {
      id: newId('pay'),
      number: nextNumber(db.payments.map((p) => p.number), 'PAY-', 5),
      direction: 'incoming',
      category: 'customer_receipt',
      date: input.date,
      amount,
      currency: inv.currency,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      bankAccountId: input.bankAccountId,
      customerId: inv.customerId,
      invoiceId: inv.id,
      createdAt: stamp,
      updatedAt: stamp,
    }
    const nextBalance = invoiceBalance(inv, [...db.payments, payment], db.creditNotes)
    const status = derivePaymentStatus(inv, nextBalance)
    const actor = getActor()
    const updated: Invoice = { ...inv, status, updatedAt: stamp, history: [...inv.history, { status, at: stamp, by: actor.name, note: `Simulated payment ${payment.number} of ${formatCurrency(amount)} recorded` }] }
    useDemoStore.getState().mutate((d) =>
      withAudit({ ...replaceIn(d, 'invoices', updated), payments: [...d.payments, payment] }, auditEntry('record_payment', 'invoice', `Recorded simulated payment of ${formatCurrency(amount)} on ${inv.number}`, id)),
    )
    return payment
  },
  async createCreditNote(id, input) {
    const inv = findInvoice(id)
    if (inv.status === 'draft' || inv.status === 'void') throw new DemoValidationError('Credit notes can only be raised against issued invoices.')
    const db = getDb()
    const balance = invoiceBalance(inv, db.payments, db.creditNotes)
    const amount = round2(input.amount)
    if (amount <= 0) throw new DemoValidationError('Enter a credit amount greater than zero.')
    if (compare(amount, balance.outstanding) > 0) throw new DemoValidationError(`Credit cannot exceed the outstanding balance of ${formatCurrency(balance.outstanding)} in this demo (refunds are not simulated).`)
    if (!input.reason.trim()) throw new DemoValidationError('Give a reason for the credit note.')
    const stamp = nowStamp()
    const credit: CreditNote = {
      id: newId('cn'),
      number: nextNumber(db.creditNotes.map((c) => c.number), `CN-${input.date.slice(0, 4)}-`, 3),
      customerId: inv.customerId,
      invoiceId: inv.id,
      date: input.date,
      reason: input.reason,
      amount,
      status: 'applied',
      createdAt: stamp,
      updatedAt: stamp,
    }
    const nextBalance = invoiceBalance(inv, db.payments, [...db.creditNotes, credit])
    const status = derivePaymentStatus(inv, nextBalance)
    const actor = getActor()
    const updated: Invoice = { ...inv, status, updatedAt: stamp, history: [...inv.history, { status, at: stamp, by: actor.name, note: `Credit note ${credit.number} applied (${formatCurrency(amount)})` }] }
    useDemoStore.getState().mutate((d) =>
      withAudit({ ...replaceIn(d, 'invoices', updated), creditNotes: [credit, ...d.creditNotes] }, auditEntry('create', 'credit_note', `Raised ${credit.number} against ${inv.number}`, credit.id)),
    )
    return credit
  },
}

const paymentBase = createLocalRepository('payments', { prefix: 'pay', entity: 'payment', label: (p) => p.number })

/** Deleting a payment re-derives the linked invoice / bill status. */
export const paymentRepository: Repository<Payment> = {
  ...paymentBase,
  async remove(id) {
    const db = getDb()
    const payment = db.payments.find((p) => p.id === id)
    if (!payment) return
    const remaining = db.payments.filter((p) => p.id !== id)
    useDemoStore.getState().mutate((d) => {
      let next: typeof d = { ...d, payments: remaining }
      if (payment.invoiceId) {
        const inv = d.invoices.find((i) => i.id === payment.invoiceId)
        if (inv) {
          const status = derivePaymentStatus(inv, invoiceBalance(inv, remaining, d.creditNotes))
          next = replaceIn(next, 'invoices', { ...inv, status, updatedAt: nowStamp(), history: [...inv.history, { status, at: nowStamp(), by: getActor().name, note: `Payment ${payment.number} deleted` }] })
        }
      }
      if (payment.billId) {
        const bill = d.supplierBills.find((b) => b.id === payment.billId)
        if (bill) {
          const paidLeft = remaining.filter((p) => p.billId === bill.id).reduce((s, p) => s + p.amount, 0)
          const status = paidLeft > 0 ? 'partially_paid' : 'approved'
          next = replaceIn(next, 'supplierBills', { ...bill, status, updatedAt: nowStamp(), history: [...bill.history, { status, at: nowStamp(), by: getActor().name, note: `Payment ${payment.number} deleted` }] })
        }
      }
      return withAudit(next, auditEntry('delete', 'payment', `Deleted simulated payment ${payment.number}`, id))
    })
  },
}

export const customerRepository = createLocalRepository('customers', {
  prefix: 'cus',
  entity: 'customer',
  canDelete: (c, db) =>
    db.invoices.some((i) => i.customerId === c.id) || db.projects.some((p) => p.customerId === c.id)
      ? 'This customer has invoices or projects. Mark the customer inactive instead of deleting it.'
      : null,
})

export const contractRepository = createLocalRepository('contracts', {
  prefix: 'con',
  entity: 'contract',
  label: (c) => c.number,
  canDelete: (c, db) => (db.invoices.some((i) => i.contractId === c.id) ? 'Invoices reference this contract. Terminate it instead.' : null),
})
export const quotationRepository = createLocalRepository('quotations', { prefix: 'quo', entity: 'quotation', label: (q) => q.number })
export const creditNoteRepository = createLocalRepository('creditNotes', { prefix: 'cn', entity: 'credit_note', label: (c) => c.number })
export const recurringScheduleRepository = createLocalRepository('recurringSchedules', { prefix: 'rec', entity: 'recurring_schedule' })
export const revenueScheduleRepository = createLocalRepository('revenueSchedules', { prefix: 'rs', entity: 'revenue_schedule' })
