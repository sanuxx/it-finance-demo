import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreHorizontal, Pause, Pencil, Play, Plus, Repeat, Trash2, Zap } from 'lucide-react'
import type { RecurringSchedule } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, SwitchField, TextField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { recurringScheduleRepository } from '@/services'
import { add, divide, multiply } from '@/lib/calculations/money'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'
import { generateRecurringInvoice } from '../lib/actions'
import { FREQUENCY_MONTHS, addDaysIso, todayIso } from '../lib/billing'

const schema = z
  .object({
    name: z.string().trim().min(3, { error: 'Name the schedule' }).max(100),
    customerId: z.string().min(1, { error: 'Choose a customer' }),
    contractId: z.string().optional(),
    frequency: z.enum(['monthly', 'quarterly', 'annually']),
    amount: z.number({ error: 'Enter an amount' }).positive({ error: 'Must be greater than zero' }),
    taxRatePercent: z.number({ error: 'Enter a tax rate' }).min(0).max(100),
    description: z.string().trim().min(3, { error: 'Line description required' }).max(150),
    startDate: z.string().min(10, { error: 'Choose a start date' }),
    nextRunDate: z.string().min(10, { error: 'Choose the next run date' }),
    endDate: z.string().optional(),
    active: z.boolean(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], error: 'End date must be after the start date' })
type Values = z.infer<typeof schema>

function ScheduleDialog({ open, onOpenChange, schedule }: { open: boolean; onOpenChange: (o: boolean) => void; schedule?: RecurringSchedule }) {
  const customers = useCollection('customers')
  const contracts = useCollection('contracts')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (!open) return
    const today = todayIso()
    form.reset(schedule ? { ...schedule, endDate: schedule.endDate ?? '' } : { name: '', customerId: '', contractId: undefined, frequency: 'monthly', amount: undefined as unknown as number, taxRatePercent: 18, description: '', startDate: today, nextRunDate: today, endDate: '', active: true })
  }, [open, schedule, form])
  const customerId = form.watch('customerId')
  const save = useAction(
    (v: Values) => {
      const payload = { ...v, endDate: v.endDate || undefined, contractId: v.contractId || undefined }
      return schedule ? recurringScheduleRepository.update(schedule.id, payload) : recurringScheduleRepository.create(payload)
    },
    { success: schedule ? 'Schedule updated' : 'Schedule created' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={schedule ? `Edit ${schedule.name}` : 'New recurring schedule'} onSubmit={onSubmit} pending={save.pending} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Schedule name" required className="sm:col-span-2" />
        <SelectField control={c} name="customerId" label="Customer" required options={customers.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField control={c} name="contractId" label="Contract" allowNone noneLabel="No contract" options={contracts.filter((x) => !customerId || x.customerId === customerId).map((x) => ({ value: x.id, label: `${x.number} · ${x.title}` }))} />
        <SelectField control={c} name="frequency" label="Frequency" required options={[{ value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annually', label: 'Annually' }]} />
        <NumberField control={c} name="amount" label="Amount per run (excl. tax)" prefix="LKR" required min={0} />
        <TextField control={c} name="description" label="Invoice line description" required className="sm:col-span-2" />
        <NumberField control={c} name="taxRatePercent" label="Tax rate" suffix="%" min={0} />
        <TextField control={c} name="startDate" label="Start date" type="date" required />
        <TextField control={c} name="nextRunDate" label="Next run date" type="date" required />
        <TextField control={c} name="endDate" label="End date (optional)" type="date" />
        <SwitchField control={c} name="active" label="Active" description="Inactive schedules never generate invoices." className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function RecurringBillingPage() {
  const schedules = useCollection('recurringSchedules')
  const customers = useCollection('customers')
  const invoices = useCollection('invoices')
  const lookups = useLookups()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const canEdit = usePermission('sales.edit')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringSchedule | undefined>()

  const stats = useMemo(() => {
    const active = schedules.filter((s) => s.active)
    const monthly = active.reduce((sum, s) => add(sum, divide(s.amount, FREQUENCY_MONTHS[s.frequency])), 0)
    const in30 = active.filter((s) => s.nextRunDate <= addDaysIso(todayIso(), 30)).length
    return { active: active.length, monthly, annual: multiply(monthly, 12), in30 }
  }, [schedules])

  const generate = async (s: RecurringSchedule) => {
    const inv = await runWithToast(generateRecurringInvoice(s, customers), 'Draft invoice generated (simulated run)')
    if (inv) navigate(`/sales/invoices/${inv.id}`)
  }
  const remove = async (s: RecurringSchedule) => {
    const { confirmed } = await confirm({ title: `Delete ${s.name}?`, description: 'Invoices already generated are kept.', destructive: true, confirmLabel: 'Delete schedule' })
    if (confirmed) await runWithToast(recurringScheduleRepository.remove(s.id), 'Schedule deleted')
  }

  const columns: DataColumn<RecurringSchedule>[] = [
    { id: 'name', header: 'Schedule', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.description}</div></div> },
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.customerId) },
    { id: 'frequency', header: 'Frequency', accessor: (r) => humanize(r.frequency) },
    { id: 'amount', header: 'Amount / run', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    { id: 'next', header: 'Next run', accessor: (r) => r.nextRunDate, cell: (r) => formatDate(r.nextRunDate) },
    { id: 'end', header: 'Ends', accessor: (r) => r.endDate, cell: (r) => formatDate(r.endDate), defaultHidden: true },
    { id: 'generated', header: 'Invoices generated', accessor: (r) => invoices.filter((i) => i.recurringScheduleId === r.id).length, align: 'right' },
    { id: 'status', header: 'Status', accessor: (r) => (r.active ? 'active' : 'inactive'), cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!r.active} onSelect={() => generate(r)}><Zap /> Generate next invoice</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runWithToast(recurringScheduleRepository.update(r.id, { active: !r.active }), r.active ? 'Schedule paused' : 'Schedule activated')}>{r.active ? <><Pause /> Pause</> : <><Play /> Activate</>}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { setEditing(r); setOpen(true) }}><Pencil /> Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Recurring billing" description="Retainer and support schedules. Generating a run creates a draft invoice for review — nothing is issued or emailed automatically." actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New schedule</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="Active schedules" value={stats.active} hint={`${schedules.length} in total`} />
        <StatCard label="Monthly equivalent" value={formatCurrency(stats.monthly)} hint="Excl. tax" />
        <StatCard label="Annualised" value={formatCurrency(stats.annual)} hint="Excl. tax" />
        <StatCard label="Runs due in 30 days" value={stats.in30} to="/sales/billing-schedules" />
      </StatGrid>
      <SimulatedNotice className="mb-4">This demo has no scheduler running in the background. Use “Generate next invoice” to simulate a billing run.</SimulatedNotice>
      <DataTable caption="Recurring schedules" data={schedules} columns={columns} getRowId={(r) => r.id} exportName="recurring-schedules" initialSort={{ id: 'next' }} emptyState={<EmptyState icon={<Repeat />} title="No recurring schedules" className="border-0" />} />
      <ScheduleDialog open={open} onOpenChange={setOpen} schedule={editing} />
    </>
  )
}

