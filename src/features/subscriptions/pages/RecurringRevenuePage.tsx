import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCollection, useLookups } from '@/hooks/useData'
import { isSubscriptionLive, mrrAt, saasMetrics, subscriptionMrr } from '@/lib/calculations/saas'
import { percentOf, subtract, sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate, formatMonth, formatPercent } from '@/lib/formatting'
import { lastNMonths, monthLabel, todayISO } from '@/lib/dates'
import { BreakdownList } from '@/features/cloud-costs/components/BreakdownList'

function monthEnd(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const d = new Date(y, m, 0)
  return `${key}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RecurringRevenuePage() {
  const subs = useCollection('subscriptions')
  const products = useCollection('products')
  const lookups = useLookups()
  const today = todayISO()
  const metrics = useMemo(() => saasMetrics(subs, today), [subs, today])
  const saasProducts = products.filter((p) => p.kind === 'saas')

  const months = useMemo(() => lastNMonths(12), [])
  const trend = useMemo(
    () =>
      months.map((m) => {
        const date = m === today.slice(0, 7) ? today : monthEnd(m)
        const row: Record<string, number | string> = { month: m }
        for (const p of saasProducts) row[p.id] = mrrAt(subs, date, p.id)
        row.total = mrrAt(subs, date)
        return row
      }),
    [months, subs, saasProducts, today],
  )

  // MRR movements per month: new subscriptions, churned subscriptions, net change.
  const movements = useMemo(
    () =>
      months.map((m, i) => {
        const newMrr = sum(
          subs.filter((s) => s.status !== 'trial' && s.startDate.slice(0, 7) === m),
          subscriptionMrr,
        )
        const churned = sum(
          subs.filter((s) => s.cancelledDate?.slice(0, 7) === m),
          subscriptionMrr,
        )
        const start = i === 0 ? null : Number(trend[i - 1]!.total)
        return { month: m, newMrr, churned, net: subtract(newMrr, churned), closing: Number(trend[i]!.total), start }
      }),
    [months, subs, trend],
  )

  const byProduct = saasProducts.map((p) => ({ key: p.id, label: p.name, amount: mrrAt(subs, today, p.id), hint: `${subs.filter((s) => s.productId === p.id && isSubscriptionLive(s, today)).length} subs` })).sort((a, b) => b.amount - a.amount)
  const yearAgo = Number(trend[0]?.total ?? 0)

  return (
    <>
      <PageHeader title="Recurring revenue" description="Subscription metrics calculated from the customer subscription records." />
      <StatGrid className="mb-6 xl:grid-cols-5">
        <StatCard label="MRR" term="MRR" value={formatCurrency(metrics.mrr)} delta={percentOf(metrics.mrr - yearAgo, yearAgo)} deltaLabel="vs 12 months ago" />
        <StatCard label="ARR" term="ARR" value={formatCurrency(metrics.arr)} hint="MRR × 12" />
        <StatCard label="ARPA" term="ARPA" value={formatCurrency(metrics.arpa)} hint={`${metrics.customers} paying customers`} />
        <StatCard label="Logo churn (3 mo)" term="Churn" value={formatPercent(metrics.churnRatePercent)} estimate hint="Cancelled ÷ live 3 months ago" />
        <StatCard label="Net revenue retention" term="NRR" value={formatPercent(metrics.nrrPercent)} estimate hint="12-month cohort, seat changes not tracked" />
      </StatGrid>
      <SimulatedNotice className="mb-4" tone="demo">
        Churn and NRR are illustrative: the demo only records start and cancellation dates, not historic seat or price changes, so expansion revenue is estimated from current values.
      </SimulatedNotice>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="MRR trend by product"
          description="Month-end MRR over the last 12 months."
          height={300}
          table={{ rows: trend, columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...saasProducts.map((p) => ({ header: p.name, value: (r: Record<string, number | string>) => formatCurrency(Number(r[p.id])), align: 'right' as const })), { header: 'Total MRR', value: (r) => formatCurrency(Number(r.total)), align: 'right' }] }}
        >
          <ChartLegend items={saasProducts.map((p, i) => ({ label: p.name, color: seriesColor(i) }))} />
          <ResponsiveContainer width="100%" height="88%">
            <AreaChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
              {saasProducts.map((p, i) => (
                <Area key={p.id} type="monotone" dataKey={p.id} name={p.name} stackId="mrr" stroke={seriesColor(i)} fill={seriesColor(i)} fillOpacity={0.25} strokeWidth={2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="space-y-4">
          <Section title="MRR by product">
            <BreakdownList items={byProduct} />
          </Section>
          <Section title="Renewals in the next 30 days" actions={<Link to="/saas/subscriptions" className="text-primary text-xs hover:underline">All subscriptions</Link>}>
            {metrics.renewalsNext30Days.length ? (
              <ul className="space-y-2 text-sm">
                {[...metrics.renewalsNext30Days].sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)).slice(0, 8).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{lookups.customer(s.customerId)} <span className="text-muted-foreground text-xs">· {formatDate(s.renewalDate)}</span></span>
                    <Money value={subscriptionMrr(s)} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground text-sm">No renewals in the next 30 days.</p>}
          </Section>
        </div>
      </div>
      <Section title="MRR movements" description="New MRR from subscriptions starting in the month; churned MRR from cancellations." className="mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">New MRR</TableHead>
                <TableHead className="text-right">Churned MRR</TableHead>
                <TableHead className="text-right">Net new</TableHead>
                <TableHead className="text-right">Closing MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...movements].reverse().map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{formatMonth(m.month)}</TableCell>
                  <TableCell className="tabular text-right">{m.newMrr ? formatCurrency(m.newMrr) : '—'}</TableCell>
                  <TableCell className="tabular text-destructive text-right">{m.churned ? `−${formatCurrency(m.churned)}` : '—'}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(m.net)}</TableCell>
                  <TableCell className="tabular text-right font-medium">{formatCurrency(m.closing)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </>
  )
}
