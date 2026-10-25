import type { BaseRecord, CurrencyCode, DemoAttachment, ID, ISODate, NoteEntry, StatusChange } from '../shared/types'

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export interface LedgerAccount extends BaseRecord {
  code: string
  name: string
  type: AccountType
  subtype: string
  description?: string
  active: boolean
}

export type JournalStatus = 'draft' | 'posted' | 'reversed'

export interface JournalLine {
  id: ID
  accountId: ID
  description?: string
  debit: number
  credit: number
  projectId?: ID
  departmentId?: ID
}

/** Illustrative double-entry journal. Not a secure accounting ledger. */
export interface JournalEntry extends BaseRecord {
  number: string
  date: ISODate
  memo: string
  source: 'manual' | 'invoice' | 'payment' | 'expense' | 'bill' | 'depreciation' | 'payroll'
  sourceId?: ID
  status: JournalStatus
  lines: JournalLine[]
}

export interface BankAccount extends BaseRecord {
  name: string
  bankName: string
  accountMask: string // e.g. "•••• 4821" — never a real number
  currency: CurrencyCode
  openingBalance: number
  ledgerAccountId: ID
  active: boolean
}

export interface BankStatementLine extends BaseRecord {
  bankAccountId: ID
  date: ISODate
  description: string
  amount: number // positive = money in, negative = money out
  reference?: string
  matchedPaymentId?: ID
  reconciled: boolean
}

export type PeriodStatus = 'open' | 'closing' | 'closed'

export interface FinancialPeriod extends BaseRecord {
  name: string
  startDate: ISODate
  endDate: ISODate
  status: PeriodStatus
}

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'

export interface ExpenseClaim extends BaseRecord {
  number: string
  employeeId: ID
  date: ISODate
  categoryId: ID
  description: string
  amount: number
  taxAmount: number
  currency: CurrencyCode
  projectId?: ID
  departmentId: ID
  billable: boolean
  status: ExpenseStatus
  receipts: DemoAttachment[]
  history: StatusChange<ExpenseStatus>[]
  notes: NoteEntry[]
  flaggedForReview?: boolean
  customFields?: Record<string, unknown>
}

export interface FixedAsset extends BaseRecord {
  tag: string
  name: string
  assetClassId: ID
  purchaseDate: ISODate
  cost: number
  salvageValue: number
  usefulLifeMonths: number
  method: 'straight_line' | 'declining_balance'
  departmentId?: ID
  location: string
  status: 'active' | 'disposed' | 'fully_depreciated'
  supplierId?: ID
}

export interface RdExpenditure extends BaseRecord {
  projectId?: ID
  date: ISODate
  description: string
  amount: number
  category: 'staff' | 'contractors' | 'software' | 'cloud' | 'materials'
  eligible: boolean
}

export interface TaxRate extends BaseRecord {
  name: string
  code: string
  rate: number // percentage
  type: 'sales' | 'purchase' | 'withholding'
  active: boolean
}

export interface CurrencySetting extends BaseRecord {
  code: CurrencyCode
  name: string
  symbol: string
  rateToBase: number // 1 unit of this currency in base currency (illustrative)
  active: boolean
}

export interface FinancialPolicy extends BaseRecord {
  title: string
  category: 'expenses' | 'procurement' | 'billing' | 'approvals' | 'travel' | 'security'
  summary: string
  limitAmount?: number
  active: boolean
}
