import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, format, parseISO } from 'date-fns'
import type { SupplierBill } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { useCollection } from '@/hooks/useData'
import { supplierBillRepository } from '@/services'
import { add, applyRate } from '@/lib/calculations/money'
import { documentTotals } from '@/lib/calculations/invoices'
import { formatCurrency } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { useProcurementOptions } from '../lib/useProcurementOptions'

const schema = z
  .object({
    supplierId: z.string().min(1, 'Choose a supplier'),
    supplierReference: z.string().trim().min(1, 'Enter the supplier’s invoice reference').max(40),
    description: z.string().trim().min(3, 'Describe what was billed').max(200),
    categoryId: z.string().min(1, 'Choose an expense category'),
    departmentId: z.string().min(1, 'Choose a department'),
    projectId: z.string().optional(),
    purchaseOrderId: z.string().optional(),
    billDate: z.string().min(10, 'Choose the bill date'),
    dueDate: z.string().min(10, 'Choose the due date'),
    subtotal: z.number({ error: 'Enter the amount before tax' }).positive('Must be greater than zero'),
    taxRate: z.string(),
  })
  .refine((v) => v.dueDate >= v.billDate, { path: ['dueDate'], message: 'Due date cannot be before the bill date' })
type Values = z.infer<typeof schema>

export function SupplierBillFormDialog({ open, onOpenChange, bill, defaultPoId }: { open: boolean; onOpenChange: (o: boolean) => void; bill?: SupplierBill; defaultPoId?: string }) {
  const o = useProcurementOptions()
  const suppliers = useCollection('suppliers')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const rates = useMemo(() => [...new Set([0, ...o.purchaseTaxRates.map((t) => t.rate)])].sort((a, b) => b - a), [o.purchaseTaxRates])

  useEffect(() => {
    if (!open) return
    if (bill) {
      const rate = bill.subtotal ? Math.round((bill.taxAmount / bill.subtotal) * 1000) / 10 : 0
      form.reset({ ...bill, projectId: bill.projectId, purchaseOrderId: bill.purchaseOrderId, taxRate: String(rate) })
      return
    }
    const po = defaultPoId ? o.purchaseOrders.find((p) => p.id === defaultPoId) : undefined
    const today = todayISO()
    form.reset({
      supplierId: po?.supplierId ?? '',
      supplierReference: '',
      description: po ? `Bill against ${po.number}` : '',
      categoryId: '',
      departmentId: po?.departmentId ?? '',
      projectId: po?.projectId,
      purchaseOrderId: po?.id,
      billDate: today,
      dueDate: format(addDays(parseISO(today), 30), 'yyyy-MM-dd'),
      subtotal: po ? documentTotals(po.lines).netAmount : (undefined as unknown as number),
      taxRate: '18',
    })
  }, [open, bill, defaultPoId, o.purchaseOrders, form])

  const [supplierId, subtotal, taxRate, billDate] = useWatch({ control: form.control, name: ['supplierId', 'subtotal', 'taxRate', 'billDate'] })
  const tax = applyRate(subtotal || 0, Number(taxRate) || 0)

  // Default the due date from the supplier's payment terms when the supplier changes (new bills only).
  useEffect(() => {
    if (bill || !supplierId || !billDate) return
    const terms = suppliers.find((s) => s.id === supplierId)?.paymentTermsDays ?? 30
    form.setValue('dueDate', format(addDays(parseISO(billDate), terms), 'yyyy-MM-dd'))
  }, [supplierId, billDate, suppliers, bill, form])

  const poOptions = o.purchaseOrders
    .filter((p) => (!supplierId || p.supplierId === supplierId) && p.status !== 'cancelled' && p.status !== 'draft')
    .map((p) => ({ value: p.id, label: `${p.number} · ${formatCurrency(documentTotals(p.lines).total)}` }))

  const save = useAction(
    async (v: Values) => {
      const { taxRate: rate, ...rest } = v
      const payload = { ...rest, taxAmount: applyRate(v.subtotal, Number(rate) || 0), currency: 'LKR' as const }
      return bill ? supplierBillRepository.update(bill.id, payload) : supplierBillRepository.create({ ...payload, number: '', status: 'draft', history: [] })
    },
    { success: bill ? 'Bill updated' : 'Draft bill created' },
  )
  const c = form.control
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={bill ? `Edit ${bill.number}` : 'New supplier bill'}
      description="Record a fictional supplier bill. It counts as an expense once approved."
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="supplierId" label="Supplier" options={o.suppliers} required />
        <TextField control={c} name="supplierReference" label="Supplier invoice ref." required />
        <TextField control={c} name="description" label="Description" required className="sm:col-span-2" />
        <SelectField control={c} name="categoryId" label="Expense category" options={o.expenseCategories} required />
        <SelectField control={c} name="departmentId" label="Department" options={o.departments} required />
        <SelectField control={c} name="projectId" label="Project (optional)" options={o.projects} allowNone noneLabel="No project" />
        <SelectField control={c} name="purchaseOrderId" label="Purchase order (optional)" options={poOptions} allowNone noneLabel="No PO" />
        <TextField control={c} name="billDate" label="Bill date" type="date" required />
        <TextField control={c} name="dueDate" label="Due date" type="date" required description="Defaults from supplier terms." />
        <NumberField control={c} name="subtotal" label="Amount before tax" prefix="LKR" min={0} required />
        <SelectField control={c} name="taxRate" label="Input tax (illustrative)" options={rates.map((r) => ({ value: String(r), label: r ? `${r}% VAT` : 'No tax' }))} />
      </div>
      <div className="bg-muted/50 flex flex-wrap justify-end gap-x-6 gap-y-1 rounded-md px-3 py-2 text-sm">
        <span>
          Tax <span className="tabular font-medium">{formatCurrency(tax)}</span>
        </span>
        <span>
          Total <span className="tabular font-semibold">{formatCurrency(add(subtotal || 0, tax))}</span>
        </span>
      </div>
    </FormDialog>
  )
}
