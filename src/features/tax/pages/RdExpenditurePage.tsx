import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RdExpenditure } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { CheckboxField, NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { rdRepository } from '@/services'
import { add, percentOf } from '@/lib/calculations/money'
import { formatCurrency, formatDate, formatPercent, humanize } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { RowActions } from '@/features/procurement/components/shared'

const CATEGORIES = ['staff', 'contractors', 'software', 'cloud', 'materials'] as const

const schema = z.object({
  description: z.string().trim().min(3, 'Describe the activity').max(200),
  date: z.string().min(10, 'Choose a date'),
  amount: z.number({ error: 'Enter an amount' }).positive('Must be greater than zero'),
  category: z.enum(CATEGORIES),
  projectId: z.string().optional(),
  eligible: z.boolean(),
})
type Values = z.infer<typeof schema>

function RdFormDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: RdExpenditure }) {
  const projects = useCollection('projects')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) form.reset(item ?? { description: '', date: todayISO(), amount: undefined as unknown as number, category: 'staff', projectId: 'prj-109', eligible: true })
  }, [open, item, form])
  const save = useAction(async (v: Values) => (item ? rdRepository.update(item.id, v) : rdRepository.create(v)), { success: item ? 'R&D entry updated' : 'R&D entry added' })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={item ? 'Edit R&D entry' : 'New R&D expenditure'} pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="description" label="Activity" required autoFocus className="sm:col-span-2" />
        <TextField control={c} name="date" label="Date" type="date" required />
        <NumberField control={c} name="amount" label="Amount" prefix="LKR" required min={0} />
        <SelectField control={c} name="category" label="Category" options={CATEGORIES.map((v) => ({ value: v, label: humanize(v) }))} />
        <SelectField control={c} name="projectId" label="Project" options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} allowNone />
        <CheckboxField control={c} name="eligible" label="Potentially eligible for R&D incentives" description="Illustrative flag only — eligibility depends on local rules and professional advice." className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function RdExpenditurePage() {
  const items = useCollection('rdExpenditure')
  const lookups = useLookups()
  const canEdit = usePermission('assets.edit')
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RdExpenditure | undefined>()

  const total = items.reduce((s, i) => add(s, i.amount), 0)
  const eligible = items.filter((i) => i.eligible).reduce((s, i) => add(s, i.amount), 0)
  const byCategory = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        category: humanize(cat),
        eligible: items.filter((i) => i.category === cat && i.eligible).reduce((s, i) => add(s, i.amount), 0),
        other: items.filter((i) => i.category === cat && !i.eligible).reduce((s, i) => add(s, i.amount), 0),
      })).filter((r) => r.eligible + r.other > 0),
    [items],
  )

  const columns: DataColumn<RdExpenditure>[] = [
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'description', header: 'Activity', accessor: (r) => r.description, cell: (r) => <span className="font-medium">{r.description}</span> },
    { id: 'category', header: 'Category', accessor: (r) => humanize(r.category) },
    { id: 'project', header: 'Project', accessor: (r) => (r.projectId ? lookups.projectCode(r.projectId) : ''), cell: (r) => (r.projectId ? <Link to={`/projects/${r.projectId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{lookups.projectCode(r.projectId)}</Link> : '—') },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    { id: 'eligible', header: 'Eligibility', accessor: (r) => (r.eligible ? 'Eligible' : 'Not eligible'), cell: (r) => <StatusBadge status={r.eligible ? 'eligible' : 'excluded'} tone={r.eligible ? 'success' : 'muted'} label={r.eligible ? 'Potentially eligible' : 'Not eligible'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) =>
        canEdit ? (
          <RowActions
            label={r.description}
            actions={[
              { label: 'Edit', icon: <Pencil />, onSelect: () => { setEditing(r); setOpen(true) } },
              { label: 'Delete', icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: async () => { const { confirmed } = await confirm({ title: 'Delete this R&D entry?', confirmLabel: 'Delete', destructive: true }); if (confirmed) await runWithToast(rdRepository.remove(r.id), 'Entry deleted') } },
            ]}
          />
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="R&D expenditure" description="Track research and development spend, primarily on the internal finance platform R&D project." actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> Add entry</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="Total R&D spend" value={formatCurrency(total)} hint={`${items.length} entries`} />
        <StatCard label="Potentially eligible" value={formatCurrency(eligible)} hint={`${formatPercent(percentOf(eligible, total))} of total`} estimate />
        <StatCard label="Not eligible" value={formatCurrency(total - eligible)} />
        <StatCard label="R&D project" value={lookups.projectCode('prj-109')} hint={lookups.project('prj-109')} to="/projects/prj-109" />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="R&D spend by category"
        table={{ rows: byCategory, columns: [{ header: 'Category', value: (r) => r.category }, { header: 'Eligible', value: (r) => formatCurrency(r.eligible), align: 'right' }, { header: 'Not eligible', value: (r) => formatCurrency(r.other), align: 'right' }] }}
        footer={<ChartLegend items={[{ label: 'Potentially eligible', color: seriesColor(0) }, { label: 'Not eligible', color: seriesColor(1) }]} />}
        height={240}
      >
        <ResponsiveContainer>
          <BarChart data={byCategory} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="category" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={currencyTick} width={56} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="eligible" name="Potentially eligible" stackId="a" fill={seriesColor(0)} stroke="var(--card)" strokeWidth={1} maxBarSize={40} />
            <Bar dataKey="other" name="Not eligible" stackId="a" fill={seriesColor(1)} stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable caption="R&D expenditure" data={items} columns={columns} getRowId={(r) => r.id} exportName="rd-expenditure" initialSort={{ id: 'date', desc: true }} filters={[{ id: 'eligible', label: 'Eligibility', options: [{ value: 'yes', label: 'Potentially eligible' }, { value: 'no', label: 'Not eligible' }], predicate: (r, v) => r.eligible === (v === 'yes') }]} emptyState={<EmptyState icon={<FlaskConical />} title="No R&D entries" className="border-0" />} />
      <SimulatedNotice className="mt-4">Eligibility flags are illustrative and do not represent a tax claim or professional advice.</SimulatedNotice>
      <RdFormDialog open={open} onOpenChange={setOpen} item={editing} />
    </>
  )
}
