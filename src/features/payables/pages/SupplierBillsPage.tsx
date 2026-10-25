import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Ban, CheckCircle2, FileText, Pencil, Plus, Send, Trash2, Wallet } from 'lucide-react'
import type { SupplierBill } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { ActivityTimeline, DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { RecordSheet } from '@/components/dialogs/FormDialog'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useBillViews, useCollection, useLookups, type BillView } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { supplierBillRepository } from '@/services'
import { add } from '@/lib/calculations/money'
import { billPayments } from '@/lib/calculations/bills'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { daysBetween, todayISO } from '@/lib/dates'
import { SupplierBillFormDialog } from '@/features/procurement/components/SupplierBillFormDialog'
import { RecordPaymentDialog, RowActions } from '@/features/procurement/components/shared'

type Row = SupplierBill & { view: BillView; displayStatus: string }

export default function SupplierBillsPage() {
  const bills = useCollection('supplierBills')
  const payments = useCollection('payments')
  const purchaseOrders = useCollection('purchaseOrders')
  const views = useBillViews()
  const lookups = useLookups()
  const canEdit = usePermission('procurement.edit')
  const canApprove = usePermission('procurement.approve')
  const canPay = usePermission('payments.record')
  const confirm = useConfirm()
  const [params] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierBill | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>(() => params.get('bill') ?? undefined)
  const [paying, setPaying] = useState<Row | undefined>()
  const poParam = params.get('po')
  const billParam = params.get('bill')

  // Deep link from other screens: /procurement/bills?bill=<id> opens that bill.
  useEffect(() => {
    if (billParam) setDetailId(billParam)
  }, [billParam])

  // Arriving from a purchase order ("Record supplier bill") opens a pre-filled form.
  useEffect(() => {
    if (poParam && canEdit) {
      setEditing(undefined)
      setFormOpen(true)
    }
  }, [poParam, canEdit])

  const rows = useMemo<Row[]>(
    () =>
      bills.map((b) => {
        const view = views.get(b.id)!
        return { ...b, view, displayStatus: view.overdue ? 'overdue' : view.status }
      }),
    [bills, views],
  )
  const detail = rows.find((r) => r.id === detailId)

  const kpi = useMemo(() => {
    const today = todayISO()
    const open = rows.filter((r) => r.view.balance.outstanding > 0 && ['approved', 'partially_paid'].includes(r.view.status))
    return {
      outstanding: open.reduce((s, r) => add(s, r.view.balance.outstanding), 0),
      overdue: open.filter((r) => r.view.overdue).reduce((s, r) => add(s, r.view.balance.outstanding), 0),
      dueSoon: open.filter((r) => !r.view.overdue && daysBetween(today, r.dueDate) <= 14).reduce((s, r) => add(s, r.view.balance.outstanding), 0),
      awaiting: rows.filter((r) => r.status === 'awaiting_approval').length,
    }
  }, [rows])

  const act = async (fn: () => Promise<unknown>, msg: string) => runWithToast(fn(), msg)

  const voidBill = async (b: Row) => {
    const { confirmed, reason } = await confirm({ title: `Void ${b.number}?`, description: 'A voided bill no longer counts as an expense or payable. Bills with payments cannot be voided.', requireReason: true, confirmLabel: 'Void bill', destructive: true })
    if (confirmed) await act(() => supplierBillRepository.void(b.id, reason), `${b.number} voided`)
  }
  const removeBill = async (b: Row) => {
    const { confirmed } = await confirm({ title: `Delete draft ${b.number}?`, description: 'The draft will be permanently removed from this browser’s demo data.', confirmLabel: 'Delete', destructive: true })
    if (confirmed) await act(() => supplierBillRepository.remove(b.id), 'Draft bill deleted')
  }

  const actionsFor = (r: Row) => [
    ...(r.status === 'draft' && canEdit
      ? [
          { label: 'Edit', icon: <Pencil />, onSelect: () => { setEditing(r); setFormOpen(true) } },
          { label: 'Submit for approval', icon: <Send />, onSelect: () => act(() => supplierBillRepository.submitForApproval(r.id), `${r.number} submitted for approval`) },
        ]
      : []),
    ...((r.status === 'awaiting_approval' || r.status === 'draft') && canApprove
      ? [{ label: 'Approve (simulated)', icon: <CheckCircle2 />, onSelect: () => act(() => supplierBillRepository.approve(r.id), `${r.number} approved`) }]
      : []),
    ...((r.view.status === 'approved' || r.view.status === 'partially_paid') && r.view.balance.outstanding > 0 && canPay
      ? [{ label: 'Record simulated payment', icon: <Wallet />, onSelect: () => setPaying(r) }]
      : []),
    ...(r.status !== 'void' && r.status !== 'draft' && canApprove ? [{ label: 'Void', icon: <Ban />, onSelect: () => voidBill(r), destructive: true, separatorBefore: true }] : []),
    ...(r.status === 'draft' && canEdit ? [{ label: 'Delete draft', icon: <Trash2 />, onSelect: () => removeBill(r), destructive: true, separatorBefore: true }] : []),
  ]

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Bill', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.number}</div><div className="text-muted-foreground text-xs">{r.supplierReference}</div></div> },
    { id: 'supplier', header: 'Supplier', accessor: (r) => lookups.supplier(r.supplierId) },
    { id: 'description', header: 'Description', accessor: (r) => r.description, className: 'max-w-64 truncate' },
    { id: 'category', header: 'Category', accessor: (r) => lookups.master(r.categoryId), defaultHidden: true },
    { id: 'project', header: 'Project', accessor: (r) => (r.projectId ? lookups.projectCode(r.projectId) : ''), defaultHidden: true },
    { id: 'billDate', header: 'Bill date', accessor: (r) => r.billDate, cell: (r) => formatDate(r.billDate) },
    { id: 'dueDate', header: 'Due', accessor: (r) => r.dueDate, cell: (r) => <span className={r.view.overdue ? 'text-destructive font-medium' : undefined}>{formatDate(r.dueDate)}</span> },
    { id: 'total', header: 'Total', accessor: (r) => r.view.balance.total, align: 'right', cell: (r) => <Money value={r.view.balance.total} /> },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => r.view.balance.outstanding, align: 'right', cell: (r) => <Money value={r.view.balance.outstanding} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.displayStatus, cell: (r) => <StatusBadge status={r.displayStatus} /> },
    { id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right', cell: (r) => <RowActions label={r.number} actions={actionsFor(r)} /> },
  ]

  const statusOptions = ['draft', 'awaiting_approval', 'approved', 'partially_paid', 'paid', 'overdue', 'void'].map((s) => ({ value: s, label: s === 'overdue' ? 'Overdue' : s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }))

  return (
    <>
      <PageHeader
        title="Supplier bills"
        description="Bills from suppliers. Approved bills count as expenses; payments recorded here are simulated."
        actions={
          canEdit ? (
            <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
              <Plus /> New bill
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Outstanding payables" term="Accounts payable" value={formatCurrency(kpi.outstanding)} to="/finance/payables" />
        <StatCard label="Overdue" value={formatCurrency(kpi.overdue)} hint="Past due date, unpaid" />
        <StatCard label="Due in next 14 days" value={formatCurrency(kpi.dueSoon)} />
        <StatCard label="Awaiting approval" value={kpi.awaiting} hint="Bills to review" to="/approvals" />
      </StatGrid>
      <DataTable
        caption="Supplier bills"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="supplier-bills"
        initialSort={{ id: 'billDate', desc: true }}
        searchPlaceholder="Search bill, supplier, description…"
        onRowClick={(r) => setDetailId(r.id)}
        rowClassName={(r) => (r.view.overdue ? 'bg-destructive/[0.03]' : undefined)}
        filters={[
          { id: 'status', label: 'Statuses', options: statusOptions, predicate: (r, v) => r.displayStatus === v, defaultValue: params.get('status') ?? undefined },
          { id: 'supplier', label: 'Suppliers', options: [...new Set(bills.map((b) => b.supplierId))].map((id) => ({ value: id, label: lookups.supplier(id) })), predicate: (r, v) => r.supplierId === v, defaultValue: params.get('supplier') ?? undefined },
        ]}
        emptyState={<EmptyState icon={<FileText />} title="No supplier bills" description="Record a bill when a supplier invoices you." className="border-0" />}
      />

      <RecordSheet
        open={!!detail}
        onOpenChange={(o) => !o && setDetailId(undefined)}
        title={detail ? `${detail.number} — ${lookups.supplier(detail.supplierId)}` : ''}
        description={detail ? <StatusBadge status={detail.displayStatus} /> : null}
        actions={
          detail
            ? actionsFor(detail)
                .filter((a) => !a.destructive)
                .map((a) => (
                  <Button key={a.label} size="sm" variant="outline" onClick={a.onSelect}>
                    {a.icon}
                    {a.label}
                  </Button>
                ))
            : null
        }
      >
        {detail ? (
          <>
            <DetailList
              items={[
                { label: 'Supplier reference', value: detail.supplierReference },
                { label: 'Category', value: lookups.master(detail.categoryId) },
                { label: 'Department', value: lookups.master(detail.departmentId) },
                { label: 'Project', value: detail.projectId ? <Link className="text-primary hover:underline" to={`/projects/${detail.projectId}`}>{lookups.project(detail.projectId)}</Link> : '—' },
                { label: 'Purchase order', value: purchaseOrders.find((p) => p.id === detail.purchaseOrderId)?.number ?? '—' },
                { label: 'Bill date', value: formatDate(detail.billDate) },
                { label: 'Due date', value: formatDate(detail.dueDate) },
                { label: 'Subtotal', value: <Money value={detail.subtotal} /> },
                { label: 'Tax', value: <Money value={detail.taxAmount} /> },
                { label: 'Total', value: <Money value={detail.view.balance.total} className="font-semibold" /> },
                { label: 'Paid (simulated)', value: <Money value={detail.view.balance.paid} /> },
                { label: 'Outstanding', value: <Money value={detail.view.balance.outstanding} className="font-semibold" /> },
                { label: 'Description', value: detail.description, full: true },
              ]}
            />
            <div>
              <h3 className="mb-2 text-sm font-semibold">Payments</h3>
              {billPayments(detail.id, payments).length ? (
                <ul className="divide-y rounded-md border text-sm">
                  {billPayments(detail.id, payments).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span>
                        {p.number} · {formatDate(p.date)} <span className="text-muted-foreground">· {p.method.replace('_', ' ')}</span>
                      </span>
                      <Money value={p.amount} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No payments recorded.</p>
              )}
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">History</h3>
              <ActivityTimeline items={detail.history} />
            </div>
          </>
        ) : null}
      </RecordSheet>

      <SupplierBillFormDialog open={formOpen} onOpenChange={setFormOpen} bill={editing} defaultPoId={editing ? undefined : (poParam ?? undefined)} />
      {paying ? (
        <RecordPaymentDialog
          open={!!paying}
          onOpenChange={(o) => !o && setPaying(undefined)}
          title={`Pay ${paying.number}`}
          outstanding={paying.view.balance.outstanding}
          defaultReference={paying.supplierReference}
          onSubmit={(input) => supplierBillRepository.recordPayment(paying.id, input)}
        />
      ) : null}
      <SimulatedNotice className="mt-4">Approvals and payments on this page are demonstrations stored in your browser. No accounting postings or bank transfers are made.</SimulatedNotice>
    </>
  )
}
