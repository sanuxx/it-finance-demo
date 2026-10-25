import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartTheme'
import { Term } from '@/components/data-display/Term'
import { useDbSlice } from '@/hooks/useData'
import { productProfitability } from '@/lib/calculations/saas'
import { add, percentOf, subtract, sum } from '@/lib/calculations/money'
import { formatCurrency, formatPercent } from '@/lib/formatting'
import { lastNMonths } from '@/lib/dates'
import { cn } from '@/lib/utils'

type Row = ReturnType<typeof productProfitability>[number]

export default function ProductProfitabilityPage() {
  const db = useDbSlice('products', 'subscriptions', 'cloudCosts', 'aiUsage')
  const [window, setWindow] = useState(6)
  const months = useMemo(() => lastNMonths(window), [window])
  const rows = useMemo(() => productProfitability(db, months), [db, months])

  const revenue = sum(rows, (r) => r.revenue)
  const cost = add(sum(rows, (r) => r.cloud), sum(rows, (r) => r.ai))
  const chart = rows.map((r) => ({ name: r.product.name, revenue: r.revenue, cloud: r.cloud, ai: r.ai }))

  const columns: DataColumn<Row>[] = [
    { id: 'product', header: 'Product', accessor: (r) => r.product.name, alwaysVisible: true, cell: (r) => <span className="font-medium">{r.product.name}</span> },
    { id: 'revenue', header: 'Subscription revenue', accessor: (r) => r.revenue, align: 'right', cell: (r) => <Money value={r.revenue} /> },
    { id: 'cloud', header: 'Cloud cost', accessor: (r) => r.cloud, align: 'right', cell: (r) => <Money value={r.cloud} /> },
    { id: 'ai', header: 'AI & API cost', accessor: (r) => r.ai, align: 'right', cell: (r) => <Money value={r.ai} /> },
    { id: 'gp', header: 'Gross profit', accessor: (r) => r.grossProfit, align: 'right', cell: (r) => <Money value={r.grossProfit} signed /> },
    { id: 'gm', header: 'Gross margin', accessor: (r) => r.grossMarginPercent, align: 'right', cell: (r) => <span className={cn('tabular', (r.grossMarginPercent ?? 0) < 0 && 'text-destructive')}>{formatPercent(r.grossMarginPercent)}</span> },
    { id: 'infra', header: 'Infra cost % of revenue', accessor: (r) => percentOf(r.cloud + r.ai, r.revenue), align: 'right', cell: (r) => formatPercent(percentOf(r.cloud + r.ai, r.revenue)) },
  ]

  return (
    <>
      <PageHeader
        title="Product profitability"
        description="SaaS subscription revenue compared with cloud and AI costs tagged to each product."
        actions={
          <Select value={String(window)} onValueChange={(v) => setWindow(Number(v))}>
            <SelectTrigger size="sm" className="h-9 w-40" aria-label="Period"><SelectValue /></SelectTrigger>
            <SelectContent>{[3, 6, 12].map((n) => <SelectItem key={n} value={String(n)}>Last {n} months</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      <SimulatedNotice tone="demo" className="mb-5">
        Illustrative <Term term="Gross margin">gross margin</Term>: revenue is month-end MRR summed over the period; costs include only cloud and AI entries tagged to the product. Support staff, shared infrastructure and overhead are not allocated.
      </SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Subscription revenue" value={formatCurrency(revenue)} hint={`${window} months`} estimate />
        <StatCard label="Attributed infrastructure" value={formatCurrency(cost)} hint="Cloud + AI tagged to products" />
        <StatCard label="Gross profit" value={formatCurrency(subtract(revenue, cost))} estimate />
        <StatCard label="Gross margin" term="Gross margin" value={formatPercent(percentOf(subtract(revenue, cost), revenue))} estimate />
      </StatGrid>
      <ChartCard
        title="Revenue vs infrastructure cost by product"
        height={280}
        className="mb-4"
        table={{ rows: chart, columns: [{ header: 'Product', value: (r) => r.name }, { header: 'Revenue', value: (r) => formatCurrency(r.revenue), align: 'right' }, { header: 'Cloud', value: (r) => formatCurrency(r.cloud), align: 'right' }, { header: 'AI', value: (r) => formatCurrency(r.ai), align: 'right' }] }}
      >
        <ChartLegend items={[{ label: 'Revenue', color: SERIES[0] }, { label: 'Cloud cost', color: SERIES[1] }, { label: 'AI & API cost', color: SERIES[2] }]} />
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)' }} />
            <Bar dataKey="revenue" name="Revenue" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="cloud" name="Cloud cost" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="ai" name="AI & API cost" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable caption="Product profitability" data={rows} columns={columns} getRowId={(r) => r.product.id} exportName="product-profitability" initialSort={{ id: 'gp', desc: true }} />
    </>
  )
}
