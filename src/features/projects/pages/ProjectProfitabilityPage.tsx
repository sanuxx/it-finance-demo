import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Project } from '@/domain'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { Term } from '@/components/data-display/Term'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartTheme'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups, useProjectFinancials } from '@/hooks/useData'
import { applyRate, percentOf, subtract, sum } from '@/lib/calculations/money'
import type { ProjectFinancials } from '@/lib/calculations/projects'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/formatting'
import { PROJECT_STATUS_LABELS, toOptions } from '../lib/labels'

type Row = Project & { fin: ProjectFinancials; client: string; overhead: number; netProfit: number; netMargin: number | null }

export default function ProjectProfitabilityPage() {
  const projects = useCollection('projects')
  const fins = useProjectFinancials()
  const lookups = useLookups()
  const navigate = useNavigate()
  const inputId = useId()
  const [overheadPct, setOverheadPct] = useState(12)
  const safePct = Number.isFinite(overheadPct) ? Math.min(Math.max(overheadPct, 0), 100) : 0

  const rows = useMemo<Row[]>(
    () =>
      projects
        .filter((p) => !p.isInternal)
        .map((p) => {
          const fin = fins.get(p.id)!
          // Illustrative overhead: a % of forecast direct cost.
          const overhead = applyRate(fin.forecastCost, safePct)
          const netProfit = subtract(fin.estimatedProfit, overhead)
          return { ...p, fin, client: lookups.customer(p.customerId), overhead, netProfit, netMargin: percentOf(netProfit, p.contractValue) }
        }),
    [projects, fins, lookups, safePct],
  )

  const ranking = [...rows].sort((a, b) => b.fin.estimatedProfit - a.fin.estimatedProfit).map((r) => ({ name: r.code, direct: r.fin.estimatedProfit, net: r.netProfit }))
  const totalValue = sum(rows, (r) => r.contractValue)
  const totalDirect = sum(rows, (r) => r.fin.estimatedProfit)
  const totalNet = sum(rows, (r) => r.netProfit)
  const losers = rows.filter((r) => r.netProfit < 0).length

  const columns: DataColumn<Row>[] = [
    { id: 'project', header: 'Project', accessor: (r) => `${r.code} ${r.name}`, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.code} · {r.client}</div></div> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'value', header: 'Contract value', accessor: (r) => r.contractValue, align: 'right', cell: (r) => <Money value={r.contractValue} /> },
    { id: 'recognised', header: 'Recognised revenue', accessor: (r) => r.fin.recognisedRevenue, align: 'right', cell: (r) => <Money value={r.fin.recognisedRevenue} />, defaultHidden: true },
    { id: 'forecast', header: 'Forecast cost', accessor: (r) => r.fin.forecastCost, align: 'right', cell: (r) => <Money value={r.fin.forecastCost} /> },
    { id: 'direct', header: 'Direct profit', accessor: (r) => r.fin.estimatedProfit, align: 'right', cell: (r) => <Money value={r.fin.estimatedProfit} signed /> },
    { id: 'directMargin', header: 'Direct margin', accessor: (r) => r.fin.estimatedMarginPercent ?? undefined, align: 'right', cell: (r) => formatPercent(r.fin.estimatedMarginPercent) },
    { id: 'overhead', header: `Overhead (${safePct}%)`, accessor: (r) => r.overhead, align: 'right', cell: (r) => <Money value={r.overhead} /> },
    { id: 'net', header: 'Profit after overhead', accessor: (r) => r.netProfit, align: 'right', cell: (r) => <Money value={r.netProfit} signed className="font-medium" /> },
    { id: 'netMargin', header: 'Net margin', accessor: (r) => r.netMargin ?? undefined, align: 'right', cell: (r) => <span className={(r.netMargin ?? 0) < 0 ? 'text-destructive font-medium' : ''}>{formatPercent(r.netMargin)}</span> },
  ]

  return (
    <>
      <PageHeader title="Project profitability" description="Estimated profit across client projects — first on direct costs, then after an illustrative overhead allocation you can adjust." />
      <Section className="mb-6" title="Overhead allocation" description="Applied as a percentage of each project’s forecast direct cost. Illustrative only.">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>Allocated overhead %</Label>
            <Input id={inputId} type="number" min={0} max={100} step={1} value={Number.isFinite(overheadPct) ? overheadPct : ''} onChange={(e) => setOverheadPct(e.target.value === '' ? 0 : Number(e.target.value))} className="tabular w-32" />
          </div>
          <input type="range" min={0} max={40} step={1} value={safePct} onChange={(e) => setOverheadPct(Number(e.target.value))} aria-label="Allocated overhead percentage" className="accent-primary w-64" />
          <p className="text-muted-foreground max-w-xl text-xs">
            <Term term="Direct-cost margin">Direct-cost margin</Term> excludes shared costs such as office, finance and sales. Allocating overhead shows whether each project still contributes after its share of those costs.
          </p>
        </div>
      </Section>
      <StatGrid className="mb-6">
        <StatCard label="Client contract value" term="Contract value" value={formatCompactCurrency(totalValue)} hint={`${rows.length} client projects`} />
        <StatCard label="Direct profit" term="Direct-cost margin" value={formatCompactCurrency(totalDirect)} hint={`Margin ${formatPercent(percentOf(totalDirect, totalValue))}`} estimate />
        <StatCard label="Profit after overhead" value={formatCompactCurrency(totalNet)} hint={`Margin ${formatPercent(percentOf(totalNet, totalValue))}`} estimate />
        <StatCard label="Loss-making after overhead" value={losers} hint={losers ? 'Review pricing or scope' : 'All projects contribute'} />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="Projects ranked by estimated profit"
        description={`Direct profit vs profit after ${safePct}% overhead`}
        height={300}
        table={{
          rows: ranking,
          columns: [
            { header: 'Project', value: (r) => r.name },
            { header: 'Direct profit', value: (r) => formatCurrency(r.direct), align: 'right' },
            { header: 'After overhead', value: (r) => formatCurrency(r.net), align: 'right' },
          ],
        }}
      >
        <div className="flex h-full flex-col">
          <ChartLegend items={[{ label: 'Direct profit', color: SERIES[0] }, { label: 'After overhead', color: SERIES[1] }]} />
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ranking} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="direct" name="Direct profit" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="net" name="After overhead" radius={[4, 4, 0, 0]} maxBarSize={22}>
                {ranking.map((r) => (
                  <Cell key={r.name} fill={SERIES[1]} fillOpacity={r.net < 0 ? 0.55 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <DataTable
        caption="Project profitability"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="project-profitability"
        initialSort={{ id: 'net', desc: true }}
        onRowClick={(r) => navigate(`/projects/${r.id}`)}
        filters={[{ id: 'status', label: 'Statuses', options: toOptions(PROJECT_STATUS_LABELS), predicate: (r, v) => r.status === v }]}
      />
      <SimulatedNotice className="mt-4">Estimates use an illustrative estimate-at-completion (actual cost ÷ % complete). They are not audited management accounts.</SimulatedNotice>
    </>
  )
}
