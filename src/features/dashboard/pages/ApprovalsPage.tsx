import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useDbSlice } from '@/hooks/useData'
import { useCan } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { budgetRepository, expenseRepository, purchaseOrderRepository, purchaseRequestRepository, supplierBillRepository } from '@/services'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { APPROVAL_KIND_LABEL, approvalsTotal, collectApprovals, type ApprovalItem, type ApprovalKind } from '../lib/approvals'

const REJECT_LABEL: Record<ApprovalKind, string> = {
  expense: 'Reject',
  purchase_order: 'Return to draft',
  supplier_bill: 'Reject (void)',
  purchase_request: 'Reject',
  budget: 'Request revision',
}

async function approve(item: ApprovalItem) {
  switch (item.kind) {
    case 'expense':
      return expenseRepository.approve(item.id, 'Approved from the approvals inbox (simulated)')
    case 'purchase_order':
      return purchaseOrderRepository.transition(item.id, 'approved', 'Approved from the approvals inbox (simulated)')
    case 'supplier_bill':
      return supplierBillRepository.approve(item.id, 'Approved from the approvals inbox (simulated)')
    case 'purchase_request':
      return purchaseRequestRepository.transition(item.id, 'approved', 'Approved from the approvals inbox (simulated)')
    case 'budget':
      return budgetRepository.setStatus(item.id, 'approved')
  }
}

async function reject(item: ApprovalItem, reason: string) {
  switch (item.kind) {
    case 'expense':
      return expenseRepository.reject(item.id, reason)
    case 'purchase_order':
      return purchaseOrderRepository.transition(item.id, 'draft', reason)
    case 'supplier_bill':
      return supplierBillRepository.void(item.id, reason)
    case 'purchase_request':
      return purchaseRequestRepository.transition(item.id, 'rejected', reason)
    case 'budget':
      return budgetRepository.setStatus(item.id, 'revision', reason)
  }
}

export default function ApprovalsPage() {
  const db = useDbSlice('expenses', 'purchaseOrders', 'supplierBills', 'purchaseRequests', 'budgets', 'employees', 'suppliers', 'users')
  const items = useMemo(() => collectApprovals(db), [db])
  const can = useCan()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const byKind = (k: ApprovalKind) => items.filter((i) => i.kind === k)

  const onApprove = async (item: ApprovalItem) => {
    const { confirmed } = await confirm({
      title: `Approve ${item.number}?`,
      description: `${item.title} — ${formatCurrency(item.amount)}. This is a simulated approval stored in this browser; it does not authorise any real financial operation.`,
      confirmLabel: 'Approve',
    })
    if (confirmed) await runWithToast(approve(item), `${item.number} approved (simulated)`)
  }

  const onReject = async (item: ApprovalItem) => {
    const { confirmed, reason } = await confirm({
      title: `${REJECT_LABEL[item.kind]}: ${item.number}`,
      description: item.title,
      confirmLabel: REJECT_LABEL[item.kind],
      destructive: true,
      requireReason: true,
      reasonLabel: 'Reason (shared with the requester)',
    })
    if (confirmed) await runWithToast(reject(item, reason), `${item.number} updated`)
  }

  const columns: DataColumn<ApprovalItem>[] = [
    {
      id: 'item',
      header: 'Request',
      alwaysVisible: true,
      accessor: (r) => `${r.number} ${r.title}`,
      cell: (r) => (
        <div className="min-w-0">
          <Link to={r.link} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {r.number}
          </Link>
          <div className="text-muted-foreground max-w-md truncate text-xs">{r.title}</div>
        </div>
      ),
    },
    { id: 'kind', header: 'Type', accessor: (r) => APPROVAL_KIND_LABEL[r.kind] },
    { id: 'requester', header: 'Requested by', accessor: (r) => r.requester },
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'flag', header: 'Rules', accessor: (r) => (r.flagged ? 'Flagged for review' : ''), cell: (r) => (r.flagged ? <span className="text-warning text-xs font-medium">Flagged for review</span> : <span className="text-muted-foreground">—</span>) },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      align: 'right',
      cell: (r) =>
        can(r.permission) ? (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={() => onApprove(r)} aria-label={`Approve ${r.number}`}>
              <Check /> Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReject(r)} aria-label={`${REJECT_LABEL[r.kind]} ${r.number}`}>
              <X />
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs" title="Your demo role cannot approve this type of request">View only</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader title="Approvals inbox" description="Everything waiting for a decision across expenses, purchasing, supplier bills and budgets." />
      <StatGrid className="mb-4">
        <StatCard label="Waiting" value={items.length} hint={formatCurrency(approvalsTotal(items))} />
        <StatCard label="Expense claims" value={byKind('expense').length} hint={formatCurrency(approvalsTotal(byKind('expense')))} to="/finance/expenses" />
        <StatCard label="Purchasing" value={byKind('purchase_order').length + byKind('purchase_request').length} hint="Purchase orders and requests" to="/procurement/purchase-orders" />
        <StatCard label="Bills & budgets" value={byKind('supplier_bill').length + byKind('budget').length} hint="Supplier bills and budget submissions" to="/procurement/bills" />
      </StatGrid>
      <SimulatedNotice className="mb-4">
        Approvals here are a browser-side demonstration. They change the demo records only and never authorise real payments or purchases. Configure the approval stages in the{' '}
        <Link to="/config/workflows" className="text-primary hover:underline">
          workflow builder
        </Link>
        .
      </SimulatedNotice>
      <DataTable
        caption="Pending approvals"
        data={items}
        columns={columns}
        getRowId={(r) => `${r.kind}:${r.id}`}
        onRowClick={(r) => navigate(r.link)}
        exportName="pending-approvals"
        initialSort={{ id: 'date', desc: true }}
        filters={[
          {
            id: 'kind',
            label: 'Types',
            options: (Object.keys(APPROVAL_KIND_LABEL) as ApprovalKind[]).map((k) => ({ value: k, label: APPROVAL_KIND_LABEL[k] })),
            predicate: (r, v) => r.kind === v,
          },
        ]}
        emptyState={<EmptyState icon={<CheckCircle2 />} title="All caught up" description="There is nothing waiting for approval." className="border-0" />}
      />
    </>
  )
}
