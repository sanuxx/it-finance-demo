import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useLedgers, useLookups } from '@/hooks/useData'
import { groupSum, type ExpenseItem } from '@/lib/calculations/ledgers'
import { add, percentOf } from '@/lib/calculations/money'
import { formatCurrency, formatMonth, formatPercent } from '@/lib/formatting'
import { monthLabel, monthsBetween, presetRange, type DatePreset } from '@/lib/dates'

/** Third-party spend sources: supplier bills, licences, cloud and AI usage. */
const VENDOR_SOURCES = new Set<ExpenseItem['source']>(['bill', 'licence', 'cloud', 'ai'])

interface VendorRow {
  key: string
  vendor: string
  kind: string
  amount: number
  items: number
  share: number | null
  topCategory: string
}

export default function VendorSpendPage() {
  const [preset, setPreset] = useState<DatePreset>('last_12_months')
  const range = useMemo(() => presetRange(preset), [preset])
  const { expenses } = useLedgers(range)
  const lookups = useLookups()

  const vendorItems = useMemo(() => expenses.filter((e) => VENDOR_SOURCES.has(e.source)), [expenses])

  const vendorOf = (e: ExpenseItem) => {
    if (e.supplierId) return { key: e.supplierId, name: lookups.supplier(e.supplierId), kind: e.source === 'licence' ? 'Software licences' : 'Supplier bills' }
    const provider = e.label.split(' — ')[0]?.trim() || 'Other provider'
    return { key: `provider:${provider}`, name: provider, kind: e.source === 'ai' ? 'AI / API usage' : 'Cloud usage' }
  }

  const total = vendorItems.reduce((s, e) => add(s, e.amount), 0)
  const rows = useMemo<VendorRow[]>(() => {
    const map = new Map<string, { vendor: string; kinds: Set<string>; items: ExpenseItem[] }>()
    for (const e of vendorItems) {
      const v = vendorOf(e)
      const entry = map.get(v.key) ?? { vendor: v.name, kinds: new Set<string>(), items: [] }
      entry.kinds.add(v.kind)
      entry.items.push(e)
      map.set(v.key, entry)
    }
    return [...map.entries()].map(([key, v]) => {
      const amount = v.items.reduce((s, e) => add(s, e.amount), 0)
      return { key, vendor: v.vendor, kind: [...v.kinds].join(', '), amount, items: v.items.length, share: percentOf(amount, total), topCategory: lookups.master(groupSum(v.items, (i) => i.categoryId)[0]?.key) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorItems, total, lookups])

  const byCategory = useMemo(() => groupSum(vendorItems, (e) => e.categoryId).map((g) => ({ name: lookups.master(g.key), value: g.amount })), [vendorItems, lookups])

  // Monthly stacked spend for the top 4 vendors, the rest folded into "Other".
  const top = useMemo(() => [...rows].sort((a, b) => b.amount - a.amount).slice(0, 4), [rows])
  const months = useMemo(() => {
    const from = range.from ?? vendorItems.reduce((m, e) => (e.date < m ? e.date : m), new Date().toISOString().slice(0, 10))
    return monthsBetween(from, range.to ?? new Date().toISOString().slice(0, 10))
  }, [range, vendorItems])
  const monthly = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, number | string> = { month: m }
        let other = 0
        for (const e of vendorItems) {
          if (e.date.slice(0, 7) !== m) continue
          const k = vendorOf(e).key
          const idx = top.findIndex((t) => t.key === k)
          if (idx >= 0) row[`v${idx}`] = add(Number(row[`v${idx}`] ?? 0), e.amount)
          else other = add(other, e.amount)
        }
        row.other = other
        return row
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [months, vendorItems, top],
  )
  const series = [...top.map((t, i) => ({ key: `v${i}`, label: t.vendor, color: seriesColor(i) })), { key: 'other', label: 'Other vendors', color: 'var(--muted-foreground)' }]

  const columns: DataColumn<VendorRow>[] = [
    { id: 'vendor', header: 'Vendor', accessor: (r) => r.vendor, alwaysVisible: true, cell: (r) => <span className="font-medium">{r.vendor}</span> },
    { id: 'kind', header: 'Spend type', accessor: (r) => r.kind },
    { id: 'category', header: 'Main category', accessor: (r) => r.topCategory },
    { id: 'items', header: 'Entries', accessor: (r) => r.items, align: 'right' },
    { id: 'amount', header: 'Spend (excl. tax)', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    { id: 'share', header: 'Share', accessor: (r) => r.share, align: 'right', cell: (r) => formatPercent(r.share) },
  ]

  return (
    <>
      <PageHeader
        title="Vendor spending"
        description="Third-party spend by vendor and category, derived from approved supplier bills, software licences, cloud and AI usage records."
        actions={<DateRangeSelect value={preset} onChange={setPreset} />}
      />
      <StatGrid className="mb-6">
        <StatCard label="Vendor spend" value={formatCurrency(total)} hint="Excluding tax" />
        <StatCard label="Vendors with spend" value={rows.length} />
        <StatCard label="Largest vendor" value={top[0]?.vendor ?? '—'} hint={top[0] ? `${formatCurrency(top[0].amount)} · ${formatPercent(top[0].share)}` : undefined} />
        <StatCard label="Top category" value={byCategory[0]?.name ?? '—'} hint={byCategory[0] ? formatCurrency(byCategory[0].value) : undefined} />
      </StatGrid>
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly spend by vendor"
          description="Top four vendors; others combined"
          table={{ rows: monthly, columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...series.map((s) => ({ header: s.label, value: (r: Record<string, number | string>) => formatCurrency(Number(r[s.key] ?? 0)), align: 'right' as const }))] }}
          footer={<ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
        >
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ left: 4, right: 8, top: 4 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={monthLabel} />
              <YAxis {...axisProps} tickFormatter={currencyTick} width={56} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} stroke="var(--card)" strokeWidth={1} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Spend by category" description="Selected period" table={{ rows: byCategory, columns: [{ header: 'Category', value: (r) => r.name }, { header: 'Spend', value: (r) => formatCurrency(r.value), align: 'right' }] }}>
          <ResponsiveContainer>
            <BarChart data={byCategory.slice(0, 7)} layout="vertical" margin={{ left: 8, right: 12 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" {...axisProps} tickFormatter={currencyTick} />
              <YAxis type="category" dataKey="name" {...axisProps} width={118} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <Bar dataKey="value" name="Spend" fill={seriesColor(0)} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <DataTable caption="Vendor spend" data={rows} columns={columns} getRowId={(r) => r.key} exportName="vendor-spend" initialSort={{ id: 'amount', desc: true }} />
      <SimulatedNotice className="mt-4">Spend figures are calculated from the fictional demo records in this browser and exclude tax. Cloud and AI providers are grouped by provider name.</SimulatedNotice>
    </>
  )
}
