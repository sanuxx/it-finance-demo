import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Invoice } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { invoiceRepository } from '@/services'
import { documentTotals } from '@/lib/calculations/invoices'
import { addDaysIso, blankLine, todayIso } from '../lib/billing'
import { LineItemsEditor, linesSchema, type LinesForm } from '../components/LineItemsEditor'

const schema = z
  .object({
    customerId: z.string().min(1, { error: 'Choose a customer' }),
    projectId: z.string().optional(),
    contractId: z.string().optional(),
    issueDate: z.string().min(10, { error: 'Choose an issue date' }),
    dueDate: z.string().min(10, { error: 'Choose a due date' }),
    discountPercent: z.number({ error: 'Enter 0 for no discount' }).min(0).max(100, { error: 'Max 100%' }),
    notes: z.string().max(1000).optional(),
    terms: z.string().max(1000).optional(),
    lines: linesSchema,
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ['dueDate'], error: 'Due date cannot be before the issue date' })

type Values = z.infer<typeof schema>

export default function InvoiceEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const existing = useRecord('invoices', id)
  const customers = useCollection('customers')
  const projects = useCollection('projects')
  const contracts = useCollection('contracts')
  const canEdit = usePermission('sales.edit')
  const canIssue = usePermission('invoices.issue')
  const [saving, setSaving] = useState<'draft' | 'issue' | null>(null)

  const defaults = useMemo<Values>(() => {
    if (existing) {
      return {
        customerId: existing.customerId,
        projectId: existing.projectId,
        contractId: existing.contractId,
        issueDate: existing.issueDate,
        dueDate: existing.dueDate,
        discountPercent: existing.discountPercent,
        notes: existing.notes ?? '',
        terms: existing.terms ?? '',
        lines: existing.lines.map((l) => ({ ...l })),
      }
    }
    const customerId = params.get('customer') ?? ''
    const projectId = params.get('project') ?? undefined
    const customer = customers.find((c) => c.id === customerId)
    const issue = todayIso()
    return {
      customerId,
      projectId,
      contractId: projectId ? projects.find((p) => p.id === projectId)?.contractId : undefined,
      issueDate: issue,
      dueDate: addDaysIso(issue, customer?.paymentTermsDays ?? 30),
      discountPercent: 0,
      notes: '',
      terms: 'Payment by bank transfer quoting the invoice number. (Sample terms — illustrative only.)',
      lines: [blankLine()],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id])

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  useEffect(() => form.reset(defaults), [defaults, form])

  const customerId = useWatch({ control: form.control, name: 'customerId' })
  const issueDate = useWatch({ control: form.control, name: 'issueDate' })
  const projectId = useWatch({ control: form.control, name: 'projectId' })

  // Default the due date from the customer's payment terms unless the user changed it.
  useEffect(() => {
    if (!customerId || !issueDate || issueDate.length < 10) return
    if (form.getFieldState('dueDate').isDirty) return
    const terms = customers.find((c) => c.id === customerId)?.paymentTermsDays ?? 30
    form.setValue('dueDate', addDaysIso(issueDate, terms))
  }, [customerId, issueDate, customers, form])

  // Picking a project fills its contract.
  useEffect(() => {
    if (!projectId) return
    const p = projects.find((x) => x.id === projectId)
    if (p?.contractId && !form.getValues('contractId')) form.setValue('contractId', p.contractId)
  }, [projectId, projects, form])

  if (id && !existing) return <EmptyState title="Invoice not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/sales/invoices">Back to invoices</Link></Button>} className="mt-10" />
  if (existing && existing.status !== 'draft')
    return (
      <EmptyState
        title={`${existing.number} has been issued`}
        description="Issued invoices cannot be edited. Raise a credit note or void the invoice from its detail page."
        action={<Button asChild size="sm"><Link to={`/sales/invoices/${existing.id}`}>Open invoice</Link></Button>}
        className="mt-10"
      />
    )
  if (!canEdit) return <EmptyState title="Your demo role cannot edit invoices" description="Switch to the Finance Manager or Accountant role from the user menu." className="mt-10" />

  const submit = (mode: 'draft' | 'issue') =>
    form.handleSubmit(async (v) => {
      setSaving(mode)
      const payload = {
        ...v,
        projectId: v.projectId || undefined,
        contractId: v.contractId || undefined,
        currency: existing?.currency ?? customers.find((c) => c.id === v.customerId)?.currency ?? 'LKR',
      }
      let saved: Invoice | undefined
      if (existing) saved = await runWithToast(invoiceRepository.update(existing.id, payload))
      else saved = await runWithToast(invoiceRepository.create({ ...payload, number: '', status: 'draft', history: [] }))
      if (saved && mode === 'issue') {
        if (documentTotals(saved.lines, saved.discountPercent).total <= 0) {
          toast.error('Draft saved, but the invoice total must be greater than zero before issuing.')
        } else {
          await runWithToast(invoiceRepository.issue(saved.id), `${saved.number} issued (simulated — no email sent)`)
        }
      } else if (saved) {
        toast.success(`Draft ${saved.number} saved`)
      }
      setSaving(null)
      if (saved) navigate(`/sales/invoices/${saved.id}`)
    })()

  const c = form.control
  const customerProjects = projects.filter((p) => !customerId || p.customerId === customerId)
  const customerContracts = contracts.filter((x) => !customerId || x.customerId === customerId)

  return (
    <>
      <PageHeader
        title={existing ? `Edit ${existing.number}` : 'New invoice'}
        description="Draft invoices can be changed freely. Totals use decimal-safe rounding (2 dp, half-up) with tax calculated per line."
        actions={
          <Button variant="outline" asChild>
            <Link to={existing ? `/sales/invoices/${existing.id}` : '/sales/invoices'}>
              <ArrowLeft /> Cancel
            </Link>
          </Button>
        }
      />
      <form onSubmit={(e) => { e.preventDefault(); submit('draft') }} noValidate className="space-y-6">
        <Section title="Customer & dates">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField control={c} name="customerId" label="Customer" required options={customers.filter((x) => x.status !== 'inactive' || x.id === customerId).map((x) => ({ value: x.id, label: x.name }))} className="md:col-span-1" />
            <SelectField control={c} name="projectId" label="Project" allowNone noneLabel="No project" options={customerProjects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
            <SelectField control={c} name="contractId" label="Contract" allowNone noneLabel="No contract" options={customerContracts.map((x) => ({ value: x.id, label: `${x.number} · ${x.title}` }))} />
            <TextField control={c} name="issueDate" label="Issue date" type="date" required />
            <TextField control={c} name="dueDate" label="Due date" type="date" required description="Defaults from the customer’s payment terms" />
            <NumberField control={c} name="discountPercent" label="Invoice discount" suffix="%" min={0} />
          </div>
        </Section>
        <Section title="Line items" description="Choose a product or service, then set quantity, price, discount and tax.">
          <LineItemsEditor control={c as unknown as Control<LinesForm>} errors={form.formState.errors as never} />
        </Section>
        <Section title="Notes & terms">
          <div className="grid gap-4 md:grid-cols-2">
            <TextareaField control={c} name="notes" label="Notes to customer" rows={3} />
            <TextareaField control={c} name="terms" label="Payment terms text" rows={3} />
          </div>
        </Section>
        <SimulatedNotice>Saving stores the invoice in this browser. “Save & issue” marks it as issued in the demo — no email, PDF delivery or accounting posting takes place.</SimulatedNotice>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="submit" variant="outline" disabled={!!saving}>
            {saving === 'draft' ? <Loader2 className="animate-spin" /> : <Save />} Save draft
          </Button>
          {canIssue ? (
            <Button type="button" onClick={() => submit('issue')} disabled={!!saving}>
              {saving === 'issue' ? <Loader2 className="animate-spin" /> : <Send />} Save & issue
            </Button>
          ) : null}
        </div>
      </form>
    </>
  )
}
