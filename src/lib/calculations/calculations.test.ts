import { describe, expect, it } from 'vitest'
import type { FixedAsset, Invoice, LineItem, Payment } from '@/domain'
import { add, applyRate, divide, percentOf, round2, sum } from './money'
import { ageingBucket, derivePaymentStatus, documentTotals, invoiceBalance, invoiceDisplayStatus, lineTotals } from './invoices'
import { budgetActuals } from './budgets'
import { assetBookValue, depreciationSchedule, monthlyDepreciation } from './depreciation'
import { subscriptionMrr } from './saas'

const line = (quantity: number, unitPrice: number, discountPercent = 0, taxRatePercent = 18): LineItem => ({ id: `l${quantity}${unitPrice}`, description: 'x', quantity, unitPrice, discountPercent, taxRatePercent })

const invoice = (lines: LineItem[], extra: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1',
  number: 'INV-1',
  customerId: 'c',
  issueDate: '2026-01-01',
  dueDate: '2026-01-31',
  currency: 'LKR',
  lines,
  discountPercent: 0,
  status: 'issued',
  history: [],
  createdAt: '',
  updatedAt: '',
  ...extra,
})

const pay = (amount: number, invoiceId = 'inv-1'): Payment => ({
  id: `p${amount}`,
  number: 'P',
  direction: 'incoming',
  category: 'customer_receipt',
  date: '2026-01-10',
  amount,
  currency: 'LKR',
  method: 'bank_transfer',
  bankAccountId: 'b',
  invoiceId,
  createdAt: '',
  updatedAt: '',
})

describe('money helpers', () => {
  it('avoids floating point drift', () => {
    expect(add(0.1, 0.2)).toBe(0.3)
    expect(sum([{ v: 0.1 }, { v: 0.2 }, { v: 0.3 }], (x) => x.v)).toBe(0.6)
  })
  it('rounds half up to 2dp', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
    expect(applyRate(99.99, 18)).toBe(18)
  })
  it('handles zero divisors safely', () => {
    expect(divide(10, 0)).toBe(0)
    expect(percentOf(10, 0)).toBeNull()
    expect(percentOf(25, 200)).toBe(12.5)
  })
})

describe('invoice totals', () => {
  it('calculates line totals with discounts', () => {
    expect(lineTotals({ quantity: 3, unitPrice: 1000, discountPercent: 10 })).toEqual({ gross: 3000, discount: 300, net: 2700 })
  })
  it('applies document discount before tax and sums tax per line', () => {
    const t = documentTotals([line(2, 50_000), line(10, 9_500, 0, 0)], 10)
    expect(t.subtotal).toBe(195_000)
    expect(t.documentDiscount).toBe(19_500)
    expect(t.netAmount).toBe(175_500)
    expect(t.taxTotal).toBe(16_200) // 18% of 90,000 (zero-rated line excluded)
    expect(t.total).toBe(191_700)
    expect(t.taxByRate.map((r) => r.rate)).toEqual([0, 18])
  })
  it('keeps payments and outstanding balance consistent', () => {
    const inv = invoice([line(1, 100_000)])
    const b0 = invoiceBalance(inv, [], [])
    expect(b0).toEqual({ total: 118_000, paid: 0, credited: 0, outstanding: 118_000 })
    const b1 = invoiceBalance(inv, [pay(50_000)], [])
    expect(b1.outstanding).toBe(68_000)
    expect(derivePaymentStatus(inv, b1)).toBe('partially_paid')
    const b2 = invoiceBalance(inv, [pay(50_000), pay(68_000)], [])
    expect(b2.outstanding).toBe(0)
    expect(derivePaymentStatus(inv, b2)).toBe('paid')
  })
  it('treats drafts as not yet receivable', () => {
    expect(invoiceBalance(invoice([line(1, 1000)], { status: 'draft' }), [], []).outstanding).toBe(0)
  })
  it('ignores payments for other invoices and never goes negative', () => {
    const inv = invoice([line(1, 1000)])
    expect(invoiceBalance(inv, [pay(5000, 'other')], []).outstanding).toBe(1180)
    expect(invoiceBalance(inv, [pay(5000)], []).outstanding).toBe(0)
  })
  it('derives overdue only for unpaid issued invoices past due', () => {
    const inv = invoice([line(1, 1000)], { dueDate: '2026-02-01' })
    const b = invoiceBalance(inv, [], [])
    expect(invoiceDisplayStatus(inv, b, '2026-03-01')).toBe('overdue')
    expect(invoiceDisplayStatus(inv, b, '2026-01-15')).toBe('issued')
    expect(invoiceDisplayStatus({ ...inv, status: 'draft' }, b, '2026-03-01')).toBe('draft')
  })
  it('buckets receivables by age', () => {
    expect(ageingBucket('2026-01-31', '2026-01-31')).toBe('current')
    expect(ageingBucket('2026-01-01', '2026-01-20')).toBe('1_30')
    expect(ageingBucket('2026-01-01', '2026-02-20')).toBe('31_60')
    expect(ageingBucket('2026-01-01', '2026-06-01')).toBe('90_plus')
  })
})

describe('budgets', () => {
  const budget = {
    id: 'b',
    name: 'B',
    scope: 'company' as const,
    kind: 'expense' as const,
    fiscalYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    ownerId: 'u',
    status: 'approved' as const,
    lines: [
      { id: '1', categoryId: 'exp-travel', amount: 100_000 },
      { id: '2', categoryId: 'exp-meals', amount: 0 },
    ],
    createdAt: '',
    updatedAt: '',
  }
  it('calculates utilisation = eligible actual / approved budget and handles zero budgets', () => {
    const expenses = [
      { id: 'a', date: '2026-02-01', amount: 25_000, categoryId: 'exp-travel', source: 'expense' as const, label: '' },
      { id: 'b', date: '2025-12-31', amount: 99_000, categoryId: 'exp-travel', source: 'expense' as const, label: '' },
      { id: 'c', date: '2026-03-01', amount: 5_000, categoryId: 'exp-meals', source: 'expense' as const, label: '' },
    ]
    const r = budgetActuals(budget, { expenses, revenue: [] }, '2026-07-01')
    expect(r.actual).toBe(30_000)
    expect(r.utilisationPercent).toBe(30)
    expect(r.lines[0]!.utilisationPercent).toBe(25)
    expect(r.lines[1]!.utilisationPercent).toBeNull()
    expect(r.remaining).toBe(70_000)
  })
})

describe('depreciation & SaaS', () => {
  const asset: FixedAsset = { id: 'a', tag: 'A', name: 'Laptop', assetClassId: 'x', purchaseDate: '2026-01-10', cost: 360_000, salvageValue: 0, usefulLifeMonths: 36, method: 'straight_line', location: '', status: 'active', createdAt: '', updatedAt: '' }
  it('depreciates straight line from the month after purchase', () => {
    expect(monthlyDepreciation(asset, '2026-01-01')).toBe(0)
    expect(monthlyDepreciation(asset, '2026-02-01')).toBe(10_000)
    expect(depreciationSchedule(asset).at(-1)!.closing).toBe(0)
    expect(assetBookValue(asset, '2026-07-15').bookValue).toBe(300_000)
  })
  it('normalises annual subscriptions to MRR', () => {
    expect(subscriptionMrr({ seats: 10, unitPrice: 12_000, billingCycle: 'annual' })).toBe(10_000)
    expect(subscriptionMrr({ seats: 10, unitPrice: 1_200, billingCycle: 'monthly' })).toBe(12_000)
  })
})
