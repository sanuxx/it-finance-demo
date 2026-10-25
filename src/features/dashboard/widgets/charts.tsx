import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, foldOther, gridProps, seriesColor } from '@/components/charts/chartKit'
import type { MonthlyPoint } from '@/lib/calculations/ledgers'
import { formatCurrency, formatMonth, formatPercent } from '@/lib/formatting'
import { monthLabel } from '@/lib/dates'

/** Monthly revenue vs expenses bars with a profit line. Click a month to drill into revenue. */
export function IncomeExpenseChart({ data, title = 'Income vs expenses', description, height = 300 }: { data: MonthlyPoint[]; title?: string; description?: string; height?: number }) {
  const navigate = useNavigate()
  return (
    <ChartCard
      title={title}
      description={description ?? 'Monthly revenue (net of tax) and operating expenses. Click a month to see its revenue.'}
      height={height}
      table={{
        rows: data,
        columns: [
          { header: 'Month', value: (r) => formatMonth(r.month) },
          { header: 'Revenue', value: (r) => formatCurrency(r.revenue), align: 'right' },
          { header: 'Expenses', value: (r) => formatCurrency(r.expenses), align: 'right' },
          { header: 'Profit', value: (r) => formatCurrency(r.profit), align: 'right' },
        ],
      }}
    >
      <div className="flex h-full flex-col">
        <ChartLegend
          items={[
            { label: 'Revenue', color: seriesColor(0) },
            { label: 'Expenses', color: seriesColor(1) },
            { label: 'Net profit', color: 'var(--foreground)' },
          ]}
        />
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              barGap={2}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={(state) => {
                const label = state?.activeLabel
                if (typeof label === 'string') navigate(`/finance/revenue?month=${label}`)
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
              <Bar dataKey="revenue" name="Revenue" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expenses" name="Expenses" fill={seriesColor(1)} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line dataKey="profit" name="Net profit" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}

/** Donut of a category split, folded to at most 6 slices. */
export function CategoryDonut({ title, description, items, height = 280, onSelect }: { title: string; description?: string; items: { name: string; value: number; key?: string }[]; height?: number; onSelect?: (name: string) => void }) {
  const data = foldOther(items.filter((i) => i.value > 0), 6)
  const total = data.reduce((s, i) => s + i.value, 0)
  return (
    <ChartCard
      title={title}
      description={description}
      height={height}
      table={{
        rows: data,
        columns: [
          { header: 'Category', value: (r) => r.name },
          { header: 'Amount', value: (r) => formatCurrency(r.value), align: 'right' },
          { header: 'Share', value: (r) => formatPercent(total ? (r.value / total) * 100 : null), align: 'right' },
        ],
      }}
    >
      {data.length ? (
        <div className="flex h-full flex-col items-center gap-3 sm:flex-row">
          <div className="h-full min-h-40 w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={1} stroke="var(--card)" strokeWidth={2} onClick={(d) => onSelect?.(String((d as { name?: string }).name ?? ''))}>
                  {data.map((d, i) => (
                    <Cell key={d.name} fill={d.name === 'Other' ? 'var(--muted-foreground)' : seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1.5 text-xs sm:w-1/2">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.name === 'Other' ? 'var(--muted-foreground)' : seriesColor(i) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="tabular text-muted-foreground">{formatPercent(total ? (d.value / total) * 100 : null, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground flex h-full items-center justify-center text-sm">No data for this period.</p>
      )}
    </ChartCard>
  )
}

/** Simple single- or multi-series monthly bar chart. */
export function MonthlyBars({ title, description, data, series, height = 280, stacked }: { title: string; description?: string; data: Record<string, number | string>[]; series: { key: string; label: string }[]; height?: number; stacked?: boolean }) {
  return (
    <ChartCard
      title={title}
      description={description}
      height={height}
      table={{
        rows: data,
        columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...series.map((s) => ({ header: s.label, value: (r: Record<string, number | string>) => formatCurrency(Number(r[s.key] ?? 0)), align: 'right' as const }))],
      }}
    >
      <div className="flex h-full flex-col">
        {series.length > 1 ? <ChartLegend items={series.map((s, i) => ({ label: s.label, color: seriesColor(i) }))} /> : null}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={seriesColor(i)}
                  stackId={stacked ? 'a' : undefined}
                  stroke={stacked ? 'var(--card)' : undefined}
                  strokeWidth={stacked ? 1 : 0}
                  radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  )
}
