import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Project } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { CheckboxField, NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { Money } from '@/components/data-display/DetailList'
import { useAction } from '@/hooks/useAction'
import { useCollection, useMasterList } from '@/hooks/useData'
import { projectRepository } from '@/services'
import { add, subtract } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { BILLING_MODEL_LABELS, PROJECT_STATUS_LABELS, toOptions } from '../lib/labels'

const money = (label: string) => z.number({ error: `Enter ${label}` }).min(0, 'Cannot be negative')

const projectSchema = z
  .object({
    code: z.string().trim().min(3, 'Enter a project code').max(20),
    name: z.string().trim().min(3, 'Enter a project name').max(120),
    customerId: z.string({ error: 'Choose a client' }).min(1, 'Choose a client'),
    categoryId: z.string({ error: 'Choose a category' }).min(1, 'Choose a category'),
    managerId: z.string({ error: 'Choose a project manager' }).min(1, 'Choose a project manager'),
    departmentId: z.string({ error: 'Choose a department' }).min(1, 'Choose a department'),
    billingModel: z.enum(['fixed_price', 'time_and_materials', 'retainer', 'subscription', 'milestone']),
    status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
    startDate: z.string().min(1, 'Choose a start date'),
    endDate: z.string().min(1, 'Choose an end date'),
    contractValue: money('the contract value'),
    budget: money('the cost budget').positive('Budget must be greater than zero'),
    plannedLabour: money('planned labour'),
    plannedInfrastructure: money('planned infrastructure'),
    percentComplete: z.number({ error: 'Enter % complete' }).min(0, 'Minimum 0%').max(100, 'Maximum 100%'),
    isInternal: z.boolean(),
    description: z.string().max(1000).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'End date must be on or after the start date' })
  .refine((v) => add(v.plannedLabour, v.plannedInfrastructure) <= v.budget, {
    path: ['plannedInfrastructure'],
    message: 'Planned labour + infrastructure cannot exceed the budget',
  })

export type ProjectFormValues = z.infer<typeof projectSchema>

export function ProjectFormDialog({ open, onOpenChange, project, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project; onSaved?: (p: Project) => void }) {
  const customers = useCollection('customers')
  const employees = useCollection('employees')
  const projects = useCollection('projects')
  const categories = useMasterList('projectCategories')
  const departments = useMasterList('departments')

  const defaults = useMemo<ProjectFormValues>(() => {
    if (project)
      return {
        code: project.code,
        name: project.name,
        customerId: project.customerId,
        categoryId: project.categoryId,
        managerId: project.managerId,
        departmentId: project.departmentId,
        billingModel: project.billingModel,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        contractValue: project.contractValue,
        budget: project.budget,
        plannedLabour: project.plannedLabour,
        plannedInfrastructure: project.plannedInfrastructure,
        percentComplete: project.percentComplete,
        isInternal: project.isInternal,
        description: project.description ?? '',
      }
    const nextCode = `PRJ-${Math.max(100, ...projects.map((p) => Number(p.code.replace(/\D/g, '')) || 0)) + 1}`
    return {
      code: nextCode,
      name: '',
      customerId: '',
      categoryId: '',
      managerId: '',
      departmentId: 'dept-delivery',
      billingModel: 'fixed_price',
      status: 'planning',
      startDate: todayISO(),
      endDate: todayISO(),
      contractValue: 0,
      budget: 0,
      plannedLabour: 0,
      plannedInfrastructure: 0,
      percentComplete: 0,
      isInternal: false,
      description: '',
    }
  }, [project, projects])

  const form = useForm<ProjectFormValues>({ resolver: zodResolver(projectSchema), defaultValues: defaults })
  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])

  const [budget, labour, infra] = useWatch({ control: form.control, name: ['budget', 'plannedLabour', 'plannedInfrastructure'] })
  const other = subtract(budget || 0, add(labour || 0, infra || 0))

  const save = useAction(
    async (v: ProjectFormValues) => {
      const payload = { ...v, plannedOther: subtract(v.budget, add(v.plannedLabour, v.plannedInfrastructure)), contractId: project?.contractId, customFields: project?.customFields }
      return project ? projectRepository.update(project.id, payload) : projectRepository.create(payload)
    },
    { success: project ? 'Project updated' : 'Project created' },
  )

  const onSubmit = form.handleSubmit(async (v) => {
    const r = await save.run(v)
    if (r) {
      onOpenChange(false)
      onSaved?.(r)
    }
  })

  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={project ? `Edit ${project.code}` : 'New project'} description="Projects and budgets here are fictional demo records." onSubmit={onSubmit} pending={save.pending} size="xl">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField control={c} name="code" label="Project code" required />
        <TextField control={c} name="name" label="Project name" required className="lg:col-span-2" autoFocus />
        <SelectField control={c} name="customerId" label="Client" required options={customers.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField control={c} name="categoryId" label="Category" required options={categories.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField control={c} name="managerId" label="Project manager" required options={employees.filter((e) => e.active).map((e) => ({ value: e.id, label: e.name }))} />
        <SelectField control={c} name="departmentId" label="Department" required options={departments.map((x) => ({ value: x.id, label: x.name }))} />
        <SelectField control={c} name="billingModel" label="Billing model" required options={toOptions(BILLING_MODEL_LABELS)} />
        <SelectField control={c} name="status" label="Status" required options={toOptions(PROJECT_STATUS_LABELS)} />
        <TextField control={c} name="startDate" label="Start date" type="date" required />
        <TextField control={c} name="endDate" label="End date" type="date" required />
        <NumberField control={c} name="percentComplete" label="% complete" suffix="%" min={0} required />
        <NumberField control={c} name="contractValue" label="Contract value" prefix="LKR" min={0} required />
        <NumberField control={c} name="budget" label="Cost budget" prefix="LKR" min={0} required />
        <div className="flex items-end pb-2">
          <CheckboxField control={c} name="isInternal" label="Internal project (no client revenue)" />
        </div>
        <NumberField control={c} name="plannedLabour" label="Planned labour" prefix="LKR" min={0} required />
        <NumberField control={c} name="plannedInfrastructure" label="Planned infrastructure" prefix="LKR" min={0} required />
        <div className="space-y-1.5">
          <div className="text-sm font-medium">Planned other direct costs</div>
          <div className={`flex h-9 items-center rounded-md border px-3 text-sm ${other < 0 ? 'border-destructive text-destructive' : 'bg-muted/40'}`}>
            <Money value={other} />
          </div>
          <p className="text-muted-foreground text-xs">Calculated: budget − labour − infrastructure.</p>
        </div>
        <TextareaField control={c} name="description" label="Description" className="sm:col-span-2 lg:col-span-3" />
      </div>
      <SimulatedNotice>% complete drives the illustrative estimate-at-completion and recognised-revenue figures.</SimulatedNotice>
    </FormDialog>
  )
}
