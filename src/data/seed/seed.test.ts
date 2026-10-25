import { describe, expect, it } from 'vitest'
import { buildSeed } from './buildSeed'
import { invoiceBalance, invoiceTotals } from '@/lib/calculations/invoices'
import { billBalance } from '@/lib/calculations/bills'
import { bankBalance } from '@/lib/calculations/cash'
import { expenseLedger, revenueLedger } from '@/lib/calculations/ledgers'
import { add, sum } from '@/lib/calculations/money'

const ANCHOR = new Date(2026, 9, 24)
const db = buildSeed(ANCHOR)
const asOf = '2026-10-24'

describe('seed dataset integrity', () => {
  it('is deterministic for a given anchor date', () => {
    const again = buildSeed(ANCHOR)
    expect({ ...again, meta: null }).toEqual({ ...db, meta: null })
  })

  it('references existing customers, projects and suppliers', () => {
    const customers = new Set(db.customers.map((c) => c.id))
    const projects = new Set(db.projects.map((p) => p.id))
    const suppliers = new Set(db.suppliers.map((s) => s.id))
    for (const i of db.invoices) {
      expect(customers.has(i.customerId)).toBe(true)
      if (i.projectId) expect(projects.has(i.projectId)).toBe(true)
    }
    for (const p of db.projects) expect(customers.has(p.customerId)).toBe(true)
    for (const c of db.projectCosts) expect(projects.has(c.projectId)).toBe(true)
    for (const b of db.supplierBills) expect(suppliers.has(b.supplierId)).toBe(true)
    for (const s of db.subscriptions) expect(customers.has(s.customerId)).toBe(true)
  })

  it('never allocates more payment than an invoice or bill total', () => {
    for (const inv of db.invoices) {
      const b = invoiceBalance(inv, db.payments, db.creditNotes)
      expect(add(b.paid, b.credited)).toBeLessThanOrEqual(b.total + 0.001)
    }
    for (const bill of db.supplierBills) {
      const b = billBalance(bill, db.payments)
      expect(b.paid).toBeLessThanOrEqual(b.total + 0.001)
    }
  })

  it('has stored invoice statuses that agree with balances', () => {
    for (const inv of db.invoices) {
      const b = invoiceBalance(inv, db.payments, db.creditNotes)
      if (inv.status === 'paid') expect(b.outstanding).toBe(0)
      if (inv.status === 'issued') expect(b.paid).toBe(0)
    }
  })

  it('contains records in a mix of statuses', () => {
    const statuses = new Set(db.invoices.map((i) => i.status))
    for (const s of ['draft', 'issued', 'partially_paid', 'paid']) expect(statuses.has(s as never)).toBe(true)
    const expenseStatuses = new Set(db.expenses.map((e) => e.status))
    for (const s of ['submitted', 'approved', 'rejected', 'reimbursed']) expect(expenseStatuses.has(s as never)).toBe(true)
  })

  it('keeps simulated bank balances non-negative', () => {
    for (const a of db.bankAccounts) expect(bankBalance(a, db.payments, asOf)).toBeGreaterThanOrEqual(0)
  })

  it('produces a plausible, profitable trailing year', () => {
    const range = { from: '2025-11-01', to: asOf }
    const revenue = sum(revenueLedger(db, range), (r) => r.amount)
    const expenses = sum(expenseLedger(db, range, asOf), (e) => e.amount)
    expect(revenue).toBeGreaterThan(expenses)
    expect(invoiceTotals(db.invoices[0]!).total).toBeGreaterThan(0)
  })

  it('stays small enough for localStorage', () => {
    expect(JSON.stringify(db).length).toBeLessThan(2_000_000)
  })
})
