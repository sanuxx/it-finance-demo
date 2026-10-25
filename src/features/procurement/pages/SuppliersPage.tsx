import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, CheckCircle2, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import type { Supplier } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useBillViews, useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { supplierRepository } from '@/services'
import { add } from '@/lib/calculations/money'
import { isBillIncurred } from '@/lib/calculations/bills'
import { formatCurrency } from '@/lib/formatting'
import { inRange, presetRange } from '@/lib/dates'
import { SupplierFormDialog } from '../components/SupplierFormDialog'
import { RowActions } from '../components/shared'

interface Row extends Supplier {
  outstanding: number
  overdue: number
  spend12m: number
  openPos: number
}

export default function SuppliersPage() {
  const suppliers = useCollection('suppliers')
  const bills = useCollection('supplierBills')
  const pos = useCollection('purchaseOrders')
  const billViews = useBillViews()
  const lookups = useLookups()
  const canEdit = usePermission('procurement.edit')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | undefined>()

  const rows = useMemo<Row[]>(() => {
    const range = presetRange('last_12_months')
    return suppliers.map((s) => {
      let outstanding = 0
      let overdue = 0
      let spend12m = 0
      for (const b of bills) {
        if (b.supplierId !== s.id) continue
        const v = billViews.get(b.id)
        if (v && isBillIncurred(b)) {
          outstanding = add(outstanding, v.balance.outstanding)
          if (v.overdue) overdue = add(overdue, v.balance.outstanding)
          if (inRange(b.billDate, range.from, range.to)) spend12m = add(spend12m, b.subtotal)
        }
      }
      const openPos = pos.filter((p) => p.supplierId === s.id && ['approved', 'sent', 'pending_approval'].includes(p.status)).length
      return { ...s, outstanding, overdue, spend12m, openPos }
    })
  }, [suppliers, bills, pos, billViews])

  const edit = (s?: Supplier) => {
    setEditing(s)
    setOpen(true)
  }

  const remove = async (s: Supplier) => {
    const { confirmed } = await confirm({
      title: `Delete ${s.name}?`,
      description: 'Suppliers with bills or purchase orders cannot be deleted — mark them inactive instead.',
      confirmLabel: 'Delete supplier',
      destructive: true,
    })
    if (confirmed) await runWithToast(supplierRepository.remove(s.id), 'Supplier deleted')
  }

  const columns: DataColumn<Row>[] = [
    {
      id: 'name',
      header: 'Supplier',
      accessor: (r) => r.name,
      alwaysVisible: true,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-muted-foreground text-xs">{r.code}</div>
        </div>
      ),
    },
    { id: 'category', header: 'Category', accessor: (r) => lookups.master(r.categoryId) },
    { id: 'contact', header: 'Contact', accessor: (r) => r.contactName, cell: (r) => <div><div>{r.contactName}</div><div className="text-muted-foreground text-xs">{r.email}</div></div> },
    { id: 'terms', header: 'Terms', accessor: (r) => r.paymentTermsDays, align: 'right', cell: (r) => (r.paymentTermsDays ? `Net ${r.paymentTermsDays}` : 'On receipt'), defaultHidden: true },
    { id: 'spend', header: 'Spend (12 m)', accessor: (r) => r.spend12m, align: 'right', cell: (r) => <Money value={r.spend12m} /> },
    { id: 'openPos', header: 'Open POs', accessor: (r) => r.openPos, align: 'right' },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => r.outstanding, align: 'right', cell: (r) => <Money value={r.outstanding} /> },
    { id: 'overdue', header: 'Overdue', accessor: (r) => r.overdue, align: 'right', cell: (r) => (r.overdue > 0 ? <Money value={r.overdue} className="text-destructive font-medium" /> : <span className="text-muted-foreground">—</span>) },
    { id: 'vendor', header: 'Software vendor', accessor: (r) => r.isSoftwareVendor, defaultHidden: true },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
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
        canEdit ? (
          <RowActions
            label={r.name}
            actions={[
              { label: 'Edit', icon: <Pencil />, onSelect: () => edit(r) },
              r.status === 'active'
                ? { label: 'Deactivate', icon: <Ban />, onSelect: () => runWithToast(supplierRepository.update(r.id, { status: 'inactive' }), `${r.name} deactivated`) }
                : { label: 'Reactivate', icon: <CheckCircle2 />, onSelect: () => runWithToast(supplierRepository.update(r.id, { status: 'active' }), `${r.name} reactivated`) },
              { label: 'Delete', icon: <Trash2 />, onSelect: () => remove(r), destructive: true, separatorBefore: true },
            ]}
          />
        ) : null,
    },
  ]

  const totalOutstanding = rows.reduce((s, r) => add(s, r.outstanding), 0)
  const totalOverdue = rows.reduce((s, r) => add(s, r.overdue), 0)
  const totalSpend = rows.reduce((s, r) => add(s, r.spend12m), 0)

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Suppliers and software vendors with payables and spend derived from their bills."
        actions={
          canEdit ? (
            <Button onClick={() => edit()}>
              <Plus /> New supplier
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Active suppliers" value={rows.filter((r) => r.status === 'active').length} hint={`${rows.filter((r) => r.isSoftwareVendor).length} software vendors`} />
        <StatCard label="Outstanding payables" term="Accounts payable" value={formatCurrency(totalOutstanding)} to="/procurement/bills" />
        <StatCard label="Overdue to suppliers" value={formatCurrency(totalOverdue)} to="/procurement/bills?status=overdue" />
        <StatCard label="Billed spend (12 months)" value={formatCurrency(totalSpend)} hint="Approved bills, excluding tax" to="/procurement/vendor-spend" />
      </StatGrid>
      <DataTable
        caption="Suppliers"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="suppliers"
        searchPlaceholder="Search name, code, contact…"
        initialSort={{ id: 'spend', desc: true }}
        onRowClick={(r) => navigate(`/procurement/suppliers/${r.id}`)}
        filters={[
          {
            id: 'status',
            label: 'Statuses',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
            predicate: (r, v) => r.status === v,
          },
          {
            id: 'category',
            label: 'Categories',
            options: [...new Set(suppliers.map((s) => s.categoryId))].map((id) => ({ value: id, label: lookups.master(id) })),
            predicate: (r, v) => r.categoryId === v,
          },
        ]}
        emptyState={<EmptyState icon={<Truck />} title="No suppliers yet" description="Add a fictional supplier to start raising purchase orders." className="border-0" />}
      />
      <SupplierFormDialog open={open} onOpenChange={setOpen} supplier={editing} />
    </>
  )
}
