import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Customer } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { customerRepository } from '@/services'
import { EMPTY, customerSchema, type CustomerFormValues } from '../lib/customerSchema'

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
