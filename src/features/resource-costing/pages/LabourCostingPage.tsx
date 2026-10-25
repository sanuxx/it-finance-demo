import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { divide, multiply, percentOf, round2, sum } from '@/lib/calculations/money'
import { presetRange, monthsBetween, type DatePreset } from '@/lib/dates'
import { formatCompactCurrency, formatCurrency, formatMonth, formatNumber, formatPercent } from '@/lib/formatting'
import { countableTimesheets } from '../lib/utilisation'

interface Agg {
  key: string
  label: string
  sub?: string
  hours: number
  billableHours: number
  cost: number
  billableCost: number
}

function aggregate(rows: { key: string; label: string; sub?: string; hours: number; billable: boolean; cost: number }[]): Agg[] {
  const m = new Map<string, Agg>()
  for (const r of rows) {
    const a = m.get(r.key) ?? { key: r.key, label: r.label, sub: r.sub, hours: 0, billableHours: 0, cost: 0, billableCost: 0 }
    a.hours += r.hours
    a.cost = round2(a.cost + r.cost)
    if (r.billable) {
      a.billableHours += r.hours
      a.billableCost = round2(a.billableCost + r.cost)
    }
    m.set(r.key, a)
  }
  return [...m.values()]
}

export default function LabourCostingPage() {
  const timesheets = useCollection('timesheets')
  const employees = useCollection('employees')
  const lookups = useLookups()
  const sensitive = usePermission('costs.sensitive')
  const [preset, setPreset] = useState<DatePreset>('last_6_months')
  const range = presetRange(preset)

  const lines = useMemo(() => {
    const emp = new Map(employees.map((e) => [e.id, e]))
    return countableTimesheets(timesheets, range.from, range.to).map((t) => {
      const e = emp.get(t.employeeId)
      return { t, dept: e?.departmentId, cost: multiply(t.hours, e?.hourlyCostRate ?? 0) }
    })
  }, [timesheets, employees, range.from, range.to])

  const byProject = aggregate(lines.map((l) => ({ key: l.t.projectId, label: lookups.project(l.t.projectId), sub: lookups.projectCode(l.t.projectId), hours: l.t.hours, billable: l.t.billable, cost: l.cost })))
  const byPerson = aggregate(lines.map((l) => ({ key: l.t.employeeId, label: lookups.employee(l.t.employeeId), sub: lookups.master(l.dept), hours: l.t.hours, billable: l.t.billable, cost: l.cost })))
  const byDept = aggregate(lines.map((l) => ({ key: l.dept ?? 'none', label: lookups.master(l.dept), hours: l.t.hours, billable: l.t.billable, cost: l.cost })))

  const monthKeys = useMemo(() => {
    const dates = lines.map((l) => l.t.date).sort()
    const from = range.from ?? dates[0]
    const to = range.to ?? dates.at(-1)
    return from && to ? monthsBetween(from, to) : []
  }, [lines, range.from, range.to])
  const monthly = monthKeys.map((m) => {
    const inMonth = lines.filter((l) => l.t.date.startsWith(m))
    return { month: m, billable: sum(inMonth.filter((l) => l.t.billable), (l) => l.cost), nonBillable: sum(inMonth.filter((l) => !l.t.billable), (l) => l.cost) }
  })

  const totalCost = sum(lines, (l) => l.cost)
  const totalHours = lines.reduce((s, l) => s + l.t.hours, 0)
  const billableCost = sum(lines.filter((l) => l.t.billable), (l) => l.cost)

  const columns = (first: string): DataColumn<Agg>[] => [
    { id: 'label', header: first, accessor: (r) => r.label, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.label}</div>{r.sub ? <div className="text-muted-foreground text-xs">{r.sub}</div> : null}</div> },
    { id: 'hours', header: 'Hours', accessor: (r) => r.hours, align: 'right', cell: (r) => formatNumber(r.hours) },
    { id: 'billableHours', header: 'Billable hours', accessor: (r) => r.billableHours, align: 'right', cell: (r) => formatNumber(r.billableHours) },
    { id: 'billablePct', header: 'Billable %', accessor: (r) => percentOf(r.billableHours, r.hours) ?? undefined, align: 'right', cell: (r) => formatPercent(percentOf(r.billableHours, r.hours)) },
    { id: 'cost', header: 'Labour cost', accessor: (r) => r.cost, align: 'right', cell: (r) => <Money value={r.cost} /> },
    { id: 'rate', header: 'Avg cost / hour', accessor: (r) => divide(r.cost, r.hours), align: 'right', cell: (r) => <Money value={divide(r.cost, r.hours)} /> },
    { id: 'nonBillable', header: 'Non-billable cost', accessor: (r) => round2(r.cost - r.billableCost), align: 'right', cell: (r) => <Money value={round2(r.cost - r.billableCost)} /> },
  ]

  if (!sensitive) {
    return (
      <>
        <PageHeader title="Labour costing" />
        <SimulatedNotice>Labour cost rates are restricted for your demo role (simulated permission).</SimulatedNotice>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Labour costing"
        description="Labour cost calculated from submitted and approved timesheet hours × each person’s fictional hourly cost rate."
        actions={<DateRangeSelect value={preset} onChange={setPreset} presets={['this_month', 'last_month', 'last_3_months', 'last_6_months', 'last_12_months', 'ytd', 'all']} />}
      />
      <StatGrid className="mb-6">
        <StatCard label="Labour cost" value={formatCompactCurrency(totalCost)} hint={`${formatNumber(totalHours)} hours`} />
        <StatCard label="Billable labour" value={formatCompactCurrency(billableCost)} hint={`${formatPercent(percentOf(billableCost, totalCost))} of labour cost`} />
        <StatCard label="Non-billable labour" value={formatCompactCurrency(round2(totalCost - billableCost))} hint="Internal work, meetings, R&D" />
        <StatCard label="Avg cost per hour" value={formatCurrency(divide(totalCost, totalHours))} hint={`${byPerson.length} people logged time`} />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="Labour cost by month"
        description="Split by billable and non-billable hours"
        height={260}
        table={{
          rows: monthly,
          columns: [
            { header: 'Month', value: (r) => formatMonth(r.month) },
            { header: 'Billable', value: (r) => formatCurrency(r.billable), align: 'right' },
            { header: 'Non-billable', value: (r) => formatCurrency(r.nonBillable), align: 'right' },
          ],
        }}
      >
        <div className="flex h-full flex-col">
          <ChartLegend items={[{ label: 'Billable', color: SERIES[0] }, { label: 'Non-billable', color: SERIES[1] }]} />
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <Bar dataKey="billable" name="Billable" stackId="a" fill={SERIES[0]} maxBarSize={40} stroke="var(--card)" strokeWidth={1} />
              <Bar dataKey="nonBillable" name="Non-billable" stackId="a" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={40} stroke="var(--card)" strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <Tabs defaultValue="project">
        <TabsList className="mb-4">
          <TabsTrigger value="project">By project</TabsTrigger>
          <TabsTrigger value="person">By person</TabsTrigger>
          <TabsTrigger value="department">By department</TabsTrigger>
        </TabsList>
        <TabsContent value="project">
          <DataTable caption="Labour cost by project" data={byProject} columns={columns('Project')} getRowId={(r) => r.key} exportName="labour-by-project" initialSort={{ id: 'cost', desc: true }} />
        </TabsContent>
        <TabsContent value="person">
          <DataTable caption="Labour cost by person" data={byPerson} columns={columns('Person')} getRowId={(r) => r.key} exportName="labour-by-person" initialSort={{ id: 'cost', desc: true }} />
        </TabsContent>
        <TabsContent value="department">
          <DataTable caption="Labour cost by department" data={byDept} columns={columns('Department')} getRowId={(r) => r.key} exportName="labour-by-department" initialSort={{ id: 'cost', desc: true }} />
        </TabsContent>
      </Tabs>
      <SimulatedNotice className="mt-4">This is project labour allocation. Company personnel cost in the P&L uses each person’s full monthly cost, so unallocated time appears as overhead there.</SimulatedNotice>
    </>
  )
}
