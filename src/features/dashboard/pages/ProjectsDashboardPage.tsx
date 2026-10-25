import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups, useProjectFinancials } from '@/hooks/useData'
import { PROJECT_HEALTH_LABEL, type ProjectFinancials } from '@/lib/calculations/projects'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatPercent } from '@/lib/formatting'
import type { Project } from '@/domain'

interface Row {
  project: Project
  fin: ProjectFinancials
}

export default function ProjectsDashboardPage() {
  const projects = useCollection('projects')
  const fins = useProjectFinancials()
  const l = useLookups()
  const navigate = useNavigate()

  const rows = useMemo<Row[]>(() => projects.flatMap((p) => (fins.get(p.id) ? [{ project: p, fin: fins.get(p.id)! }] : [])), [projects, fins])
  const live = rows.filter((r) => r.project.status === 'active' || r.project.status === 'on_hold')
  const counts = {
    on_track: live.filter((r) => r.fin.health === 'on_track').length,
    at_risk: live.filter((r) => r.fin.health === 'at_risk').length,
    over_budget: live.filter((r) => r.fin.health === 'over_budget').length,
  }
  const external = rows.filter((r) => !r.project.isInternal && r.project.status !== 'cancelled')
  const totalContract = sum(external, (r) => r.project.contractValue)
  const totalProfit = sum(external, (r) => r.fin.estimatedProfit)
  const chartData = live.map((r) => ({ code: r.project.code, name: r.project.name, budget: r.fin.budget, actual: r.fin.actualCost, committed: r.fin.committedCost, forecast: r.fin.forecastCost }))
  const attention = live
    .filter((r) => r.fin.health === 'at_risk' || r.fin.health === 'over_budget')
    .sort((a, b) => (b.fin.budgetConsumptionPercent ?? 0) - (a.fin.budgetConsumptionPercent ?? 0))

  const columns: DataColumn<Row>[] = [
    {
      id: 'project',
      header: 'Project',
      alwaysVisible: true,
      accessor: (r) => r.project.name,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.project.name}</div>
          <div className="text-muted-foreground text-xs">
            {r.project.code} · {l.customer(r.project.customerId)}
          </div>
        </div>
      ),
    },
    { id: 'status', header: 'Status', accessor: (r) => r.project.status, cell: (r) => <StatusBadge status={r.project.status} /> },
    { id: 'health', header: 'Health', accessor: (r) => PROJECT_HEALTH_LABEL[r.fin.health], cell: (r) => <StatusBadge status={r.fin.health} /> },
    { id: 'contract', header: 'Contract value', accessor: (r) => r.project.contractValue, align: 'right', cell: (r) => (r.project.isInternal ? <span className="text-muted-foreground">Internal</span> : <Money value={r.project.contractValue} compact />) },
    { id: 'consumed', header: 'Budget used', accessor: (r) => r.fin.budgetConsumptionPercent ?? 0, cell: (r) => <ProgressBar value={r.fin.actualCost} max={r.fin.budget} label={`${r.project.name} budget used`} className="min-w-28" /> },
    { id: 'complete', header: '% complete', accessor: (r) => r.project.percentComplete, align: 'right', cell: (r) => `${r.project.percentComplete}%` },
    { id: 'profit', header: 'Est. profit', accessor: (r) => r.fin.estimatedProfit, align: 'right', cell: (r) => (r.project.isInternal ? '—' : <Money value={r.fin.estimatedProfit} compact signed />) },
    { id: 'margin', header: 'Est. margin', accessor: (r) => r.fin.estimatedMarginPercent ?? -999, align: 'right', cell: (r) => formatPercent(r.fin.estimatedMarginPercent), exportValue: (r) => r.fin.estimatedMarginPercent },
  ]

  return (
    <>
      <PageHeader title="Project financial overview" description="Health of the software delivery portfolio: cost against budget, forecast at completion and estimated direct-cost margin." />
      <StatGrid className="mb-6">
        <StatCard label="On track" value={counts.on_track} hint={`of ${live.length} active or on-hold projects`} to="/projects" />
        <StatCard label="At risk" value={<span className={counts.at_risk ? 'text-warning' : undefined}>{counts.at_risk}</span>} hint="Spend ahead of progress or forecast near budget" to="/projects/budgets" />
        <StatCard label="Over budget" value={<span className={counts.over_budget ? 'text-destructive' : undefined}>{counts.over_budget}</span>} hint="Forecast cost exceeds approved budget" to="/projects/budgets" />
        <StatCard
          label="Portfolio est. margin"
          term="Direct-cost margin"
          value={formatPercent(totalContract ? (totalProfit / totalContract) * 100 : null)}
          hint={`${formatCurrency(totalProfit, 'LKR', { compact: true })} on ${formatCurrency(totalContract, 'LKR', { compact: true })}`}
          estimate
          to="/projects/profitability"
        />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Budget, actual and forecast cost"
            description="Active and on-hold projects. Forecast is an illustrative estimate at completion. Click a project to open it."
            height={320}
            table={{
              rows: chartData,
              columns: [
                { header: 'Project', value: (r) => `${r.code} ${r.name}` },
                { header: 'Budget', value: (r) => formatCurrency(r.budget), align: 'right' },
                { header: 'Actual', value: (r) => formatCurrency(r.actual), align: 'right' },
                { header: 'Committed', value: (r) => formatCurrency(r.committed), align: 'right' },
                { header: 'Forecast', value: (r) => formatCurrency(r.forecast), align: 'right' },
              ],
            }}
          >
            <div className="flex h-full flex-col">
              <ChartLegend
                items={[
                  { label: 'Budget', color: seriesColor(0) },
                  { label: 'Actual', color: seriesColor(1) },
                  { label: 'Forecast (EAC)', color: seriesColor(2) },
                ]}
              />
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    barGap={2}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    onClick={(s) => {
                      const p = projects.find((x) => x.code === s?.activeLabel)
                      if (p) navigate(`/projects/${p.id}`)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="code" {...axisProps} />
                    <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                    <Tooltip content={<ChartTooltip labelFormatter={(lbl) => chartData.find((c) => c.code === lbl)?.name ?? lbl} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                    <Bar dataKey="budget" name="Budget" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="actual" name="Actual" fill={seriesColor(1)} radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="forecast" name="Forecast (EAC)" fill={seriesColor(2)} radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ChartCard>
        </div>
        <Section title="Needs attention" description="At-risk and over-budget projects" className="h-full">
          {attention.length ? (
            <ul className="-my-2 divide-y">
              {attention.map((r) => (
                <li key={r.project.id}>
                  <Link to={`/projects/${r.project.id}`} className="hover:bg-accent/40 -mx-2 block space-y-1.5 rounded-md px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={r.fin.health === 'over_budget' ? 'text-destructive size-4' : 'text-warning size-4'} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.project.name}</span>
                      <StatusBadge status={r.fin.health} />
                    </div>
                    <ProgressBar value={r.fin.actualCost} max={r.fin.budget} label="Budget used" />
                    <div className="text-muted-foreground text-xs">
                      {r.project.percentComplete}% complete · forecast {formatCurrency(r.fin.forecastCost, 'LKR', { compact: true })} vs budget {formatCurrency(r.fin.budget, 'LKR', { compact: true })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No projects need attention.</p>
          )}
        </Section>
      </div>
      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold">Margin ranking</h2>
        <SimulatedNotice>
          Estimated margin is direct-cost margin (contract value less forecast direct cost) before allocated company overhead. Invoiced revenue differs from recognised revenue — see Revenue recognition.
        </SimulatedNotice>
        <DataTable caption="Project margin ranking" data={rows} columns={columns} getRowId={(r) => r.project.id} initialSort={{ id: 'margin', desc: true }} onRowClick={(r) => navigate(`/projects/${r.project.id}`)} exportName="project-margins" pageSize={10} />
      </div>
    </>
  )
}
