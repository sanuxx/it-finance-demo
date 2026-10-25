import type { BillStatus, Payment, SupplierBill } from '@/domain'
import { add, max0, subtract, sum } from './money'
import { todayISO } from '@/lib/dates'

export function billTotal(bill: Pick<SupplierBill, 'subtotal' | 'taxAmount' | 'status'>): number {
  return bill.status === 'void' ? 0 : add(bill.subtotal, bill.taxAmount)
}

export interface BillBalance {
  total: number
  paid: number
  outstanding: number
}

export function billPayments(billId: string, payments: Payment[]): Payment[] {
  return payments.filter((p) => p.direction === 'outgoing' && p.billId === billId)
}

export function billBalance(bill: SupplierBill, payments: Payment[]): BillBalance {
  const total = billTotal(bill)
  const paid = sum(billPayments(bill.id, payments), (p) => p.amount)
  return { total, paid, outstanding: max0(subtract(total, paid)) }
}

export function deriveBillStatus(bill: SupplierBill, balance: BillBalance): BillStatus {
  if (bill.status === 'draft' || bill.status === 'awaiting_approval' || bill.status === 'void') return bill.status
  if (balance.total > 0 && balance.outstanding <= 0) return 'paid'
  if (balance.paid > 0) return 'partially_paid'
  return 'approved'
}

/** Bills count as incurred expenses once approved. */
export function isBillIncurred(bill: SupplierBill): boolean {
  return bill.status === 'approved' || bill.status === 'partially_paid' || bill.status === 'paid'
}

export function isBillOverdue(bill: SupplierBill, balance: BillBalance, asOf: string = todayISO()): boolean {
  return isBillIncurred(bill) && balance.outstanding > 0 && bill.dueDate < asOf
}
