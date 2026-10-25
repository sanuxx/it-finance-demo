import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCollection, useDbSlice } from '@/hooks/useData'
import { mrrTrend, productProfitability, saasMetrics } from '@/lib/calculations/saas'
import { groupSum } from '@/lib/calculations/ledgers'
import { round2, sum } from '@/lib/calculations/money'
import { lastNMonths, monthLabel } from '@/lib/dates'
import { formatCurrency, formatMonth, formatPercent } from '@/lib/formatting'
import { MonthlyBars } from '../widgets/charts'

export default function SaasDashboardPage() {
  const db = useDbSlice('products', 'subscriptions', 'cloudCosts', 'aiUsage', 'licences')
  const suppliers = useCollection('suppliers')
  const months = useMemo(() => lastNMonths(12), [])

  const data = useMemo(() => {
    const metrics = saasMetrics(db.subscriptions)
    const trend = mrrTrend(db.subscriptions, months)
    const providers = groupSum(
      db.cloudCosts.filter((c) => months.includes(c.month.slice(0, 7))),
      (c) => c.provider,
    ).map((g) => g.key)
    const top = providers.slice(0, 4)
    const cloudSeries = [...top.map((p) => ({ key: p, label: p })), ...(providers.length > 4 ? [{ key: 'Other', label: 'Other' }] : [])]
    const cloud = months.map((month) => {
      const row: Record<string, number | string> = { month }
      for (const s of cloudSeries) row[s.key] = 0
      for (const c of db.cloudCosts) {
        if (!c.month.startsWith(month)) continue
        const key = top.includes(c.provider) ? c.provider : 'Other'
        row[key] = round2(Number(row[key]) + c.amount)
      }
      return row
    })
    const ai = months.map((month) => ({ month, ai: sum(db.aiUsage.filter((a) => a.month.startsWith(month)), (a) => a.amount) }))
    const last3 = months.slice(-4, -1)
    const profit = productProfitability(db, last3)
    const cloudLast = sum(
      db.cloudCosts.filter((c) => c.month.startsWith(months[months.length - 2]!)),
      (c) => c.amount,
    )
    const cloudPrev = sum(
      db.cloudCosts.filter((c) => c.month.startsWith(months[months.length - 3]!)),
      (c) => c.amount,
    )
    return { metrics, trend, cloud, cloudSeries, ai, profit, cloudLast, cloudPrev, last3 }
  }, [db, months])

  const vendor = new Map(suppliers.map((s) => [s.id, s.name]))
  const licences = [...db.licences].filter((l) => l.status !== 'cancelled').sort((a, b) => a.seatsUsed / a.seats - b.seatsUsed / b.seats)
  const m = data.metrics

  return (
    <>
      <PageHeader title="SaaS & infrastructure overview" description="Recurring revenue from live subscriptions, and the cloud, AI and licence costs behind the products." />
      <StatGrid className="mb-6">
        <StatCard label="MRR" term="MRR" value={formatCurrency(m.mrr, 'LKR', { compact: true })} hint={`${m.activeSubscriptions} live subscriptions · ${m.trialSubscriptions} trial`} to="/saas/metrics" />
        <StatCard label="ARR" term="ARR" value={formatCurrency(m.arr, 'LKR', { compact: true })} hint={`ARPA ${formatCurrency(m.arpa, 'LKR', { compact: true })}`} to="/saas/metrics" />
        <StatCard label="Logo churn (3 months)" term="Churn" value={formatPercent(m.churnRatePercent)} hint={`NRR ${formatPercent(m.nrrPercent)} (12-month cohort)`} estimate to="/saas/subscriptions" />
        <StatCard
          label="Cloud spend last month"
          value={formatCurrency(data.cloudLast, 'LKR', { compact: true })}
          delta={data.cloudPrev ? ((data.cloudLast - data.cloudPrev) / data.cloudPrev) * 100 : null}
          invertDelta
          deltaLabel="vs prior month"
          to="/saas/cloud"
        />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="MRR trend"
          description="Month-end MRR from live subscriptions (trials excluded)."
          height={280}
          table={{ rows: data.trend, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'MRR', value: (r) => formatCurrency(r.mrr), align: 'right' }] }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
              <Area dataKey="mrr" name="MRR" stroke={seriesColor(0)} strokeWidth={2} fill={seriesColor(0)} fillOpacity={0.12} type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <MonthlyBars title="Cloud spend by provider" description="Current month is month-to-date." data={data.cloud} series={data.cloudSeries} stacked />
        <MonthlyBars title="AI & API usage cost" description="Model inference and API spend by month." data={data.ai} series={[{ key: 'ai', label: 'AI & API' }]} />
        <Section title="Product gross margin" description={`Illustrative: subscription MRR vs attributed cloud + AI cost, ${formatMonth(data.last3[0]!)} – ${formatMonth(data.last3[data.last3.length - 1]!)}.`} actions={<Link to="/saas/product-profitability" className="text-primary text-xs font-medium hover:underline">Details</Link>}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Infra cost</TableHead>
                <TableHead className="text-right">Gross margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.profit.map((p) => (
                <TableRow key={p.product.id}>
                  <TableCell className="font-medium">{p.product.name}</TableCell>
                  <TableCell className="text-right">
                    <Money value={p.revenue} compact />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={p.cloud + p.ai} compact />
                  </TableCell>
                  <TableCell className="tabular text-right">{formatPercent(p.grossMarginPercent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
        <Section title="Licence utilisation" description="Seats in use vs purchased — low utilisation suggests savings." actions={<Link to="/saas/licences" className="text-primary text-xs font-medium hover:underline">Manage</Link>} className="xl:col-span-2">
          <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {licences.map((l) => (
              <li key={l.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{l.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {l.seatsUsed}/{l.seats} seats · {vendor.get(l.vendorId)}
                  </span>
                </div>
                <ProgressBar value={l.seatsUsed} max={l.seats} tone="primary" label={`${l.name} seat utilisation`} />
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  )
}
