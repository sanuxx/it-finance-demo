import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Copy, CreditCard, FileMinus, MoreHorizontal, Pencil, Printer, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { ActivityTimeline, DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useInvoiceViews, useLookups, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { invoiceRepository, paymentRepository } from '@/services'
import { lineTotals } from '@/lib/calculations/invoices'
import { daysBetween } from '@/lib/dates'
import { formatCurrency, formatDate, formatPercent, humanize } from '@/lib/formatting'
import { CreditNoteDialog, RecordPaymentDialog } from '../components/InvoiceDialogs'
import { todayIso } from '../lib/billing'

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const invoice = useRecord('invoices', id)
  const views = useInvoiceViews()
  const payments = useCollection('payments')
  const creditNotes = useCollection('creditNotes')
  const customers = useCollection('customers')
  const lookups = useLookups()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const canEdit = usePermission('sales.edit')
  const canIssue = usePermission('invoices.issue')
  const canPay = usePermission('payments.record')
  const [payOpen, setPayOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)

  if (!invoice) return <EmptyState title="Invoice not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/sales/invoices">Back to invoices</Link></Button>} className="mt-10" />

  const view = views.get(invoice.id)!
  const { totals, balance, displayStatus } = view
  const customer = customers.find((c) => c.id === invoice.customerId)
  const related = payments.filter((p) => p.invoiceId === invoice.id)
  const credits = creditNotes.filter((c) => c.invoiceId === invoice.id)
  const open = invoice.status === 'issued' || invoice.status === 'partially_paid'
  const overdueDays = displayStatus === 'overdue' ? daysBetween(invoice.dueDate, todayIso()) : 0

  const issue = () => runWithToast(invoiceRepository.issue(invoice.id), `${invoice.number} marked as issued (simulated — no email sent)`)
  const voidIt = async () => {
    const { confirmed, reason } = await confirm({ title: `Void ${invoice.number}?`, description: 'Voiding removes the invoice from revenue and receivables. Invoices with payments cannot be voided.', requireReason: true, reasonLabel: 'Reason for voiding', confirmLabel: 'Void invoice', destructive: true })
    if (confirmed) await runWithToast(invoiceRepository.void(invoice.id, reason), 'Invoice voided')
  }
  const remove = async () => {
    const { confirmed } = await confirm({ title: `Delete draft ${invoice.number}?`, description: 'The draft will be permanently removed from this browser’s demo data.', confirmLabel: 'Delete draft', destructive: true })
    if (confirmed && (await runWithToast(invoiceRepository.remove(invoice.id).then(() => true), 'Draft deleted'))) navigate('/sales/invoices')
  }
  const duplicate = async () => {
    const copy = await runWithToast(invoiceRepository.duplicate(invoice.id), 'Duplicated as a new draft')
    if (copy) navigate(`/sales/invoices/${copy.id}/edit`)
  }
  const removePayment = async (pid: string, number: string) => {
    const { confirmed } = await confirm({ title: `Delete payment ${number}?`, description: 'The invoice balance and status will be recalculated.', confirmLabel: 'Delete payment', destructive: true })
    if (confirmed) await runWithToast(paymentRepository.remove(pid), 'Payment deleted')
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {invoice.number} <StatusBadge status={displayStatus} />
          </span>
        }
        description={
          <>
            <Link to={`/sales/customers/${invoice.customerId}`} className="hover:underline">{lookups.customer(invoice.customerId)}</Link>
            {invoice.projectId ? <> · <Link to={`/projects/${invoice.projectId}`} className="hover:underline">{lookups.project(invoice.projectId)}</Link></> : null}
          </>
        }
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/sales/invoices"><ArrowLeft /> Invoices</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/sales/invoices/${invoice.id}/print`}><Printer /> Preview</Link>
            </Button>
            {invoice.status === 'draft' && canEdit ? (
              <Button variant="outline" asChild>
                <Link to={`/sales/invoices/${invoice.id}/edit`}><Pencil /> Edit</Link>
              </Button>
            ) : null}
            {invoice.status === 'draft' && canIssue ? (
              <Button onClick={issue}><Send /> Mark as issued</Button>
            ) : null}
            {open && canPay ? (
              <Button onClick={() => setPayOpen(true)}><CreditCard /> Record payment</Button>
            ) : null}
            {canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={duplicate}><Copy /> Duplicate as draft</DropdownMenuItem>
                  {open ? <DropdownMenuItem onSelect={() => setCreditOpen(true)}><FileMinus /> Raise credit note</DropdownMenuItem> : null}
                  <DropdownMenuSeparator />
                  {invoice.status === 'draft' ? (
                    <DropdownMenuItem variant="destructive" onSelect={remove}><Trash2 /> Delete draft</DropdownMenuItem>
                  ) : invoice.status !== 'void' ? (
                    <DropdownMenuItem variant="destructive" onSelect={voidIt}><Ban /> Void invoice</DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard label="Invoice total" value={formatCurrency(totals.total, invoice.currency)} hint={`Net ${formatCurrency(totals.netAmount)} + tax ${formatCurrency(totals.taxTotal)}`} />
        <StatCard label="Paid" value={formatCurrency(balance.paid, invoice.currency)} hint={`${related.length} simulated payment(s)`} />
        <StatCard label="Credited" term="Credit note" value={formatCurrency(balance.credited, invoice.currency)} hint={`${credits.length} credit note(s)`} />
        <StatCard label="Outstanding" term="Accounts receivable" value={formatCurrency(balance.outstanding, invoice.currency)} hint={overdueDays > 0 ? `${overdueDays} days overdue` : `Due ${formatDate(invoice.dueDate)}`} />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Line items">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Disc.</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div>{l.description}</div>
                        {l.productId ? <div className="text-muted-foreground text-xs">{lookups.product(l.productId)}</div> : null}
                      </TableCell>
                      <TableCell className="tabular text-right">{l.quantity}</TableCell>
                      <TableCell className="text-right"><Money value={l.unitPrice} /></TableCell>
                      <TableCell className="tabular text-right">{l.discountPercent ? formatPercent(l.discountPercent) : '—'}</TableCell>
                      <TableCell className="tabular text-right">{formatPercent(l.taxRatePercent, 0)}</TableCell>
                      <TableCell className="text-right"><Money value={lineTotals(l).net} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <dl className="mt-4 ml-auto w-full max-w-sm space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd><Money value={totals.subtotal} /></dd></div>
              {totals.documentDiscount ? <div className="flex justify-between"><dt className="text-muted-foreground">Invoice discount ({formatPercent(invoice.discountPercent)})</dt><dd><Money value={-totals.documentDiscount} /></dd></div> : null}
              {totals.taxByRate.map((t) => (
                <div key={t.rate} className="flex justify-between"><dt className="text-muted-foreground">Tax {formatPercent(t.rate, 0)}</dt><dd><Money value={t.tax} /></dd></div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd><Money value={totals.total} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Less payments</dt><dd><Money value={-balance.paid} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Less credit notes</dt><dd><Money value={-balance.credited} /></dd></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><dt>Balance due</dt><dd><Money value={balance.outstanding} /></dd></div>
            </dl>
          </Section>

          <Section title="Payments" description="Simulated receipts recorded against this invoice — no money was moved." actions={open && canPay ? <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}><CreditCard /> Record payment</Button> : null}>
            {related.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {related.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.number}</TableCell>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell>{humanize(p.method)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.reference ?? '—'}</TableCell>
                      <TableCell className="text-right"><Money value={p.amount} /></TableCell>
                      <TableCell className="text-right">
                        {canPay ? <Button variant="ghost" size="icon-sm" aria-label={`Delete payment ${p.number}`} onClick={() => removePayment(p.id, p.number)}><Trash2 /></Button> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
            )}
          </Section>

          {credits.length ? (
            <Section title="Credit notes">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {credits.map((c) => (
                    <TableRow key={c.id}><TableCell className="font-medium">{c.number}</TableCell><TableCell>{formatDate(c.date)}</TableCell><TableCell>{c.reason}</TableCell><TableCell className="text-right"><Money value={c.amount} /></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          ) : null}
        </div>

        <div className="space-y-6">
          <Section title="Details">
            <DetailList
              columns={1}
              items={[
                { label: 'Customer', value: <Link to={`/sales/customers/${invoice.customerId}`} className="text-primary hover:underline">{customer?.name}</Link> },
                { label: 'Billing contact', value: customer ? `${customer.contactName} · ${customer.email}` : undefined },
                { label: 'Issue date', value: formatDate(invoice.issueDate) },
                { label: 'Due date', value: <span className={overdueDays > 0 ? 'text-destructive font-medium' : undefined}>{formatDate(invoice.dueDate)}{overdueDays > 0 ? ` (${overdueDays} days overdue)` : ''}</span> },
                { label: 'Project', value: invoice.projectId ? <Link to={`/projects/${invoice.projectId}`} className="text-primary hover:underline">{lookups.project(invoice.projectId)}</Link> : undefined },
                { label: 'Contract', value: invoice.contractId ? <Link to="/sales/contracts" className="text-primary hover:underline">{invoice.contractId}</Link> : undefined },
                { label: 'Currency', value: invoice.currency },
                { label: 'Notes', value: invoice.notes || undefined },
                { label: 'Terms', value: invoice.terms || undefined },
              ]}
            />
          </Section>
          <Section title="Status history">
            <ActivityTimeline items={invoice.history} />
          </Section>
          <SimulatedNotice>Status changes are demo records only. “Issued” means marked as issued in this browser — nothing is emailed, posted to a ledger or reported to tax authorities.</SimulatedNotice>
        </div>
      </div>

      <RecordPaymentDialog invoice={invoice} open={payOpen} onOpenChange={setPayOpen} />
      <CreditNoteDialog invoice={invoice} open={creditOpen} onOpenChange={setCreditOpen} />
    </>
  )
}
