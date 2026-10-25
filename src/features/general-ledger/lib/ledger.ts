import type { AccountType, JournalEntry, JournalLine, LedgerAccount } from '@/domain'
import { add, compare, subtract, sum } from '@/lib/calculations/money'
import { inRange } from '@/lib/dates'

/** Accounts whose normal balance is a debit. */
export function isDebitNormal(type: AccountType): boolean {
  return type === 'asset' || type === 'expense'
}

export interface PostedLine extends JournalLine {
  entryId: string
  entryNumber: string
  date: string
  memo: string
  source: JournalEntry['source']
}

/** Lines of posted (and later-reversed) journals; drafts are excluded. */
export function postedLines(entries: JournalEntry[], from?: string, to?: string): PostedLine[] {
  const out: PostedLine[] = []
  for (const e of entries) {
    if (e.status === 'draft' || !inRange(e.date, from, to)) continue
    for (const l of e.lines) out.push({ ...l, entryId: e.id, entryNumber: e.number, date: e.date, memo: e.memo, source: e.source })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.entryNumber.localeCompare(b.entryNumber))
}

export interface AccountSummary {
  account: LedgerAccount
  debit: number
  credit: number
  /** Balance in the account's normal direction. */
  balance: number
  lines: number
}

export function accountSummaries(accounts: LedgerAccount[], lines: PostedLine[]): AccountSummary[] {
  return accounts.map((account) => {
    const own = lines.filter((l) => l.accountId === account.id)
    const debit = sum(own, (l) => l.debit)
    const credit = sum(own, (l) => l.credit)
    return { account, debit, credit, balance: isDebitNormal(account.type) ? subtract(debit, credit) : subtract(credit, debit), lines: own.length }
  })
}

export function journalTotals(lines: Pick<JournalLine, 'debit' | 'credit'>[]) {
  const debit = sum(lines, (l) => l.debit || 0)
  const credit = sum(lines, (l) => l.credit || 0)
  return { debit, credit, difference: subtract(debit, credit), balanced: compare(debit, credit) === 0 && debit > 0 }
}

/** Running balance for one account's lines in its normal direction. */
export function withRunningBalance(lines: PostedLine[], type: AccountType) {
  let running = 0
  return lines.map((l) => {
    running = isDebitNormal(type) ? add(running, subtract(l.debit, l.credit)) : add(running, subtract(l.credit, l.debit))
    return { ...l, running }
  })
}
