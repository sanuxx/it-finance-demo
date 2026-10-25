import { useEffect, useMemo, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreHorizontal } from 'lucide-react'
import type { PaymentMethod } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField, TextareaField, type Option } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useMasterList } from '@/hooks/useData'
import { useAction } from '@/hooks/useAction'
import type { RecordPaymentInput } from '@/services'
import { formatCurrency } from '@/lib/formatting'
import { compare } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'

/** Select options shared by procurement, payables and assets screens. */
export function useProcurementOptions() {
  const suppliers = useCollection('suppliers')
  const projects = useCollection('projects')
  const bankAccounts = useCollection('bankAccounts')
  const taxRates = useCollection('taxRates')
  const purchaseOrders = useCollection('purchaseOrders')
  const departments = useMasterList('departments')
  const expenseCategories = useMasterList('expenseCategories')
  const supplierCategories = useMasterList('supplierCategories')
  const assetClasses = useMasterList('assetClasses')
  return useMemo(() => {
    const opt = <T,>(items: T[], value: (t: T) => string, label: (t: T) => string): Option[] => items.map((i) => ({ value: value(i), label: label(i) }))
    return {
      suppliers: opt(suppliers.filter((s) => s.status === 'active'), (s) => s.id, (s) => s.name),
      allSuppliers: opt(suppliers, (s) => s.id, (s) => s.name),
      projects: opt(projects.filter((p) => p.status !== 'cancelled'), (p) => p.id, (p) => `${p.code} · ${p.name}`),
      bankAccounts: opt(bankAccounts.filter((b) => b.active), (b) => b.id, (b) => `${b.name} (${b.accountMask})`),
      purchaseTaxRates: taxRates.filter((t) => t.active && (t.type === 'purchase' || t.type === 'sales')),
      purchaseOrders,
      departments: opt(departments, (d) => d.id, (d) => d.name),
      expenseCategories: opt(expenseCategories, (d) => d.id, (d) => d.name),
      supplierCategories: opt(supplierCategories, (d) => d.id, (d) => d.name),
      assetClasses,
      assetClassOptions: opt(assetClasses, (d) => d.id, (d) => d.name),
    }
  }, [suppliers, projects, bankAccounts, taxRates, purchaseOrders, departments, expenseCategories, supplierCategories, assetClasses])
}

export interface RowAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

/** "⋯" row menu that never triggers the row click. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  const visible = actions.filter(Boolean)
  if (!visible.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {visible.map((a) => (
          <div key={a.label}>
            {a.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant={a.destructive ? 'destructive' : 'default'} disabled={a.disabled} onSelect={a.onSelect}>
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const METHOD_OPTIONS: Option[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'cash', label: 'Cash' },
]

/**
 * Simulated payment dialog. The amount is validated against the outstanding
 * balance here and again in the repository.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  title,
  outstanding,
  onSubmit,
  defaultReference,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  outstanding: number
  onSubmit: (input: RecordPaymentInput) => Promise<unknown>
  defaultReference?: string
}) {
  const { bankAccounts } = useProcurementOptions()
  const schema = useMemo(
    () =>
      z.object({
        date: z.string().min(10, 'Choose a payment date'),
        amount: z
          .number({ error: 'Enter an amount' })
          .positive('Amount must be greater than zero')
          .refine((v) => compare(v, outstanding) <= 0, `Cannot exceed the outstanding balance of ${formatCurrency(outstanding)}`),
        method: z.enum(['bank_transfer', 'cheque', 'card', 'cash', 'online']),
        bankAccountId: z.string().min(1, 'Choose a bank account'),
        reference: z.string().max(80).optional(),
        notes: z.string().max(500).optional(),
      }),
    [outstanding],
  )
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) form.reset({ date: todayISO(), amount: outstanding, method: 'bank_transfer', bankAccountId: bankAccounts[0]?.value ?? '', reference: defaultReference ?? '', notes: '' })
  }, [open, outstanding, bankAccounts, defaultReference, form])
  const action = useAction((v: Values) => onSubmit({ ...v, method: v.method as PaymentMethod }), { success: 'Simulated payment recorded — no money was moved' })
  const c = form.control
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`Outstanding balance: ${formatCurrency(outstanding)}`}
      submitLabel="Record simulated payment"
      pending={action.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await action.run(v)) onOpenChange(false)
      })}
    >
      <SimulatedNotice>This records an illustrative payment in your browser only. No bank transaction or money transfer takes place.</SimulatedNotice>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="date" label="Payment date" type="date" required />
        <NumberField control={c} name="amount" label="Amount" prefix="LKR" required min={0} />
        <SelectField control={c} name="method" label="Method" options={METHOD_OPTIONS} required />
        <SelectField control={c} name="bankAccountId" label="Paid from (simulated account)" options={bankAccounts} required />
        <TextField control={c} name="reference" label="Reference" className="sm:col-span-2" />
        <TextareaField control={c} name="notes" label="Notes" rows={2} className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}
