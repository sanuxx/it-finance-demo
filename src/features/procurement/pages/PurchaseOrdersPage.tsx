import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardList, FileText, PackageCheck, Pencil, Plus, Send, Trash2, Undo2, XCircle, Lock } from 'lucide-react'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { ActivityTimeline, DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { statusLabel } from '@/components/data-display/statusMeta'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { RecordSheet } from '@/components/dialogs/FormDialog'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { poAllowedTransitions, purchaseOrderRepository } from '@/services'
import { documentTotals, lineTotals } from '@/lib/calculations/invoices'
import { add } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { PurchaseOrderFormDialog } from '../components/PurchaseOrderFormDialog'
import { RowActions, type RowAction } from '../components/shared'
import { useNow } from '@/hooks/useNow'

type Row = PurchaseOrder & { total: number; net: number; billed: number }

const TRANSITION_LABEL: Record<PurchaseOrderStatus, { label: string; icon: React.ReactNode; approval?: boolean }> = {
  pending_approval: { label: 'Submit for approval', icon: <Send /> },
  approved: { label: 'Approve (simulated)', icon: <CheckCircle2 />, approval: true },
  draft: { label: 'Return to draft', icon: <Undo2 /> },
  sent: { label: 'Send to supplier (simulated)', icon: <Send /> },
  received: { label: 'Mark goods received', icon: <PackageCheck /> },
  closed: { label: 'Close order', icon: <Lock /> },
  cancelled: { label: 'Cancel order', icon: <XCircle /> },
}

export default function PurchaseOrdersPage() {
  const now = useNow()
  const orders = useCollection('purchaseOrders')
  const bills = useCollection('supplierBills')
  const requests = useCollection('purchaseRequests')
  const lookups = useLookups()
  const canEdit = usePermission('procurement.edit')
  const canApprove = usePermission('procurement.approve')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PurchaseOrder | undefined>()
  const [detailId, setDetailId] = useState<string | undefined>()

  const rows = useMemo<Row[]>(
    () =>
      orders.map((o) => {
        const t = documentTotals(o.lines)
        const billed = bills.filter((b) => b.purchaseOrderId === o.id && b.status !== 'void').reduce((s, b) => add(s, b.subtotal), 0)
        return { ...o, total: t.total, net: t.netAmount, billed }
      }),
    [orders, bills],
  )
  const detail = rows.find((r) => r.id === detailId)

  const transition = async (r: Row, status: PurchaseOrderStatus) => {
    let note: string | undefined
    if (status === 'cancelled') {
      const res = await confirm({ title: `Cancel ${r.number}?`, description: 'Cancelled orders cannot be reopened.', requireReason: true, confirmLabel: 'Cancel order', destructive: true })
      if (!res.confirmed) return
      note = res.reason
    }
    await runWithToast(purchaseOrderRepository.transition(r.id, status, note), `${r.number}: ${statusLabel(status)}${status === 'sent' ? ' (simulated — nothing was emailed)' : ''}`)
  }

  const actionsFor = (r: Row): RowAction[] => {
    const list: RowAction[] = []
    if (r.status === 'draft' && canEdit) list.push({ label: 'Edit', icon: <Pencil />, onSelect: () => { setEditing(r); setFormOpen(true) } })
    for (const next of poAllowedTransitions(r.status)) {
      const meta = TRANSITION_LABEL[next]
      if (meta.approval ? !canApprove : !canEdit) continue
      list.push({ label: meta.label, icon: meta.icon, onSelect: () => transition(r, next), destructive: next === 'cancelled', separatorBefore: next === 'cancelled' })
    }
    if (['approved', 'sent', 'received'].includes(r.status) && canEdit) list.push({ label: 'Record supplier bill', icon: <FileText />, onSelect: () => navigate(`/procurement/bills?po=${r.id}`) })
    if (r.status === 'draft' && canEdit)
      list.push({
        label: 'Delete draft',
        icon: <Trash2 />,
        destructive: true,
        separatorBefore: true,
        onSelect: async () => {
          const { confirmed } = await confirm({ title: `Delete ${r.number}?`, confirmLabel: 'Delete', destructive: true })
          if (confirmed) {
            await runWithToast(purchaseOrderRepository.remove(r.id), 'Draft purchase order deleted')
            setDetailId(undefined)
          }
        },
      })
    return list
  }

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'PO', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'supplier', header: 'Supplier', accessor: (r) => lookups.supplier(r.supplierId) },
    { id: 'first', header: 'Items', accessor: (r) => r.lines.map((l) => l.description).join('; '), className: 'max-w-64 truncate' },
    { id: 'department', header: 'Department', accessor: (r) => lookups.master(r.departmentId), defaultHidden: true },
    { id: 'project', header: 'Project', accessor: (r) => (r.projectId ? lookups.projectCode(r.projectId) : '') },
    { id: 'orderDate', header: 'Ordered', accessor: (r) => r.orderDate, cell: (r) => formatDate(r.orderDate) },
    { id: 'expected', header: 'Expected', accessor: (r) => r.expectedDate, cell: (r) => formatDate(r.expectedDate), defaultHidden: true },
    { id: 'total', header: 'Total', accessor: (r) => r.total, align: 'right', cell: (r) => <Money value={r.total} /> },
    { id: 'billed', header: 'Billed (net)', accessor: (r) => r.billed, align: 'right', cell: (r) => <Money value={r.billed} />, defaultHidden: true },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right', cell: (r) => <RowActions label={r.number} actions={actionsFor(r)} /> },
  ]

  const open = rows.filter((r) => ['approved', 'sent'].includes(r.status))
  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders placed with suppliers. Approved and sent orders are commitments until billed."
        actions={
          canEdit ? (
            <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
              <Plus /> New purchase order
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Open commitments" term="Committed cost" value={formatCurrency(open.reduce((s, r) => add(s, Math.max(0, r.net - r.billed)), 0))} hint={`${open.length} approved or sent orders, net of billed`} />
        <StatCard label="Pending approval" value={rows.filter((r) => r.status === 'pending_approval').length} to="/approvals" />
        <StatCard label="Drafts" value={rows.filter((r) => r.status === 'draft').length} />
        <StatCard label="Received this month" value={rows.filter((r) => r.status === 'received' && r.updatedAt.slice(0, 7) === now.toISOString().slice(0, 7)).length} />
      </StatGrid>
      <DataTable
        caption="Purchase orders"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="purchase-orders"
        initialSort={{ id: 'orderDate', desc: true }}
        onRowClick={(r) => setDetailId(r.id)}
        filters={[
          { id: 'status', label: 'Statuses', options: ['draft', 'pending_approval', 'approved', 'sent', 'received', 'closed', 'cancelled'].map((s) => ({ value: s, label: statusLabel(s) })), predicate: (r, v) => r.status === v },
          { id: 'supplier', label: 'Suppliers', options: [...new Set(orders.map((o) => o.supplierId))].map((id) => ({ value: id, label: lookups.supplier(id) })), predicate: (r, v) => r.supplierId === v },
        ]}
        emptyState={<EmptyState icon={<ClipboardList />} title="No purchase orders" description="Raise a purchase order or convert an approved purchase request." className="border-0" />}
      />
      <RecordSheet
        wide
        open={!!detail}
        onOpenChange={(o) => !o && setDetailId(undefined)}
        title={detail ? `${detail.number} — ${lookups.supplier(detail.supplierId)}` : ''}
        description={detail ? <StatusBadge status={detail.status} /> : null}
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
            <SimulatedNotice>Purchase orders are illustrative. “Send to supplier” only changes the status here — nothing is emailed.</SimulatedNotice>
            <DetailList
              items={[
                { label: 'Department', value: lookups.master(detail.departmentId) },
                { label: 'Project', value: detail.projectId ? lookups.project(detail.projectId) : '—' },
                { label: 'Order date', value: formatDate(detail.orderDate) },
                { label: 'Expected', value: formatDate(detail.expectedDate) },
                { label: 'From request', value: requests.find((p) => p.id === detail.requestId)?.number ?? '—' },
                { label: 'Billed to date (net)', value: <Money value={detail.billed} /> },
              ]}
            />
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit</th>
                    <th className="px-3 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2">{l.description}</td>
                      <td className="tabular px-3 py-2 text-right">{l.quantity}</td>
                      <td className="px-3 py-2 text-right"><Money value={l.unitPrice} /></td>
                      <td className="px-3 py-2 text-right"><Money value={lineTotals(l).net} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr className="border-t"><td colSpan={3} className="px-3 py-1.5 text-right text-muted-foreground">Tax</td><td className="px-3 py-1.5 text-right"><Money value={documentTotals(detail.lines).taxTotal} /></td></tr>
                  <tr><td colSpan={3} className="px-3 py-1.5 text-right font-medium">Total</td><td className="px-3 py-1.5 text-right font-semibold"><Money value={detail.total} /></td></tr>
                </tfoot>
              </table>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">History</h3>
              <ActivityTimeline items={detail.history} />
            </div>
          </>
        ) : null}
      </RecordSheet>
      <PurchaseOrderFormDialog open={formOpen} onOpenChange={setFormOpen} order={editing} />
    </>
  )
}
