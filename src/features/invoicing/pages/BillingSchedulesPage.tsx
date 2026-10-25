import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileOutput, Zap } from 'lucide-react'
import type { Milestone, RecurringSchedule } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { add } from '@/lib/calculations/money'
import { monthLabel, monthsBetween } from '@/lib/dates'
import { formatCurrency, formatDate, formatMonth } from '@/lib/formatting'
import { generateRecurringInvoice, invoiceMilestone } from '../lib/actions'
import { FREQUENCY_MONTHS, addMonthsIso, todayIso } from '../lib/billing'

type MsRow = Milestone & { projectName: string; customerName: string; overdue: boolean }

export default function BillingSchedulesPage() {
  const milestones = useCollection('milestones')
  const projects = useCollection('projects')
  const customers = useCollection('customers')
  const schedules = useCollection('recurringSchedules')
  const lookups = useLookups()
  const navigate = useNavigate()
  const canEdit = usePermission('sales.edit')
  const today = todayIso()
  const horizonEnd = addMonthsIso(today, 6)

  const msRows = useMemo<MsRow[]>(
    () =>
      milestones
        .filter((m) => m.status !== 'invoiced')
        .map((m) => {
          const p = projects.find((x) => x.id === m.projectId)
          return { ...m, projectName: p ? `${p.code} · ${p.name}` : '—', customerName: lookups.customer(p?.customerId), overdue: m.dueDate < today }
        }),
    [milestones, projects, lookups, today],
  )
  const activeSchedules = schedules.filter((s) => s.active)

  const chart = useMemo(() => {
    const months = monthsBetween(today, horizonEnd)
    const data = months.map((m) => ({ month: m, milestones: 0, recurring: 0 }))
    const idx = new Map(months.map((m, i) => [m, i]))
    for (const m of msRows) {
      const key = (m.dueDate < today ? today : m.dueDate).slice(0, 7)
      const i = idx.get(key)
      if (i !== undefined) data[i]!.milestones = add(data[i]!.milestones, m.amount)
    }
    for (const s of activeSchedules) {
      for (let d = s.nextRunDate; d <= horizonEnd && (!s.endDate || d <= s.endDate); d = addMonthsIso(d, FREQUENCY_MONTHS[s.frequency])) {
        const i = idx.get(d.slice(0, 7))
        if (i !== undefined) data[i]!.recurring = add(data[i]!.recurring, s.amount)
      }
    }
    return data
  }, [msRows, activeSchedules, today, horizonEnd])

  const totals = useMemo(() => ({
    milestones: msRows.reduce((s, m) => add(s, m.amount), 0),
    overdueMs: msRows.filter((m) => m.overdue).length,
    recurring: chart.reduce((s, m) => add(s, m.recurring), 0),
  }), [msRows, chart])

  const invoiceMs = async (m: MsRow) => {
    const project = projects.find((p) => p.id === m.projectId)
    if (!project) return
    const inv = await runWithToast(invoiceMilestone(m, project, customers), `Draft invoice created for “${m.name}”`)
    if (inv) navigate(`/sales/invoices/${inv.id}`)
  }
  const runSchedule = async (s: RecurringSchedule) => {
    const inv = await runWithToast(generateRecurringInvoice(s, customers), 'Draft invoice generated (simulated run)')
    if (inv) navigate(`/sales/invoices/${inv.id}`)
  }

  const msColumns: DataColumn<MsRow>[] = [
    { id: 'name', header: 'Milestone', accessor: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { id: 'project', header: 'Project', accessor: (r) => r.projectName },
    { id: 'customer', header: 'Customer', accessor: (r) => r.customerName },
    { id: 'due', header: 'Due', accessor: (r) => r.dueDate, cell: (r) => <span className={r.overdue ? 'text-destructive font-medium' : undefined}>{formatDate(r.dueDate)}</span> },
    { id: 'amount', header: 'Amount (excl. tax)', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right', cell: (r) => (canEdit ? <Button size="sm" variant="outline" onClick={() => invoiceMs(r)}><FileOutput /> Invoice milestone</Button> : null) },
  ]
  const schedColumns: DataColumn<RecurringSchedule>[] = [
    { id: 'name', header: 'Schedule', accessor: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.customerId) },
    { id: 'next', header: 'Next run', accessor: (r) => r.nextRunDate, cell: (r) => formatDate(r.nextRunDate) },
    { id: 'frequency', header: 'Frequency', accessor: (r) => r.frequency },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    { id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right', cell: (r) => (canEdit ? <Button size="sm" variant="outline" onClick={() => runSchedule(r)}><Zap /> Generate</Button> : null) },
  ]

  return (
    <>
      <PageHeader title="Billing schedules" description="What is due to be billed next: uninvoiced project milestones and upcoming recurring runs." />
      <StatGrid className="mb-6">
        <StatCard label="Uninvoiced milestones" value={formatCurrency(totals.milestones)} hint={`${msRows.length} milestone(s)`} />
        <StatCard label="Milestones past due date" value={totals.overdueMs} hint="Ready to invoice once signed off" />
        <StatCard label="Recurring (next 6 months)" value={formatCurrency(totals.recurring)} hint={`${activeSchedules.length} active schedule(s)`} to="/sales/recurring" />
        <StatCard label="Total pipeline" value={formatCurrency(add(totals.milestones, totals.recurring))} hint="Excl. tax" />
      </StatGrid>
      <ChartCard
        title="Expected billing by month"
        description="Milestones by due date (past-due shown in the current month) and recurring runs, excl. tax"
        className="mb-6"
        table={{ rows: chart, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Milestones', value: (r) => formatCurrency(r.milestones), align: 'right' }, { header: 'Recurring', value: (r) => formatCurrency(r.recurring), align: 'right' }] }}
      >
        <ChartLegend items={[{ label: 'Milestones', color: seriesColor(0) }, { label: 'Recurring', color: seriesColor(1) }]} />
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chart} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="milestones" name="Milestones" stackId="a" fill={seriesColor(0)} stroke="var(--card)" strokeWidth={2} maxBarSize={44} />
            <Bar dataKey="recurring" name="Recurring" stackId="a" fill={seriesColor(1)} stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="space-y-6">
        <Section title="Milestones not yet invoiced">
          <DataTable caption="Uninvoiced milestones" data={msRows} columns={msColumns} getRowId={(r) => r.id} exportName="uninvoiced-milestones" initialSort={{ id: 'due' }} pageSize={10} />
        </Section>
        <Section title="Recurring runs">
          <DataTable caption="Active recurring schedules" data={activeSchedules} columns={schedColumns} getRowId={(r) => r.id} initialSort={{ id: 'next' }} pageSize={10} />
        </Section>
        <SimulatedNotice>Invoicing a milestone creates a draft invoice for review and marks the milestone as invoiced. Nothing is sent to the customer.</SimulatedNotice>
      </div>
    </>
  )
}
