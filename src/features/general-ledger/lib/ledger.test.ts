import { describe, expect, it } from 'vitest'
import type { JournalEntry, LedgerAccount } from '@/domain'
import { accountSummaries, journalTotals, postedLines, withRunningBalance } from './ledger'

const acc = (id: string, type: LedgerAccount['type']): LedgerAccount => ({ id, code: id, name: id, type, subtype: 'x', active: true, createdAt: '', updatedAt: '' })
const entry = (id: string, status: JournalEntry['status'], lines: [string, number, number][]): JournalEntry => ({
  id, number: id, date: '2026-01-10', memo: id, source: 'manual', status, createdAt: '', updatedAt: '',
  lines: lines.map(([accountId, debit, credit], i) => ({ id: `${id}-${i}`, accountId, debit, credit })),
})

describe('general ledger helpers', () => {
  it('detects balanced journals with decimal-safe totals', () => {
    expect(journalTotals([{ debit: 0.1, credit: 0 }, { debit: 0.2, credit: 0 }, { debit: 0, credit: 0.3 }]).balanced).toBe(true)
    expect(journalTotals([{ debit: 100, credit: 0 }, { debit: 0, credit: 99.99 }]).balanced).toBe(false)
  })

  it('excludes drafts and uses each account’s normal balance', () => {
    const entries = [entry('a', 'posted', [['bank', 1000, 0], ['rev', 0, 1000]]), entry('b', 'draft', [['bank', 50, 0], ['rev', 0, 50]])]
    const lines = postedLines(entries)
    expect(lines).toHaveLength(2)
    const s = accountSummaries([acc('bank', 'asset'), acc('rev', 'income')], lines)
    expect(s.find((x) => x.account.id === 'bank')?.balance).toBe(1000)
    expect(s.find((x) => x.account.id === 'rev')?.balance).toBe(1000)
    expect(withRunningBalance(lines.filter((l) => l.accountId === 'bank'), 'asset').at(-1)?.running).toBe(1000)
  })
})
