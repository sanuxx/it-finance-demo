import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileSignature, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Contract, ContractStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { statusLabel } from '@/components/data-display/statusMeta'
import { EmptyState } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useDbSlice, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { contractRepository } from '@/services'
import { nextNumber } from '@/services/demo/demoStore'
import { add, percentOf } from '@/lib/calculations/money'
import { addMonths, format } from 'date-fns'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { contractInvoiced } from '../lib/recognition'
import { useNow } from '@/hooks/useNow'

const BILLING = [
  { value: 'fixed_price', label: 'Fixed price' },
  { value: 'time_and_materials', label: 'Time & materials' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'subscription', label: 'Subscription' },
]
const STATUSES: ContractStatus[] = ['draft', 'active', 'on_hold', 'completed', 'terminated']

const schema = z
  .object({
    title: z.string().trim().min(3, { error: 'Enter a title' }).max(150),
    customerId: z.string().min(1, { error: 'Choose a customer' }),
    projectId: z.string().optional(),
    billingModel: z.enum(['fixed_price', 'time_and_materials', 'retainer', 'subscription', 'milestone']),
    value: z.number({ error: 'Enter the contract value' }).min(0, { error: 'Cannot be negative' }),
    startDate: z.string().min(10, { error: 'Choose a start date' }),
    endDate: z.string().min(10, { error: 'Choose an end date' }),
    renewalDate: z.string().optional(),
    status: z.enum(['draft', 'active', 'on_hold', 'completed', 'terminated']),
    description: z.string().max(1000).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], error: 'End date must be after the start date' })
type Values = z.infer<typeof schema>

