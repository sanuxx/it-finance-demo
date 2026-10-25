import { useMemo } from 'react'
import type { ForecastScenario } from '@/domain'
import { useBillViews, useCollection, useDbSlice, useInvoiceViews, useLedgers } from '@/hooks/useData'
import { cashPosition } from '@/lib/calculations/cash'
import { sum } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { actualsByMonth, completeMonths, computeBaseline, projectCash, projectMonths } from './forecast'

/** Current receivables / payables / cash used as the opening position. */
export function useWorkingCapital() {
  const invoiceViews = useInvoiceViews()
  const billViews = useBillViews()
  const slice = useDbSlice('bankAccounts', 'payments', 'currencies')
  return useMemo(
    () => ({
      cash: cashPosition(slice),
      receivables: sum([...invoiceViews.values()], (v) => v.balance.outstanding),
      payables: sum(
        [...billViews.values()].filter((v) => v.status === 'approved' || v.status === 'partially_paid'),
        (v) => v.balance.outstanding,
      ),
    }),
    [invoiceViews, billViews, slice],
  )
}

export function useScenario(id: string | undefined): ForecastScenario | undefined {
  const scenarios = useCollection('scenarios')
  return scenarios.find((s) => s.id === id) ?? scenarios.find((s) => s.isDefault) ?? scenarios[0]
}

/** Baseline, history and projection for a scenario — shared by the forecasting pages. */
export function useForecast(scenario: ForecastScenario | undefined, horizon: number) {
  const ledgers = useLedgers()
  const wc = useWorkingCapital()
  return useMemo(() => {
    const asOf = todayISO()
    const baseline = computeBaseline(ledgers.revenue, ledgers.expenses, asOf)
    const history = actualsByMonth(ledgers.revenue, ledgers.expenses, completeMonths(asOf, 6))
    const s = scenario ?? { revenueGrowthPercent: 0, expenseGrowthPercent: 0, oneOffItems: [], collectionRatePercent: 85 }
    const forecast = projectMonths(baseline, s, asOf, horizon)
    const cash = projectCash(forecast, { openingCash: wc.cash, receivables: wc.receivables, payables: wc.payables, collectionRatePercent: s.collectionRatePercent })
    return { baseline, history, forecast, cash, workingCapital: wc }
  }, [ledgers, wc, scenario, horizon])
}
