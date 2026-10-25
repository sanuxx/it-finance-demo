import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ProjectCostEntry } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { CheckboxField, NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { useCollection, useMasterList } from '@/hooks/useData'
import { projectCostRepository } from '@/services'
import { round2 } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { COST_TYPE_LABELS, toOptions } from '../lib/labels'

const schema = z.object({
  projectId: z.string({ error: 'Choose a project' }).min(1, 'Choose a project'),
  date: z.string().min(1, 'Choose a date'),
  type: z.enum(['labour', 'infrastructure', 'software', 'subcontractor', 'travel', 'other']),
  costCodeId: z.string().optional(),
  description: z.string().trim().min(3, 'Describe the cost').max(200),
  amount: z.number({ error: 'Enter an amount' }).positive('Amount must be greater than zero').max(1_000_000_000),
  billable: z.boolean(),
  committed: z.boolean(),
})
type Values = z.infer<typeof schema>

export function CostEntryDialog({ open, onOpenChange, entry, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; entry?: ProjectCostEntry; projectId?: string }) {
  const projects = useCollection('projects')
  const costCodes = useMasterList('costCodes')
  const defaults = useMemo<Values>(
    () =>
      entry
        ? { projectId: entry.projectId, date: entry.date, type: entry.type, costCodeId: entry.costCodeId, description: entry.description, amount: entry.amount, billable: entry.billable, committed: entry.committed }
        : { projectId: projectId ?? '', date: todayISO(), type: 'other', costCodeId: undefined, description: '', amount: 0, billable: true, committed: false },
    [entry, projectId],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])

  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, amount: round2(v.amount), sourceType: entry?.sourceType ?? ('manual' as const), sourceId: entry?.sourceId }
      return entry ? projectCostRepository.update(entry.id, payload) : projectCostRepository.create(payload)
    },
    { success: entry ? 'Cost entry updated' : 'Cost entry added' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={entry ? 'Edit cost entry' : 'Add cost entry'} description="Direct project costs. Labour is calculated from timesheets, so record it here only for exceptional items." onSubmit={onSubmit} pending={save.pending} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="projectId" label="Project" required disabled={!!projectId} options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} className="sm:col-span-2" />
        <TextField control={c} name="description" label="Description" required className="sm:col-span-2" />
        <SelectField control={c} name="type" label="Cost type" required options={toOptions(COST_TYPE_LABELS)} />
        <SelectField control={c} name="costCodeId" label="Cost code" allowNone options={costCodes.map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))} />
        <TextField control={c} name="date" label="Date" type="date" required />
        <NumberField control={c} name="amount" label="Amount" prefix="LKR" min={0} required />
        <CheckboxField control={c} name="billable" label="Billable to the client" />
        <CheckboxField control={c} name="committed" label="Committed (ordered, not yet incurred)" description="Committed costs count towards the forecast, not actual cost." />
      </div>
    </FormDialog>
  )
}
