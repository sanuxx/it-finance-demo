import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, FileOutput, MoreHorizontal, Pencil, Plus, Send, Trash2, XCircle } from 'lucide-react'
import type { Quotation } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { invoiceRepository, quotationRepository } from '@/services'
import { nextNumber, newId } from '@/services/demo/demoStore'
import { quotationTotals } from '@/lib/calculations/invoices'
import { add, percentOf } from '@/lib/calculations/money'
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatting'
import { LineItemsEditor, linesSchema, type LinesForm } from '../components/LineItemsEditor'
import { addDaysIso, blankLine, todayIso } from '../lib/billing'

const schema = z
  .object({
    customerId: z.string().min(1, { error: 'Choose a customer' }),
    title: z.string().trim().min(3, { error: 'Give the quotation a title' }).max(120),
    issueDate: z.string().min(10, { error: 'Choose a date' }),
    validUntil: z.string().min(10, { error: 'Choose an expiry date' }),
    notes: z.string().max(1000).optional(),
    lines: linesSchema,
  })
  .refine((v) => v.validUntil >= v.issueDate, { path: ['validUntil'], error: 'Must be on or after the issue date' })
type Values = z.infer<typeof schema>

function QuotationDialog({ open, onOpenChange, quotation }: { open: boolean; onOpenChange: (o: boolean) => void; quotation?: Quotation }) {
  const customers = useCollection('customers')
  const quotations = useCollection('quotations')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (!open) return
    const today = todayIso()
    form.reset(
      quotation
        ? { customerId: quotation.customerId, title: quotation.title, issueDate: quotation.issueDate, validUntil: quotation.validUntil, notes: quotation.notes ?? '', lines: quotation.lines.map((l) => ({ ...l })) }
        : { customerId: '', title: '', issueDate: today, validUntil: addDaysIso(today, 30), notes: '', lines: [blankLine()] },
    )
  }, [open, quotation, form])

  const save = useAction(
    async (v: Values) =>
      quotation
        ? quotationRepository.update(quotation.id, v)
        : quotationRepository.create({ ...v, number: nextNumber(quotations.map((q) => q.number), 'QUO-', 4), currency: 'LKR', status: 'draft' }),
    { success: quotation ? 'Quotation updated' : 'Quotation created' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={quotation ? `Edit ${quotation.number}` : 'New quotation'} description="Estimates are illustrative and never sent to the customer." onSubmit={onSubmit} pending={save.pending} size="xl">
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField control={c} name="customerId" label="Customer" required options={customers.map((x) => ({ value: x.id, label: x.name }))} className="md:col-span-2" />
        <TextField control={c} name="issueDate" label="Issue date" type="date" required />
        <TextField control={c} name="validUntil" label="Valid until" type="date" required />
        <TextField control={c} name="title" label="Title" required className="md:col-span-4" />
      </div>
      <LineItemsEditor control={c as unknown as Control<LinesForm>} errors={form.formState.errors as never} showDocumentDiscount={false} />
      <TextareaField control={c} name="notes" label="Notes" rows={2} />
    </FormDialog>
  )
}

type Row = Quotation & { total: number; net: number; customerName: string }

