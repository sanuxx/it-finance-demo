import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from 'lucide-react'
import type { Payment } from '@/domain'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useInvoiceViews, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { paymentRepository } from '@/services'
import { add, subtract } from '@/lib/calculations/money'
import { inRange, presetRange, type DatePreset } from '@/lib/dates'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'
import { RecordPaymentDialog } from '../components/InvoiceDialogs'
import { PAYMENT_CATEGORY_LABELS, PAYMENT_METHOD_OPTIONS } from '../lib/billing'

type Row = Payment & { party: string; linked?: { label: string; to: string } }

export default function PaymentsPage() {
  const payments = useCollection('payments')
  const invoices = useCollection('invoices')
  const bills = useCollection('supplierBills')
  const views = useInvoiceViews()
  const lookups = useLookups()
  const confirm = useConfirm()
  const canPay = usePermission('payments.record')
  const [params] = useSearchParams()
  const [preset, setPreset] = useState<DatePreset>('last_12_months')
  const [pickOpen, setPickOpen] = useState(false)
  const [picked, setPicked] = useState('')
  const [payOpen, setPayOpen] = useState(false)

  const range = presetRange(preset)
  const rows = useMemo<Row[]>(() => {
    const invNo = new Map(invoices.map((i) => [i.id, i.number]))
    const billNo = new Map(bills.map((b) => [b.id, b.number]))
    return payments
      .filter((p) => inRange(p.date, range.from, range.to))
      .map((p) => ({
        ...p,
        party: p.customerId ? lookups.customer(p.customerId) : p.supplierId ? lookups.supplier(p.supplierId) : PAYMENT_CATEGORY_LABELS[p.category] ?? '—',
        linked: p.invoiceId ? { label: invNo.get(p.invoiceId) ?? 'Invoice', to: `/sales/invoices/${p.invoiceId}` } : p.billId ? { label: billNo.get(p.billId) ?? 'Bill', to: '/procurement/bills' } : undefined,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, invoices, bills, lookups, range.from, range.to])

  const totals = useMemo(() => {
    const inflow = rows.filter((r) => r.direction === 'incoming').reduce((s, r) => add(s, r.amount), 0)
    const outflow = rows.filter((r) => r.direction === 'outgoing').reduce((s, r) => add(s, r.amount), 0)
    return { inflow, outflow, net: subtract(inflow, outflow) }
  }, [rows])

  const openInvoices = invoices.filter((i) => (i.status === 'issued' || i.status === 'partially_paid') && (views.get(i.id)?.balance.outstanding ?? 0) > 0)

  const remove = async (p: Payment) => {
    const { confirmed } = await confirm({ title: `Delete payment ${p.number}?`, description: 'Any linked invoice or bill balance and status will be recalculated. This only affects demo data in this browser.', destructive: true, confirmLabel: 'Delete payment' })
    if (confirmed) await runWithToast(paymentRepository.remove(p.id), 'Payment deleted')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Payment', accessor: (r) => r.number, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    {
      id: 'direction', header: 'Direction', accessor: (r) => r.direction,
      cell: (r) => r.direction === 'incoming'
        ? <span className="text-success inline-flex items-center gap-1"><ArrowDownLeft className="size-3.5" /> In</span>
        : <span className="text-muted-foreground inline-flex items-center gap-1"><ArrowUpRight className="size-3.5" /> Out</span>,
    },
    { id: 'category', header: 'Category', accessor: (r) => PAYMENT_CATEGORY_LABELS[r.category] ?? r.category },
    { id: 'party', header: 'Customer / supplier', accessor: (r) => r.party },
    { id: 'linked', header: 'Linked document', accessor: (r) => r.linked?.label, cell: (r) => (r.linked ? <Link to={r.linked.to} className="text-primary hover:underline">{r.linked.label}</Link> : <span className="text-muted-foreground">—</span>) },
    { id: 'method', header: 'Method', accessor: (r) => humanize(r.method), defaultHidden: true },
    { id: 'bank', header: 'Bank account', accessor: (r) => lookups.bankAccount(r.bankAccountId), defaultHidden: true },
    { id: 'reference', header: 'Reference', accessor: (r) => r.reference, defaultHidden: true },
    { id: 'amount', header: 'Amount', accessor: (r) => (r.direction === 'incoming' ? r.amount : -r.amount), align: 'right', cell: (r) => <Money value={r.direction === 'incoming' ? r.amount : -r.amount} signed /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => canPay && (r.category === 'customer_receipt' || r.category === 'supplier_payment') ? <Button variant="ghost" size="icon-sm" aria-label={`Delete payment ${r.number}`} onClick={() => remove(r)}><Trash2 /></Button> : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every simulated money movement — customer receipts, supplier payments, payroll, reimbursements and card settlements. No money is transferred by this demo."
        actions={
          <>
            <DateRangeSelect value={preset} onChange={setPreset} />
            {canPay ? <Button onClick={() => { setPicked(''); setPickOpen(true) }}><Plus /> Record receipt</Button> : null}
          </>
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Money in" value={formatCurrency(totals.inflow)} hint="Simulated receipts" />
        <StatCard label="Money out" value={formatCurrency(totals.outflow)} hint="Simulated payments" />
        <StatCard label="Net movement" value={formatCurrency(totals.net)} />
        <StatCard label="Transactions" value={rows.length} to="/finance/transactions" />
      </StatGrid>
      <DataTable
        key={params.get('direction') ?? 'all'}
        caption="Payments"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="payments"
        initialSort={{ id: 'date', desc: true }}
        filters={[
          { id: 'direction', label: 'Directions', defaultValue: params.get('direction') ?? undefined, options: [{ value: 'incoming', label: 'Money in' }, { value: 'outgoing', label: 'Money out' }], predicate: (r, v) => r.direction === v },
          { id: 'category', label: 'Categories', options: Object.entries(PAYMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label })), predicate: (r, v) => r.category === v },
          { id: 'method', label: 'Methods', options: PAYMENT_METHOD_OPTIONS, predicate: (r, v) => r.method === v },
        ]}
      />

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a customer receipt</DialogTitle>
            <DialogDescription>Choose the invoice the payment relates to. Supplier payments are recorded from Procurement → Supplier bills.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pay-invoice">Invoice</Label>
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger id="pay-invoice" className="w-full"><SelectValue placeholder="Select an open invoice" /></SelectTrigger>
              <SelectContent>
                {openInvoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.number} · {lookups.customer(i.customerId)} · {formatCurrency(views.get(i.id)?.balance.outstanding)} due</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SimulatedNotice>Payments are simulated records. No bank, card or payment provider is contacted.</SimulatedNotice>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickOpen(false)}>Cancel</Button>
            <Button disabled={!picked} onClick={() => { setPickOpen(false); setPayOpen(true) }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecordPaymentDialog invoice={invoices.find((i) => i.id === picked)} open={payOpen} onOpenChange={setPayOpen} />
    </>
  )
}
