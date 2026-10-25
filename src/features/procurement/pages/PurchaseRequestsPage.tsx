import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, format } from 'date-fns'
import { ArrowRightLeft, CheckCircle2, Inbox, Pencil, Plus, Send, Trash2, Undo2, XCircle } from 'lucide-react'
import type { PurchaseRequest } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { ActivityTimeline, DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { statusLabel } from '@/components/data-display/statusMeta'
import { EmptyState } from '@/components/feedback/Feedback'
import { FormDialog, RecordSheet } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { purchaseRequestRepository } from '@/services'
import { add } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { RowActions, type RowAction } from '../components/shared'
import { useProcurementOptions } from '../lib/useProcurementOptions'

const schema = z.object({
  title: z.string().trim().min(4, 'Describe what you need').max(120),
  requesterId: z.string().min(1, 'Choose the requester'),
  departmentId: z.string().min(1, 'Choose a department'),
  projectId: z.string().optional(),
  supplierId: z.string().optional(),
  estimatedAmount: z.number({ error: 'Enter an estimate' }).positive('Must be greater than zero'),
  neededBy: z.string().min(10, 'Choose a date'),
  justification: z.string().trim().min(10, 'Give a short business justification (10+ characters)').max(1000),
})
type Values = z.infer<typeof schema>

function RequestFormDialog({ open, onOpenChange, request }: { open: boolean; onOpenChange: (o: boolean) => void; request?: PurchaseRequest }) {
  const o = useProcurementOptions()
  const employees = useCollection('employees')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open)
      form.reset(
        request ?? { title: '', requesterId: employees[0]?.id ?? '', departmentId: '', projectId: undefined, supplierId: undefined, estimatedAmount: undefined as unknown as number, neededBy: format(addDays(new Date(), 21), 'yyyy-MM-dd'), justification: '' },
      )
  }, [open, request, employees, form])
  const save = useAction(
    async (v: Values) => (request ? purchaseRequestRepository.update(request.id, v) : purchaseRequestRepository.create({ ...v, number: '', status: 'draft', history: [] })),
    { success: request ? 'Request updated' : 'Draft request created' },
  )
  const c = form.control
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={request ? `Edit ${request.number}` : 'New purchase request'}
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="title" label="What is needed?" required autoFocus className="sm:col-span-2" />
        <SelectField control={c} name="requesterId" label="Requested by" options={employees.map((e) => ({ value: e.id, label: e.name }))} required />
        <SelectField control={c} name="departmentId" label="Department" options={o.departments} required />
        <SelectField control={c} name="projectId" label="Project (optional)" options={o.projects} allowNone noneLabel="No project" />
        <SelectField control={c} name="supplierId" label="Preferred supplier" options={o.suppliers} allowNone noneLabel="Not decided" description="Required before converting to a PO." />
        <NumberField control={c} name="estimatedAmount" label="Estimated amount (excl. tax)" prefix="LKR" required min={0} />
        <TextField control={c} name="neededBy" label="Needed by" type="date" required />
        <TextareaField control={c} name="justification" label="Business justification" required className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function PurchaseRequestsPage() {
  const requests = useCollection('purchaseRequests')
  const orders = useCollection('purchaseOrders')
  const lookups = useLookups()
  const canEdit = usePermission('procurement.edit')
  const canApprove = usePermission('procurement.approve')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PurchaseRequest | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>()
  const detail = requests.find((r) => r.id === detailId)

  const reject = async (r: PurchaseRequest) => {
    const res = await confirm({ title: `Reject ${r.number}?`, description: 'The requester can revise and resubmit a rejected request.', requireReason: true, reasonLabel: 'Reason for rejection', confirmLabel: 'Reject', destructive: true })
    if (res.confirmed) await runWithToast(purchaseRequestRepository.transition(r.id, 'rejected', res.reason), `${r.number} rejected`)
  }
  const convert = async (r: PurchaseRequest) => {
    const po = await runWithToast(purchaseRequestRepository.convertToOrder(r.id))
    if (po) {
      toast.success(`Created draft ${po.number}`, { action: { label: 'View orders', onClick: () => navigate('/procurement/purchase-orders') } })
    }
  }

  const actionsFor = (r: PurchaseRequest): RowAction[] => {
    const a: RowAction[] = []
    if ((r.status === 'draft' || r.status === 'rejected') && canEdit) a.push({ label: 'Edit', icon: <Pencil />, onSelect: () => { setEditing(r); setFormOpen(true) } })
    if (r.status === 'draft' && canEdit) a.push({ label: 'Submit for approval', icon: <Send />, onSelect: () => runWithToast(purchaseRequestRepository.transition(r.id, 'submitted'), `${r.number} submitted`) })
    if (r.status === 'rejected' && canEdit) a.push({ label: 'Reopen as draft', icon: <Undo2 />, onSelect: () => runWithToast(purchaseRequestRepository.transition(r.id, 'draft'), `${r.number} reopened`) })
    if (r.status === 'submitted' && canApprove) {
      a.push({ label: 'Approve (simulated)', icon: <CheckCircle2 />, onSelect: () => runWithToast(purchaseRequestRepository.transition(r.id, 'approved', 'Approved (simulated)'), `${r.number} approved`) })
      a.push({ label: 'Reject…', icon: <XCircle />, onSelect: () => reject(r), destructive: true })
    }
    if (r.status === 'approved' && canEdit) a.push({ label: 'Convert to purchase order', icon: <ArrowRightLeft />, onSelect: () => convert(r), disabled: !r.supplierId })
    if ((r.status === 'draft' || r.status === 'rejected') && canEdit)
      a.push({
        label: 'Delete',
        icon: <Trash2 />,
        destructive: true,
        separatorBefore: true,
        onSelect: async () => {
          const { confirmed } = await confirm({ title: `Delete ${r.number}?`, confirmLabel: 'Delete', destructive: true })
          if (confirmed) await runWithToast(purchaseRequestRepository.remove(r.id), 'Request deleted')
        },
      })
    return a
  }

  const columns: DataColumn<PurchaseRequest>[] = [
    { id: 'number', header: 'Request', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.number}</div><div className="text-muted-foreground max-w-64 truncate text-xs">{r.title}</div></div> },
    { id: 'title', header: 'Title', accessor: (r) => r.title, defaultHidden: true },
    { id: 'requester', header: 'Requested by', accessor: (r) => lookups.employee(r.requesterId) },
    { id: 'department', header: 'Department', accessor: (r) => lookups.master(r.departmentId) },
    { id: 'supplier', header: 'Supplier', accessor: (r) => (r.supplierId ? lookups.supplier(r.supplierId) : ''), defaultHidden: true },
    { id: 'neededBy', header: 'Needed by', accessor: (r) => r.neededBy, cell: (r) => formatDate(r.neededBy) },
    { id: 'amount', header: 'Estimate', accessor: (r) => r.estimatedAmount, align: 'right', cell: (r) => <Money value={r.estimatedAmount} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right', cell: (r) => <RowActions label={r.number} actions={actionsFor(r)} /> },
  ]

  const stats = useMemo(() => {
    const submitted = requests.filter((r) => r.status === 'submitted')
    return { submitted: submitted.length, submittedValue: submitted.reduce((s, r) => add(s, r.estimatedAmount), 0), approved: requests.filter((r) => r.status === 'approved').length, converted: requests.filter((r) => r.status === 'converted').length }
  }, [requests])

  return (
    <>
      <PageHeader
        title="Purchase requests"
        description="Internal requests to buy. Approved requests can be converted to purchase orders."
        actions={canEdit ? <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}><Plus /> New request</Button> : null}
      />
      <StatGrid className="mb-6">
        <StatCard label="Awaiting approval" value={stats.submitted} hint={formatCurrency(stats.submittedValue)} to="/approvals" />
        <StatCard label="Approved, not ordered" value={stats.approved} />
        <StatCard label="Converted to POs" value={stats.converted} to="/procurement/purchase-orders" />
        <StatCard label="Total requests" value={requests.length} />
      </StatGrid>
      <DataTable
        caption="Purchase requests"
        data={requests}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="purchase-requests"
        initialSort={{ id: 'number', desc: true }}
        onRowClick={(r) => setDetailId(r.id)}
        filters={[{ id: 'status', label: 'Statuses', options: ['draft', 'submitted', 'approved', 'rejected', 'converted'].map((s) => ({ value: s, label: statusLabel(s) })), predicate: (r, v) => r.status === v }]}
        emptyState={<EmptyState icon={<Inbox />} title="No purchase requests" className="border-0" />}
      />
      <RecordSheet
        open={!!detail}
        onOpenChange={(o) => !o && setDetailId(undefined)}
        title={detail ? `${detail.number} — ${detail.title}` : ''}
        description={detail ? <StatusBadge status={detail.status} /> : null}
        actions={detail ? actionsFor(detail).filter((a) => !a.separatorBefore).map((a) => <Button key={a.label} size="sm" variant="outline" disabled={a.disabled} onClick={a.onSelect}>{a.icon}{a.label}</Button>) : null}
      >
        {detail ? (
          <>
            <DetailList
              items={[
                { label: 'Requested by', value: lookups.employee(detail.requesterId) },
                { label: 'Department', value: lookups.master(detail.departmentId) },
                { label: 'Project', value: detail.projectId ? lookups.project(detail.projectId) : '—' },
                { label: 'Preferred supplier', value: detail.supplierId ? lookups.supplier(detail.supplierId) : 'Not decided' },
                { label: 'Estimated amount', value: <Money value={detail.estimatedAmount} /> },
                { label: 'Needed by', value: formatDate(detail.neededBy) },
                { label: 'Purchase order', value: orders.find((o) => o.requestId === detail.id)?.number ?? '—' },
                { label: 'Justification', value: detail.justification, full: true },
              ]}
            />
            <div>
              <h3 className="mb-3 text-sm font-semibold">Approval history (simulated)</h3>
              <ActivityTimeline items={detail.history} />
            </div>
          </>
        ) : null}
      </RecordSheet>
      <RequestFormDialog open={formOpen} onOpenChange={setFormOpen} request={editing} />
    </>
  )
}
