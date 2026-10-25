import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { ProgressBar } from '@/components/data-display/DetailList'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { SERIES, axisProps, gridProps } from '@/components/charts/chartTheme'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups } from '@/hooks/useData'
import { percentOf } from '@/lib/calculations/money'
import { presetRange, todayISO, type DatePreset } from '@/lib/dates'
import { formatNumber, formatPercent } from '@/lib/formatting'
import { utilisationByPerson, type PersonUtilisation } from '../lib/utilisation'

const TARGET = 75

interface DeptRow {
  id: string
  name: string
  people: number
  capacity: number
  hours: number
  billableHours: number
}

export default function UtilisationPage() {
  const employees = useCollection('employees')
  const timesheets = useCollection('timesheets')
  const lookups = useLookups()
  const [preset, setPreset] = useState<DatePreset>('last_3_months')
  const [deliveryOnly, setDeliveryOnly] = useState(true)
  const range = presetRange(preset)
  const from = range.from!
  const today = todayISO()
  const to = range.to! > today ? today : range.to!

  const people = useMemo(
    () => utilisationByPerson(employees.filter((e) => !deliveryOnly || e.hourlyBillRate > 0), timesheets, from, to).filter((p) => p.capacity > 0),
    [employees, timesheets, from, to, deliveryOnly],
  )
  const depts = useMemo<DeptRow[]>(() => {
    const m = new Map<string, DeptRow>()
    for (const p of people) {
      const id = p.employee.departmentId
      const d = m.get(id) ?? { id, name: lookups.master(id), people: 0, capacity: 0, hours: 0, billableHours: 0 }
      d.people++
      d.capacity += p.capacity
      d.hours += p.hours
      d.billableHours += p.billableHours
      m.set(id, d)
    }
    return [...m.values()]
  }, [people, lookups])

  const capacity = people.reduce((s, p) => s + p.capacity, 0)
  const hours = people.reduce((s, p) => s + p.hours, 0)
  const billable = people.reduce((s, p) => s + p.billableHours, 0)
  const chart = [...people].sort((a, b) => (b.utilisationPercent ?? 0) - (a.utilisationPercent ?? 0)).map((p) => ({ name: p.employee.name.split(' ')[0], full: p.employee.name, utilisation: p.utilisationPercent ?? 0, billable: p.billableUtilisationPercent ?? 0 }))

  const columns: DataColumn<PersonUtilisation>[] = [
    { id: 'name', header: 'Person', accessor: (r) => r.employee.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.employee.name}</div><div className="text-muted-foreground text-xs">{lookups.master(r.employee.roleId)}</div></div> },
    { id: 'dept', header: 'Department', accessor: (r) => lookups.master(r.employee.departmentId) },
    { id: 'type', header: 'Type', accessor: (r) => (r.employee.employmentType === 'contractor' ? 'Contractor' : 'Employee'), defaultHidden: true },
    { id: 'capacity', header: 'Capacity (h)', accessor: (r) => r.capacity, align: 'right', cell: (r) => formatNumber(Math.round(r.capacity)) },
    { id: 'hours', header: 'Logged (h)', accessor: (r) => r.hours, align: 'right', cell: (r) => formatNumber(r.hours) },
    { id: 'billable', header: 'Billable (h)', accessor: (r) => r.billableHours, align: 'right', cell: (r) => formatNumber(r.billableHours) },
    { id: 'util', header: 'Utilisation', accessor: (r) => r.utilisationPercent ?? undefined, cell: (r) => <ProgressBar value={r.hours} max={r.capacity} label={`${r.employee.name} utilisation`} tone="primary" className="min-w-28" /> },
    { id: 'billUtil', header: 'Billable utilisation', accessor: (r) => r.billableUtilisationPercent ?? undefined, align: 'right', cell: (r) => <span className={(r.billableUtilisationPercent ?? 0) < 50 ? 'text-muted-foreground' : 'font-medium'}>{formatPercent(r.billableUtilisationPercent)}</span> },
  ]
  const deptColumns: DataColumn<DeptRow>[] = [
    { id: 'name', header: 'Department', accessor: (r) => r.name, alwaysVisible: true },
    { id: 'people', header: 'People', accessor: (r) => r.people, align: 'right' },
    { id: 'capacity', header: 'Capacity (h)', accessor: (r) => r.capacity, align: 'right', cell: (r) => formatNumber(Math.round(r.capacity)) },
    { id: 'hours', header: 'Logged (h)', accessor: (r) => r.hours, align: 'right', cell: (r) => formatNumber(r.hours) },
    { id: 'util', header: 'Utilisation', accessor: (r) => percentOf(r.hours, r.capacity) ?? undefined, align: 'right', cell: (r) => formatPercent(percentOf(r.hours, r.capacity)) },
    { id: 'billUtil', header: 'Billable utilisation', accessor: (r) => percentOf(r.billableHours, r.capacity) ?? undefined, align: 'right', cell: (r) => formatPercent(percentOf(r.billableHours, r.capacity)) },
  ]

  return (
    <>
      <PageHeader
        title="Resource utilisation"
        description="Logged (submitted and approved) hours compared with weekly capacity, pro-rated for start dates."
        actions={
          <>
            <div className="flex items-center gap-2">
              <Switch id="delivery-only" checked={deliveryOnly} onCheckedChange={setDeliveryOnly} />
              <Label htmlFor="delivery-only" className="text-sm">Billable roles only</Label>
            </div>
            <DateRangeSelect value={preset} onChange={setPreset} presets={['this_month', 'last_month', 'last_3_months', 'last_6_months', 'last_12_months', 'ytd']} />
          </>
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Utilisation" term="Utilisation" value={formatPercent(percentOf(hours, capacity))} hint={`Target ${TARGET}%`} />
        <StatCard label="Billable utilisation" value={formatPercent(percentOf(billable, capacity))} hint={`${formatNumber(billable)} billable hours`} />
        <StatCard label="Capacity" value={`${formatNumber(Math.round(capacity))} h`} hint={`${people.length} people in scope`} />
        <StatCard label="Below 50% utilised" value={people.filter((p) => (p.utilisationPercent ?? 0) < 50).length} hint="Available for new work" />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="Utilisation by person"
        description={`Dashed line shows the ${TARGET}% utilisation target`}
        height={300}
        table={{
          rows: chart,
          columns: [
            { header: 'Person', value: (r) => r.full },
            { header: 'Utilisation', value: (r) => formatPercent(r.utilisation), align: 'right' },
            { header: 'Billable', value: (r) => formatPercent(r.billable), align: 'right' },
          ],
        }}
      >
        <div className="flex h-full flex-col">
          <ChartLegend items={[{ label: 'Utilisation', color: SERIES[0] }, { label: 'Billable utilisation', color: SERIES[1] }, { label: `${TARGET}% target`, color: 'var(--muted-foreground)', dashed: true }]} />
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} interval={0} angle={chart.length > 10 ? -35 : 0} textAnchor={chart.length > 10 ? 'end' : 'middle'} height={chart.length > 10 ? 50 : 30} />
              <YAxis tickFormatter={(v: number) => `${v}%`} width={44} {...axisProps} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} />
              <Tooltip content={<ChartTooltip format="percent" />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <ReferenceLine y={TARGET} stroke="var(--muted-foreground)" strokeDasharray="5 4" />
              <Bar dataKey="utilisation" name="Utilisation" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="billable" name="Billable utilisation" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <div className="space-y-6">
        <DataTable caption="Utilisation by person" data={people} columns={columns} getRowId={(r) => r.employee.id} exportName="utilisation-by-person" initialSort={{ id: 'util', desc: true }} />
        <DataTable caption="Utilisation by department" data={depts} columns={deptColumns} getRowId={(r) => r.id} exportName="utilisation-by-department" initialSort={{ id: 'util', desc: true }} pageSize={10} />
      </div>
      <SimulatedNotice className="mt-4">Capacity assumes each person’s contracted weekly hours with no leave or public holidays — an illustrative simplification.</SimulatedNotice>
    </>
  )
}