function ContractDialog({ open, onOpenChange, contract }: { open: boolean; onOpenChange: (o: boolean) => void; contract?: Contract }) {
  const customers = useCollection('customers')
  const projects = useCollection('projects')
  const contracts = useCollection('contracts')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (!open) return
    const start = format(new Date(), 'yyyy-MM-dd')
    form.reset(
      contract
        ? { ...contract, renewalDate: contract.renewalDate ?? '', description: contract.description ?? '' }
        : { title: '', customerId: '', projectId: undefined, billingModel: 'fixed_price', value: undefined as unknown as number, startDate: start, endDate: format(addMonths(new Date(), 12), 'yyyy-MM-dd'), renewalDate: '', status: 'draft', description: '' },
    )
  }, [open, contract, form])
  const customerId = useWatch({ control: form.control, name: 'customerId' })
  const save = useAction(
    (v: Values) => {
      const payload = { ...v, projectId: v.projectId || undefined, renewalDate: v.renewalDate || undefined, currency: 'LKR' as const }
      return contract ? contractRepository.update(contract.id, payload) : contractRepository.create({ ...payload, number: nextNumber(contracts.map((c) => c.number), 'CTR-', 3) })
    },
    { success: contract ? 'Contract updated' : 'Contract created' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={contract ? `Edit ${contract.number}` : 'New contract'} description="Fictional agreements only. This demo does not manage legal documents." onSubmit={onSubmit} pending={save.pending} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="title" label="Title" required className="sm:col-span-2" />
        <SelectField control={c} name="customerId" label="Customer" required options={customers.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField control={c} name="projectId" label="Project" allowNone noneLabel="No project" options={projects.filter((p) => !customerId || p.customerId === customerId).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
        <SelectField control={c} name="billingModel" label="Billing model" required options={BILLING} />
        <NumberField control={c} name="value" label="Contract value (excl. tax)" prefix="LKR" required min={0} />
        <TextField control={c} name="startDate" label="Start date" type="date" required />
        <TextField control={c} name="endDate" label="End date" type="date" required />
        <TextField control={c} name="renewalDate" label="Renewal date" type="date" />
        <SelectField control={c} name="status" label="Status" required options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} />
        <TextareaField control={c} name="description" label="Scope summary" className="sm:col-span-2" rows={2} />
      </div>
    </FormDialog>
  )
}

type Row = Contract & { invoiced: number; invoicedPct: number | null }

export default function ContractsPage() {
  const now = useNow()
  const contracts = useCollection('contracts')
  const db = useDbSlice('invoices', 'creditNotes')
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('sales.edit')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | undefined>()

  const rows = useMemo<Row[]>(() => contracts.map((c) => {
    const invoiced = contractInvoiced(c.id, db)
    return { ...c, invoiced, invoicedPct: percentOf(invoiced, c.value) }
  }), [contracts, db])
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === 'active')
    const value = active.reduce((s, r) => add(s, r.value), 0)
    const invoiced = active.reduce((s, r) => add(s, r.invoiced), 0)
    const soon = rows.filter((r) => r.status === 'active' && r.renewalDate && r.renewalDate <= format(addMonths(now, 3), 'yyyy-MM-dd')).length
    return { active: active.length, value, remaining: Math.max(0, value - invoiced), soon }
  }, [rows, now])

  const remove = async (c: Contract) => {
    const { confirmed } = await confirm({ title: `Delete ${c.number}?`, description: 'Contracts referenced by invoices cannot be deleted — terminate them instead.', destructive: true, confirmLabel: 'Delete contract' })
    if (confirmed) await runWithToast(contractRepository.remove(c.id), 'Contract deleted')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Contract', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.title}</div><div className="text-muted-foreground text-xs">{r.number}</div></div> },
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.customerId), cell: (r) => <Link to={`/sales/customers/${r.customerId}`} className="hover:underline">{lookups.customer(r.customerId)}</Link> },
    { id: 'project', header: 'Project', accessor: (r) => (r.projectId ? lookups.projectCode(r.projectId) : ''), cell: (r) => (r.projectId ? <Link to={`/projects/${r.projectId}`} className="text-primary hover:underline">{lookups.projectCode(r.projectId)}</Link> : '—') },
    { id: 'billing', header: 'Billing', accessor: (r) => BILLING.find((b) => b.value === r.billingModel)?.label },
    { id: 'term', header: 'Term', accessor: (r) => r.startDate, cell: (r) => <span className="text-xs">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span> },
    { id: 'renewal', header: 'Renewal', accessor: (r) => r.renewalDate, cell: (r) => formatDate(r.renewalDate), defaultHidden: true },
    { id: 'value', header: 'Value', accessor: (r) => r.value, align: 'right', cell: (r) => <Money value={r.value} /> },
    { id: 'invoiced', header: 'Invoiced to date', accessor: (r) => r.invoiced, align: 'right', cell: (r) => <Money value={r.invoiced} /> },
    { id: 'progress', header: '% invoiced', accessor: (r) => r.invoicedPct, cell: (r) => <ProgressBar value={r.invoicedPct} tone="primary" label={`${r.number} invoiced`} className="w-28" /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.number}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => { setEditing(r); setOpen(true) }}><Pencil /> Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">Change status</DropdownMenuLabel>
            {STATUSES.filter((s) => s !== r.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => runWithToast(contractRepository.update(r.id, { status: s }), `${r.number} → ${statusLabel(s)}`)}>{statusLabel(s)}</DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Contracts" description="Statements of work, retainers and subscription agreements, with invoicing progress against contract value." actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New contract</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="Active contracts" value={stats.active} hint={`${rows.length} in total`} />
        <StatCard label="Active contract value" term="Contract value" value={formatCurrency(stats.value)} hint="Excl. tax" />
        <StatCard label="Remaining to invoice" value={formatCurrency(stats.remaining)} hint="Active contracts" to="/sales/billing-schedules" />
        <StatCard label="Renewals in 3 months" value={stats.soon} />
      </StatGrid>
      <DataTable
        caption="Contracts"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="contracts"
        initialSort={{ id: 'value', desc: true }}
        filters={[
          { id: 'status', label: 'Statuses', options: STATUSES.map((s) => ({ value: s, label: statusLabel(s) })), predicate: (r, v) => r.status === v },
          { id: 'billing', label: 'Billing models', options: BILLING, predicate: (r, v) => r.billingModel === v },
        ]}
        emptyState={<EmptyState icon={<FileSignature />} title="No contracts" className="border-0" />}
      />
      <ContractDialog open={open} onOpenChange={setOpen} contract={editing} />
    </>
  )
}
