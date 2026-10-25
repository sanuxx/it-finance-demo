import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addDays, format, parseISO } from 'date-fns'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { useBillViews, useCollection, useDbSlice, useInvoiceViews, useLedgers } from '@/hooks/useData'
import { AGEING_LABELS, ageingBucket, type AgeingBucket } from '@/lib/calculations/invoices'
import { cashPosition, monthlyCashFlow } from '@/lib/calculations/cash'
import { groupSum } from '@/lib/calculations/ledgers'
import { round2, sum } from '@/lib/calculations/money'
import { lastNMonths, monthLabel, todayISO } from '@/lib/dates'
import { formatCurrency, formatMonth } from '@/lib/formatting'
import { illustrativeDso } from '../lib/metrics'
import { MonthlyBars } from '../widgets/charts'

const BUCKETS: AgeingBucket[] = ['current', '1_30', '31_60', '61_90', '90_plus']

export default function FinanceDashboardPage() {
  const invoices = useCollection('invoices')
  const bills = useCollection('supplierBills')
  const payments = useCollection('payments')
  const masterData = useCollection('masterData')
  const cashDb = useDbSlice('bankAccounts', 'payments', 'currencies')
  const invoiceViews = useInvoiceViews()
  const billViews = useBillViews()
  const today = todayISO()
  const months = useMemo(() => lastNMonths(12), [])
  const ledgers = useLedgers({ from: `${months[0]}-01` })

  const data = useMemo(() => {
    const ar = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<AgeingBucket, number>
    const ap = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<AgeingBucket, number>
    let receivables = 0
    let payables = 0
    for (const inv of invoices) {
      const v = invoiceViews.get(inv.id)
      if (!v || v.balance.outstanding <= 0 || inv.status === 'draft' || inv.status === 'void') continue
      const b = ageingBucket(inv.dueDate, today)
      ar[b] = round2(ar[b] + v.balance.outstanding)
      receivables += v.balance.outstanding
    }
    for (const bill of bills) {
      const v = billViews.get(bill.id)
      if (!v || v.balance.outstanding <= 0 || !['approved', 'partially_paid'].includes(v.status)) continue
      const b = ageingBucket(bill.dueDate, today)
      ap[b] = round2(ap[b] + v.balance.outstanding)
      payables += v.balance.outstanding
    }
    const ageing = BUCKETS.map((b) => ({ bucket: AGEING_LABELS[b], receivables: ar[b], payables: ap[b] }))
    const cashflow = monthlyCashFlow(payments, months)
    const from90 = format(addDays(parseISO(today), -90), 'yyyy-MM-dd')
    const revenue90 = sum(
      ledgers.revenue.filter((r) => r.date >= from90 && r.date <= today),
      (r) => r.amount,
    )
    // Top 5 expense categories over the period; the rest fold into "Other".
    const name = new Map(masterData.map((m) => [m.id, m.name]))
    const top = groupSum(ledgers.expenses, (e) => e.categoryId).slice(0, 5).map((g) => g.key)
    const series = [...top.map((k) => ({ key: k, label: name.get(k) ?? k })), { key: 'other', label: 'Other' }]
    const byCategory = months.map((month) => {
      const row: Record<string, number | string> = { month }
      for (const s of series) row[s.key] = 0
      for (const e of ledgers.expenses) {
        if (!e.date.startsWith(month)) continue
        const key = top.includes(e.categoryId) ? e.categoryId : 'other'
        row[key] = round2(Number(row[key]) + e.amount)
      }
      return row
    })
    return { ageing, cashflow, receivables, payables, dso: illustrativeDso(receivables, revenue90), byCategory, series }
  }, [invoices, bills, payments, masterData, invoiceViews, billViews, months, ledgers, today])

  const cash = cashPosition(cashDb)
  const net12 = sum(data.cashflow, (c) => c.net)

  return (
    <>
      <PageHeader title="Finance dashboard" description="Working capital, ageing and cash flow over the last 12 months — calculated from simulated receipts, payments, invoices and bills." />
      <StatGrid className="mb-6">
        <StatCard label="Cash position" term="Cash position" value={formatCurrency(cash, 'LKR', { compact: true })} hint={`Net cash flow 12m ${formatCurrency(net12, 'LKR', { compact: true })}`} to="/finance/banking" />
        <StatCard label="Receivables" term="Accounts receivable" value={formatCurrency(data.receivables, 'LKR', { compact: true })} hint={`${formatCurrency(data.ageing.slice(1).reduce((s, a) => s + a.receivables, 0), 'LKR', { compact: true })} overdue`} to="/finance/receivables" />
        <StatCard label="Payables" term="Accounts payable" value={formatCurrency(data.payables, 'LKR', { compact: true })} hint="Approved bills not yet paid" to="/finance/payables" />
        <StatCard label="Days sales outstanding" value={data.dso === null ? '—' : `${data.dso} days`} estimate hint="Receivables ÷ last-90-day revenue × 90" to="/reports/view/ar-ageing" />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Cash flow"
          description="Simulated money in and out by month, with net flow."
          height={300}
          table={{ rows: data.cashflow, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Inflow', value: (r) => formatCurrency(r.inflow), align: 'right' }, { header: 'Outflow', value: (r) => formatCurrency(r.outflow), align: 'right' }, { header: 'Net', value: (r) => formatCurrency(r.net), align: 'right' }] }}
        >
          <div className="flex h-full flex-col">
            <ChartLegend items={[{ label: 'Inflow', color: seriesColor(0) }, { label: 'Outflow', color: seriesColor(1) }, { label: 'Net', color: 'var(--foreground)' }]} />
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.cashflow} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
                  <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                  <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                  <Bar dataKey="inflow" name="Inflow" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="outflow" name="Outflow" fill={seriesColor(1)} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line dataKey="net" name="Net" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
        <ChartCard
          title="Receivables & payables ageing"
          description="Outstanding balances by days past due date."
          height={300}
          table={{ rows: data.ageing, columns: [{ header: 'Bucket', value: (r) => r.bucket }, { header: 'Receivables', value: (r) => formatCurrency(r.receivables), align: 'right' }, { header: 'Payables', value: (r) => formatCurrency(r.payables), align: 'right' }] }}
        >
          <div className="flex h-full flex-col">
            <ChartLegend items={[{ label: 'Receivables', color: seriesColor(0) }, { label: 'Payables', color: seriesColor(1) }]} />
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ageing} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="bucket" {...axisProps} />
                  <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                  <Bar dataKey="receivables" name="Receivables" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="payables" name="Payables" fill={seriesColor(1)} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
        <div className="xl:col-span-2">
          <MonthlyBars title="Expenses by category" description="Top five categories; the rest are grouped as Other. Current month is month-to-date." data={data.byCategory} series={data.series} stacked height={320} />
        </div>
      </div>
    </>
  )
}
