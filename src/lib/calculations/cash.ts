import type { BankAccount, DemoDatabase, Payment } from '@/domain'
import { add, subtract, sum } from './money'
import { todayISO } from '@/lib/dates'

export function signedPayment(p: Payment): number {
  return p.direction === 'incoming' ? p.amount : -p.amount
}

/** Simulated bank balance = opening balance ± recorded payments up to `asOf`. */
export function bankBalance(account: BankAccount, payments: Payment[], asOf: string = todayISO()): number {
  const movements = payments.filter((p) => p.bankAccountId === account.id && p.date <= asOf)
  return add(account.openingBalance, sum(movements, signedPayment))
}

export function cashPosition(db: Pick<DemoDatabase, 'bankAccounts' | 'payments' | 'currencies'>, asOf: string = todayISO()): number {
  const rate = new Map(db.currencies.map((c) => [c.code, c.rateToBase]))
  return sum(
    db.bankAccounts.filter((a) => a.active),
    (a) => bankBalance(a, db.payments, asOf) * (rate.get(a.currency) ?? 1),
  )
}

export function monthlyCashFlow(payments: Payment[], months: string[]) {
  return months.map((m) => {
    const inMonth = payments.filter((p) => p.date.slice(0, 7) === m)
    const inflow = sum(
      inMonth.filter((p) => p.direction === 'incoming'),
      (p) => p.amount,
    )
    const outflow = sum(
      inMonth.filter((p) => p.direction === 'outgoing'),
      (p) => p.amount,
    )
    return { month: m, inflow, outflow, net: subtract(inflow, outflow) }
  })
}
