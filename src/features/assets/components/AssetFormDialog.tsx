import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { FixedAsset } from '@/domain'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useAction } from '@/hooks/useAction'
import { useCollection } from '@/hooks/useData'
import { assetRepository } from '@/services'
import { nextNumber } from '@/services/demo/demoStore'
import { divide, subtract } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { useProcurementOptions } from '@/features/procurement/lib/useProcurementOptions'

const schema = z
  .object({
    tag: z.string().trim().min(2, 'Enter an asset tag').max(20),
    name: z.string().trim().min(2, 'Enter a name').max(120),
    assetClassId: z.string().min(1, 'Choose an asset class'),
    purchaseDate: z.string().min(10, 'Choose the purchase date'),
    cost: z.number({ error: 'Enter the cost' }).positive('Cost must be greater than zero'),
    salvageValue: z.number({ error: 'Enter a salvage value (0 if none)' }).min(0, 'Cannot be negative'),
    usefulLifeMonths: z.number({ error: 'Enter the useful life' }).int('Whole months only').min(1, 'At least 1 month').max(600),
    method: z.enum(['straight_line', 'declining_balance']),
    departmentId: z.string().optional(),
    supplierId: z.string().optional(),
    location: z.string().trim().min(2, 'Enter a location'),
  })
  .refine((v) => v.salvageValue < v.cost, { path: ['salvageValue'], message: 'Salvage value must be below cost' })
type Values = z.infer<typeof schema>

export function AssetFormDialog({ open, onOpenChange, asset }: { open: boolean; onOpenChange: (o: boolean) => void; asset?: FixedAsset }) {
  const o = useProcurementOptions()
  const assets = useCollection('assets')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (!open) return
    form.reset(
      asset ?? {
        tag: nextNumber(assets.map((a) => a.tag), 'FA-', 3),
        name: '',
        assetClassId: '',
        purchaseDate: todayISO(),
        cost: undefined as unknown as number,
        salvageValue: 0,
        usefulLifeMonths: 36,
        method: 'straight_line',
        departmentId: undefined,
        supplierId: undefined,
        location: 'Colombo office',
      },
    )
  }, [open, asset, assets, form])

  const [classId, cost, salvage, life, method] = useWatch({ control: form.control, name: ['assetClassId', 'cost', 'salvageValue', 'usefulLifeMonths', 'method'] })
  // Default useful life from the asset class (master data attribute) for new assets.
  useEffect(() => {
    if (asset || !classId) return
    const months = o.assetClasses.find((c) => c.id === classId)?.attributes?.usefulLifeMonths
    if (typeof months === 'number') form.setValue('usefulLifeMonths', months)
  }, [classId, asset, o.assetClasses, form])

  const save = useAction(
    async (v: Values) => (asset ? assetRepository.update(asset.id, v) : assetRepository.create({ ...v, status: 'active' })),
    { success: asset ? 'Asset updated' : 'Asset added to the register' },
  )
  const c = form.control
  const monthlySL = cost && life ? divide(subtract(cost, salvage || 0), life) : 0
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={asset ? `Edit ${asset.tag}` : 'Add fixed asset'}
      description="Illustrative asset register entry. Depreciation is calculated in the browser for demonstration only."
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="tag" label="Asset tag" required />
        <TextField control={c} name="name" label="Name" required autoFocus />
        <SelectField control={c} name="assetClassId" label="Asset class" options={o.assetClassOptions} required />
        <TextField control={c} name="purchaseDate" label="Purchase date" type="date" required />
        <NumberField control={c} name="cost" label="Cost" prefix="LKR" required min={0} />
        <NumberField control={c} name="salvageValue" label="Salvage value" prefix="LKR" required min={0} />
        <NumberField control={c} name="usefulLifeMonths" label="Useful life" suffix="months" step={1} min={1} required description="Defaults from the asset class." />
        <SelectField
          control={c}
          name="method"
          label="Depreciation method"
          options={[
            { value: 'straight_line', label: 'Straight line' },
            { value: 'declining_balance', label: 'Double declining balance' },
          ]}
        />
        <SelectField control={c} name="departmentId" label="Department" options={o.departments} allowNone />
        <SelectField control={c} name="supplierId" label="Supplier" options={o.allSuppliers} allowNone />
        <TextField control={c} name="location" label="Location" required className="sm:col-span-2" />
      </div>
      {method === 'straight_line' && monthlySL > 0 ? (
        <p className="text-muted-foreground text-xs">
          Straight-line depreciation: <span className="tabular text-foreground font-medium">{formatCurrency(monthlySL)}</span> per month, starting the month after purchase.
        </p>
      ) : null}
    </FormDialog>
  )
}
