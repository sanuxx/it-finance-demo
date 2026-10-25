import { describe, expect, it } from 'vitest'
import type { ExpenseItem, RevenueItem } from '@/lib/calculations/ledgers'
import { completeMonths, computeBaseline, projectCash, projectMonths } from './forecast'

const rev = (date: string, amount: number): RevenueItem => ({ id: date + amount, date, amount, categoryId: 'inc', customerId: 'c', source: 'invoice', label: '' })
const exp = (date: string, amount: number, source: ExpenseItem['source'] = 'bill'): ExpenseItem => ({ id: date + amount + source, date, amount, categoryId: 'exp', source, label: '' })

describe('forecast helper', () => {
  it('uses the last three complete months', () => {
    expect(completeMonths('2026-10-24', 3)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('averages trailing months and ignores the current month', () => {
    const b = computeBaseline(
      [rev('2026-07-05', 100), rev('2026-08-05', 200), rev('2026-09-05', 300), rev('2026-10-05', 9999), rev('2026-06-01', 5000)],
      [exp('2026-07-01', 60), exp('2026-08-01', 60), exp('2026-09-01', 60), exp('2026-09-01', 30, 'depreciation')],
      '2026-10-24',
    )
    expect(b.revenue).toBe(200)
    expect(b.expenses).toBe(70)
    expect(b.nonCash).toBe(10)
  })

  it('compounds growth and applies one-off items', () => {
    const months = projectMonths(
      { revenue: 1000, expenses: 500, nonCash: 0, months: [] },
      { revenueGrowthPercent: 10, expenseGrowthPercent: 0, oneOffItems: [{ id: 'a', month: '2026-11-01', label: 'x', amount: -200 }, { id: 'b', month: '2026-10-01', label: 'y', amount: 50 }] },
      '2026-10-24',
      2,
    )
    expect(months[0]).toMatchObject({ month: '2026-10', revenue: 1150, expenses: 500 })
    expect(months[1]).toMatchObject({ month: '2026-11', revenue: 1210, expenses: 700, profit: 510 })
  })

  it('rolls cash forward with VAT, collection rate and working capital', () => {
    const forecast = projectMonths({ revenue: 1000, expenses: 600, nonCash: 100, months: [] }, { revenueGrowthPercent: 0, expenseGrowthPercent: 0, oneOffItems: [] }, '2026-10-24', 3)
    const cash = projectCash(forecast, { openingCash: 10_000, receivables: 1000, payables: 300, collectionRatePercent: 50 })
    expect(cash[0]).toMatchObject({ inflowSales: 590, inflowReceivables: 300, outflowOperating: 500, outflowPayables: 300, net: 90, closing: 10_090 })
    expect(cash[1]!.inflowReceivables).toBe(200)
    expect(cash[2]!.inflowReceivables).toBe(0)
    expect(cash[2]!.opening).toBe(cash[1]!.closing)
  })
})
