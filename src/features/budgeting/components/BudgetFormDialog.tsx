import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import type { Budget } from '@/domain'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { useCollection, useMasterList } from '@/hooks/useData'
import { useAction } from '@/hooks/useAction'
import { budgetRepository } from '@/services'
import { newId } from '@/services/demo/demoStore'
import { sum } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { SCOPE_LABELS } from '../lib/budgetData'

const schema = z
  .object({
    name: z.string().trim().min(3, 'Enter a budget name').max(100),
    scope: z.enum(['company', 'department', 'project', 'cloud', 'personnel']),
    kind: z.enum(['expense', 'revenue']),
    fiscalYear: z.number({ error: 'Enter a fiscal year' }).int().min(2000).max(2100),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an end date'),
    departmentId: z.string().optional(),
    projectId: z.string().optional(),
    ownerId: z.string().min(1, 'Choose an owner'),
    notes: z.string().max(500).optional(),
    lines: z
      .array(z.object({ id: z.string(), categoryId: z.string().min(1, 'Choose a category'), amount: z.number({ error: 'Enter an amount' }).min(0, 'Cannot be negative').max(10_000_000_000) }))
      .min(1, 'Add at least one budget line'),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { path: ['periodEnd'], message: 'End must be on or after the start' })
  .refine((v) => new Set(v.lines.map((l) => l.categoryId)).size === v.lines.length, { path: ['lines'], message: 'Each category can appear only once' })
  .refine((v) => v.scope !== 'department' || !!v.departmentId, { path: ['departmentId'], message: 'Choose a department' })
  .refine((v) => v.scope !== 'project' || !!v.projectId, { path: ['projectId'], message: 'Choose a project' })
  .refine((v) => (v.scope !== 'cloud' && v.scope !== 'personnel') || v.kind === 'expense', { path: ['kind'], message: 'Cloud and personnel budgets are expense budgets' })

type Values = z.infer<typeof schema>

export function BudgetFormDialog({ open, onOpenChange, budget, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; budget?: Budget; onSaved?: (b: Budget) => void }) {
  const year = Number(todayISO().slice(0, 4))
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const users = useCollection('users')
  const projects = useCollection('projects')
  const departments = useMasterList('departments')
  const expenseCats = useMasterList('expenseCategories')
  const incomeCats = useMasterList('incomeCategories')
  const kind = useWatch({ control: form.control, name: 'kind' })
  const scope = useWatch({ control: form.control, name: 'scope' })
  const watchedLines = useWatch({ control: form.control, name: 'lines' })
  const categories = kind === 'revenue' ? incomeCats : expenseCats

  useEffect(() => {
    if (!open) return
    form.reset(
      budget
        ? { ...budget, notes: budget.notes ?? '' }
        : { name: '', scope: 'department', kind: 'expense', fiscalYear: year, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, ownerId: 'u-fm', notes: '', lines: [{ id: newId('bl'), categoryId: '', amount: 0 }] },
    )
  }, [open, budget, form, year])

  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, departmentId: v.scope === 'project' ? undefined : v.departmentId, projectId: v.scope === 'project' ? v.projectId : undefined }
      return budget ? budgetRepository.update(budget.id, payload) : budgetRepository.create({ ...payload, status: 'draft' })
    },
    { success: budget ? 'Budget updated' : 'Draft budget created' },
  )

  const c = form.control
  const linesError = form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message
  const total = sum(watchedLines ?? [], (l) => (Number.isFinite(l.amount) ? l.amount : 0))

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={budget ? `Edit ${budget.name}` : 'New budget'}
      description="Actuals are calculated automatically from demo expenses, bills, cloud costs, personnel and invoices."
      size="xl"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        const saved = await save.run(v)
        if (saved) {
          onOpenChange(false)
          onSaved?.(saved)
        }
      })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField control={c} name="name" label="Budget name" required className="sm:col-span-3" autoFocus />
        <SelectField control={c} name="scope" label="Scope" required options={Object.entries(SCOPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField control={c} name="kind" label="Type" required options={[{ value: 'expense', label: 'Expense budget' }, { value: 'revenue', label: 'Revenue budget' }]} />
        <SelectField control={c} name="ownerId" label="Owner" required options={users.map((u) => ({ value: u.id, label: u.name }))} />
        <NumberField control={c} name="fiscalYear" label="Fiscal year" step={1} required />
        <TextField control={c} name="periodStart" label="Period start" type="date" required />
        <TextField control={c} name="periodEnd" label="Period end" type="date" required />
        {scope === 'project' ? (
          <SelectField control={c} name="projectId" label="Project" required className="sm:col-span-3" options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
        ) : (
          <SelectField control={c} name="departmentId" label="Department" required={scope === 'department'} allowNone={scope !== 'department'} noneLabel="All departments" className="sm:col-span-3" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        )}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Budget lines</legend>
        {scope === 'project' ? <p className="text-muted-foreground text-xs">Project budgets compare against project costs: salaries → labour, cloud/AI → infrastructure, contractors → subcontractors, software, travel; other categories → other direct costs.</p> : null}
        {lines.fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[2fr_1fr_auto] items-end gap-2">
            <SelectField control={c} name={`lines.${i}.categoryId`} label={i === 0 ? 'Category' : <span className="sr-only">Category</span>} options={categories.map((m) => ({ value: m.id, label: m.name }))} />
            <NumberField control={c} name={`lines.${i}.amount`} label={i === 0 ? 'Amount' : <span className="sr-only">Amount</span>} prefix="LKR" min={0} />
            <Button type="button" variant="ghost" size="icon" onClick={() => lines.remove(i)} disabled={lines.fields.length === 1} aria-label={`Remove line ${i + 1}`}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {linesError ? <p role="alert" className="text-destructive text-xs">{linesError}</p> : null}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={() => lines.append({ id: newId('bl'), categoryId: '', amount: 0 })}>
            <Plus /> Add line
          </Button>
          <span className="text-sm">
            Total <strong className="tabular">{formatCurrency(total)}</strong>
          </span>
        </div>
      </fieldset>
      <TextareaField control={c} name="notes" label="Notes" rows={2} />
    </FormDialog>
  )
}
