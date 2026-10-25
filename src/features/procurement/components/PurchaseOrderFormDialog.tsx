import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addDays, format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import type { PurchaseOrder } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { purchaseOrderRepository } from '@/services'
import { newId } from '@/services/demo/demoStore'
import { documentTotals, lineTotals } from '@/lib/calculations/invoices'
import { formatCurrency } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { useProcurementOptions } from '../lib/useProcurementOptions'

const lineSchema = z.object({
  id: z.string(),
  description: z.string().trim().min(2, 'Describe the item'),
  quantity: z.number({ error: 'Qty' }).positive('> 0'),
  unitPrice: z.number({ error: 'Price' }).min(0, '≥ 0'),
  discountPercent: z.number().min(0).max(100),
  taxRatePercent: z.number().min(0).max(100),
})

const schema = z
  .object({
    supplierId: z.string().min(1, 'Choose a supplier'),
    departmentId: z.string().min(1, 'Choose a department'),
    projectId: z.string().optional(),
    orderDate: z.string().min(10, 'Choose the order date'),
    expectedDate: z.string().min(10, 'Choose the expected date'),
    lines: z.array(lineSchema).min(1, 'Add at least one line'),
  })
  .refine((v) => v.expectedDate >= v.orderDate, { path: ['expectedDate'], message: 'Expected date must be on or after the order date' })
type Values = z.infer<typeof schema>

const blankLine = () => ({ id: newId('poln'), description: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxRatePercent: 18 })

export function PurchaseOrderFormDialog({ open, onOpenChange, order }: { open: boolean; onOpenChange: (o: boolean) => void; order?: PurchaseOrder }) {
  const o = useProcurementOptions()
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  useEffect(() => {
    if (!open) return
    form.reset(
      order
        ? { supplierId: order.supplierId, departmentId: order.departmentId, projectId: order.projectId, orderDate: order.orderDate, expectedDate: order.expectedDate, lines: order.lines.map((l) => ({ ...l })) }
        : { supplierId: '', departmentId: '', projectId: undefined, orderDate: todayISO(), expectedDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'), lines: [blankLine()] },
    )
  }, [open, order, form])

  const lines = useWatch({ control: form.control, name: 'lines' }) ?? []
  const totals = documentTotals(lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })))

  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, currency: 'LKR' as const }
      return order ? purchaseOrderRepository.update(order.id, payload) : purchaseOrderRepository.create({ ...payload, number: '', status: 'draft', history: [] })
    },
    { success: (po) => (order ? `${po.number} updated` : `Draft ${po.number} created`) },
  )

  const num = (i: number, key: 'quantity' | 'unitPrice' | 'discountPercent' | 'taxRatePercent') =>
    form.register(`lines.${i}.${key}`, { setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)) })
  const lineErrors = form.formState.errors.lines

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={order ? `Edit ${order.number}` : 'New purchase order'}
      description="Purchase orders are fictional and are never sent to a supplier."
      size="xl"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField control={form.control} name="supplierId" label="Supplier" options={o.suppliers} required />
        <SelectField control={form.control} name="departmentId" label="Department" options={o.departments} required />
        <SelectField control={form.control} name="projectId" label="Project (optional)" options={o.projects} allowNone noneLabel="No project" />
        <TextField control={form.control} name="orderDate" label="Order date" type="date" required />
        <TextField control={form.control} name="expectedDate" label="Expected delivery" type="date" required />
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Line items</div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Description</th>
                <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Unit price</th>
                <th className="w-20 px-2 py-2 text-right font-medium">Disc. %</th>
                <th className="w-20 px-2 py-2 text-right font-medium">Tax %</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Net</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => {
                const l = lines[i]
                const net = l ? lineTotals({ quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, discountPercent: Number(l.discountPercent) || 0 }).net : 0
                const err = lineErrors?.[i]
                return (
                  <tr key={f.id} className="border-t align-top">
                    <td className="p-1.5">
                      <Input aria-label={`Line ${i + 1} description`} aria-invalid={!!err?.description} {...form.register(`lines.${i}.description`)} />
                      {err?.description ? <p className="text-destructive mt-1 text-xs">{err.description.message}</p> : null}
                    </td>
                    <td className="p-1.5"><Input type="number" step="any" className="tabular text-right" aria-label={`Line ${i + 1} quantity`} aria-invalid={!!err?.quantity} {...num(i, 'quantity')} /></td>
                    <td className="p-1.5"><Input type="number" step="any" className="tabular text-right" aria-label={`Line ${i + 1} unit price`} aria-invalid={!!err?.unitPrice} {...num(i, 'unitPrice')} /></td>
                    <td className="p-1.5"><Input type="number" step="any" className="tabular text-right" aria-label={`Line ${i + 1} discount percent`} {...num(i, 'discountPercent')} /></td>
                    <td className="p-1.5"><Input type="number" step="any" className="tabular text-right" aria-label={`Line ${i + 1} tax percent`} {...num(i, 'taxRatePercent')} /></td>
                    <td className="tabular p-1.5 pt-3 text-right">{formatCurrency(net)}</td>
                    <td className="p-1.5">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={fields.length === 1} aria-label={`Remove line ${i + 1}`}>
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {typeof lineErrors?.message === 'string' ? <p className="text-destructive text-xs">{lineErrors.message}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}>
          <Plus /> Add line
        </Button>
      </div>
      <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular text-right">{formatCurrency(totals.netAmount)}</dd>
        <dt className="text-muted-foreground">Tax</dt>
        <dd className="tabular text-right">{formatCurrency(totals.taxTotal)}</dd>
        <dt className="font-medium">Total</dt>
        <dd className="tabular text-right font-semibold">{formatCurrency(totals.total)}</dd>
      </dl>
    </FormDialog>
  )
}
