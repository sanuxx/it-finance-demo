import { beforeEach, describe, expect, it } from 'vitest'
import { customerRepository, expenseRepository, invoiceRepository, useDemoStore, DemoValidationError } from '@/services'
import { invoiceBalance } from '@/lib/calculations/invoices'
import { evaluateRule } from '@/lib/rules/engine'

const db = () => useDemoStore.getState().db

describe('repositories (browser demo implementation)', () => {
  beforeEach(() => {
    localStorage.clear()
    useDemoStore.getState().reset()
  })

  it('creates and edits a customer with an audit entry', async () => {
    const c = await customerRepository.create({ code: 'C-T', name: 'Test Co', industry: 'IT', contactName: 'A', email: 'a@test.example', phone: '', country: 'LK', currency: 'LKR', paymentTermsDays: 30, creditLimit: 0, status: 'active' })
    expect(db().customers.some((x) => x.id === c.id)).toBe(true)
    await customerRepository.update(c.id, { name: 'Renamed Co' })
    expect(db().customers.find((x) => x.id === c.id)!.name).toBe('Renamed Co')
    expect(db().auditLog[0]!.summary).toContain('Renamed Co')
  })

  it('blocks deleting customers that have invoices', async () => {
    const withInvoices = db().customers.find((c) => db().invoices.some((i) => i.customerId === c.id))!
    await expect(customerRepository.remove(withInvoices.id)).rejects.toBeInstanceOf(DemoValidationError)
  })

  it('creates, issues and part-pays an invoice consistently', async () => {
    const customerId = db().customers[0]!.id
    const inv = await invoiceRepository.create({
      number: '',
      customerId,
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'LKR',
      discountPercent: 0,
      lines: [{ id: 'l1', description: 'Build', quantity: 10, unitPrice: 10_000, discountPercent: 0, taxRatePercent: 18 }],
      status: 'draft',
      history: [],
    })
    expect(inv.number).toMatch(/^INV-2026-\d{4}$/)
    await invoiceRepository.issue(inv.id)
    await invoiceRepository.recordPayment(inv.id, { date: '2026-10-05', amount: 50_000, method: 'bank_transfer', bankAccountId: 'bank-operating' })
    let current = db().invoices.find((i) => i.id === inv.id)!
    expect(current.status).toBe('partially_paid')
    expect(invoiceBalance(current, db().payments, db().creditNotes).outstanding).toBe(68_000)
    await expect(invoiceRepository.recordPayment(inv.id, { date: '2026-10-06', amount: 68_000.01, method: 'bank_transfer', bankAccountId: 'bank-operating' })).rejects.toThrow(/exceeds the outstanding/)
    await invoiceRepository.recordPayment(inv.id, { date: '2026-10-06', amount: 68_000, method: 'bank_transfer', bankAccountId: 'bank-operating' })
    current = db().invoices.find((i) => i.id === inv.id)!
    expect(current.status).toBe('paid')
  })

  it('runs an expense through submit → approve and submit → reject', async () => {
    const base = { number: '', employeeId: 'emp-05', date: '2026-10-01', categoryId: 'exp-travel', description: 'Taxi', amount: 60_000, taxAmount: 0, currency: 'LKR' as const, departmentId: 'dept-engineering', billable: false, status: 'draft' as const, receipts: [], history: [], notes: [] }
    const a = await expenseRepository.create(base)
    const submitted = await expenseRepository.submit(a.id)
    expect(submitted.status).toBe('submitted')
    expect(submitted.flaggedForReview).toBe(true) // seeded rule: amount ≥ 50,000
    expect((await expenseRepository.approve(a.id)).status).toBe('approved')

    const b = await expenseRepository.create({ ...base, amount: 1_000 })
    await expenseRepository.submit(b.id)
    await expect(expenseRepository.reject(b.id, ' ')).rejects.toThrow(/reason/)
    const rejected = await expenseRepository.reject(b.id, 'Missing receipt')
    expect(rejected.status).toBe('rejected')
    expect(rejected.history.at(-1)!.note).toBe('Missing receipt')
  })

  it('reset restores the original dataset', async () => {
    const first = db().customers[0]!
    await customerRepository.update(first.id, { name: 'Temporary' })
    useDemoStore.getState().reset()
    expect(db().customers[0]!.name).toBe(first.name)
  })
})

describe('rules engine', () => {
  it('evaluates all/any conditions without executing code', () => {
    const rule = db().rules.find((r) => r.id === 'rule-1')!
    expect(evaluateRule(rule, { amount: 49_999 }).triggered).toBe(false)
    expect(evaluateRule(rule, { amount: 50_000 }).triggered).toBe(true)
    const anyRule = { ...rule, match: 'any' as const, conditions: [...rule.conditions, { id: 'x', field: 'categoryId' as const, operator: 'eq' as const, value: 'exp-meals' }] }
    expect(evaluateRule(anyRule, { amount: 10, categoryId: 'exp-meals' }).triggered).toBe(true)
  })
})
