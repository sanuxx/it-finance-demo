import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RevenueItem } from '@/lib/calculations/ledgers'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, foldOther, gridProps, seriesColor } from '@/components/charts/chartKit'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useLedgers, useLookups } from '@/hooks/useData'
import { groupSum } from '@/lib/calculations/ledgers'
import { percentOf, subtract, sum } from '@/lib/calculations/money'
import { monthsBetween, presetRange, previousRange, todayISO, type DatePreset } from '@/lib/dates'
import { formatCurrency, formatMonth } from '@/lib/formatting'
import { revenueLedger } from '@/lib/calculations/ledgers'
import { useDbSlice } from '@/hooks/useData'

export default function RevenuePage() {
  const [preset, setPreset] = useState<DatePreset>('last_12_months')
  const range = useMemo(() => presetRange(preset), [preset])
  const { revenue } = useLedgers(range)
  const lookups = useLookups()
  const navigate = useNavigate()
  const slice = useDbSlice('invoices', 'creditNotes', 'products')
  const prevTotal = useMemo(() => {
    const prev = previousRange(range)
    if (!prev.from) return null
    return sum(revenueLedger(slice, prev), (r) => r.amount)
  }, [slice, range])

  const total = sum(revenue, (r) => r.amount)
  const credits = sum(revenue.filter((r) => r.source === 'credit_note'), (r) => r.amount)
  const byCategory = groupSum(revenue, (r) => r.categoryId)
  const byCustomer = groupSum(revenue, (r) => r.customerId)
  const categoryKeys = byCategory.map((c) => c.key)

  const months = useMemo(() => {
    const from = range.from ?? revenue.reduce((m, r) => (r.date < m ? r.date : m), todayISO())
    const to = range.to && range.to < todayISO() ? range.to : todayISO()
    return monthsBetween(from, to)
  }, [range, revenue])

  const monthly = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, number | string> = { month: m }
        for (const k of categoryKeys) row[k] = sum(revenue.filter((r) => r.date.startsWith(m) && r.categoryId === k), (r) => r.amount)
        row.total = sum(revenue.filter((r) => r.date.startsWith(m)), (r) => r.amount)
        return row
      }),
    [months, revenue, categoryKeys],
  )

  const customerPie = foldOther(
    byCustomer.filter((c) => c.amount > 0).map((c) => ({ name: lookups.customer(c.key), value: c.amount })),
    6,
  )

  const columns: DataColumn<RevenueItem>[] = [
    { id: 'date', header: 'Date', accessor: (r) => r.date },
    { id: 'label', header: 'Description', accessor: (r) => r.label, alwaysVisible: true, cell: (r) => <span className="line-clamp-1">{r.label}</span> },
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.customerId) },
    { id: 'category', header: 'Category', accessor: (r) => lookups.master(r.categoryId) },
    { id: 'project', header: 'Project', accessor: (r) => (r.projectId ? lookups.projectCode(r.projectId) : ''), defaultHidden: true },
    { id: 'source', header: 'Source', accessor: (r) => r.source, cell: (r) => <StatusBadge status={r.source} tone={r.source === 'credit_note' ? 'warning' : 'info'} label={r.source === 'credit_note' ? 'Credit note' : 'Invoice'} /> },
    { id: 'amount', header: 'Net amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} signed /> },
  ]

  const delta = prevTotal ? percentOf(subtract(total, prevTotal), Math.abs(prevTotal)) : null

  return (
    <>
      <PageHeader
        title="Income & revenue"
        description="Accrual revenue net of tax and discounts, derived from issued invoices less credit notes."
        actions={<DateRangeSelect value={preset} onChange={setPreset} />}
      />
      <StatGrid className="mb-6">
        <StatCard label="Revenue" value={formatCurrency(total)} delta={delta} hint="Net of tax" />
        <StatCard label="Invoiced lines" value={revenue.filter((r) => r.source === 'invoice').length} hint="Revenue entries in range" />
        <StatCard label="Credit notes" term="Credit note" value={formatCurrency(credits)} to="/sales/credit-notes" />
        <StatCard label="Top service" value={byCategory[0] ? lookups.master(byCategory[0].key) : '—'} hint={byCategory[0] ? `${formatCurrency(byCategory[0].amount)} · ${percentOf(byCategory[0].amount, total) ?? 0}% of revenue` : undefined} />
      </StatGrid>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly revenue by service"
          description="Stacked by income category"
          table={{
            rows: monthly,
            columns: [
              { header: 'Month', value: (r) => formatMonth(String(r.month)) },
              ...categoryKeys.map((k) => ({ header: lookups.master(k), value: (r: Record<string, number | string>) => formatCurrency(Number(r[k])), align: 'right' as const })),
              { header: 'Total', value: (r) => formatCurrency(Number(r.total)), align: 'right' },
            ],
          }}
          footer={<ChartLegend items={categoryKeys.map((k, i) => ({ label: lookups.master(k), color: seriesColor(i) }))} />}
        >
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={(v) => formatMonth(String(v)).slice(0, 3)} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
              {categoryKeys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={lookups.master(k)}
                  stackId="rev"
                  fill={seriesColor(i)}
                  stroke="var(--card)"
                  strokeWidth={1}
                  radius={i === categoryKeys.length - 1 ? [4, 4, 0, 0] : 0}
                  cursor="pointer"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Revenue by customer"
          description="Top customers; the rest folded into Other"
          table={{ rows: customerPie, columns: [{ header: 'Customer', value: (r) => r.name }, { header: 'Revenue', value: (r) => formatCurrency(r.value), align: 'right' }] }}
          footer={<ChartLegend items={customerPie.map((c, i) => ({ label: c.name, color: seriesColor(i) }))} />}
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie data={customerPie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1} stroke="var(--card)" strokeWidth={2}>
                {customerPie.map((_, i) => (
                  <Cell key={i} fill={seriesColor(i)} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SimulatedNotice className="mb-3">Revenue is illustrative accrual revenue recognised on invoice issue date. See Revenue recognition for % complete based estimates.</SimulatedNotice>
      <DataTable
        caption="Revenue entries"
        data={revenue}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="revenue"
        initialSort={{ id: 'date', desc: true }}
        onRowClick={(r) => r.invoiceId && navigate(`/sales/invoices/${r.invoiceId}`)}
        filters={[
          { id: 'cat', label: 'Categories', options: categoryKeys.map((k) => ({ value: k, label: lookups.master(k) })), predicate: (r, v) => r.categoryId === v },
          { id: 'cus', label: 'Customers', options: byCustomer.map((c) => ({ value: c.key, label: lookups.customer(c.key) })), predicate: (r, v) => r.customerId === v },
        ]}
      />
    </>
  )
}
