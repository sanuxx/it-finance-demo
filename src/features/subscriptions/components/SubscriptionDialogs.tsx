import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addMonths, format, parseISO } from 'date-fns'
import type { CustomerSubscription } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useCollection } from '@/hooks/useData'
import { useAction } from '@/hooks/useAction'
import { subscriptionRepository } from '@/services'
import { subscriptionMrr } from '@/lib/calculations/saas'
import { formatCurrency } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'

const ISO = /^\d{4}-\d{2}-\d{2}$/

const schema = z
  .object({
    customerId: z.string().min(1, 'Choose a customer'),
    productId: z.string().min(1, 'Choose a product'),
    planId: z.string().min(1, 'Choose a plan'),
    billingCycle: z.enum(['monthly', 'annual']),
    seats: z.number({ error: 'Enter seats' }).int('Whole number').min(1, 'At least one seat').max(100_000),
    unitPrice: z.number({ error: 'Enter a price' }).min(0, 'Cannot be negative'),
    startDate: z.string().regex(ISO, 'Choose a start date'),
    renewalDate: z.string().regex(ISO, 'Choose a renewal date'),
    status: z.enum(['trial', 'active', 'past_due']),
  })
  .refine((v) => v.renewalDate > v.startDate, { path: ['renewalDate'], message: 'Renewal must be after the start date' })
type Values = z.infer<typeof schema>

export function SubscriptionFormDialog({ open, onOpenChange, subscription }: { open: boolean; onOpenChange: (o: boolean) => void; subscription?: CustomerSubscription }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const customers = useCollection('customers')
  const products = useCollection('products')
  const saasProducts = products.filter((p) => p.kind === 'saas' && (p.active || p.id === subscription?.productId))
  const [productId, planId, cycle, seats, unitPrice, startDate] = useWatch({ control: form.control, name: ['productId', 'planId', 'billingCycle', 'seats', 'unitPrice', 'startDate'] })
  const product = products.find((p) => p.id === productId)
  const plan = product?.plans.find((p) => p.id === planId)
  const ready = useRef(false)

  useEffect(() => {
    if (!open) return
    ready.current = false
    const start = todayISO()
    const first = saasProducts[0]
    form.reset(
      subscription
        ? { ...subscription, status: subscription.status === 'cancelled' ? 'active' : subscription.status }
        : { customerId: '', productId: first?.id ?? '', planId: first?.plans[0]?.id ?? '', billingCycle: 'monthly', seats: 10, unitPrice: first?.plans[0]?.monthlyPrice ?? 0, startDate: start, renewalDate: format(addMonths(parseISO(start), 1), 'yyyy-MM-dd'), status: 'active' },
    )
    setTimeout(() => (ready.current = true), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subscription])

  // Default the unit price from the plan, and the renewal date from the cycle, when the user changes them.
  useEffect(() => {
    if (!ready.current || !plan) return
    form.setValue('unitPrice', cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice, { shouldValidate: true })
  }, [plan, cycle, form])
  useEffect(() => {
    if (!ready.current || !startDate || !ISO.test(startDate)) return
    form.setValue('renewalDate', format(addMonths(parseISO(startDate), cycle === 'annual' ? 12 : 1), 'yyyy-MM-dd'))
  }, [startDate, cycle, form])
  useEffect(() => {
    if (!ready.current || !product) return
    if (!product.plans.some((p) => p.id === form.getValues('planId'))) form.setValue('planId', product.plans[0]?.id ?? '')
  }, [product, form])

  const save = useAction(async (v: Values) => (subscription ? subscriptionRepository.update(subscription.id, v) : subscriptionRepository.create(v)), { success: subscription ? 'Subscription updated' : 'Subscription created' })
  const c = form.control
  const mrr = Number.isFinite(seats) && Number.isFinite(unitPrice) ? subscriptionMrr({ seats, unitPrice, billingCycle: cycle ?? 'monthly' }) : 0
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={subscription ? 'Edit subscription' : 'New subscription'}
      description="Subscriptions drive MRR, ARR and churn metrics. No billing provider is connected."
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}
      footerExtra={<span className="text-muted-foreground mr-auto self-center text-sm">MRR <strong className="text-foreground tabular">{formatCurrency(mrr)}</strong></span>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="customerId" label="Customer" required className="sm:col-span-2" options={customers.filter((x) => x.status !== 'inactive' || x.id === subscription?.customerId).map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField control={c} name="productId" label="Product" required options={saasProducts.map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField control={c} name="planId" label="Plan" required options={(product?.plans ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField control={c} name="billingCycle" label="Billing cycle" required options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} />
        <NumberField control={c} name="seats" label="Seats / outlets" step={1} min={1} required />
        <NumberField control={c} name="unitPrice" label={`Price per seat (${cycle === 'annual' ? 'per year' : 'per month'})`} prefix="LKR" min={0} required description={plan ? `List price: ${formatCurrency(cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice)}` : undefined} />
        <SelectField control={c} name="status" label="Status" required options={[{ value: 'trial', label: 'Trial (excluded from MRR)' }, { value: 'active', label: 'Active' }, { value: 'past_due', label: 'Past due' }]} />
        <TextField control={c} name="startDate" label="Start date" type="date" required />
        <TextField control={c} name="renewalDate" label="Next renewal" type="date" required />
      </div>
    </FormDialog>
  )
}

const cancelSchema = z.object({ cancelledDate: z.string().regex(ISO, 'Choose a date') })

export function CancelSubscriptionDialog({ open, onOpenChange, subscription, label }: { open: boolean; onOpenChange: (o: boolean) => void; subscription?: CustomerSubscription; label: string }) {
  const form = useForm<{ cancelledDate: string }>({ resolver: zodResolver(cancelSchema), defaultValues: { cancelledDate: todayISO() } })
  useEffect(() => {
    if (open) form.reset({ cancelledDate: todayISO() })
  }, [open, form])
  const save = useAction(
    async (v: { cancelledDate: string }) => {
      if (!subscription) throw new Error('No subscription selected')
      if (v.cancelledDate < subscription.startDate) throw new Error('Cancellation cannot be before the start date.')
      return subscriptionRepository.update(subscription.id, { status: 'cancelled', cancelledDate: v.cancelledDate })
    },
    { success: 'Subscription cancelled — churn metrics updated' },
  )
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Cancel subscription" description={`${label}. MRR stops from the cancellation date and the subscription counts towards churn.`} submitLabel="Cancel subscription" size="sm" pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <TextField control={form.control} name="cancelledDate" label="Cancellation effective date" type="date" required />
    </FormDialog>
  )
}
