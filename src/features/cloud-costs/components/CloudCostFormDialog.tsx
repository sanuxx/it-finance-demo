import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CloudCostEntry } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useCollection, useMasterList } from '@/hooks/useData'
import { useAction } from '@/hooks/useAction'
import { cloudCostRepository } from '@/services'
import { todayISO } from '@/lib/dates'

import { CATEGORIES, ENVIRONMENTS, PROVIDERS } from '../lib/cloud'

const schema = z.object({
  provider: z.enum(PROVIDERS),
  service: z.string().trim().min(2, 'Describe the service').max(80),
  category: z.enum(CATEGORIES),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Choose a month'),
  amount: z.number({ error: 'Enter an amount' }).positive('Amount must be greater than zero').max(1_000_000_000),
  environment: z.enum(ENVIRONMENTS),
  projectId: z.string().optional(),
  productId: z.string().optional(),
  departmentId: z.string().optional(),
})
type Values = z.infer<typeof schema>

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

export function CloudCostFormDialog({ open, onOpenChange, entry }: { open: boolean; onOpenChange: (o: boolean) => void; entry?: CloudCostEntry }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const projects = useCollection('projects')
  const products = useCollection('products')
  const departments = useMasterList('departments')
  useEffect(() => {
    if (!open) return
    form.reset(entry ? { ...entry, month: entry.month.slice(0, 7) } : { provider: 'AWS', service: '', category: 'compute', month: todayISO().slice(0, 7), amount: undefined as unknown as number, environment: 'production' })
  }, [open, entry, form])
  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, month: `${v.month}-01`, currency: 'LKR' as const }
      return entry ? cloudCostRepository.update(entry.id, payload) : cloudCostRepository.create(payload)
    },
    { success: entry ? 'Cloud cost updated' : 'Cloud cost added' },
  )
  const c = form.control
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit cloud cost' : 'Add cloud cost'}
      description="Sample usage entry — no cloud provider is connected. Tag a project or product to allocate the cost."
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="provider" label="Provider" required options={PROVIDERS.map((p) => ({ value: p, label: p }))} />
        <TextField control={c} name="service" label="Service" required placeholder="e.g. EC2 compute" />
        <SelectField control={c} name="category" label="Category" required options={CATEGORIES.map((p) => ({ value: p, label: cap(p) }))} />
        <SelectField control={c} name="environment" label="Environment" required options={ENVIRONMENTS.map((p) => ({ value: p, label: cap(p) }))} />
        <TextField control={c} name="month" label="Billing month" type="month" required />
        <NumberField control={c} name="amount" label="Amount" prefix="LKR" required min={0} />
        <SelectField control={c} name="projectId" label="Project" allowNone options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
        <SelectField control={c} name="productId" label="Product" allowNone options={products.filter((p) => p.kind === 'saas').map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField control={c} name="departmentId" label="Department" allowNone options={departments.map((d) => ({ value: d.id, label: d.name }))} />
      </div>
    </FormDialog>
  )
}
