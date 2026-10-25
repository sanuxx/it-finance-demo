import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartTheme'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLedgers, useLookups } from '@/hooks/useData'
import { groupSum } from '@/lib/calculations/ledgers'
import { divide, percentOf, sum } from '@/lib/calculations/money'
import { formatCurrency, formatMonth, formatPercent } from '@/lib/formatting'
import { monthLabel, todayISO } from '@/lib/dates'
import { completeMonths } from '../lib/forecast'
import { useForecast, useScenario } from '../lib/useForecast'
import { HorizonSelect, IllustrativeNotice, ScenarioSelect } from './ForecastControls'

export function ProjectionView({ metric }: { metric: 'revenue' | 'expenses' }) {
  const [scenarioId, setScenarioId] = useState('scn-base')
  const [horizon, setHorizon] = useState(12)
  const scenario = useScenario(scenarioId)
  const { baseline, history, forecast } = useForecast(scenario, horizon)
  const ledgers = useLedgers()
  const lookups = useLookups()
  const label = metric === 'revenue' ? 'Revenue' : 'Expenses'

  const chart = useMemo(() => {
    const rows: { month: string; actual?: number; forecast?: number }[] = history.map((h) => ({ month: h.month, actual: h[metric] }))
    if (rows.length) rows[rows.length - 1]!.forecast = rows[rows.length - 1]!.actual
    for (const f of forecast) rows.push({ month: f.month, forecast: f[metric] })
    return rows
  }, [history, forecast, metric])

  const byCategory = useMemo(() => {
    const months = new Set(completeMonths(todayISO(), 3))
    const items = (metric === 'revenue' ? ledgers.revenue : ledgers.expenses).filter((i) => months.has(i.date.slice(0, 7)))
    return groupSum(items, (i) => i.categoryId).map((g) => ({ ...g, monthly: divide(g.amount, 3) }))
  }, [ledgers, metric])

  const total = sum(forecast, (f) => f[metric])
  const trailing = sum(history.slice(-3), (h) => h[metric])
  const baseValue = metric === 'revenue' ? baseline.revenue : baseline.expenses
  const last = forecast[forecast.length - 1]

  return (
    <>
      <PageHeader
        title={`${label} forecast`}
        description={`Projected monthly ${label.toLowerCase()} from recent demo actuals and the selected scenario.`}
        actions={
          <>
            <ScenarioSelect value={scenario?.id ?? scenarioId} onChange={setScenarioId} />
            <HorizonSelect value={horizon} onChange={setHorizon} />
          </>
        }
      />
      <IllustrativeNotice scenario={scenario} />
      <StatGrid className="mb-6">
        <StatCard label="Monthly baseline" value={formatCurrency(baseValue)} hint={`Average of ${baseline.months.map(monthLabel).join(', ')}`} estimate />
        <StatCard label={`Projected ${label.toLowerCase()} (${horizon} mo)`} value={formatCurrency(total)} estimate />
        <StatCard label="Final month run-rate" value={formatCurrency(last?.[metric])} hint={last ? formatMonth(last.month) : undefined} delta={last ? percentOf(last[metric] - baseValue, baseValue) : null} deltaLabel="vs baseline" invertDelta={metric === 'expenses'} estimate />
        <StatCard label="Last 3 months actual" value={formatCurrency(trailing)} hint="From demo records" />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={`${label}: actual vs projection`}
          description="Solid line: recorded demo data. Dashed line: illustrative projection."
          height={300}
          table={{
            rows: chart,
            columns: [
              { header: 'Month', value: (r) => formatMonth(r.month) },
              { header: 'Actual', value: (r) => (r.actual === undefined ? '—' : formatCurrency(r.actual)), align: 'right' },
              { header: 'Projection', value: (r) => (r.forecast === undefined || r.actual !== undefined ? '—' : formatCurrency(r.forecast)), align: 'right' },
            ],
          }}
        >
          <ChartLegend items={[{ label: 'Actual', color: SERIES[0] }, { label: 'Projection', color: SERIES[1], dashed: true }]} />
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="Projection" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <Section title="Baseline by category" description="Average of the last three complete months.">
          <ul className="space-y-2">
            {byCategory.slice(0, 10).map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{lookups.master(c.key)}</span>
                <span className="tabular text-right">
                  <Money value={c.monthly} />
                  <span className="text-muted-foreground ml-2 text-xs">{formatPercent(percentOf(c.monthly, baseValue))}</span>
                </span>
              </li>
            ))}
            {!byCategory.length ? <li className="text-muted-foreground text-sm">No recent activity.</li> : null}
          </ul>
        </Section>
      </div>
      <Section title="Monthly projection" className="mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Baseline with growth</TableHead>
                <TableHead className="text-right">One-off items</TableHead>
                <TableHead className="text-right">Projected {label.toLowerCase()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.map((f) => {
                const oneOff = metric === 'revenue' ? f.oneOffRevenue : f.oneOffCost
                return (
                  <TableRow key={f.month}>
                    <TableCell>{formatMonth(f.month)}</TableCell>
                    <TableCell className="tabular text-right">{formatCurrency(f[metric] - oneOff)}</TableCell>
                    <TableCell className="tabular text-right">{oneOff ? formatCurrency(oneOff) : '—'}</TableCell>
                    <TableCell className="tabular text-right font-medium">{formatCurrency(f[metric])}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  )
}
