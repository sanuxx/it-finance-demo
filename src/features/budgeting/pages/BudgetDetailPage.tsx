import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, Pencil, RotateCcw, Send } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BudgetStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DetailList, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useLedgers, useLookups, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { budgetAllowedTransitions, budgetRepository } from '@/services'
import { formatCurrency, formatDate, formatMonth, formatPercent } from '@/lib/formatting'
import { monthLabel } from '@/lib/dates'
import { SCOPE_LABELS, eligibleItems, pacingSeries, useAllBudgetActuals } from '../lib/budgetData'
import { BudgetFormDialog } from '../components/BudgetFormDialog'
import { cn } from '@/lib/utils'

const TRANSITION_LABEL: Record<BudgetStatus, { label: string; icon: typeof Send }> = {
  submitted: { label: 'Submit for approval', icon: Send },
  approved: { label: 'Approve (simulated)', icon: Check },
  revision: { label: 'Request revision', icon: RotateCcw },
  draft: { label: 'Return to draft', icon: Pencil },
}

export default function BudgetDetailPage() {
  const { id } = useParams()
  const budget = useRecord('budgets', id)
  const actualsMap = useAllBudgetActuals()
  const ledgers = useLedgers()
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('budgets.edit')
  const canApprove = usePermission('budgets.approve')
  const [editOpen, setEditOpen] = useState(false)
  const [notes, setNotes] = useState<string | null>(null)

  const pacing = useMemo(() => (budget && budget.scope !== 'project' ? pacingSeries(budget, eligibleItems(budget, ledgers)) : []), [budget, ledgers])

  if (!budget) {
    return <EmptyState title="Budget not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/planning/budgets">Back to budgets</Link></Button>} className="mt-10" />
  }
  const a = actualsMap.get(budget.id)
  if (!a) return null
  const editable = budget.status === 'draft' || budget.status === 'revision'
  const isRevenue = budget.kind === 'revenue'

  const transition = async (status: BudgetStatus) => {
    const needsReason = status === 'revision'
    const { confirmed, reason } = await confirm({
      title: `${TRANSITION_LABEL[status].label}?`,
      description: status === 'approved' ? 'This is a simulated approval stored in this browser only — it does not authorise real spending.' : `The budget will move to “${status}”.`,
      requireReason: needsReason,
      reasonLabel: 'What needs to change?',
      confirmLabel: TRANSITION_LABEL[status].label,
    })
    if (confirmed) await runWithToast(budgetRepository.setStatus(budget.id, status, needsReason ? `Revision requested: ${reason}` : undefined), `Budget ${status === 'approved' ? 'approved' : status === 'submitted' ? 'submitted' : 'updated'}`)
  }

  const allowed = budgetAllowedTransitions(budget.status).filter((s) => (s === 'approved' || s === 'revision' ? canApprove : canEdit))

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/planning/budgets"><ArrowLeft /> Budgets</Link>
      </Button>
      <PageHeader
        title={budget.name}
        description={`${isRevenue ? 'Revenue plan' : `${SCOPE_LABELS[budget.scope]} expense budget`} · ${formatDate(budget.periodStart)} – ${formatDate(budget.periodEnd)}`}
        meta={<><StatusBadge status={budget.status} /><StatusBadge status={a.status} /></>}
        actions={
          <>
            {canEdit && editable ? <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit lines</Button> : null}
            {canEdit ? <Button variant="outline" onClick={() => runWithToast(budgetRepository.duplicate(budget.id, budget.fiscalYear + 1), `Draft created for FY${budget.fiscalYear + 1}`)}><Copy /> Duplicate</Button> : null}
            {allowed.map((s) => {
              const Icon = TRANSITION_LABEL[s].icon
              return <Button key={s} variant={s === 'approved' || s === 'submitted' ? 'default' : 'outline'} onClick={() => transition(s)}><Icon /> {TRANSITION_LABEL[s].label}</Button>
            })}
          </>
        }
      />
      {!editable && canEdit ? <SimulatedNotice className="mb-4">Approved and submitted budgets are locked. Request a revision to change the lines.</SimulatedNotice> : null}
      <StatGrid className="mb-6">
        <StatCard label={isRevenue ? 'Revenue target' : 'Approved budget'} value={formatCurrency(a.total)} hint={`${budget.lines.length} line(s)`} />
        <StatCard label={isRevenue ? 'Revenue to date' : 'Actual to date'} value={formatCurrency(a.actual)} hint="Calculated from demo records" />
        <StatCard label={isRevenue ? 'Still to achieve' : 'Remaining'} value={formatCurrency(a.remaining)} />
        <StatCard label="Utilisation" term="Budget utilisation" value={a.utilisationPercent === null ? '—' : formatPercent(a.utilisationPercent)} hint={`${a.elapsedPercent.toFixed(0)}% of the period elapsed`} />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Lines" description={budget.scope === 'project' ? 'Compared with the project’s labour and direct costs.' : 'Actuals use the same eligibility rules as all budget reports.'} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="w-40">Utilisation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.lines.map((l) => (
                  <TableRow key={l.lineId}>
                    <TableCell>{lookups.master(l.categoryId)}</TableCell>
                    <TableCell className="tabular text-right">{formatCurrency(l.budget)}</TableCell>
                    <TableCell className="tabular text-right">{formatCurrency(l.actual)}</TableCell>
                    <TableCell className={cn('tabular text-right', l.remaining < 0 && !isRevenue && 'text-destructive')}>{formatCurrency(l.remaining)}</TableCell>
                    <TableCell><ProgressBar value={l.utilisationPercent} label={`Utilisation of ${lookups.master(l.categoryId)}`} tone={isRevenue ? 'primary' : 'auto'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="tabular text-right font-semibold">{formatCurrency(a.total)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{formatCurrency(a.actual)}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{formatCurrency(a.remaining)}</TableCell>
                  <TableCell><ProgressBar value={a.utilisationPercent} label="Total utilisation" tone={isRevenue ? 'primary' : 'auto'} /></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </Section>
        <Section title="Details">
          <DetailList
            columns={1}
            items={[
              { label: 'Owner', value: lookups.user(budget.ownerId) },
              { label: 'Department', value: budget.departmentId ? lookups.master(budget.departmentId) : 'All departments' },
              ...(budget.projectId ? [{ label: 'Project', value: <Link className="text-primary hover:underline" to={`/projects/${budget.projectId}`}>{lookups.project(budget.projectId)}</Link> }] : []),
              { label: 'Fiscal year', value: `FY${budget.fiscalYear}` },
              { label: 'Last updated', value: formatDate(budget.updatedAt) },
            ]}
          />
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="budget-notes">Notes</Label>
            <Textarea id="budget-notes" rows={3} value={notes ?? budget.notes ?? ''} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
            {notes !== null && notes !== (budget.notes ?? '') ? (
              <Button size="sm" onClick={async () => { if (await runWithToast(budgetRepository.update(budget.id, { notes }), 'Notes saved')) setNotes(null) }}>Save notes</Button>
            ) : null}
          </div>
        </Section>
      </div>

      {pacing.length ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Cumulative actual vs budget pacing"
            description="Straight-line budget phasing across the period."
            table={{ rows: pacing, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Cumulative actual', value: (r) => (r.cumulativeActual === null ? '—' : formatCurrency(r.cumulativeActual)), align: 'right' }, { header: 'Cumulative budget', value: (r) => formatCurrency(r.cumulativeBudget), align: 'right' }] }}
          >
            <ChartLegend items={[{ label: 'Cumulative actual', color: SERIES[0] }, { label: 'Budget pacing', color: SERIES[1], dashed: true }]} />
            <ResponsiveContainer width="100%" height="88%">
              <LineChart data={pacing} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
                <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
                <Line dataKey="cumulativeActual" name="Cumulative actual" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="cumulativeBudget" name="Budget pacing" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="Monthly actual vs monthly budget"
            table={{ rows: pacing, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Actual', value: (r) => formatCurrency(r.actual), align: 'right' }, { header: 'Monthly budget', value: (r) => formatCurrency(r.monthlyBudget), align: 'right' }] }}
          >
            <ChartLegend items={[{ label: 'Actual', color: SERIES[0] }, { label: 'Monthly budget (÷ months)', color: SERIES[1], dashed: true }]} />
            <ResponsiveContainer width="100%" height="88%">
              <ComposedChart data={pacing} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
                <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="actual" name="Actual" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line dataKey="monthlyBudget" name="Monthly budget" stroke={SERIES[1]} strokeDasharray="5 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : budget.scope === 'project' ? (
        <SimulatedNotice className="mt-4">Monthly pacing is not shown for project budgets — see the project’s financial profile for its cost timeline.</SimulatedNotice>
      ) : null}
      <BudgetFormDialog open={editOpen} onOpenChange={setEditOpen} budget={budget} />
    </>
  )
}
