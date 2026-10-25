import type { SoftwareLicence } from '@/domain'
import { divide, multiply } from '@/lib/calculations/money'

/** Monthly equivalent cost of a licence (annual plans ÷ 12) — matches the expense ledger. */
export function licenceMonthly(l: Pick<SoftwareLicence, 'seats' | 'costPerSeat' | 'billingCycle'>): number {
  const cycle = multiply(l.seats, l.costPerSeat)
  return l.billingCycle === 'annual' ? divide(cycle, 12) : cycle
}
