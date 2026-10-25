import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { Term } from '@/components/data-display/Term'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { EstimateTag, SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useLookups } from '@/hooks/useData'
import { add, subtract } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { formatCurrency } from '@/lib/formatting'
import { contractRecognition, type ContractRecognition } from '../lib/recognition'

export default function RevenueRecognitionPage() {
  const db = useDbSlice('contracts', 'projects', 'revenueSchedules', 'projectCosts', 'timesheets', 'employees', 'expenses', 'supplierBills', 'cloudCosts', 'aiUsage', 'invoices', 'payments', 'creditNotes')
  const lookups = useLookups()
  const rows = useMemo(() => contractRecognition(db, todayISO()), [db])
  const totals = useMemo(() => {
    const recognised = rows.reduce((s, r) => add(s, r.recognised), 0)
    const invoiced = rows.reduce((s, r) => add(s, r.invoiced), 0)
    return { recognised, invoiced, diff: subtract(recognised, invoiced), value: rows.reduce((s, r) => add(s, r.contract.value), 0) }
  }, [rows])
  const chart = [...rows].sort((a, b) => b.contract.value - a.contract.value).slice(0, 10).map((r) => ({ name: r.contract.number, recognised: r.recognised, invoiced: r.invoiced }))

  const columns: DataColumn<ContractRecognition>[] = [
    { id: 'contract', header: 'Contract', accessor: (r) => r.contract.number, cell: (r) => <div><div className="font-medium">{r.contract.title}</div><div className="text-muted-foreground text-xs">{r.contract.number} · {lookups.customer(r.contract.customerId)}</div></div> },
    { id: 'project', header: 'Project', accessor: (r) => (r.contract.projectId ? lookups.projectCode(r.contract.projectId) : ''), cell: (r) => (r.contract.projectId ? <Link to={`/projects/${r.contract.projectId}`} className="text-primary hover:underline">{lookups.projectCode(r.contract.projectId)}</Link> : '—') },
    { id: 'method', header: 'Method', accessor: (r) => r.method },
    { id: 'progress', header: 'Progress', accessor: (r) => r.percentComplete, cell: (r) => <ProgressBar value={r.percentComplete} tone="primary" label="Progress" className="w-28" /> },
    { id: 'value', header: 'Contract value', accessor: (r) => r.contract.value, align: 'right', cell: (r) => <Money value={r.contract.value} /> },
    { id: 'recognised', header: 'Recognised (est.)', accessor: (r) => r.recognised, align: 'right', cell: (r) => <Money value={r.recognised} /> },
    { id: 'invoiced', header: 'Invoiced (net)', accessor: (r) => r.invoiced, align: 'right', cell: (r) => <Money value={r.invoiced} /> },
    { id: 'diff', header: 'Unbilled / (deferred)', accessor: (r) => r.difference, align: 'right', cell: (r) => <Money value={r.difference} signed /> },
    { id: 'status', header: 'Status', accessor: (r) => r.contract.status, cell: (r) => <StatusBadge status={r.contract.status} /> },
  ]

  return (
    <>
      <PageHeader title="Revenue recognition" description="Compares revenue earned to date with revenue billed to date, contract by contract." meta={<EstimateTag />} />
      <SimulatedNotice className="mb-6">
        Illustrative only — not an IFRS 15 / ASC 606 assessment. Fixed-price and milestone contracts use % complete × contract value; time & materials uses invoiced amounts; retainers and subscriptions without a project are spread straight-line over the contract term.
      </SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Contract value" term="Contract value" value={formatCurrency(totals.value)} hint="Non-draft contracts" />
        <StatCard label="Recognised to date" term="Recognised revenue" value={formatCurrency(totals.recognised)} estimate />
        <StatCard label="Invoiced to date" term="Invoiced revenue" value={formatCurrency(totals.invoiced)} hint="Net of tax and credit notes" />
        <StatCard label="Net unbilled / (deferred)" term="WIP" value={formatCurrency(totals.diff)} to="/sales/wip" estimate />
      </StatGrid>
      <ChartCard
        title="Recognised vs invoiced — largest contracts"
        description="Top 10 by contract value"
        className="mb-6"
        table={{ rows: chart, columns: [{ header: 'Contract', value: (r) => r.name }, { header: 'Recognised (est.)', value: (r) => formatCurrency(r.recognised), align: 'right' }, { header: 'Invoiced', value: (r) => formatCurrency(r.invoiced), align: 'right' }] }}
      >
        <ChartLegend items={[{ label: 'Recognised (est.)', color: seriesColor(0) }, { label: 'Invoiced', color: seriesColor(1) }]} />
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chart} margin={{ left: 8, right: 8, top: 8 }} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="recognised" name="Recognised (est.)" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="invoiced" name="Invoiced" fill={seriesColor(1)} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable caption="Revenue recognition by contract" data={rows} columns={columns} getRowId={(r) => r.contract.id} exportName="revenue-recognition" initialSort={{ id: 'value', desc: true }} />
      <p className="text-muted-foreground mt-3 text-xs">
        <Term term="Recognised revenue" /> vs <Term term="Invoiced revenue" /> — positive differences are unbilled work in progress; negative differences are billed in advance (deferred).
      </p>
    </>
  )
}
