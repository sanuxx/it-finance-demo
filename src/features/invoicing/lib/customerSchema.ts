import { z } from 'zod'

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

export const EMPTY: CustomerFormValues = {
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
