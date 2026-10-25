import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Invoice } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useCollection, useInvoiceViews, useLookups, type InvoiceView } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { invoiceRepository } from '@/services'
import { add } from '@/lib/calculations/money'
import { exportCsv, timestampedName } from '@/lib/export'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { todayIso } from '../lib/billing'

type Row = Invoice & { view: InvoiceView; customerName: string; projectName: string }

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
  { value: 'open', label: 'Open (unpaid balance)' },
]

export default function InvoicesPage() {
  const invoices = useCollection('invoices')
  const customers = useCollection('customers')
  const views = useInvoiceViews()
  const lookups = useLookups()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const canEdit = usePermission('sales.edit')
  const canIssue = usePermission('invoices.issue')

  const rows = useMemo<Row[]>(
    () =>
      invoices
        .map((i) => ({ ...i, view: views.get(i.id)!, customerName: lookups.customer(i.customerId), projectName: i.projectId ? lookups.projectCode(i.projectId) : '' }))
        .filter((r) => r.view),
    [invoices, views, lookups],
  )

  const stats = useMemo(() => {
    const month = todayIso().slice(0, 7)
    let outstanding = 0
    let overdue = 0
    let overdueCount = 0
    let billedThisMonth = 0
    for (const r of rows) {
      outstanding = add(outstanding, r.view.balance.outstanding)
      if (r.view.displayStatus === 'overdue') {
        overdue = add(overdue, r.view.balance.outstanding)
        overdueCount++
      }
      if (r.status !== 'draft' && r.status !== 'void' && r.issueDate.startsWith(month)) billedThisMonth = add(billedThisMonth, r.view.totals.total)
    }
    return { outstanding, overdue, overdueCount, billedThisMonth, drafts: rows.filter((r) => r.status === 'draft').length }
  }, [rows])

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Invoice', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'customer', header: 'Customer', accessor: (r) => r.customerName },
    { id: 'project', header: 'Project', accessor: (r) => r.projectName, defaultHidden: true },
    { id: 'issueDate', header: 'Issued', accessor: (r) => r.issueDate, cell: (r) => formatDate(r.issueDate) },
    { id: 'dueDate', header: 'Due', accessor: (r) => r.dueDate, cell: (r) => <span className={r.view.displayStatus === 'overdue' ? 'text-destructive font-medium' : undefined}>{formatDate(r.dueDate)}</span> },
    { id: 'net', header: 'Net (excl. tax)', accessor: (r) => r.view.totals.netAmount, align: 'right', defaultHidden: true, cell: (r) => <Money value={r.view.totals.netAmount} /> },
    { id: 'total', header: 'Total', accessor: (r) => r.view.totals.total, align: 'right', cell: (r) => <Money value={r.view.totals.total} /> },
    { id: 'paid', header: 'Paid', accessor: (r) => r.view.balance.paid, align: 'right', defaultHidden: true, cell: (r) => <Money value={r.view.balance.paid} /> },
    { id: 'balance', header: 'Balance', accessor: (r) => r.view.balance.outstanding, align: 'right', cell: (r) => (r.view.balance.outstanding > 0 ? <Money value={r.view.balance.outstanding} className="font-medium" /> : <span className="text-muted-foreground">—</span>) },
    { id: 'status', header: 'Status', accessor: (r) => r.view.displayStatus, cell: (r) => <StatusBadge status={r.view.displayStatus} /> },
  ]

  const exportRows = (list: Row[]) =>
    exportCsv(timestampedName('invoices-selected'), list, [
      { header: 'Invoice', value: (r) => r.number },
      { header: 'Customer', value: (r) => r.customerName },
      { header: 'Issue date', value: (r) => r.issueDate },
      { header: 'Due date', value: (r) => r.dueDate },
      { header: 'Net', value: (r) => r.view.totals.netAmount },
      { header: 'Tax', value: (r) => r.view.totals.taxTotal },
      { header: 'Total', value: (r) => r.view.totals.total },
      { header: 'Outstanding', value: (r) => r.view.balance.outstanding },
      { header: 'Status', value: (r) => r.view.displayStatus },
    ])

  const statusParam = params.get('status') ?? undefined
  const customerParam = params.get('customer') ?? undefined

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Customer invoices with balances derived from simulated payments and credit notes. Issuing an invoice never sends an email."
        actions={
          canEdit ? (
            <Button asChild>
              <Link to="/sales/invoices/new">
                <Plus /> New invoice
              </Link>
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Outstanding" term="Accounts receivable" value={formatCurrency(stats.outstanding)} to="/sales/invoices?status=open" />
        <StatCard label="Overdue" value={formatCurrency(stats.overdue)} hint={`${stats.overdueCount} invoice(s) past due`} to="/sales/invoices?status=overdue" />
        <StatCard label="Billed this month" value={formatCurrency(stats.billedThisMonth)} hint="Incl. tax, excl. drafts" />
        <StatCard label="Drafts" value={stats.drafts} hint="Not yet issued" to="/sales/invoices?status=draft" />
      </StatGrid>
      <DataTable
        key={`${statusParam}|${customerParam}`}
        caption="Invoices"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search number, customer…"
        exportName="invoices"
        initialSort={{ id: 'issueDate', desc: true }}
        onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)}
        selectable
        bulkActions={[
          { label: 'Export selected', icon: <Download />, onClick: (list) => exportRows(list) },
          ...(canIssue
            ? [
                {
                  label: 'Issue selected drafts',
                  icon: <Send />,
                  disabled: (list: Row[]) => !list.some((r) => r.status === 'draft'),
                  onClick: async (list: Row[]) => {
                    const drafts = list.filter((r) => r.status === 'draft')
                    let ok = 0
                    for (const d of drafts) if (await runWithToast(invoiceRepository.issue(d.id))) ok++
                    if (ok) toast.success(`${ok} invoice(s) marked as issued (simulated — no emails sent)`)
                  },
                },
              ]
            : []),
        ]}
        filters={[
          {
            id: 'status',
            label: 'Statuses',
            options: STATUS_OPTIONS,
            defaultValue: statusParam,
            predicate: (r, v) => (v === 'open' ? r.view.balance.outstanding > 0 && r.status !== 'draft' : r.view.displayStatus === v),
          },
          {
            id: 'customer',
            label: 'Customers',
            options: customers.map((c) => ({ value: c.id, label: c.name })),
            defaultValue: customerParam,
            predicate: (r, v) => r.customerId === v,
          },
        ]}
        rowClassName={(r) => (r.view.displayStatus === 'overdue' ? 'bg-destructive/[0.03]' : undefined)}
        emptyState={<EmptyState icon={<FileText />} title="No invoices yet" description="Create a draft invoice to get started." className="border-0" />}
      />
    </>
  )
}
