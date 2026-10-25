import type { BaseRecord, CurrencyCode, ID, ISODate, NoteEntry, StatusChange } from '../shared/types'

export interface Customer extends BaseRecord {
  code: string
  name: string
  industry: string
  contactName: string
  email: string
  phone: string
  country: string
  currency: CurrencyCode
  paymentTermsDays: number
  creditLimit: number
  status: 'active' | 'inactive' | 'prospect'
  notes?: string
  customFields?: Record<string, unknown>
}

export interface Supplier extends BaseRecord {
  code: string
  name: string
  categoryId: ID
  contactName: string
  email: string
  phone: string
  country: string
  currency: CurrencyCode
  paymentTermsDays: number
  status: 'active' | 'inactive'
  isSoftwareVendor: boolean
}

export type BillingModel = 'fixed_price' | 'time_and_materials' | 'retainer' | 'subscription' | 'milestone'

export type ContractStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'terminated'

export interface Contract extends BaseRecord {
  number: string
  title: string
  customerId: ID
  projectId?: ID
  billingModel: BillingModel
  value: number
  currency: CurrencyCode
  startDate: ISODate
  endDate: ISODate
  status: ContractStatus
  renewalDate?: ISODate
  description?: string
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'

export interface LineItem {
  id: ID
  description: string
  productId?: ID
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRatePercent: number
}

export interface Quotation extends BaseRecord {
  number: string
  customerId: ID
  title: string
  issueDate: ISODate
  validUntil: ISODate
  currency: CurrencyCode
  lines: LineItem[]
  status: QuotationStatus
  notes?: string
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void'

export interface Invoice extends BaseRecord {
  number: string
  customerId: ID
  projectId?: ID
  contractId?: ID
  issueDate: ISODate
  dueDate: ISODate
  currency: CurrencyCode
  lines: LineItem[]
  /** Invoice-level discount applied after line discounts (percent). */
  discountPercent: number
  status: InvoiceStatus
  history: StatusChange<InvoiceStatus>[]
  notes?: string
  terms?: string
  recurringScheduleId?: ID
}

export type CreditNoteStatus = 'draft' | 'issued' | 'applied'

export interface CreditNote extends BaseRecord {
  number: string
  customerId: ID
  invoiceId?: ID
  date: ISODate
  reason: string
  amount: number
  status: CreditNoteStatus
}

export type PaymentDirection = 'incoming' | 'outgoing'
export type PaymentCategory = 'customer_receipt' | 'supplier_payment' | 'payroll' | 'reimbursement' | 'card_settlement' | 'tax' | 'other'
export type PaymentMethod = 'bank_transfer' | 'cheque' | 'card' | 'cash' | 'online'

/** Simulated payment record — no money is ever moved by this application. */
export interface Payment extends BaseRecord {
  number: string
  direction: PaymentDirection
  category: PaymentCategory
  date: ISODate
  amount: number
  currency: CurrencyCode
  method: PaymentMethod
  reference?: string
  bankAccountId: ID
  customerId?: ID
  supplierId?: ID
  invoiceId?: ID
  billId?: ID
  notes?: string
}

export type RecurringFrequency = 'monthly' | 'quarterly' | 'annually'

export interface RecurringSchedule extends BaseRecord {
  name: string
  customerId: ID
  contractId?: ID
  frequency: RecurringFrequency
  amount: number
  description: string
  startDate: ISODate
  nextRunDate: ISODate
  endDate?: ISODate
  active: boolean
  taxRatePercent: number
}

export interface RevenueSchedule extends BaseRecord {
  contractId: ID
  method: 'straight_line' | 'milestone' | 'percent_complete'
  totalAmount: number
  startDate: ISODate
  endDate: ISODate
}

export type CustomerNote = NoteEntry
