import { buildSeed } from '@/data/seed'
import { documentTotals } from '@/lib/calculations/invoices'
import { contractInvoiced, contractRecognition, deferredOf, wipOf } from './recognition'
import { fillTemplate } from '@/features/invoicing/lib/billing'

describe('contract recognition', () => {
  const db = buildSeed(new Date(2026, 9, 24))

  it('net invoiced equals the sum of non-draft contract invoices net of tax (less credits)', () => {
    const c = db.contracts.find((x) => x.id === 'con-107')!
    const expected = db.invoices
      .filter((i) => i.contractId === c.id && i.status !== 'draft' && i.status !== 'void')
      .reduce((s, i) => s + documentTotals(i.lines, i.discountPercent).netAmount, 0)
    expect(contractInvoiced(c.id, db)).toBeCloseTo(expected, 2)
  })

  it('splits each difference into WIP or deferred, never both', () => {
    for (const r of contractRecognition(db, '2026-10-24')) {
      expect(wipOf(r) > 0 && deferredOf(r) > 0).toBe(false)
      expect(wipOf(r) - deferredOf(r)).toBeCloseTo(r.difference, 2)
    }
  })

  it('fills known template placeholders and leaves unknown ones visible', () => {
    expect(fillTemplate('Hi {{customer.name}}, {{nope}}', { 'customer.name': 'Acme' })).toBe('Hi Acme, {{nope}}')
  })
})
