import type { CreditNote, Invoice, InvoiceStatus, LineItem, Payment, Quotation } from '@/domain'
import { add, applyRate, max0, multiply, subtract, sum } from './money'
import { daysBetween, todayISO } from '@/lib/dates'

export interface LineTotals {
  gross: number
  discount: number
  net: number
}

/** quantity × unit price, less the line discount. Tax is computed at document level. */
export function lineTotals(line: Pick<LineItem, 'quantity' | 'unitPrice' | 'discountPercent'>): LineTotals {
  const gross = multiply(line.quantity || 0, line.unitPrice || 0)
  const discount = applyRate(gross, line.discountPercent || 0)
  return { gross, discount, net: subtract(gross, discount) }
}

export interface DocumentTotals {
  /** Sum of line nets (after line discounts). */
  subtotal: number
  /** Document-level discount amount. */
  documentDiscount: number
  /** Taxable amount after all discounts — this is the revenue (net of tax). */
  netAmount: number
  taxTotal: number
  total: number
  taxByRate: { rate: number; taxable: number; tax: number }[]
}

/**
 * Totals for invoices / quotations / purchase orders.
 *
 * Rounding rule: each line's net is rounded to 2dp, the document discount is
 * allocated per line and rounded, and tax is rounded per line before summing.
 */
export function documentTotals(lines: LineItem[], documentDiscountPercent = 0): DocumentTotals {
  const byRate = new Map<number, { taxable: number; tax: number }>()
  let subtotal = 0
  let documentDiscount = 0
  let taxTotal = 0
  for (const line of lines) {
    const { net } = lineTotals(line)
    const share = applyRate(net, documentDiscountPercent)
    const taxable = subtract(net, share)
    const tax = applyRate(taxable, line.taxRatePercent || 0)
    subtotal = add(subtotal, net)
    documentDiscount = add(documentDiscount, share)
    taxTotal = add(taxTotal, tax)
    const bucket = byRate.get(line.taxRatePercent || 0) ?? { taxable: 0, tax: 0 }
    byRate.set(line.taxRatePercent || 0, { taxable: add(bucket.taxable, taxable), tax: add(bucket.tax, tax) })
  }
  const netAmount = subtract(subtotal, documentDiscount)
  return {
    subtotal,
    documentDiscount,
    netAmount,
    taxTotal,
    total: add(netAmount, taxTotal),
    taxByRate: [...byRate.entries()].map(([rate, v]) => ({ rate, ...v })).sort((a, b) => a.rate - b.rate),
  }
}

export function invoiceTotals(invoice: Pick<Invoice, 'lines' | 'discountPercent'>): DocumentTotals {
  return documentTotals(invoice.lines, invoice.discountPercent)
}

export function quotationTotals(q: Pick<Quotation, 'lines'>): DocumentTotals {
  return documentTotals(q.lines, 0)
}

export interface InvoiceBalance {
  total: number
  paid: number
  credited: number
  outstanding: number
}

export function invoicePayments(invoiceId: string, payments: Payment[]): Payment[] {
  return payments.filter((p) => p.direction === 'incoming' && p.invoiceId === invoiceId)
}

export function invoiceCredits(invoiceId: string, creditNotes: CreditNote[]): CreditNote[] {
  return creditNotes.filter((c) => c.invoiceId === invoiceId && c.status !== 'draft')
}

export function invoiceBalance(invoice: Invoice, payments: Payment[], creditNotes: CreditNote[]): InvoiceBalance {
  const total = invoice.status === 'void' ? 0 : invoiceTotals(invoice).total
  const paid = sum(invoicePayments(invoice.id, payments), (p) => p.amount)
  const credited = sum(invoiceCredits(invoice.id, creditNotes), (c) => c.amount)
  // Drafts are not yet receivable, so nothing is outstanding until the invoice is issued.
  const outstanding = invoice.status === 'draft' ? 0 : max0(subtract(total, add(paid, credited)))
  return { total, paid, credited, outstanding }
}

/** Payment status derived from balances. Draft and void are never changed by payments. */
export function derivePaymentStatus(invoice: Invoice, balance: InvoiceBalance): InvoiceStatus {
  if (invoice.status === 'draft' || invoice.status === 'void') return invoice.status
  if (balance.total > 0 && balance.outstanding <= 0) return 'paid'
  if (balance.paid > 0 || balance.credited > 0) return 'partially_paid'
  return 'issued'
}

export function isInvoiceOverdue(invoice: Invoice, balance: InvoiceBalance, asOf: string = todayISO()): boolean {
  if (invoice.status === 'draft' || invoice.status === 'void') return false
  return balance.outstanding > 0 && invoice.dueDate < asOf
}

export type AgeingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus'

export const AGEING_LABELS: Record<AgeingBucket, string> = {
  current: 'Current',
  '1_30': '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_plus': '90+ days',
}

export function ageingBucket(dueDate: string, asOf: string = todayISO()): AgeingBucket {
  const days = daysBetween(dueDate, asOf)
  if (days <= 0) return 'current'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

/** Status shown in the UI: adds the derived "overdue" display state. */
export type InvoiceDisplayStatus = InvoiceStatus | 'overdue'

export function invoiceDisplayStatus(invoice: Invoice, balance: InvoiceBalance, asOf?: string): InvoiceDisplayStatus {
  const status = derivePaymentStatus(invoice, balance)
  if ((status === 'issued' || status === 'partially_paid') && isInvoiceOverdue(invoice, balance, asOf)) return 'overdue'
  return status
}