export default function QuotationsPage() {
  const quotations = useCollection('quotations')
  const customers = useCollection('customers')
  const lookups = useLookups()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const canEdit = usePermission('sales.edit')
  const [editing, setEditing] = useState<Quotation | undefined>()
  const [open, setOpen] = useState(false)

  const rows = useMemo<Row[]>(
    () =>
      quotations.map((q) => {
        const t = quotationTotals(q)
        // A sent quotation past its validity date is shown as expired.
        const status = q.status === 'sent' && q.validUntil < todayIso() ? 'expired' : q.status
        return { ...q, status, total: t.total, net: t.netAmount, customerName: lookups.customer(q.customerId) }
      }),
    [quotations, lookups],
  )
  const stats = useMemo(() => {
    const decided = rows.filter((r) => r.status === 'accepted' || r.status === 'declined')
    return {
      pipeline: rows.filter((r) => r.status === 'sent' || r.status === 'draft').reduce((s, r) => add(s, r.net), 0),
      accepted: rows.filter((r) => r.status === 'accepted').reduce((s, r) => add(s, r.net), 0),
      winRate: percentOf(rows.filter((r) => r.status === 'accepted').length, decided.length),
      open: rows.filter((r) => r.status === 'sent').length,
    }
  }, [rows])

  const setStatus = (q: Quotation, status: Quotation['status'], msg: string) => runWithToast(quotationRepository.update(q.id, { status }), msg)

  const convert = async (q: Quotation) => {
    const customer = customers.find((c) => c.id === q.customerId)
    const today = todayIso()
    const inv = await runWithToast(
      invoiceRepository.create({
        number: '',
        customerId: q.customerId,
        issueDate: today,
        dueDate: addDaysIso(today, customer?.paymentTermsDays ?? 30),
        currency: q.currency,
        lines: q.lines.map((l) => ({ ...l, id: newId('ln') })),
        discountPercent: 0,
        notes: `Based on quotation ${q.number} — ${q.title}`,
        status: 'draft',
        history: [],
      }),
      `Draft invoice created from ${q.number}`,
    )
    if (inv) {
      if (q.status !== 'accepted') await quotationRepository.update(q.id, { status: 'accepted' })
      navigate(`/sales/invoices/${inv.id}/edit`)
    }
  }

  const remove = async (q: Quotation) => {
    const { confirmed } = await confirm({ title: `Delete ${q.number}?`, description: 'This quotation will be removed from the demo data.', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(quotationRepository.remove(q.id), 'Quotation deleted')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Quote', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.number}</div><div className="text-muted-foreground text-xs">{r.title}</div></div> },
    { id: 'customer', header: 'Customer', accessor: (r) => r.customerName },
    { id: 'issueDate', header: 'Issued', accessor: (r) => r.issueDate, cell: (r) => formatDate(r.issueDate) },
    { id: 'validUntil', header: 'Valid until', accessor: (r) => r.validUntil, cell: (r) => formatDate(r.validUntil) },
    { id: 'net', header: 'Net', accessor: (r) => r.net, align: 'right', cell: (r) => <Money value={r.net} /> },
    { id: 'total', header: 'Total incl. tax', accessor: (r) => r.total, align: 'right', cell: (r) => <Money value={r.total} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => {
        if (!canEdit) return null
        const original = quotations.find((q) => q.id === r.id)!
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.number}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {r.status === 'draft' ? <DropdownMenuItem onSelect={() => { setEditing(original); setOpen(true) }}><Pencil /> Edit</DropdownMenuItem> : null}
              {r.status === 'draft' ? <DropdownMenuItem onSelect={() => setStatus(original, 'sent', `${r.number} marked as sent (simulated — nothing emailed)`)}><Send /> Mark as sent</DropdownMenuItem> : null}
              {r.status === 'sent' ? <DropdownMenuItem onSelect={() => setStatus(original, 'accepted', `${r.number} accepted`)}><CheckCircle2 /> Mark accepted</DropdownMenuItem> : null}
              {r.status === 'sent' ? <DropdownMenuItem onSelect={() => setStatus(original, 'declined', `${r.number} declined`)}><XCircle /> Mark declined</DropdownMenuItem> : null}
              {r.status === 'expired' && original.status === 'sent' ? <DropdownMenuItem onSelect={() => setStatus(original, 'expired', `${r.number} marked expired`)}><XCircle /> Confirm expired</DropdownMenuItem> : null}
              {r.status === 'accepted' || r.status === 'sent' ? <DropdownMenuItem onSelect={() => convert(original)}><FileOutput /> Convert to invoice</DropdownMenuItem> : null}
              {r.status === 'draft' ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => remove(original)}><Trash2 /> Delete</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader title="Quotations" description="Estimates and proposals. Accepted quotations can be converted into draft invoices." actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New quotation</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="Open pipeline" value={formatCurrency(stats.pipeline)} hint="Draft and sent, net of tax" />
        <StatCard label="Awaiting response" value={stats.open} hint="Sent and still valid" />
        <StatCard label="Accepted value" value={formatCurrency(stats.accepted)} hint="Net of tax" />
        <StatCard label="Win rate" value={formatPercent(stats.winRate)} hint="Accepted ÷ decided quotations" />
      </StatGrid>
      <DataTable
        caption="Quotations"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="quotations"
        initialSort={{ id: 'issueDate', desc: true }}
        filters={[{ id: 'status', label: 'Statuses', options: ['draft', 'sent', 'accepted', 'declined', 'expired'].map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) })), predicate: (r, v) => r.status === v }]}
      />
      <QuotationDialog open={open} onOpenChange={setOpen} quotation={editing} />
    </>
  )
}
