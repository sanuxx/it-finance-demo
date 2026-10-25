import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { EstimateTag, SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useLookups } from '@/hooks/useData'
import { add } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { formatCurrency } from '@/lib/formatting'
import { contractRecognition, deferredOf, wipOf, type ContractRecognition } from '../lib/recognition'

export default function WorkInProgressPage() {
  const db = useDbSlice('contracts', 'projects', 'revenueSchedules', 'projectCosts', 'timesheets', 'employees', 'expenses', 'supplierBills', 'cloudCosts', 'aiUsage', 'invoices', 'payments', 'creditNotes')
  const lookups = useLookups()
  const rows = useMemo(() => contractRecognition(db, todayISO()).filter((r) => r.contract.status !== 'terminated'), [db])
  const totals = useMemo(
    () => ({
      wip: rows.reduce((s, r) => add(s, wipOf(r)), 0),
      deferred: rows.reduce((s, r) => add(s, deferredOf(r)), 0),
      wipCount: rows.filter((r) => wipOf(r) > 0).length,
      deferredCount: rows.filter((r) => deferredOf(r) > 0).length,
    }),
    [rows],
  )
  const chart = rows
    .filter((r) => Math.abs(r.difference) > 0)
    .sort((a, b) => b.difference - a.difference)
    .map((r) => ({ name: r.contract.projectId ? lookups.projectCode(r.contract.projectId) : r.contract.number, wip: wipOf(r), deferred: -deferredOf(r) }))

  const columns: DataColumn<ContractRecognition>[] = [
    { id: 'contract', header: 'Contract', accessor: (r) => r.contract.title, cell: (r) => <div><div className="font-medium">{r.contract.title}</div><div className="text-muted-foreground text-xs">{lookups.customer(r.contract.customerId)}</div></div> },
    { id: 'project', header: 'Project', accessor: (r) => (r.contract.projectId ? lookups.projectCode(r.contract.projectId) : ''), cell: (r) => (r.contract.projectId ? <Link to={`/projects/${r.contract.projectId}`} className="text-primary hover:underline">{lookups.projectCode(r.contract.projectId)}</Link> : '—') },
    { id: 'recognised', header: 'Recognised (est.)', accessor: (r) => r.recognised, align: 'right', cell: (r) => <Money value={r.recognised} /> },
    { id: 'invoiced', header: 'Invoiced (net)', accessor: (r) => r.invoiced, align: 'right', cell: (r) => <Money value={r.invoiced} /> },
    { id: 'wip', header: 'WIP (unbilled)', accessor: (r) => wipOf(r), align: 'right', cell: (r) => (wipOf(r) > 0 ? <Money value={wipOf(r)} className="font-medium" /> : <span className="text-muted-foreground">—</span>) },
    { id: 'deferred', header: 'Deferred revenue', accessor: (r) => deferredOf(r), align: 'right', cell: (r) => (deferredOf(r) > 0 ? <Money value={deferredOf(r)} /> : <span className="text-muted-foreground">—</span>) },
    { id: 'status', header: 'Status', accessor: (r) => r.contract.status, cell: (r) => <StatusBadge status={r.contract.status} /> },
  ]

  return (
    <>
      <PageHeader title="Work in progress" description="Unbilled work (recognised but not yet invoiced) and deferred revenue (invoiced ahead of delivery)." meta={<EstimateTag />} />
      <StatGrid className="mb-6">
        <StatCard label="Unbilled WIP" term="WIP" value={formatCurrency(totals.wip)} hint={`${totals.wipCount} contract(s)`} estimate to="/sales/billing-schedules" />
        <StatCard label="Deferred revenue" value={formatCurrency(totals.deferred)} hint={`${totals.deferredCount} contract(s) billed ahead`} estimate />
        <StatCard label="Net position" value={formatCurrency(totals.wip - totals.deferred)} hint="WIP less deferred" />
        <StatCard label="Contracts reviewed" value={rows.length} to="/sales/revenue-recognition" />
      </StatGrid>
      <ChartCard
        title="WIP and deferred revenue by contract"
        description="Above zero: work done but not billed. Below zero: billed in advance."
        className="mb-6"
        table={{ rows: chart, columns: [{ header: 'Contract', value: (r) => r.name }, { header: 'WIP', value: (r) => formatCurrency(r.wip), align: 'right' }, { header: 'Deferred', value: (r) => formatCurrency(-r.deferred), align: 'right' }] }}
      >
        <ChartLegend items={[{ label: 'Unbilled WIP', color: seriesColor(0) }, { label: 'Deferred revenue', color: seriesColor(1) }]} />
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chart} margin={{ left: 8, right: 8, top: 8 }} stackOffset="sign">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="wip" name="Unbilled WIP" stackId="s" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar dataKey="deferred" name="Deferred revenue" stackId="s" fill={seriesColor(1)} radius={[0, 0, 4, 4]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable caption="Work in progress by contract" data={rows} columns={columns} getRowId={(r) => r.contract.id} exportName="work-in-progress" initialSort={{ id: 'wip', desc: true }} />
      <SimulatedNotice className="mt-4">Estimates use the same illustrative recognition rules as the Revenue recognition screen. They are not audited figures.</SimulatedNotice>
    </>
  )
}
