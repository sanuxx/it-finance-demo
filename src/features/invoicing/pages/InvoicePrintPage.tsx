import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useInvoiceViews, useLookups, useRecord } from '@/hooks/useData'
import { lineTotals } from '@/lib/calculations/invoices'
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatting'
import { fillTemplate, invoiceTemplateVars } from '../lib/billing'

export default function InvoicePrintPage() {
  const { id } = useParams()
  const invoice = useRecord('invoices', id)
  const db = useDbSlice('customers', 'payments', 'creditNotes', 'organization', 'templates')
  const views = useInvoiceViews()
  const lookups = useLookups()
  if (!invoice) return <EmptyState title="Invoice not found" action={<Button asChild size="sm"><Link to="/sales/invoices">Back to invoices</Link></Button>} className="mt-10" />

  const view = views.get(invoice.id)!
  const customer = db.customers.find((c) => c.id === invoice.customerId)
  const org = db.organization
  const template = db.templates.find((t) => t.kind === 'invoice' && t.isDefault) ?? db.templates.find((t) => t.kind === 'invoice')
  const accent = template?.accentColor ?? '#1d4ed8'
  const message = template ? fillTemplate(template.body, invoiceTemplateVars(invoice, db)) : ''
  const fmt = (v: number) => formatCurrency(v, invoice.currency)

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link to={`/sales/invoices/${invoice.id}`}><ArrowLeft /> Back to invoice</Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Template: {template?.name ?? 'Built-in'} · <Link to="/config/templates" className="text-primary hover:underline">Edit templates</Link></span>
          <Button onClick={() => window.print()}><Printer /> Print / save as PDF</Button>
        </div>
      </div>
      <SimulatedNotice className="no-print">This is an illustrative layout generated in your browser from sample data. It is not a valid tax invoice and is never sent to anyone.</SimulatedNotice>

      <article className="relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border bg-white p-8 text-[13px] text-slate-900 shadow-sm sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none" aria-label={`Invoice ${invoice.number} preview`}>
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-24deg] text-5xl font-bold tracking-widest whitespace-nowrap text-slate-200/70 uppercase select-none sm:text-6xl">Sample data — not a tax invoice</span>
        </div>
        <div className="relative">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6" style={{ borderColor: accent }}>
            <div>
              <div className="text-xl font-semibold" style={{ color: accent }}>{org.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-600">
                {org.legalName}<br />{org.address}<br />{org.email} · {org.phone}<br />Tax ID: {org.taxId}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight">{invoice.status === 'draft' ? 'DRAFT INVOICE' : 'INVOICE'}</div>
              <div className="mt-1 text-sm font-medium">{invoice.number}</div>
              <dl className="mt-2 space-y-0.5 text-xs text-slate-600">
                <div>Issue date: {formatDate(invoice.issueDate)}</div>
                <div>Due date: {formatDate(invoice.dueDate)}</div>
                {invoice.projectId ? <div>Project: {lookups.projectCode(invoice.projectId)}</div> : null}
              </dl>
            </div>
          </header>

          <section className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Bill to</div>
              <div className="mt-1 font-medium">{customer?.name}</div>
              <div className="text-xs leading-relaxed text-slate-600">Attn: {customer?.contactName}<br />{customer?.email}<br />{customer?.country}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Amount due</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(view.balance.outstanding)}</div>
            </div>
          </section>

          <table className="mt-8 w-full text-left">
            <thead>
              <tr className="border-b text-xs text-slate-500 uppercase" style={{ borderColor: accent }}>
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 text-right font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Unit price</th>
                <th className="py-2 text-right font-semibold">Disc.</th>
                <th className="py-2 text-right font-semibold">Tax</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-200 align-top">
                  <td className="py-2 pr-4">{l.description}</td>
                  <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(l.unitPrice)}</td>
                  <td className="py-2 text-right tabular-nums">{l.discountPercent ? formatPercent(l.discountPercent) : '—'}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(l.taxRatePercent, 0)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(lineTotals(l).net)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm tabular-nums">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>{fmt(view.totals.subtotal)}</dd></div>
            {view.totals.documentDiscount ? <div className="flex justify-between"><dt className="text-slate-600">Discount</dt><dd>-{fmt(view.totals.documentDiscount)}</dd></div> : null}
            {view.totals.taxByRate.map((t) => (
              <div key={t.rate} className="flex justify-between"><dt className="text-slate-600">VAT {formatPercent(t.rate, 0)} (illustrative)</dt><dd>{fmt(t.tax)}</dd></div>
            ))}
            <div className="flex justify-between border-t pt-1.5 font-semibold" style={{ borderColor: accent }}><dt>Total</dt><dd>{fmt(view.totals.total)}</dd></div>
            {view.balance.paid ? <div className="flex justify-between"><dt className="text-slate-600">Paid</dt><dd>-{fmt(view.balance.paid)}</dd></div> : null}
            {view.balance.credited ? <div className="flex justify-between"><dt className="text-slate-600">Credited</dt><dd>-{fmt(view.balance.credited)}</dd></div> : null}
            <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{fmt(view.balance.outstanding)}</dd></div>
          </dl>

          {message ? <p className="mt-8 text-sm leading-relaxed whitespace-pre-line text-slate-700">{message}</p> : null}
          {invoice.notes ? <p className="mt-4 text-xs whitespace-pre-line text-slate-600">{invoice.notes}</p> : null}
          {invoice.terms ? <p className="mt-2 text-xs whitespace-pre-line text-slate-500">{invoice.terms}</p> : null}
          <footer className="mt-10 border-t pt-3 text-center text-[11px] text-slate-400">Generated by an interactive demo with fictional data. Not a legal or tax document.</footer>
        </div>
      </article>
    </div>
  )
}
