import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Milestone } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { milestoneRepository } from '@/services'
import { todayISO } from '@/lib/dates'
import { MILESTONE_STATUS_LABELS, toOptions } from '../lib/labels'

const schema = z.object({
  name: z.string().trim().min(3, 'Enter a milestone name').max(120),
  dueDate: z.string().min(1, 'Choose a due date'),
  amount: z.number({ error: 'Enter an amount' }).min(0, 'Cannot be negative'),
  status: z.enum(['pending', 'in_progress', 'completed', 'invoiced']),
})
type Values = z.infer<typeof schema>

export function MilestoneDialog({ open, onOpenChange, projectId, milestone }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; milestone?: Milestone }) {
  const defaults = useMemo<Values>(
    () => (milestone ? { name: milestone.name, dueDate: milestone.dueDate, amount: milestone.amount, status: milestone.status } : { name: '', dueDate: todayISO(), amount: 0, status: 'pending' }),
    [milestone],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])
  const save = useAction(
    async (v: Values) => (milestone ? milestoneRepository.update(milestone.id, v) : milestoneRepository.create({ ...v, projectId })),
    { success: milestone ? 'Milestone updated' : 'Milestone added' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  const statusOptions = toOptions(MILESTONE_STATUS_LABELS).filter((o) => o.value !== 'invoiced' || milestone?.status === 'invoiced')
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={milestone ? 'Edit milestone' : 'Add milestone'} onSubmit={onSubmit} pending={save.pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Milestone" required className="sm:col-span-2" autoFocus />
        <TextField control={c} name="dueDate" label="Due date" type="date" required />
        <NumberField control={c} name="amount" label="Billing amount" prefix="LKR" min={0} required />
        <SelectField control={c} name="status" label="Status" required options={statusOptions} disabled={milestone?.status === 'invoiced'} description={milestone?.status === 'invoiced' ? 'Invoiced milestones are locked.' : 'Invoice a milestone from Sales → Invoices.'} />
      </div>
    </FormDialog>
  )
}
