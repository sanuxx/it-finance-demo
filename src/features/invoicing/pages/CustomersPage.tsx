import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import type { Customer } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useInvoiceViews } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { customerRepository } from '@/services'
import { add } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import { CustomerFormDialog } from '../components/CustomerFormDialog'

interface CustomerRow extends Customer {
  outstanding: number
  overdue: number
  invoiceCount: number
}

export default function CustomersPage() {
  const customers = useCollection('customers')
  const invoices = useCollection('invoices')
  const views = useInvoiceViews()
  const canEdit = usePermission('sales.edit')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Customer | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const rows = useMemo<CustomerRow[]>(() => {
    return customers.map((c) => {
      let outstanding = 0
      let overdue = 0
      let invoiceCount = 0
      for (const inv of invoices) {
        if (inv.customerId !== c.id) continue
        invoiceCount++
        const v = views.get(inv.id)
        if (!v) continue
        outstanding = add(outstanding, v.balance.outstanding)
        if (v.displayStatus === 'overdue') overdue = add(overdue, v.balance.outstanding)
      }
      return { ...c, outstanding, overdue, invoiceCount }
    })
  }, [customers, invoices, views])

  const totals = useMemo(
    () => ({
      active: rows.filter((r) => r.status === 'active').length,
      outstanding: rows.reduce((s, r) => add(s, r.outstanding), 0),
      overdue: rows.reduce((s, r) => add(s, r.overdue), 0),
      withOverdue: rows.filter((r) => r.overdue > 0).length,
    }),
    [rows],
  )

  const openEdit = (c?: Customer) => {
    setEditing(c)
    setFormOpen(true)
  }

  const remove = async (c: Customer) => {
    const { confirmed } = await confirm({
      title: `Delete ${c.name}?`,
      description: 'The customer will be removed from this browser’s demo data. Customers with invoices or projects cannot be deleted — mark them inactive instead.',
      confirmLabel: 'Delete customer',
      destructive: true,
    })
    if (confirmed) await runWithToast(customerRepository.remove(c.id), 'Customer deleted')
  }

  const columns: DataColumn<CustomerRow>[] = [
    {
      id: 'name',
      header: 'Customer',
      accessor: (r) => r.name,
      alwaysVisible: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.name}</div>
          <div className="text-muted-foreground text-xs">{r.code}</div>
        </div>
      ),
    },
    { id: 'industry', header: 'Industry', accessor: (r) => r.industry },
    { id: 'contact', header: 'Billing contact', accessor: (r) => r.contactName, cell: (r) => <div><div>{r.contactName}</div><div className="text-muted-foreground text-xs">{r.email}</div></div> },
    { id: 'country', header: 'Country', accessor: (r) => r.country, defaultHidden: true },
    { id: 'terms', header: 'Terms', accessor: (r) => r.paymentTermsDays, cell: (r) => `Net ${r.paymentTermsDays}`, align: 'right', defaultHidden: true },
    { id: 'invoices', header: 'Invoices', accessor: (r) => r.invoiceCount, align: 'right' },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => r.outstanding, align: 'right', cell: (r) => <Money value={r.outstanding} /> },
    { id: 'overdue', header: 'Overdue', accessor: (r) => r.overdue, align: 'right', cell: (r) => (r.overdue > 0 ? <Money value={r.overdue} className="text-destructive font-medium" /> : <span className="text-muted-foreground">—</span>) },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => openEdit(r)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/sales/invoices/new?customer=${r.id}`)}>
                <Plus /> New invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer accounts with balances derived from their invoices, payments and credit notes."
        actions={
          canEdit ? (
            <Button onClick={() => openEdit()}>
              <Plus /> New customer
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Active customers" value={totals.active} hint={`${rows.length} in total`} />
        <StatCard label="Outstanding" term="Accounts receivable" value={formatCurrency(totals.outstanding)} to="/finance/receivables" />
        <StatCard label="Overdue" value={formatCurrency(totals.overdue)} hint={`${totals.withOverdue} customer(s) with overdue balances`} to="/sales/invoices?status=overdue" />
        <StatCard label="Prospects" value={rows.filter((r) => r.status === 'prospect').length} hint="Not yet invoiced" />
      </StatGrid>
      <DataTable
        caption="Customers"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search name, code, contact…"
        exportName="customers"
        initialSort={{ id: 'outstanding', desc: true }}
        onRowClick={(r) => navigate(`/sales/customers/${r.id}`)}
        filters={[
          {
            id: 'status',
            label: 'Statuses',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'inactive', label: 'Inactive' },
            ],
            predicate: (r, v) => r.status === v,
          },
          {
            id: 'balance',
            label: 'Balances',
            options: [
              { value: 'outstanding', label: 'Has outstanding balance' },
              { value: 'overdue', label: 'Has overdue balance' },
            ],
            predicate: (r, v) => (v === 'overdue' ? r.overdue > 0 : r.outstanding > 0),
          },
        ]}
        emptyState={<EmptyState icon={<Users />} title="No customers yet" description="Create your first fictional customer to start invoicing." className="border-0" />}
      />
      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />
    </>
  )
}
