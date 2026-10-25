import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCollection, useLedgers } from '@/hooks/useData'
import { formatCurrency, formatMonth } from '@/lib/formatting'
import { monthLabel, todayISO } from '@/lib/dates'
import { computeBaseline, projectCash, projectMonths, FORECAST_VAT_RATE } from '../lib/forecast'
import { useForecast, useScenario, useWorkingCapital } from '../lib/useForecast'
import { HorizonSelect, IllustrativeNotice, ScenarioSelect } from '../components/ForecastControls'
import { cn } from '@/lib/utils'

export default function CashFlowForecastPage() {
  const [scenarioId, setScenarioId] = useState('scn-base')
  const [horizon, setHorizon] = useState(12)
  const scenario = useScenario(scenarioId)
  const scenarios = useCollection('scenarios')
  const { cash, workingCapital } = useForecast(scenario, horizon)
  const ledgers = useLedgers()
  const wc = useWorkingCapital()

  // Closing balance per scenario for the comparison chart.
  const comparison = useMemo(() => {
    const asOf = todayISO()
    const baseline = computeBaseline(ledgers.revenue, ledgers.expenses, asOf)
    const series = scenarios.map((s) => ({
      scenario: s,
      cash: projectCash(projectMonths(baseline, s, asOf, horizon), { openingCash: wc.cash, receivables: wc.receivables, payables: wc.payables, collectionRatePercent: s.collectionRatePercent }),
    }))
    const months = series[0]?.cash.map((c) => c.month) ?? []
    const rows = months.map((m, i) => {
      const row: Record<string, number | string> = { month: m }
      for (const s of series) row[s.scenario.id] = s.cash[i]!.closing
      return row
    })
    return { series, rows }
  }, [ledgers, scenarios, horizon, wc])

  const closing = cash[cash.length - 1]?.closing ?? workingCapital.cash
  const lowest = cash.reduce<(typeof cash)[number] | undefined>((min, c) => (!min || c.closing < min.closing ? c : min), undefined)

  return (
    <>
      <PageHeader
        title="Cash flow forecast"
        description="Projected simulated cash position by month, starting from current demo bank balances, receivables and payables."
        actions={
          <>
            <ScenarioSelect value={scenario?.id ?? scenarioId} onChange={setScenarioId} />
            <HorizonSelect value={horizon} onChange={setHorizon} />
          </>
        }
      />
      <IllustrativeNotice scenario={scenario} />
      <StatGrid className="mb-6">
        <StatCard label="Opening cash" term="Cash position" value={formatCurrency(workingCapital.cash)} to="/finance/banking" />
        <StatCard label="Receivables to collect" term="Accounts receivable" value={formatCurrency(workingCapital.receivables)} hint="Collected 60% / 40% over two months" to="/finance/receivables" />
        <StatCard label="Payables to settle" term="Accounts payable" value={formatCurrency(workingCapital.payables)} hint="Assumed paid in month one" to="/finance/payables" />
        <StatCard label={`Projected cash in ${horizon} months`} value={formatCurrency(closing)} hint={lowest ? `Lowest: ${formatCurrency(lowest.closing)} (${formatMonth(lowest.month)})` : undefined} estimate />
      </StatGrid>

      <ChartCard
        title="Projected closing cash by scenario"
        description="Compare best-case, base and conservative assumptions."
        height={300}
        table={{
          rows: comparison.rows,
          columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...comparison.series.map((s) => ({ header: s.scenario.name, value: (r: Record<string, number | string>) => formatCurrency(Number(r[s.scenario.id])), align: 'right' as const }))],
        }}
      >
        <ChartLegend items={comparison.series.map((s, i) => ({ label: s.scenario.name, color: seriesColor(i) }))} />
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={comparison.rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <ReferenceLine y={0} stroke="var(--destructive)" strokeDasharray="3 3" />
            <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
            {comparison.series.map((s, i) => (
              <Line key={s.scenario.id} type="monotone" dataKey={s.scenario.id} name={s.scenario.name} stroke={seriesColor(i)} strokeWidth={s.scenario.id === scenario?.id ? 2.5 : 1.5} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <Section title={`Monthly cash flow — ${scenario?.name ?? 'Scenario'}`} description={`Sales receipts = projected revenue × (1 + ${FORECAST_VAT_RATE}% VAT) × collection rate. Operating outflows exclude depreciation.`} className="mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Sales receipts</TableHead>
                <TableHead className="text-right">Receivables collected</TableHead>
                <TableHead className="text-right">Operating outflows</TableHead>
                <TableHead className="text-right">Payables settled</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cash.map((c) => (
                <TableRow key={c.month}>
                  <TableCell>{formatMonth(c.month)}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(c.opening)}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(c.inflowSales)}</TableCell>
                  <TableCell className="tabular text-right">{c.inflowReceivables ? formatCurrency(c.inflowReceivables) : '—'}</TableCell>
                  <TableCell className="tabular text-right">−{formatCurrency(c.outflowOperating)}</TableCell>
                  <TableCell className="tabular text-right">{c.outflowPayables ? `−${formatCurrency(c.outflowPayables)}` : '—'}</TableCell>
                  <TableCell className={cn('tabular text-right', c.net < 0 && 'text-destructive')}>{formatCurrency(c.net)}</TableCell>
                  <TableCell className={cn('tabular text-right font-medium', c.closing < 0 && 'text-destructive')}>{formatCurrency(c.closing)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  )
}
