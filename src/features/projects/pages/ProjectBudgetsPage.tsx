import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Project } from '@/domain'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { Button } from '@/components/ui/button'
import { useCollection, useProjectFinancials } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { add, percentOf, subtract, sum } from '@/lib/calculations/money'
import type { ProjectFinancials } from '@/lib/calculations/projects'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/formatting'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import { PROJECT_STATUS_LABELS, toOptions } from '../lib/labels'

type Row = Project & { fin: ProjectFinancials }

export default function ProjectBudgetsPage() {
  const projects = useCollection('projects')
  const fins = useProjectFinancials()
  const canEdit = usePermission('projects.edit')
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Project | undefined>()

  const rows = useMemo<Row[]>(() => projects.map((p) => ({ ...p, fin: fins.get(p.id)! })), [projects, fins])
  const open = rows.filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
  const totals = {
    budget: sum(open, (r) => r.budget),
    actual: sum(open, (r) => r.fin.actualCost),
    committed: sum(open, (r) => r.fin.committedCost),
    forecast: sum(open, (r) => r.fin.forecastCost),
  }
  const chart = open
    .map((r) => ({ name: r.code, Budget: r.budget, Actual: r.fin.actualCost, Committed: r.fin.committedCost, Forecast: r.fin.forecastCost }))
    .sort((a, b) => b.Budget - a.Budget)

  const columns: DataColumn<Row>[] = [
    { id: 'project', header: 'Project', accessor: (r) => `${r.code} ${r.name}`, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.code}</div></div> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'budget', header: 'Budget', accessor: (r) => r.budget, align: 'right', cell: (r) => <Money value={r.budget} /> },
    { id: 'actual', header: 'Actual', accessor: (r) => r.fin.actualCost, align: 'right', cell: (r) => <Money value={r.fin.actualCost} /> },
    { id: 'committed', header: 'Committed', accessor: (r) => r.fin.committedCost, align: 'right', cell: (r) => <Money value={r.fin.committedCost} /> },
    { id: 'remaining', header: 'Remaining', accessor: (r) => subtract(r.budget, add(r.fin.actualCost, r.fin.committedCost)), align: 'right', cell: (r) => <Money value={subtract(r.budget, add(r.fin.actualCost, r.fin.committedCost))} signed /> },
    { id: 'used', header: 'Used', accessor: (r) => r.fin.budgetConsumptionPercent ?? 0, cell: (r) => <ProgressBar value={r.fin.actualCost} max={r.budget} label={`${r.code} budget used`} className="min-w-28" /> },
    { id: 'complete', header: '% complete', accessor: (r) => r.percentComplete, align: 'right', cell: (r) => `${r.percentComplete}%` },
    { id: 'forecast', header: 'Forecast (est.)', accessor: (r) => r.fin.forecastCost, align: 'right', cell: (r) => <Money value={r.fin.forecastCost} /> },
    { id: 'variance', header: 'Forecast variance', accessor: (r) => subtract(r.budget, r.fin.forecastCost), align: 'right', cell: (r) => <Money value={subtract(r.budget, r.fin.forecastCost)} signed /> },
    { id: 'health', header: 'Health', accessor: (r) => r.fin.health, cell: (r) => <StatusBadge status={r.fin.health} /> },
    {
      id: 'edit',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      cell: (r) =>
        canEdit ? (
          <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setEditing(r) }}>
            Edit budget
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Project budgets" description="Approved cost budgets compared with actual, committed and illustrative forecast costs for each project." />
      <StatGrid className="mb-6">
        <StatCard label="Open project budgets" value={formatCompactCurrency(totals.budget)} hint={`${open.length} open projects`} />
        <StatCard label="Actual cost" term="Budget utilisation" value={formatCompactCurrency(totals.actual)} hint={`${formatPercent(percentOf(totals.actual, totals.budget))} of budget`} />
        <StatCard label="Committed" term="Committed cost" value={formatCompactCurrency(totals.committed)} hint="Ordered but not yet incurred" />
        <StatCard label="Forecast cost" term="Estimate at completion" value={formatCompactCurrency(totals.forecast)} hint={`Variance ${formatCompactCurrency(subtract(totals.budget, totals.forecast))}`} estimate />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="Budget, actual and forecast by project"
        description="Open projects only. Forecast is an illustrative estimate at completion."
        height={300}
        table={{
          rows: chart,
          columns: [
            { header: 'Project', value: (r) => r.name },
            { header: 'Budget', value: (r) => formatCurrency(r.Budget), align: 'right' },
            { header: 'Actual', value: (r) => formatCurrency(r.Actual), align: 'right' },
            { header: 'Committed', value: (r) => formatCurrency(r.Committed), align: 'right' },
            { header: 'Forecast', value: (r) => formatCurrency(r.Forecast), align: 'right' },
          ],
        }}
      >
        <div className="flex h-full flex-col">
          <ChartLegend items={[{ label: 'Budget', color: SERIES[0] }, { label: 'Actual', color: SERIES[1] }, { label: 'Committed', color: SERIES[2] }, { label: 'Forecast', color: SERIES[3] }]} />
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <Bar dataKey="Budget" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Actual" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Committed" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Forecast" fill={SERIES[3]} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <DataTable
        caption="Project budgets"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="project-budgets"
        initialSort={{ id: 'budget', desc: true }}
        onRowClick={(r) => navigate(`/projects/${r.id}?tab=budget`)}
        filters={[{ id: 'status', label: 'Statuses', options: toOptions(PROJECT_STATUS_LABELS), predicate: (r, v) => r.status === v }]}
      />
      <SimulatedNotice className="mt-4">Budget utilisation = actual incurred cost ÷ approved cost budget. Committed costs are excluded from utilisation but included in remaining budget and forecasts.</SimulatedNotice>
      <ProjectFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} project={editing} />
    </>
  )
}
