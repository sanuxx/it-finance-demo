import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Project, ProjectAllocation } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { useCollection, useLookups } from '@/hooks/useData'
import { allocationRepository } from '@/services'

const schema = z
  .object({
    employeeId: z.string({ error: 'Choose a person' }).min(1, 'Choose a person'),
    roleOnProject: z.string().trim().min(2, 'Enter the role on this project').max(80),
    plannedHours: z.number({ error: 'Enter planned hours' }).positive('Must be greater than zero').max(10_000),
    startDate: z.string().min(1, 'Choose a start date'),
    endDate: z.string().min(1, 'Choose an end date'),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'End date must be on or after the start date' })
type Values = z.infer<typeof schema>

export function AllocationDialog({ open, onOpenChange, project, allocation }: { open: boolean; onOpenChange: (o: boolean) => void; project: Project; allocation?: ProjectAllocation }) {
  const employees = useCollection('employees')
  const lookups = useLookups()
  const defaults = useMemo<Values>(
    () =>
      allocation
        ? { employeeId: allocation.employeeId, roleOnProject: allocation.roleOnProject, plannedHours: allocation.plannedHours, startDate: allocation.startDate, endDate: allocation.endDate }
        : { employeeId: '', roleOnProject: '', plannedHours: 160, startDate: project.startDate, endDate: project.endDate },
    [allocation, project],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])
  const save = useAction(
    async (v: Values) => (allocation ? allocationRepository.update(allocation.id, v) : allocationRepository.create({ ...v, projectId: project.id })),
    { success: allocation ? 'Allocation updated' : 'Team member allocated' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={allocation ? 'Edit allocation' : `Allocate to ${project.code}`} onSubmit={onSubmit} pending={save.pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={c}
          name="employeeId"
          label="Person"
          required
          className="sm:col-span-2"
          options={employees.filter((e) => e.active).map((e) => ({ value: e.id, label: `${e.name} — ${lookups.master(e.roleId)}` }))}
        />
        <TextField control={c} name="roleOnProject" label="Role on project" required />
        <NumberField control={c} name="plannedHours" label="Planned hours" suffix="h" min={0} required />
        <TextField control={c} name="startDate" label="From" type="date" required />
        <TextField control={c} name="endDate" label="To" type="date" required />
      </div>
    </FormDialog>
  )
}
