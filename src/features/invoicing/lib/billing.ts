import { addDays, addMonths, format, parseISO } from 'date-fns'
import type { DemoDatabase, Invoice, LineItem, RecurringFrequency } from '@/domain'
import { invoiceTotals } from '@/lib/calculations/invoices'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { invoiceBalance } from '@/lib/calculations/invoices'
import { newId } from '@/services/demo/demoStore'

export const DEFAULT_VAT = 18

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
]

export const PAYMENT_CATEGORY_LABELS: Record<string, string> = {
  customer_receipt: 'Customer receipt',
  supplier_payment: 'Supplier payment',
  payroll: 'Payroll',
  reimbursement: 'Reimbursement',
  card_settlement: 'Card settlement',
  tax: 'Tax',
  other: 'Other',
}

export const BILLING_MODEL_LABELS: Record<string, string> = {
  fixed_price: 'Fixed price',
  time_and_materials: 'Time & materials',
  retainer: 'Retainer',
  subscription: 'Subscription',
  milestone: 'Milestone',
}

export const FREQUENCY_MONTHS: Record<RecurringFrequency, number> = { monthly: 1, quarterly: 3, annually: 12 }

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function addDaysIso(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd')
}

export function addMonthsIso(date: string, months: number): string {
  return format(addMonths(parseISO(date), months), 'yyyy-MM-dd')
}

export function blankLine(): LineItem {
  return { id: newId('ln'), description: '', productId: undefined, quantity: 1, unitPrice: 0, discountPercent: 0, taxRatePercent: DEFAULT_VAT }
}

/** Replace {{placeholders}} from a controlled variable map. Unknown placeholders are left visible. */
export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => vars[key] ?? m)
}

export function invoiceTemplateVars(inv: Invoice, db: Pick<DemoDatabase, 'customers' | 'payments' | 'creditNotes' | 'organization'>): Record<string, string> {
  const customer = db.customers.find((c) => c.id === inv.customerId)
  const totals = invoiceTotals(inv)
  const bal = invoiceBalance(inv, db.payments, db.creditNotes)
  return {
    'customer.name': customer?.name ?? '',
    'customer.contact': customer?.contactName ?? '',
    'invoice.number': inv.number,
    'invoice.total': formatCurrency(totals.total, inv.currency),
    'invoice.dueDate': formatDate(inv.dueDate),
    'invoice.balance': formatCurrency(bal.outstanding, inv.currency),
    'organization.name': db.organization.name,
    today: formatDate(todayIso()),
  }
}
