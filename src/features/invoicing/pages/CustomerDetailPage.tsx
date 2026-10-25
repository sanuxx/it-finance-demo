import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useCollection, useInvoiceViews, useLookups, useRecord, type InvoiceView } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { add } from '@/lib/calculations/money'
import { AGEING_LABELS, ageingBucket, type AgeingBucket } from '@/lib/calculations/invoices'
import { formatCurrency, formatDate, formatDateTime, humanize } from '@/lib/formatting'
import type { Contract, Invoice, Payment, Project } from '@/domain'
import { CustomerFormDialog } from '../components/CustomerFormDialog'
import { BILLING_MODEL_LABELS, todayIso } from '../lib/billing'

type InvRow = Invoice & { view: InvoiceView }

export default function CustomerDetailPage() {
  const { id } = useParams()
  const customer = useRecord('customers', id)
  const invoices = useCollection('invoices')
  const payments = useCollection('payments')
  const projects = useCollection('projects')
  const contracts = useCollection('contracts')
  const audit = useCollection('auditLog')
  const views = useInvoiceViews()
  const lookups = useLookups()
  const navigate = useNavigate()
  const canEdit = usePermission('sales.edit')
  const [editOpen, setEditOpen] = useState(false)

  const data = useMemo(() => {
    if (!customer) return null
    const invs: InvRow[] = invoices.filter((i) => i.customerId === customer.id).map((i) => ({ ...i, view: views.get(i.id)! }))
    const pays = payments.filter((p) => p.customerId === customer.id && p.direction === 'incoming')
    const today = todayIso()
    const ageing: Record<AgeingBucket, number> = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 }
    let billed = 0
    let outstanding = 0
    for (const r of invs) {
      if (r.status === 'draft' || r.status === 'void') continue
      billed = add(billed, r.view.totals.netAmount)
      if (r.view.balance.outstanding > 0) {
        outstanding = add(outstanding, r.view.balance.outstanding)
        const b = ageingBucket(r.dueDate, today)
        ageing[b] = add(ageing[b], r.view.balance.outstanding)
      }
    }
    const invIds = new Set(invs.map((i) => i.id))
    const activity = audit.filter((a) => a.entityId === customer.id || (a.entityId && invIds.has(a.entityId))).slice(0, 30)
    return {
      invs,
      pays,
      projects: projects.filter((p) => p.customerId === customer.id),
      contracts: contracts.filter((c) => c.customerId === customer.id),
      billed,
      outstanding,
      collected: pays.reduce((s, p) => add(s, p.amount), 0),
      ageing,
      activity,
    }
  }, [customer, invoices, payments, projects, contracts, audit, views])

  if (!customer || !data) return <EmptyState title="Customer not found" action={<Button asChild size="sm"><Link to="/sales/customers">Back to customers</Link></Button>} className="mt-10" />

  const overdue = data.ageing['1_30'] + data.ageing['31_60'] + data.ageing['61_90'] + data.ageing['90_plus']

  const invColumns: DataColumn<InvRow>[] = [
    { id: 'number', header: 'Invoice', accessor: (r) => r.number, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'issueDate', header: 'Issued', accessor: (r) => r.issueDate, cell: (r) => formatDate(r.issueDate) },
    { id: 'dueDate', header: 'Due', accessor: (r) => r.dueDate, cell: (r) => formatDate(r.dueDate) },
    { id: 'total', header: 'Total', accessor: (r) => r.view.totals.total, align: 'right', cell: (r) => <Money value={r.view.totals.total} /> },
    { id: 'balance', header: 'Balance', accessor: (r) => r.view.balance.outstanding, align: 'right', cell: (r) => <Money value={r.view.balance.outstanding} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.view.displayStatus, cell: (r) => <StatusBadge status={r.view.displayStatus} /> },
  ]
  const payColumns: DataColumn<Payment>[] = [
    { id: 'number', header: 'Payment', accessor: (r) => r.number },
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'invoice', header: 'Invoice', accessor: (r) => invoices.find((i) => i.id === r.invoiceId)?.number, cell: (r) => (r.invoiceId ? <Link className="text-primary hover:underline" to={`/sales/invoices/${r.invoiceId}`} onClick={(e) => e.stopPropagation()}>{invoices.find((i) => i.id === r.invoiceId)?.number}</Link> : '—') },
    { id: 'method', header: 'Method', accessor: (r) => humanize(r.method) },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
  ]
  const projectColumns: DataColumn<Project>[] = [
    { id: 'code', header: 'Code', accessor: (r) => r.code },
    { id: 'name', header: 'Project', accessor: (r) => r.name },
    { id: 'billing', header: 'Billing model', accessor: (r) => BILLING_MODEL_LABELS[r.billingModel] },
    { id: 'value', header: 'Contract value', accessor: (r) => r.contractValue, align: 'right', cell: (r) => <Money value={r.contractValue} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]
  const contractColumns: DataColumn<Contract>[] = [
    { id: 'number', header: 'Contract', accessor: (r) => r.number },
    { id: 'title', header: 'Title', accessor: (r) => r.title },
    { id: 'period', header: 'Period', accessor: (r) => r.startDate, cell: (r) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}` },
    { id: 'value', header: 'Value', accessor: (r) => r.value, align: 'right', cell: (r) => <Money value={r.value} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{customer.name} <StatusBadge status={customer.status} /></span>}
        description={`${customer.code} · ${customer.industry} · ${customer.country}`}
        actions={
          <>
            <Button variant="ghost" asChild><Link to="/sales/customers"><ArrowLeft /> Customers</Link></Button>
            {canEdit ? <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button> : null}
            {canEdit ? <Button asChild><Link to={`/sales/invoices/new?customer=${customer.id}`}><Plus /> New invoice</Link></Button> : null}
          </>
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Invoiced (net)" term="Invoiced revenue" value={formatCurrency(data.billed)} hint="All issued invoices, excl. tax" />
        <StatCard label="Collected" value={formatCurrency(data.collected)} hint={`${data.pays.length} simulated receipt(s)`} />
        <StatCard label="Outstanding" term="Accounts receivable" value={formatCurrency(data.outstanding)} to={`/sales/invoices?customer=${customer.id}`} />
        <StatCard label="Overdue" value={formatCurrency(overdue)} hint={`Credit limit ${formatCurrency(customer.creditLimit, 'LKR', { compact: true })}`} to={`/sales/invoices?customer=${customer.id}&status=overdue`} />
      </StatGrid>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({data.invs.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({data.pays.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects & contracts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-3">
          <Section title="Account details" className="lg:col-span-2">
            <DetailList
              items={[
                { label: 'Billing contact', value: customer.contactName },
                { label: 'Email', value: customer.email },
                { label: 'Phone', value: customer.phone },
                { label: 'Country', value: customer.country },
                { label: 'Payment terms', value: `Net ${customer.paymentTermsDays} days` },
                { label: 'Credit limit', value: <Money value={customer.creditLimit} /> },
                { label: 'Currency', value: customer.currency },
                { label: 'Customer since', value: formatDate(customer.createdAt) },
                { label: 'Notes', value: customer.notes || undefined, full: true },
              ]}
            />
          </Section>
          <Section title="Receivables ageing" description="Outstanding balance by days past due">
            <dl className="space-y-2 text-sm">
              {(Object.keys(AGEING_LABELS) as AgeingBucket[]).map((b) => (
                <div key={b} className="flex justify-between">
                  <dt className="text-muted-foreground">{AGEING_LABELS[b]}</dt>
                  <dd><Money value={data.ageing[b]} className={b !== 'current' && data.ageing[b] > 0 ? 'text-destructive font-medium' : undefined} /></dd>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd><Money value={data.outstanding} /></dd></div>
            </dl>
          </Section>
        </TabsContent>
        <TabsContent value="invoices">
          <DataTable caption={`Invoices for ${customer.name}`} data={data.invs} columns={invColumns} getRowId={(r) => r.id} exportName={`invoices-${customer.code}`} initialSort={{ id: 'issueDate', desc: true }} onRowClick={(r) => navigate(`/sales/invoices/${r.id}`)} pageSize={10} />
        </TabsContent>
        <TabsContent value="payments">
          <DataTable caption={`Payments from ${customer.name}`} data={data.pays} columns={payColumns} getRowId={(r) => r.id} exportName={`payments-${customer.code}`} initialSort={{ id: 'date', desc: true }} pageSize={10} />
        </TabsContent>
        <TabsContent value="projects" className="space-y-6">
          <Section title="Projects">
            <DataTable caption="Projects" data={data.projects} columns={projectColumns} getRowId={(r) => r.id} onRowClick={(r) => navigate(`/projects/${r.id}`)} pageSize={10} />
          </Section>
          <Section title="Contracts">
            <DataTable caption="Contracts" data={data.contracts} columns={contractColumns} getRowId={(r) => r.id} onRowClick={() => navigate('/sales/contracts')} pageSize={10} />
          </Section>
        </TabsContent>
        <TabsContent value="activity">
          <Section title="Activity" description="Changes recorded in this browser’s demo audit log">
            {data.activity.length ? (
              <ol className="space-y-3">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="font-medium">{a.summary}</span>
                    <span className="text-muted-foreground text-xs">{a.actor} · {formatDateTime(a.at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">No recorded activity for this customer yet. Edits, invoices and payments you make will appear here.</p>
            )}
            <p className="text-muted-foreground mt-4 text-xs">Project links: {data.projects.map((p) => lookups.projectCode(p.id)).join(', ') || 'none'}</p>
          </Section>
        </TabsContent>
      </Tabs>
      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
    </>
  )
}
