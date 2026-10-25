import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Invoice } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useAction } from '@/hooks/useAction'
import { useCollection, useInvoiceViews } from '@/hooks/useData'
import { invoiceRepository } from '@/services'
import { formatCurrency } from '@/lib/formatting'
import { PAYMENT_METHOD_OPTIONS, todayIso } from '../lib/billing'

function paymentSchema(outstanding: number) {
  return z.object({
    date: z.string().min(10, { error: 'Choose a payment date' }),
    amount: z
      .number({ error: 'Enter an amount' })
      .positive({ error: 'Amount must be greater than zero' })
      .max(outstanding + 0.004, { error: `Cannot exceed the outstanding balance of ${formatCurrency(outstanding)}` }),
    method: z.enum(['bank_transfer', 'cheque', 'card', 'cash', 'online']),
    bankAccountId: z.string().min(1, { error: 'Choose a bank account' }),
    reference: z.string().max(80).optional(),
    notes: z.string().max(500).optional(),
  })
}
type PaymentValues = z.infer<ReturnType<typeof paymentSchema>>

/** Record a simulated customer receipt against an invoice. */
export function RecordPaymentDialog({ invoice, open, onOpenChange }: { invoice?: Invoice; open: boolean; onOpenChange: (o: boolean) => void }) {
  const views = useInvoiceViews()
  const bankAccounts = useCollection('bankAccounts')
  const outstanding = invoice ? (views.get(invoice.id)?.balance.outstanding ?? 0) : 0
  const form = useForm<PaymentValues>({ resolver: zodResolver(paymentSchema(outstanding)) })

  useEffect(() => {
    if (open) form.reset({ date: todayIso(), amount: outstanding, method: 'bank_transfer', bankAccountId: bankAccounts[0]?.id ?? '', reference: '', notes: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id])

  const save = useAction((v: PaymentValues) => invoiceRepository.recordPayment(invoice!.id, v), { success: (p) => `Simulated payment ${p.number} recorded` })
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Record payment — ${invoice?.number ?? ''}`} description={`Outstanding balance: ${formatCurrency(outstanding)}`} onSubmit={onSubmit} pending={save.pending} submitLabel="Record simulated payment">
      <SimulatedNotice>This records an illustrative receipt in this browser only. No money is transferred and no bank is contacted.</SimulatedNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField control={form.control} name="amount" label="Amount" prefix="LKR" required min={0} />
        <TextField control={form.control} name="date" label="Payment date" type="date" required />
        <SelectField control={form.control} name="method" label="Method" required options={PAYMENT_METHOD_OPTIONS} />
        <SelectField control={form.control} name="bankAccountId" label="Deposited to" required options={bankAccounts.filter((b) => b.active).map((b) => ({ value: b.id, label: `${b.name} (${b.accountMask})` }))} />
        <TextField control={form.control} name="reference" label="Reference" className="sm:col-span-2" placeholder="e.g. remittance advice number" />
        <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={2} />
      </div>
    </FormDialog>
  )
}

function creditSchema(outstanding: number) {
  return z.object({
    date: z.string().min(10, { error: 'Choose a date' }),
    amount: z
      .number({ error: 'Enter an amount' })
      .positive({ error: 'Amount must be greater than zero' })
      .max(outstanding + 0.004, { error: `Cannot exceed the outstanding balance of ${formatCurrency(outstanding)}` }),
    reason: z.string().trim().min(5, { error: 'Explain the reason (at least 5 characters)' }).max(200),
  })
}
type CreditValues = z.infer<ReturnType<typeof creditSchema>>

export function CreditNoteDialog({ invoice, open, onOpenChange }: { invoice?: Invoice; open: boolean; onOpenChange: (o: boolean) => void }) {
  const views = useInvoiceViews()
  const outstanding = invoice ? (views.get(invoice.id)?.balance.outstanding ?? 0) : 0
  const form = useForm<CreditValues>({ resolver: zodResolver(creditSchema(outstanding)) })
  useEffect(() => {
    if (open) form.reset({ date: todayIso(), amount: undefined as unknown as number, reason: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id])
  const save = useAction((v: CreditValues) => invoiceRepository.createCreditNote(invoice!.id, v), { success: (c) => `Credit note ${c.number} applied` })
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Credit note — ${invoice?.number ?? ''}`} description={`Reduces the amount owed. Outstanding: ${formatCurrency(outstanding)}`} onSubmit={onSubmit} pending={save.pending} submitLabel="Apply credit note">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField control={form.control} name="amount" label="Credit amount (incl. tax)" prefix="LKR" required min={0} />
        <TextField control={form.control} name="date" label="Date" type="date" required />
        <TextareaField control={form.control} name="reason" label="Reason" required className="sm:col-span-2" rows={2} />
      </div>
      <SimulatedNotice>Illustrative credit note — not a tax document. Refunds of paid amounts are not simulated in this demo.</SimulatedNotice>
    </FormDialog>
  )
}
