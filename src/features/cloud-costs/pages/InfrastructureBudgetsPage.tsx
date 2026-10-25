import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Server } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { useCollection, useLedgers, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { EXPENSE_CATEGORY } from '@/data/seed/ids'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate, formatMonth, formatPercent } from '@/lib/formatting'
import { monthLabel } from '@/lib/dates'
import { eligibleItems, pacingSeries, useAllBudgetActuals } from '@/features/budgeting/lib/budgetData'

export default function InfrastructureBudgetsPage() {
  const budgets = useCollection('budgets')
  const actuals = useAllBudgetActuals()
  const ledgers = useLedgers()
  const lookups = useLookups()
  const canCreate = usePermission('budgets.edit')
  const cloudBudgets = useMemo(() => budgets.filter((b) => b.scope === 'cloud').sort((a, b) => b.fiscalYear - a.fiscalYear), [budgets])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const selected = cloudBudgets.find((b) => b.id === selectedId) ?? cloudBudgets[0]
  const a = selected ? actuals.get(selected.id) : undefined

  const pacing = useMemo(() => (selected ? pacingSeries(selected, eligibleItems(selected, ledgers)) : []), [selected, ledgers])

  // Cloud vs AI spend inside the budget period (AI only counts if the budget has an AI line).
  const split = useMemo(() => {
    if (!selected) return { cloud: 0, ai: 0 }
    const inPeriod = ledgers.expenses.filter((e) => e.date >= selected.periodStart && e.date <= selected.periodEnd && (!selected.departmentId || e.departmentId === selected.departmentId))
    return {
      cloud: sum(inPeriod.filter((e) => e.categoryId === EXPENSE_CATEGORY.cloud), (e) => e.amount),
      ai: sum(inPeriod.filter((e) => e.categoryId === EXPENSE_CATEGORY.ai), (e) => e.amount),
    }
  }, [selected, ledgers])
  const hasAiLine = !!selected?.lines.some((l) => l.categoryId === EXPENSE_CATEGORY.ai)

  if (!cloudBudgets.length) {
    return (
      <>
        <PageHeader title="Infrastructure budgets" description="Cloud & AI budgets compared with actual spend." />
        <EmptyState icon={<Server />} title="No cloud & AI budgets yet" description="Create a budget with the “Cloud & AI” scope to track infrastructure spend." action={canCreate ? <Button asChild size="sm"><Link to="/planning/budgets">Go to budgets</Link></Button> : null} />
      </>
    )
  }

  const projectedYear = a && a.elapsedPercent > 0 ? (a.actual / a.elapsedPercent) * 100 : 0

  return (
    <>
      <PageHeader
        title="Infrastructure budgets"
        description="Cloud & AI budgets compared with actual spend from cloud cost and AI usage records."
        actions={
          <>
            {cloudBudgets.length > 1 ? (
              <Select value={selected?.id} onValueChange={setSelectedId}>
                <SelectTrigger size="sm" className="h-9 w-64" aria-label="Budget"><SelectValue /></SelectTrigger>
                <SelectContent>{cloudBudgets.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : null}
            {selected ? <Button asChild variant="outline"><Link to={`/planning/budgets/${selected.id}`}>Open budget <ArrowRight /></Link></Button> : null}
          </>
        }
      />
      {selected && a ? (
        <>
          <StatGrid className="mb-6">
            <StatCard label="Approved budget" value={formatCurrency(a.total)} hint={`${formatDate(selected.periodStart)} – ${formatDate(selected.periodEnd)}`} />
            <StatCard label="Actual to date" value={formatCurrency(a.actual)} hint={`${a.utilisationPercent ?? 0}% used · ${a.elapsedPercent.toFixed(0)}% of period elapsed`} />
            <StatCard label="Remaining" value={formatCurrency(a.remaining)} />
            <StatCard label="Projected full-period spend" value={formatCurrency(projectedYear)} hint="Straight-line run rate" estimate delta={a.total ? ((projectedYear - a.total) / a.total) * 100 : null} invertDelta deltaLabel="vs budget" />
          </StatGrid>
          <div className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Monthly actual vs monthly budget"
              description="Monthly budget = approved budget ÷ months in the period."
              height={300}
              table={{ rows: pacing, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Actual', value: (r) => formatCurrency(r.actual), align: 'right' }, { header: 'Monthly budget', value: (r) => formatCurrency(r.monthlyBudget), align: 'right' }] }}
            >
              <ChartLegend items={[{ label: 'Actual', color: SERIES[0] }, { label: 'Monthly budget', color: SERIES[1], dashed: true }]} />
              <ResponsiveContainer width="100%" height="88%">
                <ComposedChart data={pacing} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
                  <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                  <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="actual" name="Actual" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line dataKey="monthlyBudget" name="Monthly budget" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <Section title="Pacing">
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm"><span>Budget used</span><StatusBadge status={a.status} /></div>
                  <ProgressBar value={a.utilisationPercent} label="Budget used" />
                  <p className="text-muted-foreground mt-1 text-xs">{a.elapsedPercent.toFixed(0)}% of the period has elapsed.</p>
                </div>
                <dl className="space-y-2 border-t pt-3 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Department</dt><dd>{selected.departmentId ? lookups.master(selected.departmentId) : 'All'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Cloud spend in period</dt><dd className="tabular">{formatCurrency(split.cloud)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">AI & API spend in period</dt><dd className="tabular">{formatCurrency(split.ai)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">AI share</dt><dd className="tabular">{formatPercent(split.cloud + split.ai ? (split.ai / (split.cloud + split.ai)) * 100 : null)}</dd></div>
                </dl>
                {!hasAiLine ? <SimulatedNotice>This budget has no AI & API line, so AI spend is tracked separately and not counted against it.</SimulatedNotice> : null}
              </div>
            </Section>
          </div>
        </>
      ) : null}
      <Section title="All infrastructure budgets" className="mt-4">
        <ul className="divide-y">
          {cloudBudgets.map((b) => {
            const x = actuals.get(b.id)
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <Link to={`/planning/budgets/${b.id}`} className="min-w-48 flex-1 font-medium hover:underline">{b.name}</Link>
                <StatusBadge status={b.status} />
                <span className="tabular w-40 text-right">{formatCurrency(x?.actual)} / {formatCurrency(x?.total, 'LKR', { compact: true })}</span>
                <ProgressBar value={x?.utilisationPercent} label={`Utilisation of ${b.name}`} className="w-40" />
              </li>
            )
          })}
        </ul>
      </Section>
    </>
  )
}
