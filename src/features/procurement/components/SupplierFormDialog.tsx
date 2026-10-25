import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Supplier } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { CheckboxField, NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { supplierRepository } from '@/services'
import { useProcurementOptions } from './shared'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the supplier name').max(120),
  code: z.string().trim().min(2, 'Enter a short code').max(20),
  categoryId: z.string().min(1, 'Choose a category'),
  contactName: z.string().trim().min(2, 'Enter a contact name'),
  email: z.email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional(),
  country: z.string().trim().min(2, 'Enter a country'),
  paymentTermsDays: z.number({ error: 'Enter payment terms' }).int().min(0).max(180, 'Maximum 180 days'),
  status: z.enum(['active', 'inactive']),
  isSoftwareVendor: z.boolean(),
})
type Values = z.infer<typeof schema>

const EMPTY: Values = { name: '', code: '', categoryId: '', contactName: '', email: '', phone: '', country: 'Sri Lanka', paymentTermsDays: 30, status: 'active', isSoftwareVendor: false }

export function SupplierFormDialog({ open, onOpenChange, supplier }: { open: boolean; onOpenChange: (o: boolean) => void; supplier?: Supplier }) {
  const { supplierCategories } = useProcurementOptions()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY })
  useEffect(() => {
    if (open) form.reset(supplier ? { ...EMPTY, ...supplier, phone: supplier.phone ?? '' } : EMPTY)
  }, [open, supplier, form])
  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, phone: v.phone ?? '', currency: supplier?.currency ?? ('LKR' as const) }
      return supplier ? supplierRepository.update(supplier.id, payload) : supplierRepository.create(payload)
    },
    { success: supplier ? 'Supplier updated' : 'Supplier created' },
  )
  const c = form.control
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={supplier ? `Edit ${supplier.name}` : 'New supplier'}
      description="Fictional supplier details only. Never enter real bank account or credential information."
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Supplier name" required autoFocus className="sm:col-span-2" />
        <TextField control={c} name="code" label="Code" required />
        <SelectField control={c} name="categoryId" label="Category" options={supplierCategories} required />
        <TextField control={c} name="contactName" label="Contact" required />
        <TextField control={c} name="email" label="Billing email" type="email" required />
        <TextField control={c} name="phone" label="Phone" type="tel" />
        <TextField control={c} name="country" label="Country" required />
        <NumberField control={c} name="paymentTermsDays" label="Payment terms" suffix="days" step={1} min={0} required />
        <SelectField
          control={c}
          name="status"
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <CheckboxField control={c} name="isSoftwareVendor" label="Software / SaaS vendor" description="Shown in supplier subscription reporting." className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}
