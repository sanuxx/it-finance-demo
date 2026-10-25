import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { todayISO } from '@/lib/dates'
import { weekStart } from '../lib/week'
import type { TimesheetEntry } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { CheckboxField, NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { useCollection } from '@/hooks/useData'
import { timesheetRepository } from '@/services'

const schema = z.object({
  employeeId: z.string({ error: 'Choose a person' }).min(1, 'Choose a person'),
  projectId: z.string({ error: 'Choose a project' }).min(1, 'Choose a project'),
  date: z.string().min(1, 'Choose the week'),
  hours: z.number({ error: 'Enter hours' }).positive('Hours must be greater than zero').max(60, 'A weekly entry cannot exceed 60 hours'),
  billable: z.boolean(),
  description: z.string().trim().min(3, 'Describe the work').max(200),
})
type Values = z.infer<typeof schema>


export function TimesheetDialog({ open, onOpenChange, entry, lockedEmployeeId }: { open: boolean; onOpenChange: (o: boolean) => void; entry?: TimesheetEntry; lockedEmployeeId?: string }) {
  const employees = useCollection('employees')
  const projects = useCollection('projects')
  const defaults = useMemo<Values>(
    () =>
      entry
        ? { employeeId: entry.employeeId, projectId: entry.projectId, date: entry.date, hours: entry.hours, billable: entry.billable, description: entry.description }
        : { employeeId: lockedEmployeeId ?? '', projectId: '', date: weekStart(todayISO()), hours: 8, billable: true, description: '' },
    [entry, lockedEmployeeId],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])

  const save = useAction(
    async (v: Values) => {
      const project = projects.find((p) => p.id === v.projectId)
      const payload = { ...v, date: weekStart(v.date), billable: project?.isInternal ? false : v.billable }
      return entry ? timesheetRepository.update(entry.id, payload) : timesheetRepository.create({ ...payload, status: 'draft' })
    },
    { success: entry ? 'Timesheet updated' : 'Hours logged as draft' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={entry ? 'Edit timesheet entry' : 'Log hours'} description="One entry per person, project and week. Draft entries do not count towards cost until submitted." onSubmit={onSubmit} pending={save.pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="employeeId" label="Person" required disabled={!!lockedEmployeeId} className="sm:col-span-2" options={employees.filter((e) => e.active).map((e) => ({ value: e.id, label: e.name }))} />
        <SelectField
          control={c}
          name="projectId"
          label="Project"
          required
          className="sm:col-span-2"
          options={projects.filter((p) => p.status === 'active' || p.status === 'planning' || p.id === entry?.projectId).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
        />
        <TextField control={c} name="date" label="Week (any day)" type="date" required description="Saved as the Monday of that week." />
        <NumberField control={c} name="hours" label="Hours" suffix="h" min={0} step={0.5} required />
        <TextField control={c} name="description" label="Work description" required className="sm:col-span-2" />
        <CheckboxField control={c} name="billable" label="Billable to the client" description="Internal projects are always non-billable." />
      </div>
    </FormDialog>
  )
}
