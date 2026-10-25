import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Paperclip, X } from 'lucide-react'
import type { DemoAttachment, ExpenseClaim } from '@/domain'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { CheckboxField, NumberField, SelectField, TextField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useMasterList } from '@/hooks/useData'
import { useCurrentUser } from '@/hooks/useSession'
import { useAction } from '@/hooks/useAction'
import { expenseRepository } from '@/services'
import { newId } from '@/services/demo/demoStore'
import { todayISO } from '@/lib/dates'
import { useMyEmployeeId } from '../lib/useExpenseHelpers'

const schema = z.object({
  employeeId: z.string().min(1, 'Choose who is claiming'),
  date: z
    .string()
    .min(1, 'Choose the expense date')
    .refine((d) => d <= todayISO(), 'Expense date cannot be in the future'),
  categoryId: z.string().min(1, 'Choose a category'),
  description: z.string().trim().min(4, 'Describe the expense').max(160),
  amount: z.number({ error: 'Enter the amount' }).positive('Amount must be greater than zero').max(5_000_000, 'Claims above LKR 5,000,000 need a purchase request'),
  projectId: z.string().optional(),
  departmentId: z.string().min(1, 'Choose a department'),
  billable: z.boolean(),
})
type Values = z.infer<typeof schema>

const MAX_FILE_MB = 10
const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']

export function ExpenseFormDialog({ open, onOpenChange, claim, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; claim?: ExpenseClaim; onSaved?: (c: ExpenseClaim) => void }) {
  const employees = useCollection('employees')
  const projects = useCollection('projects')
  const categories = useMasterList('expenseCategories').filter((c) => c.id !== 'exp-salaries' && c.id !== 'exp-depreciation' && c.id !== 'exp-cloud')
  const departments = useMasterList('departments')
  const user = useCurrentUser()
  const mine = useMyEmployeeId()
  const restricted = user.role === 'employee'
  const [receipts, setReceipts] = useState<DemoAttachment[]>([])
  const [fileError, setFileError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const employeeId = useWatch({ control: form.control, name: 'employeeId' })
  const projectId = useWatch({ control: form.control, name: 'projectId' })

  useEffect(() => {
    if (!open) return
    const defaultEmp = claim?.employeeId ?? mine ?? employees[0]?.id ?? ''
    form.reset(
      claim
        ? { employeeId: claim.employeeId, date: claim.date, categoryId: claim.categoryId, description: claim.description, amount: claim.amount, projectId: claim.projectId, departmentId: claim.departmentId, billable: claim.billable }
        : { employeeId: defaultEmp, date: todayISO(), categoryId: '', description: '', amount: undefined as unknown as number, projectId: undefined, departmentId: employees.find((e) => e.id === defaultEmp)?.departmentId ?? '', billable: false },
    )
    setReceipts(claim?.receipts ?? [])
    setFileError('')
  }, [open, claim, form, mine, employees])

  // Default the department from the claimant.
  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId)
    if (emp && !claim && form.getValues('departmentId') !== emp.departmentId) form.setValue('departmentId', emp.departmentId)
  }, [employeeId, employees, claim, form])

  useEffect(() => {
    if (!projectId) form.setValue('billable', false)
  }, [projectId, form])

  const onFiles = (files: FileList | null) => {
    setFileError('')
    if (!files) return
    const next: DemoAttachment[] = []
    for (const f of Array.from(files)) {
      if (!ACCEPTED.includes(f.type)) {
        setFileError(`${f.name}: only PDF or image receipts are accepted.`)
        continue
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setFileError(`${f.name} is larger than ${MAX_FILE_MB} MB.`)
        continue
      }
      // Only metadata is kept — the file itself never leaves the input and is not stored.
      next.push({ id: newId('rcpt'), name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)), mimeType: f.type, addedAt: new Date().toISOString() })
    }
    setReceipts((r) => [...r, ...next])
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, projectId: v.projectId || undefined, billable: !!v.projectId && v.billable, receipts, taxAmount: claim?.taxAmount ?? 0, currency: 'LKR' as const }
      return claim ? expenseRepository.update(claim.id, payload) : expenseRepository.create({ ...payload, number: '', status: 'draft', history: [], notes: [] })
    },
    { success: claim ? 'Claim updated' : 'Draft claim saved' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    const r = await save.run(v)
    if (r) {
      onOpenChange(false)
      onSaved?.(r)
    }
  })

  const c = form.control
  const claimants = restricted ? employees.filter((e) => e.id === mine) : employees.filter((e) => e.active)
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={claim ? `Edit ${claim.number}` : 'New expense claim'} description="Saved as a draft — submit it for approval when ready." onSubmit={onSubmit} pending={save.pending} size="lg" submitLabel={claim ? 'Save changes' : 'Save draft'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="employeeId" label="Claimant" required disabled={restricted} options={claimants.map((e) => ({ value: e.id, label: e.name }))} />
        <TextField control={c} name="date" label="Expense date" type="date" required />
        <SelectField control={c} name="categoryId" label="Category" required options={categories.map((m) => ({ value: m.id, label: m.name }))} />
        <NumberField control={c} name="amount" label="Amount" prefix="LKR" required min={0} step={0.01} />
        <TextField control={c} name="description" label="Description" required className="sm:col-span-2" placeholder="e.g. Taxi to client site" />
        <SelectField control={c} name="projectId" label="Project" allowNone noneLabel="Not project related" options={projects.filter((p) => p.status !== 'cancelled').map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
        <SelectField control={c} name="departmentId" label="Department" required options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <CheckboxField control={c} name="billable" label="Billable to the client" description={projectId ? 'Recharged at cost on the project.' : 'Choose a project to mark as billable.'} disabled={!projectId} className="sm:col-span-2" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Receipts</span>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Paperclip /> Attach receipt</Button>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} multiple className="sr-only" aria-label="Attach receipt files" onChange={(e) => onFiles(e.target.files)} />
        </div>
        {receipts.length ? (
          <ul className="divide-y rounded-md border text-sm">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                <FileText className="text-muted-foreground size-4" />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-muted-foreground text-xs">{r.sizeKb} KB</span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${r.name}`} onClick={() => setReceipts((list) => list.filter((x) => x.id !== r.id))}><X /></Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">No receipts attached. Claims above LKR 5,000 should include an itemised receipt (policy).</p>
        )}
        {fileError ? <p role="alert" className="text-destructive text-xs">{fileError}</p> : null}
        <SimulatedNotice>Simulated attachment: only the file name, size and type are saved in this browser. The file itself is never uploaded or stored — please don’t attach real receipts.</SimulatedNotice>
      </div>
    </FormDialog>
  )
}
