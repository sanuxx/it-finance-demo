import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import type { ForecastScenario } from '@/domain'
import type { ExpenseItem, RevenueItem } from '@/lib/calculations/ledgers'
import { add, divide, multiply, round2, subtract, sum } from '@/lib/calculations/money'

/**
 * Simple ILLUSTRATIVE projection — not a statistical forecast.
 *
 * Baseline = average of the last 3 complete months of the revenue / expense
 * ledgers. Each future month compounds the scenario's monthly growth rate and
 * adds any one-off items (positive = extra revenue, negative = extra cost).
 */
export const FORECAST_VAT_RATE = 18

export interface ForecastMonth {
  month: string // yyyy-MM
  revenue: number
  expenses: number
  /** Non-cash part of expenses (depreciation), excluded from cash outflows. */
  nonCash: number
  oneOffRevenue: number
  oneOffCost: number
  profit: number
}

export interface Baseline {
  revenue: number
  expenses: number
  nonCash: number
  months: string[]
}

export interface ActualMonth {
  month: string
  revenue: number
  expenses: number
  profit: number
}

function monthKeyOffset(asOf: string, offset: number): string {
  return format(addMonths(startOfMonth(parseISO(asOf)), offset), 'yyyy-MM')
}

/** The last `count` complete months before the month containing `asOf`. */
export function completeMonths(asOf: string, count: number): string[] {
  const out: string[] = []
  for (let i = count; i >= 1; i--) out.push(monthKeyOffset(asOf, -i))
  return out
}

export function actualsByMonth(revenue: RevenueItem[], expenses: ExpenseItem[], months: string[]): ActualMonth[] {
  return months.map((m) => {
    const r = sum(
      revenue.filter((x) => x.date.slice(0, 7) === m),
      (x) => x.amount,
    )
    const e = sum(
      expenses.filter((x) => x.date.slice(0, 7) === m),
      (x) => x.amount,
    )
    return { month: m, revenue: r, expenses: e, profit: subtract(r, e) }
  })
}

export function computeBaseline(revenue: RevenueItem[], expenses: ExpenseItem[], asOf: string, window = 3): Baseline {
  const months = completeMonths(asOf, window)
  const set = new Set(months)
  const inWindow = <T extends { date: string }>(items: T[]) => items.filter((i) => set.has(i.date.slice(0, 7)))
  const exp = inWindow(expenses)
  return {
    revenue: divide(sum(inWindow(revenue), (r) => r.amount), window),
    expenses: divide(sum(exp, (e) => e.amount), window),
    nonCash: divide(
      sum(
        exp.filter((e) => e.source === 'depreciation'),
        (e) => e.amount,
      ),
      window,
    ),
    months,
  }
}

export function projectMonths(baseline: Baseline, scenario: Pick<ForecastScenario, 'revenueGrowthPercent' | 'expenseGrowthPercent' | 'oneOffItems'>, asOf: string, horizon: number): ForecastMonth[] {
  const out: ForecastMonth[] = []
  for (let i = 1; i <= horizon; i++) {
    // Month 1 is the current month (partially elapsed), projected in full.
    const month = monthKeyOffset(asOf, i - 1)
    const revenueBase = round2(baseline.revenue * Math.pow(1 + scenario.revenueGrowthPercent / 100, i))
    const expenseBase = round2(baseline.expenses * Math.pow(1 + scenario.expenseGrowthPercent / 100, i))
    const items = scenario.oneOffItems.filter((o) => o.month.slice(0, 7) === month)
    const oneOffRevenue = sum(
      items.filter((o) => o.amount > 0),
      (o) => o.amount,
    )
    const oneOffCost = sum(
      items.filter((o) => o.amount < 0),
      (o) => -o.amount,
    )
    const revenue = add(revenueBase, oneOffRevenue)
    const expenses = add(expenseBase, oneOffCost)
    out.push({ month, revenue, expenses, nonCash: baseline.nonCash, oneOffRevenue, oneOffCost, profit: subtract(revenue, expenses) })
  }
  return out
}

export interface CashFlowMonth {
  month: string
  opening: number
  inflowSales: number
  inflowReceivables: number
  outflowOperating: number
  outflowPayables: number
  net: number
  closing: number
}

/**
 * Cash projection: inflows = forecast revenue × (1 + VAT) × collection rate,
 * plus current receivables collected 60% / 40% over the first two months at the
 * same collection rate; outflows = cash expenses (excluding depreciation) plus
 * current payables settled in month one.
 */
export function projectCash(
  forecast: ForecastMonth[],
  opts: { openingCash: number; receivables: number; payables: number; collectionRatePercent: number },
): CashFlowMonth[] {
  const rate = opts.collectionRatePercent / 100
  const collectibleAr = multiply(opts.receivables, rate)
  let opening = opts.openingCash
  return forecast.map((f, i) => {
    const inflowSales = round2(f.revenue * (1 + FORECAST_VAT_RATE / 100) * rate)
    const inflowReceivables = i === 0 ? round2(collectibleAr * 0.6) : i === 1 ? subtract(collectibleAr, round2(collectibleAr * 0.6)) : 0
    const outflowOperating = subtract(f.expenses, f.nonCash)
    const outflowPayables = i === 0 ? opts.payables : 0
    const net = subtract(add(inflowSales, inflowReceivables), add(outflowOperating, outflowPayables))
    const closing = add(opening, net)
    const row = { month: f.month, opening, inflowSales, inflowReceivables, outflowOperating, outflowPayables, net, closing }
    opening = closing
    return row
  })
}
