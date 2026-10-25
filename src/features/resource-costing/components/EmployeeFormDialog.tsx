import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { EmployeeProfile } from '@/domain'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, SwitchField, TextField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useAction } from '@/hooks/useAction'
import { useCollection, useMasterList } from '@/hooks/useData'
import { employeeRepository } from '@/services'
import { divide } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'

/** Standard hours per month used to derive an hourly cost rate (illustrative). */
export const HOURS_PER_MONTH = 160

const schema = z
  .object({
    code: z.string().trim().min(2, 'Enter a code').max(20),
    name: z.string().trim().min(3, 'Enter a fictional name').max(80),
    email: z.email('Enter a valid email address'),
    roleId: z.string({ error: 'Choose a role' }).min(1, 'Choose a role'),
    departmentId: z.string({ error: 'Choose a department' }).min(1, 'Choose a department'),
    employmentType: z.enum(['employee', 'contractor']),
    monthlyCost: z.number({ error: 'Enter a monthly cost' }).positive('Must be greater than zero').max(50_000_000),
    hourlyCostRate: z.number({ error: 'Enter an hourly cost rate' }).positive('Must be greater than zero'),
    hourlyBillRate: z.number({ error: 'Enter a bill rate (0 if not billable)' }).min(0, 'Cannot be negative'),
    capacityHoursPerWeek: z.number({ error: 'Enter weekly capacity' }).min(1, 'At least 1 hour').max(60, 'Maximum 60 hours'),
    startDate: z.string().min(1, 'Choose a start date'),
    active: z.boolean(),
  })
  .refine((v) => v.hourlyBillRate === 0 || v.hourlyBillRate >= v.hourlyCostRate, { path: ['hourlyBillRate'], message: 'Bill rate is below cost rate — billable work would make a loss' })
type Values = z.infer<typeof schema>

export function EmployeeFormDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (o: boolean) => void; employee?: EmployeeProfile }) {
  const employees = useCollection('employees')
  const roles = useMasterList('employeeRoles')
  const departments = useMasterList('departments')
  const defaults = useMemo<Values>(
    () =>
      employee
        ? { code: employee.code, name: employee.name, email: employee.email, roleId: employee.roleId, departmentId: employee.departmentId, employmentType: employee.employmentType, monthlyCost: employee.monthlyCost, hourlyCostRate: employee.hourlyCostRate, hourlyBillRate: employee.hourlyBillRate, capacityHoursPerWeek: employee.capacityHoursPerWeek, startDate: employee.startDate, active: employee.active }
        : {
            code: `E-${Math.max(300, ...employees.map((e) => Number(e.code.replace(/\D/g, '')) || 0)) + 1}`,
            name: '',
            email: '',
            roleId: '',
            departmentId: 'dept-engineering',
            employmentType: 'employee',
            monthlyCost: 400_000,
            hourlyCostRate: 2_500,
            hourlyBillRate: 7_500,
            capacityHoursPerWeek: 40,
            startDate: todayISO(),
            active: true,
          },
    [employee, employees],
  )
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])
  const monthly = useWatch({ control: form.control, name: 'monthlyCost' })

  const save = useAction(async (v: Values) => (employee ? employeeRepository.update(employee.id, v) : employeeRepository.create(v)), { success: employee ? 'Cost profile updated' : 'Cost profile created' })
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={employee ? `Edit ${employee.name}` : 'New cost profile'} onSubmit={onSubmit} pending={save.pending} size="lg">
      <SimulatedNotice tone="warning">Use fictional names and figures only. Never enter real employee personal or payroll data in this public demo.</SimulatedNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Name (fictional)" required autoFocus />
        <TextField control={c} name="code" label="Code" required />
        <TextField control={c} name="email" label="Work email" type="email" required />
        <TextField control={c} name="startDate" label="Start date" type="date" required />
        <SelectField control={c} name="roleId" label="Role" required options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        <SelectField control={c} name="departmentId" label="Department" required options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <SelectField control={c} name="employmentType" label="Type" required options={[{ value: 'employee', label: 'Employee' }, { value: 'contractor', label: 'Contractor' }]} />
        <NumberField control={c} name="capacityHoursPerWeek" label="Weekly capacity" suffix="h" min={1} required />
        <NumberField control={c} name="monthlyCost" label="Fully loaded monthly cost" prefix="LKR" min={0} required />
        <div className="space-y-1">
          <NumberField control={c} name="hourlyCostRate" label="Hourly cost rate" prefix="LKR" min={0} required />
          <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={() => form.setValue('hourlyCostRate', divide(monthly || 0, HOURS_PER_MONTH), { shouldValidate: true })}>
            Calculate from monthly cost ÷ {HOURS_PER_MONTH} h
          </Button>
        </div>
        <NumberField control={c} name="hourlyBillRate" label="Hourly bill rate" prefix="LKR" min={0} required description="Use 0 for non-billable roles." />
        <div className="flex items-center">
          <SwitchField control={c} name="active" label="Active" description="Inactive profiles are excluded from personnel cost and capacity." className="w-full" />
        </div>
      </div>
    </FormDialog>
  )
}
