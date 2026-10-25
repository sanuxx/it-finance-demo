import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil } from 'lucide-react'
import type { Project } from '@/domain'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartTheme'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstimateTag } from '@/components/feedback/Feedback'
import { add, subtract } from '@/lib/calculations/money'
import type { ProjectFinancials } from '@/lib/calculations/projects'
import { formatCurrency } from '@/lib/formatting'

export function BudgetTab({ project, fin, canEdit, onEdit }: { project: Project; fin: ProjectFinancials; canEdit: boolean; onEdit: () => void }) {
  const otherActual = add(fin.breakdown.software, fin.breakdown.subcontractor, fin.breakdown.travel, fin.breakdown.other)
  const split = [
    { name: 'Labour', planned: project.plannedLabour, actual: fin.breakdown.labour },
    { name: 'Infrastructure', planned: project.plannedInfrastructure, actual: fin.breakdown.infrastructure },
    { name: 'Other direct', planned: project.plannedOther, actual: otherActual },
  ]
  const summary = [
    { name: 'Budget', value: fin.budget, color: 'var(--muted-foreground)' },
    { name: 'Actual', value: fin.actualCost, color: SERIES[0] },
    { name: 'Actual + committed', value: add(fin.actualCost, fin.committedCost), color: SERIES[0] },
    { name: 'Forecast (est.)', value: fin.forecastCost, color: SERIES[0] },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Budget vs actual, committed and forecast"
          description="Forecast is an illustrative estimate at completion."
          table={{ rows: summary, columns: [{ header: 'Measure', value: (r) => r.name }, { header: 'Amount', value: (r) => formatCurrency(r.value), align: 'right' }] }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis type="number" tickFormatter={currencyTick} {...axisProps} />
              <YAxis type="category" dataKey="name" width={120} {...axisProps} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
              <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]} barSize={22}>
                {summary.map((s) => (
                  <Cell key={s.name} fill={s.color} fillOpacity={s.name === 'Forecast (est.)' ? 0.55 : s.name === 'Actual + committed' ? 0.8 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Planned vs actual by cost group"
          table={{
            rows: split,
            columns: [
              { header: 'Cost group', value: (r) => r.name },
              { header: 'Planned', value: (r) => formatCurrency(r.planned), align: 'right' },
              { header: 'Actual', value: (r) => formatCurrency(r.actual), align: 'right' },
            ],
          }}
        >
          <div className="flex h-full flex-col">
            <ChartLegend items={[{ label: 'Planned', color: SERIES[0] }, { label: 'Actual', color: SERIES[1] }]} />
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={split} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                <Bar dataKey="planned" name="Planned" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="actual" name="Actual" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
      <Section
        title="Budget split"
        description="The cost budget is divided into planned labour, infrastructure and other direct costs."
        actions={
          canEdit ? (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil /> Edit budget
            </Button>
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost group</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="w-48">Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {split.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right"><Money value={r.planned} /></TableCell>
                  <TableCell className="text-right"><Money value={r.actual} /></TableCell>
                  <TableCell className="text-right"><Money value={subtract(r.planned, r.actual)} signed /></TableCell>
                  <TableCell><ProgressBar value={r.actual} max={r.planned} label={`${r.name} budget used`} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold"><Money value={fin.budget} /></TableCell>
                <TableCell className="text-right font-semibold"><Money value={fin.actualCost} /></TableCell>
                <TableCell className="text-right font-semibold"><Money value={fin.remainingBudget} signed /></TableCell>
                <TableCell><ProgressBar value={fin.actualCost} max={fin.budget} label="Total budget used" /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-2 text-xs">
          <EstimateTag /> Committed costs of <Money value={fin.committedCost} /> are included in the forecast but not in actuals. Forecast cost to complete: <Money value={fin.costToComplete} />.
        </div>
      </Section>
    </div>
  )
}
