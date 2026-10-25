import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useBillViews, useCollection, useLookups, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { add, divide, multiply } from '@/lib/calculations/money'
import { documentTotals } from '@/lib/calculations/invoices'
import { isBillIncurred } from '@/lib/calculations/bills'
import { formatCurrency, formatDate, formatMonth } from '@/lib/formatting'
import { lastNMonths, monthLabel } from '@/lib/dates'
import type { Payment, PurchaseOrder, SoftwareLicence, SupplierBill } from '@/domain'
import { SupplierFormDialog } from '../components/SupplierFormDialog'

export default function SupplierDetailPage() {
  const { id } = useParams()
  const supplier = useRecord('suppliers', id)
  const bills = useCollection('supplierBills')
  const orders = useCollection('purchaseOrders')
  const payments = useCollection('payments')
  const licences = useCollection('licences')
  const views = useBillViews()
  const lookups = useLookups()
  const canEdit = usePermission('procurement.edit')
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)

  const sBills = useMemo(() => bills.filter((b) => b.supplierId === id), [bills, id])
  const sOrders = useMemo(() => orders.filter((o) => o.supplierId === id), [orders, id])
  const sPayments = useMemo(() => payments.filter((p) => p.supplierId === id && p.direction === 'outgoing'), [payments, id])
  const sLicences = useMemo(() => licences.filter((l) => l.vendorId === id), [licences, id])

  const monthly = useMemo(
    () =>
      lastNMonths(12).map((m) => ({
        month: m,
        billed: sBills.filter((b) => isBillIncurred(b) && b.billDate.slice(0, 7) === m).reduce((s, b) => add(s, b.subtotal), 0),
      })),
    [sBills],
  )

  if (!supplier) {
    return (
      <EmptyState
        title="Supplier not found"
        description="It may have been deleted, or the demo data was reset."
        action={<Button asChild size="sm"><Link to="/procurement/suppliers">Back to suppliers</Link></Button>}
        className="mt-10"
      />
    )
  }

  const outstanding = sBills.reduce((s, b) => add(s, isBillIncurred(b) ? (views.get(b.id)?.balance.outstanding ?? 0) : 0), 0)
  const overdue = sBills.reduce((s, b) => add(s, views.get(b.id)?.overdue ? (views.get(b.id)?.balance.outstanding ?? 0) : 0), 0)
  const spend12 = monthly.reduce((s, m) => add(s, m.billed), 0)
  const licenceMonthly = sLicences.filter((l) => l.status !== 'cancelled').reduce((s, l) => add(s, l.billingCycle === 'annual' ? divide(multiply(l.seats, l.costPerSeat), 12) : multiply(l.seats, l.costPerSeat)), 0)

  const billColumns: DataColumn<SupplierBill>[] = [
    { id: 'number', header: 'Bill', accessor: (r) => r.number, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'description', header: 'Description', accessor: (r) => r.description, className: 'max-w-72 truncate' },
    { id: 'date', header: 'Date', accessor: (r) => r.billDate, cell: (r) => formatDate(r.billDate) },
    { id: 'due', header: 'Due', accessor: (r) => r.dueDate, cell: (r) => formatDate(r.dueDate) },
    { id: 'total', header: 'Total', accessor: (r) => views.get(r.id)?.balance.total, align: 'right', cell: (r) => <Money value={views.get(r.id)?.balance.total} /> },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => views.get(r.id)?.balance.outstanding, align: 'right', cell: (r) => <Money value={views.get(r.id)?.balance.outstanding} /> },
    { id: 'status', header: 'Status', accessor: (r) => (views.get(r.id)?.overdue ? 'overdue' : views.get(r.id)?.status), cell: (r) => <StatusBadge status={views.get(r.id)?.overdue ? 'overdue' : (views.get(r.id)?.status ?? r.status)} /> },
  ]
  const poColumns: DataColumn<PurchaseOrder>[] = [
    { id: 'number', header: 'PO', accessor: (r) => r.number, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'items', header: 'Items', accessor: (r) => r.lines.map((l) => l.description).join('; '), className: 'max-w-72 truncate' },
    { id: 'date', header: 'Ordered', accessor: (r) => r.orderDate, cell: (r) => formatDate(r.orderDate) },
    { id: 'total', header: 'Total', accessor: (r) => documentTotals(r.lines).total, align: 'right', cell: (r) => <Money value={documentTotals(r.lines).total} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]
  const payColumns: DataColumn<Payment>[] = [
    { id: 'number', header: 'Payment', accessor: (r) => r.number, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'bill', header: 'Bill', accessor: (r) => bills.find((b) => b.id === r.billId)?.number ?? (r.category === 'card_settlement' ? 'Card settlement' : '—') },
    { id: 'method', header: 'Method', accessor: (r) => r.method.replace('_', ' ') },
    { id: 'reference', header: 'Reference', accessor: (r) => r.reference, defaultHidden: true },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
  ]
  const licColumns: DataColumn<SoftwareLicence>[] = [
    { id: 'name', header: 'Subscription', accessor: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { id: 'seats', header: 'Seats used', accessor: (r) => r.seatsUsed, cell: (r) => `${r.seatsUsed} / ${r.seats}` },
    { id: 'cost', header: 'Cost / seat', accessor: (r) => r.costPerSeat, align: 'right', cell: (r) => <><Money value={r.costPerSeat} /> <span className="text-muted-foreground text-xs">/{r.billingCycle === 'annual' ? 'yr' : 'mo'}</span></> },
    { id: 'renewal', header: 'Renews', accessor: (r) => r.renewalDate, cell: (r) => formatDate(r.renewalDate) },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/procurement/suppliers')}>
        <ArrowLeft /> Suppliers
      </Button>
      <PageHeader
        title={supplier.name}
        description={`${supplier.code} · ${lookups.master(supplier.categoryId)}${supplier.isSoftwareVendor ? ' · Software vendor' : ''}`}
        meta={<StatusBadge status={supplier.status} />}
        actions={
          canEdit ? (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
              <Button onClick={() => navigate(`/procurement/bills?supplier=${supplier.id}`)}><Plus /> View bills</Button>
            </>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Outstanding" term="Accounts payable" value={formatCurrency(outstanding)} />
        <StatCard label="Overdue" value={formatCurrency(overdue)} />
        <StatCard label="Billed spend (12 months)" value={formatCurrency(spend12)} hint="Approved bills, excl. tax" />
        <StatCard label="Subscriptions / month" value={formatCurrency(licenceMonthly)} hint={`${sLicences.length} licence(s)`} />
      </StatGrid>
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bills">Bills ({sBills.length})</TabsTrigger>
          <TabsTrigger value="orders">Purchase orders ({sOrders.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({sPayments.length})</TabsTrigger>
          <TabsTrigger value="licences">Licences ({sLicences.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-4 xl:grid-cols-3">
          <Section title="Details">
            <DetailList
              columns={1}
              items={[
                { label: 'Contact', value: supplier.contactName },
                { label: 'Email', value: supplier.email },
                { label: 'Phone', value: supplier.phone },
                { label: 'Country', value: supplier.country },
                { label: 'Payment terms', value: supplier.paymentTermsDays ? `Net ${supplier.paymentTermsDays} days` : 'Due on receipt' },
                { label: 'Currency', value: supplier.currency },
              ]}
            />
          </Section>
          <ChartCard
            className="xl:col-span-2"
            title="Monthly billed spend"
            description="Approved bills, excluding tax — last 12 months"
            table={{ rows: monthly, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Billed', value: (r) => formatCurrency(r.billed), align: 'right' }] }}
          >
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ left: 4, right: 8, top: 4 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} tickFormatter={monthLabel} />
                <YAxis {...axisProps} tickFormatter={currencyTick} width={56} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                <Bar dataKey="billed" name="Billed spend" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>
        <TabsContent value="bills">
          <DataTable caption={`Bills from ${supplier.name}`} data={sBills} columns={billColumns} getRowId={(r) => r.id} exportName={`bills-${supplier.code}`} initialSort={{ id: 'date', desc: true }} pageSize={10} onRowClick={() => navigate(`/procurement/bills?supplier=${supplier.id}`)} />
        </TabsContent>
        <TabsContent value="orders">
          <DataTable caption={`Purchase orders for ${supplier.name}`} data={sOrders} columns={poColumns} getRowId={(r) => r.id} exportName={`pos-${supplier.code}`} initialSort={{ id: 'date', desc: true }} pageSize={10} onRowClick={() => navigate('/procurement/purchase-orders')} />
        </TabsContent>
        <TabsContent value="payments">
          <DataTable caption={`Simulated payments to ${supplier.name}`} data={sPayments} columns={payColumns} getRowId={(r) => r.id} exportName={`payments-${supplier.code}`} initialSort={{ id: 'date', desc: true }} pageSize={10} />
        </TabsContent>
        <TabsContent value="licences">
          <DataTable caption={`Licences from ${supplier.name}`} data={sLicences} columns={licColumns} getRowId={(r) => r.id} pageSize={10} emptyState={<EmptyState title="No licences from this vendor" className="border-0" />} />
        </TabsContent>
      </Tabs>
      <SupplierFormDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
    </>
  )
}
