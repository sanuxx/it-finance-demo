import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Mail } from 'lucide-react'
import type { Invoice } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDbSlice, useInvoiceViews, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { AGEING_LABELS, ageingBucket, type AgeingBucket } from '@/lib/calculations/invoices'
import { add, percentOf, sum } from '@/lib/calculations/money'
import { daysBetween, todayISO } from '@/lib/dates'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { useDemoStore } from '@/services'
import { auditEntry, withAudit } from '@/services/demo/localRepository'

const BUCKETS: AgeingBucket[] = ['current', '1_30', '31_60', '61_90', '90_plus']
// Sequential ramp (one hue, light → dark) for increasing age; current uses a neutral.
const BUCKET_COLOR: Record<AgeingBucket, string> = { current: 'var(--muted-foreground)', '1_30': '#86b6ef', '31_60': '#3987e5', '61_90': '#1c5cab', '90_plus': '#0d366b' }

interface OpenItem {
  invoice: Invoice
  outstanding: number
  bucket: AgeingBucket
  daysOverdue: number
}

interface CustomerAgeing {
  customerId: string
  total: number
  buckets: Record<AgeingBucket, number>
  count: number
}

/** Fill {{placeholders}} from a flat map; unknown placeholders are left visible. */
function fillTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key: string) => values[key] ?? m)
}

