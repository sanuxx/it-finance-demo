import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileMinus, Plus } from 'lucide-react'
import type { CreditNote } from '@/domain'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useInvoiceViews, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { add } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { CreditNoteDialog } from '../components/InvoiceDialogs'
import { todayIso } from '../lib/billing'

type Row = CreditNote & { customerName: string; invoiceNumber?: string }

export default function CreditNotesPage() {
  const creditNotes = useCollection('creditNotes')
  const invoices = useCollection('invoices')
  const views = useInvoiceViews()
  const lookups = useLookups()
  const canEdit = usePermission('sales.edit')
  const [pickOpen, setPickOpen] = useState(false)
  const [picked, setPicked] = useState<string>('')
  const [creditOpen, setCreditOpen] = useState(false)

  const rows = useMemo<Row[]>(() => creditNotes.map((c) => ({ ...c, customerName: lookups.customer(c.customerId), invoiceNumber: invoices.find((i) => i.id === c.invoiceId)?.number })), [creditNotes, invoices, lookups])
  const openInvoices = invoices.filter((i) => (i.status === 'issued' || i.status === 'partially_paid') && (views.get(i.id)?.balance.outstanding ?? 0) > 0)
  const ytd = todayIso().slice(0, 4)
  const total = rows.reduce((s, r) => add(s, r.amount), 0)
  const totalYtd = rows.filter((r) => r.date.startsWith(ytd)).reduce((s, r) => add(s, r.amount), 0)

  const columns: DataColumn<Row>[] = [
    { id: 'number', header: 'Credit note', accessor: (r) => r.number, cell: (r) => <span className="font-medium">{r.number}</span> },
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'customer', header: 'Customer', accessor: (r) => r.customerName },
    { id: 'invoice', header: 'Invoice', accessor: (r) => r.invoiceNumber, cell: (r) => (r.invoiceId ? <Link to={`/sales/invoices/${r.invoiceId}`} className="text-primary hover:underline">{r.invoiceNumber}</Link> : '—') },
    { id: 'reason', header: 'Reason', accessor: (r) => r.reason },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader title="Credit notes" description="Credits reduce what a customer owes on an invoice and reduce recognised revenue (net of tax)." actions={canEdit ? <Button onClick={() => { setPicked(''); setPickOpen(true) }}><Plus /> New credit note</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="Credit notes" value={rows.length} />
        <StatCard label="Total credited" term="Credit note" value={formatCurrency(total)} hint="Incl. tax" />
        <StatCard label="Credited this year" value={formatCurrency(totalYtd)} />
        <StatCard label="Invoices eligible" value={openInvoices.length} hint="Issued with a balance" />
      </StatGrid>
      <DataTable caption="Credit notes" data={rows} columns={columns} getRowId={(r) => r.id} exportName="credit-notes" initialSort={{ id: 'date', desc: true }} emptyState={<EmptyState icon={<FileMinus />} title="No credit notes" description="Raise one against an issued invoice." className="border-0" />} />

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose an invoice to credit</DialogTitle>
            <DialogDescription>Only issued invoices with an outstanding balance can be credited in this demo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cn-invoice">Invoice</Label>
            <Select value={picked} onValueChange={setPicked}>
              <SelectTrigger id="cn-invoice" className="w-full"><SelectValue placeholder="Select invoice" /></SelectTrigger>
              <SelectContent>
                {openInvoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.number} · {lookups.customer(i.customerId)} · {formatCurrency(views.get(i.id)?.balance.outstanding)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SimulatedNotice>Credit notes are illustrative and are not tax documents.</SimulatedNotice>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickOpen(false)}>Cancel</Button>
            <Button disabled={!picked} onClick={() => { setPickOpen(false); setCreditOpen(true) }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreditNoteDialog invoice={invoices.find((i) => i.id === picked)} open={creditOpen} onOpenChange={setCreditOpen} />
    </>
  )
}
