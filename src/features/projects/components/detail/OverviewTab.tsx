import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Project } from '@/domain'
import { Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DetailList, Money, ProgressBar } from '@/components/data-display/DetailList'
import { Term } from '@/components/data-display/Term'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { useLookups } from '@/hooks/useData'
import type { ProjectFinancials } from '@/lib/calculations/projects'
import { formatCurrency, formatDate, formatMonth, formatNumber, formatPercent } from '@/lib/formatting'
import { BILLING_MODEL_LABELS } from '../../lib/labels'
import type { ProjectCostLine } from '../../lib/projectCosts'
import { cumulativeCostByMonth } from '../../lib/projectCosts'

export function OverviewTab({ project, fin, lines }: { project: Project; fin: ProjectFinancials; lines: ProjectCostLine[] }) {
  const lookups = useLookups()
  const burn = cumulativeCostByMonth(lines)
  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard label="Contract value" value={project.isInternal ? 'Internal' : formatCurrency(fin.contractValue)} hint={BILLING_MODEL_LABELS[project.billingModel]} />
        <StatCard label="Actual cost" value={formatCurrency(fin.actualCost)} hint={`of ${formatCurrency(fin.budget)} budget`} />
        <StatCard label="Forecast total cost" term="Estimate at completion" value={formatCurrency(fin.forecastCost)} hint={`Cost to complete ${formatCurrency(fin.costToComplete)}`} estimate />
        <StatCard
          label="Estimated profit"
          term="Direct-cost margin"
          value={project.isInternal ? '—' : formatCurrency(fin.estimatedProfit)}
          hint={project.isInternal ? 'Internal project — no client revenue' : `Direct-cost margin ${formatPercent(fin.estimatedMarginPercent)}`}
          estimate
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Financial profile" description="All figures derive from timesheets, cost entries, approved bills and expenses, cloud usage, invoices and payments." className="xl:col-span-2">
          <DetailList
            columns={3}
            items={[
              { label: 'Budget', value: <Money value={fin.budget} /> },
              { label: 'Remaining budget', value: <Money value={fin.remainingBudget} signed /> },
              { label: <Term term="Budget utilisation">Budget consumed</Term>, value: <ProgressBar value={fin.actualCost} max={fin.budget} label="Budget consumed" /> },
              { label: 'Labour cost', value: <Money value={fin.breakdown.labour} /> },
              { label: 'Infrastructure cost', value: <Money value={fin.breakdown.infrastructure} /> },
              { label: 'Other direct costs', value: <Money value={fin.breakdown.software + fin.breakdown.subcontractor + fin.breakdown.travel + fin.breakdown.other} /> },
              { label: 'Billable costs', value: <Money value={fin.billableCost} /> },
              { label: 'Non-billable costs', value: <Money value={fin.nonBillableCost} /> },
              { label: <Term term="Committed cost">Committed</Term>, value: <Money value={fin.committedCost} /> },
              { label: <Term term="Invoiced revenue">Invoiced (net of tax)</Term>, value: <Money value={fin.invoiced} /> },
              { label: 'Collected (incl. VAT)', value: <Money value={fin.collected} /> },
              { label: <Term term="Recognised revenue">Recognised revenue (illustrative)</Term>, value: <Money value={fin.recognisedRevenue} /> },
              { label: 'Hours logged', value: `${formatNumber(fin.labourHours)} h (${formatNumber(fin.billableHours)} billable)` },
              { label: '% complete', value: `${project.percentComplete}%` },
              { label: 'Financial status', value: <StatusBadge status={fin.health} /> },
            ]}
          />
          <SimulatedNotice className="mt-5">
            <strong>Definitions.</strong> Invoiced revenue is what has been billed; recognised revenue estimates what has been earned (% complete × contract value for fixed-price and milestone work).
            Estimated margin is a <em>direct-cost</em> margin — it excludes allocated company overhead such as office, finance and sales costs. See Project profitability for an after-overhead view.
          </SimulatedNotice>
        </Section>
        <Section title="Project details">
          <DetailList
            columns={1}
            items={[
              { label: 'Client', value: project.isInternal ? 'Internal project' : lookups.customer(project.customerId) },
              { label: 'Project manager', value: lookups.employee(project.managerId) },
              { label: 'Department', value: lookups.master(project.departmentId) },
              { label: 'Category', value: lookups.master(project.categoryId) },
              { label: 'Timeline', value: `${formatDate(project.startDate)} – ${formatDate(project.endDate)}` },
              { label: 'Description', value: project.description },
            ]}
          />
        </Section>
      </div>

      <ChartCard
        title="Cumulative cost vs budget"
        description="Incurred cost by month. The dashed line is the approved cost budget."
        table={{
          rows: burn,
          columns: [
            { header: 'Month', value: (r) => formatMonth(r.month) },
            { header: 'Cost in month', value: (r) => formatCurrency(r.cost), align: 'right' },
            { header: 'Cumulative', value: (r) => formatCurrency(r.cumulative), align: 'right' },
          ],
        }}
      >
        {burn.length ? (
          <div className="flex h-full flex-col">
            <ChartLegend items={[{ label: 'Cumulative cost', color: SERIES[0] }, { label: 'Budget', color: 'var(--muted-foreground)', dashed: true }]} />
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burn} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tickFormatter={formatMonth} {...axisProps} />
                <YAxis tickFormatter={currencyTick} width={56} {...axisProps} domain={[0, (max: number) => Math.max(max, fin.budget) * 1.05]} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
                <ReferenceLine y={fin.budget} stroke="var(--muted-foreground)" strokeDasharray="5 4" />
                <Line type="monotone" dataKey="cumulative" name="Cumulative cost" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground flex h-full items-center justify-center text-sm">No costs recorded yet.</p>
        )}
      </ChartCard>
    </div>
  )
}
