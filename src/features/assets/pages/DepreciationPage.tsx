import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups } from '@/hooks/useData'
import { monthlyDepreciation } from '@/lib/calculations/depreciation'
import { add } from '@/lib/calculations/money'
import { formatCurrency, formatMonth } from '@/lib/formatting'
import { monthLabel, monthsBetween, presetRange, todayISO, type DatePreset } from '@/lib/dates'

interface AssetPeriodRow {
  id: string
  tag: string
  name: string
  classId: string
  departmentId?: string
  total: number
}

export default function DepreciationPage() {
  const assets = useCollection('assets')
  const lookups = useLookups()
  const [preset, setPreset] = useState<DatePreset>('ytd')

  const months = useMemo(() => {
    const r = presetRange(preset)
    const today = todayISO()
    const earliest = assets.reduce((m, a) => (a.purchaseDate < m ? a.purchaseDate : m), today)
    return monthsBetween(r.from ?? earliest, r.to ?? today)
  }, [preset, assets])

  const classIds = useMemo(() => [...new Set(assets.map((a) => a.assetClassId))], [assets])

  const { monthly, perAsset, byDepartment } = useMemo(() => {
    const perAssetMap = new Map<string, number>()
    const deptMap = new Map<string, number>()
    const monthly = months.map((m) => {
      const row: Record<string, number | string> = { month: m }
      for (const a of assets) {
        const dep = monthlyDepreciation(a, `${m}-01`)
        if (dep <= 0) continue
        const idx = classIds.indexOf(a.assetClassId)
        row[`c${idx}`] = add(Number(row[`c${idx}`] ?? 0), dep)
        perAssetMap.set(a.id, add(perAssetMap.get(a.id) ?? 0, dep))
        const dk = a.departmentId ?? 'unassigned'
        deptMap.set(dk, add(deptMap.get(dk) ?? 0, dep))
      }
      return row
    })
    const perAsset: AssetPeriodRow[] = assets
      .filter((a) => perAssetMap.has(a.id))
      .map((a) => ({ id: a.id, tag: a.tag, name: a.name, classId: a.assetClassId, departmentId: a.departmentId, total: perAssetMap.get(a.id) ?? 0 }))
    const byDepartment = [...deptMap.entries()].map(([k, v]) => ({ name: k === 'unassigned' ? 'Unassigned' : lookups.master(k), value: v })).sort((a, b) => b.value - a.value)
    return { monthly, perAsset, byDepartment }
  }, [months, assets, classIds, lookups])

  const total = perAsset.reduce((s, r) => add(s, r.total), 0)
  const series = classIds.map((id, i) => ({ key: `c${i}`, label: lookups.master(id), color: seriesColor(i) }))
  const currentMonth = todayISO().slice(0, 7)
  const thisMonth = monthly.find((m) => m.month === currentMonth)
  const thisMonthTotal = thisMonth ? series.reduce((s, x) => add(s, Number(thisMonth[x.key] ?? 0)), 0) : 0

  const columns: DataColumn<AssetPeriodRow>[] = [
    { id: 'asset', header: 'Asset', accessor: (r) => r.name, cell: (r) => <Link to={`/assets/${r.id}`} className="hover:underline"><span className="font-medium">{r.name}</span> <span className="text-muted-foreground text-xs">{r.tag}</span></Link> },
    { id: 'class', header: 'Class', accessor: (r) => lookups.master(r.classId) },
    { id: 'department', header: 'Department', accessor: (r) => lookups.master(r.departmentId) },
    { id: 'total', header: 'Depreciation in period', accessor: (r) => r.total, align: 'right', cell: (r) => <Money value={r.total} /> },
  ]

  return (
    <>
      <PageHeader title="Depreciation" description="Monthly depreciation across the asset register for the selected period. It feeds the expense ledger under the depreciation category." actions={<DateRangeSelect value={preset} onChange={setPreset} />} />
      <StatGrid className="mb-6">
        <StatCard label="Depreciation in period" term="Depreciation" value={formatCurrency(total)} hint={`${months.length} month(s)`} />
        <StatCard label="This month" value={formatCurrency(thisMonthTotal)} />
        <StatCard label="Average per month" value={formatCurrency(months.length ? total / months.length : 0)} />
        <StatCard label="Depreciating assets" value={perAsset.length} to="/assets" />
      </StatGrid>
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly depreciation by asset class"
          table={{ rows: monthly, columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...series.map((s) => ({ header: s.label, value: (r: Record<string, number | string>) => formatCurrency(Number(r[s.key] ?? 0)), align: 'right' as const }))] }}
          footer={<ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
        >
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ left: 4, right: 8, top: 4 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={monthLabel} minTickGap={12} />
              <YAxis {...axisProps} tickFormatter={currencyTick} width={56} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} stroke="var(--card)" strokeWidth={1} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Section title="By department">
          <ul className="space-y-2 text-sm">
            {byDepartment.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3">
                <span>{d.name}</span>
                <Money value={d.value} />
              </li>
            ))}
            {!byDepartment.length ? <li className="text-muted-foreground">No depreciation in this period.</li> : null}
          </ul>
        </Section>
      </div>
      <DataTable caption="Depreciation by asset" data={perAsset} columns={columns} getRowId={(r) => r.id} exportName="depreciation-by-asset" initialSort={{ id: 'total', desc: true }} />
      <SimulatedNotice className="mt-4">Illustrative book depreciation computed in the browser. No journals are posted.</SimulatedNotice>
    </>
  )
}