export default function ReceivablesPage() {
  const { invoices, templates, organization, customers } = useDbSlice('invoices', 'templates', 'organization', 'customers')
  const views = useInvoiceViews()
  const lookups = useLookups()
  const navigate = useNavigate()
  const canRemind = usePermission('sales.edit')
  const [reminder, setReminder] = useState<OpenItem | undefined>()
  const today = todayISO()

  const open = useMemo<OpenItem[]>(
    () =>
      invoices
        .map((invoice) => {
          const v = views.get(invoice.id)
          const outstanding = v?.balance.outstanding ?? 0
          return { invoice, outstanding, bucket: ageingBucket(invoice.dueDate, today), daysOverdue: Math.max(0, daysBetween(invoice.dueDate, today)) }
        })
        .filter((i) => i.outstanding > 0 && i.invoice.status !== 'draft' && i.invoice.status !== 'void'),
    [invoices, views, today],
  )

  const byCustomer = useMemo<CustomerAgeing[]>(() => {
    const m = new Map<string, CustomerAgeing>()
    for (const i of open) {
      const row = m.get(i.invoice.customerId) ?? { customerId: i.invoice.customerId, total: 0, count: 0, buckets: { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 } }
      row.total = add(row.total, i.outstanding)
      row.buckets[i.bucket] = add(row.buckets[i.bucket], i.outstanding)
      row.count++
      m.set(row.customerId, row)
    }
    return [...m.values()]
  }, [open])

  const total = sum(open, (i) => i.outstanding)
  const overdue = open.filter((i) => i.bucket !== 'current')
  const overdueTotal = sum(overdue, (i) => i.outstanding)
  const bucketTotals = BUCKETS.map((b) => ({ bucket: b, label: AGEING_LABELS[b], amount: sum(open.filter((i) => i.bucket === b), (i) => i.outstanding) }))
  const weightedDays = total ? Math.round(sum(open, (i) => i.outstanding * i.daysOverdue) / total) : 0

  const customerColumns: DataColumn<CustomerAgeing>[] = [
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.customerId), alwaysVisible: true, cell: (r) => <span className="font-medium">{lookups.customer(r.customerId)}</span> },
    { id: 'count', header: 'Open invoices', accessor: (r) => r.count, align: 'right' },
    ...BUCKETS.map<DataColumn<CustomerAgeing>>((b) => ({ id: b, header: AGEING_LABELS[b], accessor: (r) => r.buckets[b], align: 'right', cell: (r) => (r.buckets[b] ? <Money value={r.buckets[b]} className={b !== 'current' ? 'text-destructive' : undefined} /> : <span className="text-muted-foreground">—</span>), footer: formatCurrency(bucketTotals.find((x) => x.bucket === b)?.amount) })),
    { id: 'total', header: 'Total', accessor: (r) => r.total, align: 'right', cell: (r) => <Money value={r.total} className="font-medium" />, footer: formatCurrency(total) },
  ]

  const invoiceColumns: DataColumn<OpenItem>[] = [
    { id: 'number', header: 'Invoice', accessor: (r) => r.invoice.number, alwaysVisible: true, cell: (r) => <span className="font-medium">{r.invoice.number}</span> },
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.invoice.customerId) },
    { id: 'due', header: 'Due', accessor: (r) => r.invoice.dueDate, cell: (r) => formatDate(r.invoice.dueDate) },
    { id: 'days', header: 'Days overdue', accessor: (r) => r.daysOverdue, align: 'right', cell: (r) => (r.daysOverdue ? `${r.daysOverdue}` : '—') },
    { id: 'bucket', header: 'Ageing', accessor: (r) => AGEING_LABELS[r.bucket], cell: (r) => <StatusBadge status={r.bucket} tone={r.bucket === 'current' ? 'info' : r.bucket === '1_30' ? 'warning' : 'danger'} label={AGEING_LABELS[r.bucket]} /> },
    { id: 'status', header: 'Status', accessor: (r) => views.get(r.invoice.id)?.displayStatus, cell: (r) => <StatusBadge status={views.get(r.invoice.id)?.displayStatus ?? r.invoice.status} /> },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => r.outstanding, align: 'right', cell: (r) => <Money value={r.outstanding} /> },
    {
      id: 'remind', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => (r.bucket !== 'current' && canRemind ? <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setReminder(r) }}><Mail /> Reminder</Button> : null),
    },
  ]

  const template = templates.find((t) => t.kind === 'overdue_email')
  const preview = useMemo(() => {
    if (!reminder || !template) return null
    const customer = customers.find((c) => c.id === reminder.invoice.customerId)
    const values = {
      'customer.name': customer?.name ?? '',
      'customer.contact': customer?.contactName ?? '',
      'invoice.number': reminder.invoice.number,
      'invoice.total': formatCurrency(views.get(reminder.invoice.id)?.totals.total),
      'invoice.dueDate': formatDate(reminder.invoice.dueDate),
      'invoice.balance': formatCurrency(reminder.outstanding),
      'organization.name': organization.name,
      today: formatDate(today),
    }
    return { to: customer?.email ?? '', subject: fillTemplate(template.subject ?? '', values), body: fillTemplate(template.body, values) }
  }, [reminder, template, customers, views, organization, today])

  const simulateSend = async () => {
    if (!reminder) return
    useDemoStore.getState().mutate((db) => withAudit(db, auditEntry('simulate_send', 'invoice', `Simulated overdue reminder for ${reminder.invoice.number} (no email sent)`, reminder.invoice.id)))
    await runWithToast(Promise.resolve(), 'Reminder simulated — logged to the audit trail. No email was sent.')
    setReminder(undefined)
  }

  return (
    <>
      <PageHeader title="Receivables" description="Outstanding customer balances and ageing, derived from invoices, payments and credit notes." actions={<Button variant="outline" onClick={() => navigate('/sales/invoices')}>View invoices</Button>} />
      <StatGrid className="mb-6">
        <StatCard label="Outstanding receivables" term="Accounts receivable" value={formatCurrency(total)} hint={`${open.length} open invoices`} />
        <StatCard label="Overdue" value={formatCurrency(overdueTotal)} hint={`${percentOf(overdueTotal, total) ?? 0}% of receivables · ${overdue.length} invoices`} to="/sales/invoices?status=overdue" />
        <StatCard label="90+ days" value={formatCurrency(bucketTotals[4]!.amount)} hint="Collection risk" />
        <StatCard label="Weighted days overdue" value={`${weightedDays} days`} hint="Weighted by outstanding amount" />
      </StatGrid>

      <ChartCard
        className="mb-6"
        title="Receivables ageing"
        description="Outstanding balance by days past due date"
        height={220}
        table={{ rows: bucketTotals, columns: [{ header: 'Bucket', value: (r) => r.label }, { header: 'Outstanding', value: (r) => formatCurrency(r.amount), align: 'right' }] }}
      >
        <ResponsiveContainer>
          <BarChart data={bucketTotals} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
            <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {bucketTotals.map((b) => <Cell key={b.bucket} fill={BUCKET_COLOR[b.bucket]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">By customer</TabsTrigger>
          <TabsTrigger value="invoices">Open invoices</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="customers" className="mt-3">
          <DataTable caption="Receivables ageing by customer" data={byCustomer} columns={customerColumns} getRowId={(r) => r.customerId} exportName="receivables-ageing" initialSort={{ id: 'total', desc: true }} showFooter onRowClick={(r) => navigate(`/sales/customers/${r.customerId}`)} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-3">
          <DataTable caption="Open invoices" data={open} columns={invoiceColumns} getRowId={(r) => r.invoice.id} exportName="open-invoices" initialSort={{ id: 'days', desc: true }} onRowClick={(r) => navigate(`/sales/invoices/${r.invoice.id}`)} filters={[{ id: 'b', label: 'Ageing buckets', options: BUCKETS.map((b) => ({ value: b, label: AGEING_LABELS[b] })), predicate: (r, v) => r.bucket === v }]} />
        </TabsContent>
        <TabsContent value="overdue" className="mt-3">
          <DataTable caption="Overdue invoices" data={overdue} columns={invoiceColumns} getRowId={(r) => r.invoice.id} exportName="overdue-invoices" initialSort={{ id: 'days', desc: true }} onRowClick={(r) => navigate(`/sales/invoices/${r.invoice.id}`)} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!reminder} onOpenChange={(o) => !o && setReminder(undefined)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Overdue reminder preview</DialogTitle>
            <DialogDescription>Generated from the “{template?.name ?? 'Overdue reminder'}” template in the Configuration centre.</DialogDescription>
          </DialogHeader>
          <SimulatedNotice tone="warning">This demo never sends email. “Simulate send” only records an entry in the audit log.</SimulatedNotice>
          {preview ? (
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div><span className="text-muted-foreground">To:</span> {preview.to}</div>
              <div><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{preview.subject}</span></div>
              <hr />
              <p className="whitespace-pre-line">{preview.body}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No overdue reminder template is configured.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminder(undefined)}>Close</Button>
            <Button onClick={simulateSend} disabled={!preview}><Mail /> Simulate send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
