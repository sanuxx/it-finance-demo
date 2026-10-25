import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { Invoice, Project } from '@/domain'
import { Button } from '@/components/ui/button'
import { StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useInvoiceViews, type InvoiceView } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { max0, subtract, sum } from '@/lib/calculations/money'
import type { ProjectFinancials } from '@/lib/calculations/projects'
import { formatCurrency, formatDate } from '@/lib/formatting'

type Row = Invoice & { view: InvoiceView }

export function BillingTab({ project, fin }: { project: Project; fin: ProjectFinancials }) {
  const invoices = useCollection('invoices')
  const milestones = useCollection('milestones')
  const views = useInvoiceViews()
  const navigate = useNavigate()
  const canInvoice = usePermission('sales.edit')

  const rows = useMemo<Row[]>(() => invoices.filter((i) => i.projectId === project.id).map((i) => ({ ...i, view: views.get(i.id)! })), [invoices, views, project.id])
  const ms = milestones.filter((m) => m.projectId === project.id)
  const outstanding = sum(rows, (r) => r.view.balance.outstanding)
  const unbilledMilestones = sum(ms.filter((m) => m.status !== 'invoiced'), (m) => m.amount)
  const wip = subtract(fin.recognisedRevenue, fin.invoiced)

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Invoice', accessor: (r) => r.number, alwaysVisible: true, cell: (r) => <Link to={`/sales/invoices/${r.id}`} className="text-primary font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.number}</Link> },
    { id: 'issue', header: 'Issued', accessor: (r) => r.issueDate, cell: (r) => formatDate(r.issueDate) },
    { id: 'due', header: 'Due', accessor: (r) => r.dueDate, cell: (r) => formatDate(r.dueDate) },
    { id: 'net', header: 'Net amount', accessor: (r) => r.view.totals.netAmount, align: 'right', cell: (r) => <Money value={r.view.totals.netAmount} /> },
    { id: 'total', header: 'Total (incl. VAT)', accessor: (r) => r.view.totals.total, align: 'right', cell: (r) => <Money value={r.view.totals.total} /> },
    { id: 'paid', header: 'Paid', accessor: (r) => r.view.balance.paid, align: 'right', cell: (r) => <Money value={r.view.balance.paid} /> },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => r.view.balance.outstanding, align: 'right', cell: (r) => <Money value={r.view.balance.outstanding} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.view.displayStatus, cell: (r) => <StatusBadge status={r.view.displayStatus} /> },
  ]

  return (
    <div className="space-y-6">
      <StatGrid>
        <StatCard label="Invoiced (net)" term="Invoiced revenue" value={formatCurrency(fin.invoiced)} hint={project.isInternal ? 'Internal project' : `${rows.filter((r) => r.status !== 'draft' && r.status !== 'void').length} invoice(s)`} />
        <StatCard label="Collected" value={formatCurrency(fin.collected)} hint={`Outstanding ${formatCurrency(outstanding)} (incl. VAT)`} />
        <StatCard label="Recognised revenue" term="Recognised revenue" value={formatCurrency(fin.recognisedRevenue)} estimate hint={`${project.percentComplete}% complete`} />
        <StatCard label="Unbilled work (WIP)" term="WIP" value={formatCurrency(max0(wip))} hint={wip < 0 ? `Billed ahead of work by ${formatCurrency(-wip)}` : `Unbilled milestones ${formatCurrency(unbilledMilestones)}`} estimate />
      </StatGrid>
      <SimulatedNotice>Collected amounts include VAT; invoiced and recognised revenue are shown net of tax. Payments are simulated records — no money is transferred.</SimulatedNotice>
      <DataTable
        caption={`Invoices for ${project.code}`}
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName={`${project.code}-invoices`}
        initialSort={{ id: 'issue', desc: true }}
        onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)}
        toolbar={
          canInvoice && !project.isInternal ? (
            <Button size="sm" className="h-9" onClick={() => navigate(`/sales/invoices/new?customer=${project.customerId}&project=${project.id}`)}>
              <Plus /> New invoice
            </Button>
          ) : null
        }
      />
    </div>
  )
}
