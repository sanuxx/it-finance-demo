import { z } from 'zod'
import type { LineItem } from '@/domain'

export const lineSchema = z.object({
  id: z.string(),
  productId: z.string().optional(),
  description: z.string().trim().min(2, { error: 'Describe the line' }).max(200),
  quantity: z.number({ error: 'Qty required' }).positive({ error: 'Must be > 0' }),
  unitPrice: z.number({ error: 'Price required' }).min(0, { error: 'Cannot be negative' }),
  discountPercent: z.number({ error: 'Required' }).min(0).max(100, { error: 'Max 100%' }),
  taxRatePercent: z.number({ error: 'Required' }).min(0).max(100, { error: 'Max 100%' }),
})

export const linesSchema = z.array(lineSchema).min(1, { error: 'Add at least one line' })

export type LinesForm = { lines: LineItem[]; discountPercent?: number }
