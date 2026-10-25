import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Customer } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { customerRepository } from '@/services'

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name').max(120),
  code: z.string().trim().min(2, 'Enter a short code').max(20),
  industry: z.string().trim().min(2, 'Enter an industry'),
  contactName: z.string().trim().min(2, 'Enter a contact name'),
  email: z.email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  country: z.string().trim().min(2, 'Enter a country'),
  paymentTermsDays: z.number({ error: 'Enter payment terms in days' }).int().min(0, 'Cannot be negative').max(180, 'Maximum 180 days'),
  creditLimit: z.number({ error: 'Enter a credit limit' }).min(0, 'Cannot be negative'),
  status: z.enum(['active', 'inactive', 'prospect']),
  notes: z.string().max(1000).optional(),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

const EMPTY: CustomerFormValues = {
  name: '',
  code: '',
  industry: '',
  contactName: '',
  email: '',
  phone: '',
  country: 'Sri Lanka',
  paymentTermsDays: 30,
  creditLimit: 5_000_000,
  status: 'active',
  notes: '',
}

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; customer?: Customer; onSaved?: (c: Customer) => void }) {
  const form = useForm<CustomerFormValues>({ resolver: zodResolver(customerSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (open) form.reset(customer ? { ...EMPTY, ...customer, phone: customer.phone ?? '', notes: customer.notes ?? '' } : EMPTY)
  }, [open, customer, form])

  const save = useAction(
    async (values: CustomerFormValues) => {
      const payload = { ...values, phone: values.phone ?? '', currency: customer?.currency ?? ('LKR' as const) }
      return customer ? customerRepository.update(customer.id, payload) : customerRepository.create(payload)
    },
    { success: customer ? 'Customer updated' : 'Customer created' },
  )

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await save.run(values)
    if (result) {
      onOpenChange(false)
      onSaved?.(result)
    }
  })

  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={customer ? `Edit ${customer.name}` : 'New customer'} description="Fictional customer records only — do not enter real company or personal data." onSubmit={onSubmit} pending={save.pending} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Customer name" required autoFocus className="sm:col-span-2" />
        <TextField control={c} name="code" label="Code" required />
        <TextField control={c} name="industry" label="Industry" required />
        <TextField control={c} name="contactName" label="Billing contact" required />
        <TextField control={c} name="email" label="Billing email" type="email" required />
        <TextField control={c} name="phone" label="Phone" type="tel" />
        <TextField control={c} name="country" label="Country" required />
        <NumberField control={c} name="paymentTermsDays" label="Payment terms" suffix="days" required step={1} min={0} />
        <NumberField control={c} name="creditLimit" label="Credit limit" prefix="LKR" required min={0} />
        <SelectField
          control={c}
          name="status"
          label="Status"
          required
          options={[
            { value: 'active', label: 'Active' },
            { value: 'prospect', label: 'Prospect' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <TextareaField control={c} name="notes" label="Notes" className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}
