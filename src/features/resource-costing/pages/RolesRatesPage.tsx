import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useMasterList } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { divide, percentOf, sum } from '@/lib/calculations/money'
import { formatCurrency, formatPercent } from '@/lib/formatting'

interface RoleRow {
  id: string
  code: string
  name: string
  people: number
  billablePeople: number
  avgMonthly: number
  avgCostRate: number
  avgBillRate: number
  marginPercent: number | null
}

export default function RolesRatesPage() {
  const roles = useMasterList('employeeRoles', true)
  const employees = useCollection('employees')
  const sensitive = usePermission('costs.sensitive')
  const canConfig = usePermission('config.edit')

  const rows = useMemo<RoleRow[]>(
    () =>
      roles.map((r) => {
        const people = employees.filter((e) => e.active && e.roleId === r.id)
        const billable = people.filter((e) => e.hourlyBillRate > 0)
        const avgCostRate = divide(sum(people, (e) => e.hourlyCostRate), people.length)
        const avgBillRate = divide(sum(billable, (e) => e.hourlyBillRate), billable.length)
        const billableCost = divide(sum(billable, (e) => e.hourlyCostRate), billable.length)
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          people: people.length,
          billablePeople: billable.length,
          avgMonthly: divide(sum(people, (e) => e.monthlyCost), people.length),
          avgCostRate,
          avgBillRate,
          marginPercent: billable.length ? percentOf(avgBillRate - billableCost, avgBillRate) : null,
        }
      }),
    [roles, employees],
  )

  if (!sensitive) {
    return (
      <>
        <PageHeader title="Roles & rates" />
        <EmptyState title="Rates are restricted" description="Cost and bill rates are visible to finance and director roles in this simulated permission model." />
      </>
    )
  }

  const staffed = rows.filter((r) => r.people > 0)
  const chart = staffed.filter((r) => r.avgBillRate > 0).sort((a, b) => b.avgBillRate - a.avgBillRate).map((r) => ({ name: r.code, full: r.name, cost: r.avgCostRate, bill: r.avgBillRate }))
  const billableRows = staffed.filter((r) => r.marginPercent !== null)

  const columns: DataColumn<RoleRow>[] = [
    { id: 'name', header: 'Role', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.code}</div></div> },
    { id: 'people', header: 'People', accessor: (r) => r.people, align: 'right' },
    { id: 'monthly', header: 'Avg monthly cost', accessor: (r) => r.avgMonthly, align: 'right', cell: (r) => (r.people ? <Money value={r.avgMonthly} /> : '—') },
    { id: 'cost', header: 'Avg cost / hour', accessor: (r) => r.avgCostRate, align: 'right', cell: (r) => (r.people ? <Money value={r.avgCostRate} /> : '—') },
    { id: 'bill', header: 'Avg bill / hour', accessor: (r) => r.avgBillRate, align: 'right', cell: (r) => (r.billablePeople ? <Money value={r.avgBillRate} /> : <span className="text-muted-foreground">Non-billable</span>) },
    { id: 'margin', header: 'Rate margin', accessor: (r) => r.marginPercent ?? undefined, align: 'right', cell: (r) => formatPercent(r.marginPercent) },
  ]

  return (
    <>
      <PageHeader
        title="Roles & rates"
        description="Average fictional cost and bill rates per role, calculated from active cost profiles."
        actions={
          canConfig ? (
            <Button variant="outline" asChild>
              <Link to="/config/master-data/employeeRoles">
                <Settings2 /> Manage roles
              </Link>
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Roles" value={rows.length} hint={`${staffed.length} currently staffed`} />
        <StatCard label="Highest bill rate" value={chart[0] ? formatCurrency(chart[0].bill) : '—'} hint={chart[0]?.full} />
        <StatCard label="Avg rate margin" value={formatPercent(percentOf(sum(billableRows, (r) => r.avgBillRate - r.avgCostRate), sum(billableRows, (r) => r.avgBillRate)))} hint="Billable roles, unweighted" />
        <StatCard label="Non-billable roles" value={staffed.filter((r) => r.billablePeople === 0).length} hint="Finance, sales and similar" />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="Average cost vs bill rate by role"
        height={280}
        table={{
          rows: chart,
          columns: [
            { header: 'Role', value: (r) => r.full },
            { header: 'Cost / hour', value: (r) => formatCurrency(r.cost), align: 'right' },
            { header: 'Bill / hour', value: (r) => formatCurrency(r.bill), align: 'right' },
          ],
        }}
      >
        <div className="flex h-full flex-col">
          <ChartLegend items={[{ label: 'Cost / hour', color: SERIES[0] }, { label: 'Bill / hour', color: SERIES[1] }]} />
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <Bar dataKey="cost" name="Cost / hour" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="bill" name="Bill / hour" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <DataTable caption="Roles and rates" data={rows} columns={columns} getRowId={(r) => r.id} exportName="roles-and-rates" initialSort={{ id: 'bill', desc: true }} />
      <SimulatedNotice className="mt-4">Rate margin = (bill rate − cost rate) ÷ bill rate. Rates are illustrative and do not reflect any real salary data.</SimulatedNotice>
    </>
  )
}
