import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { TaxRate } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { NumberField, SelectField, SwitchField, TextField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { taxRateRepository } from '@/services'
import { documentTotals } from '@/lib/calculations/invoices'
import { isBillIncurred } from '@/lib/calculations/bills'
import { add, subtract } from '@/lib/calculations/money'
import { formatPercent, humanize } from '@/lib/formatting'
import { inRange, presetRange, type DatePreset } from '@/lib/dates'
import { RowActions } from '@/features/procurement/components/shared'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  code: z.string().trim().min(2, 'Enter a code').max(20),
  rate: z.number({ error: 'Enter a rate' }).min(0, 'Cannot be negative').max(100, 'Maximum 100%'),
  type: z.enum(['sales', 'purchase', 'withholding']),
  active: z.boolean(),
})
type Values = z.infer<typeof schema>

function TaxRateDialog({ open, onOpenChange, rate }: { open: boolean; onOpenChange: (o: boolean) => void; rate?: TaxRate }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) form.reset(rate ?? { name: '', code: '', rate: 0, type: 'sales', active: true })
  }, [open, rate, form])
  const save = useAction(async (v: Values) => (rate ? taxRateRepository.update(rate.id, v) : taxRateRepository.create(v)), { success: rate ? 'Tax rate updated' : 'Tax rate added' })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={rate ? `Edit ${rate.code}` : 'New tax rate'} description="Illustrative tax configuration only." pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Name" required autoFocus className="sm:col-span-2" />
        <TextField control={c} name="code" label="Code" required />
        <NumberField control={c} name="rate" label="Rate" suffix="%" required min={0} />
        <SelectField control={c} name="type" label="Applies to" options={[{ value: 'sales', label: 'Sales (output)' }, { value: 'purchase', label: 'Purchases (input)' }, { value: 'withholding', label: 'Withholding' }]} />
        <SwitchField control={c} name="active" label="Active" className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function TaxConfigPage() {
  const rates = useCollection('taxRates')
  const invoices = useCollection('invoices')
  const bills = useCollection('supplierBills')
  const canEdit = usePermission('assets.edit')
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TaxRate | undefined>()
  const [preset, setPreset] = useState<DatePreset>('last_3_months')

  const vat = useMemo(() => {
    const r = presetRange(preset)
    let output = 0
    let taxableSales = 0
    let invoiceCount = 0
    for (const inv of invoices) {
      if (inv.status === 'draft' || inv.status === 'void' || !inRange(inv.issueDate, r.from, r.to)) continue
      const t = documentTotals(inv.lines, inv.discountPercent)
      output = add(output, t.taxTotal)
      taxableSales = add(taxableSales, t.netAmount)
      invoiceCount++
    }
    let input = 0
    let purchases = 0
    let billCount = 0
    for (const b of bills) {
      if (!isBillIncurred(b) || !inRange(b.billDate, r.from, r.to)) continue
      input = add(input, b.taxAmount)
      purchases = add(purchases, b.subtotal)
      billCount++
    }
    return { output, input, net: subtract(output, input), taxableSales, purchases, invoiceCount, billCount }
  }, [invoices, bills, preset])

  const columns: DataColumn<TaxRate>[] = [
    { id: 'code', header: 'Code', accessor: (r) => r.code, cell: (r) => <span className="font-medium">{r.code}</span> },
    { id: 'name', header: 'Name', accessor: (r) => r.name },
    { id: 'type', header: 'Applies to', accessor: (r) => humanize(r.type) },
    { id: 'rate', header: 'Rate', accessor: (r) => r.rate, align: 'right', cell: (r) => formatPercent(r.rate, Number.isInteger(r.rate) ? 0 : 2) },
    { id: 'status', header: 'Status', accessor: (r) => (r.active ? 'active' : 'inactive'), cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) =>
        canEdit ? (
          <RowActions
            label={r.code}
            actions={[
              { label: 'Edit', icon: <Pencil />, onSelect: () => { setEditing(r); setOpen(true) } },
              { label: r.active ? 'Deactivate' : 'Activate', icon: <Power />, onSelect: () => runWithToast(taxRateRepository.update(r.id, { active: !r.active }), `${r.code} ${r.active ? 'deactivated' : 'activated'}`) },
              { label: 'Delete', icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: async () => { const { confirmed } = await confirm({ title: `Delete ${r.code}?`, description: 'Existing documents keep their stored tax amounts.', confirmLabel: 'Delete', destructive: true }); if (confirmed) await runWithToast(taxRateRepository.remove(r.id), 'Tax rate deleted') } },
            ]}
          />
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Tax configuration" description="Illustrative tax rates used by invoices, quotations, purchase orders and bills in this demo." actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New tax rate</Button> : null} />
      <SimulatedNotice tone="warning" className="mb-6">
        Rates shown are examples for demonstration and may not reflect current law. This prototype does not prepare, file or validate tax returns.
      </SimulatedNotice>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DataTable caption="Tax rates" data={rates} columns={columns} getRowId={(r) => r.id} exportName="tax-rates" pageSize={10} />
        </div>
        <Section title="VAT summary (illustrative)" description="Not a tax return" actions={<DateRangeSelect value={preset} onChange={setPreset} presets={['this_month', 'last_month', 'last_3_months', 'last_6_months', 'ytd', 'last_12_months']} className="h-8 w-40" />}>
          <DetailList
            columns={1}
            items={[
              { label: `Output tax on ${vat.invoiceCount} issued invoice(s)`, value: <Money value={vat.output} /> },
              { label: 'Net sales in period', value: <Money value={vat.taxableSales} className="text-muted-foreground" /> },
              { label: `Input tax on ${vat.billCount} approved bill(s)`, value: <Money value={vat.input} /> },
              { label: 'Net purchases in period', value: <Money value={vat.purchases} className="text-muted-foreground" /> },
              { label: vat.net >= 0 ? 'Indicative net payable' : 'Indicative net refundable', value: <Money value={Math.abs(vat.net)} className="text-base font-semibold" /> },
            ]}
          />
          <p className="text-muted-foreground mt-4 text-xs">Calculated from invoice and bill tax amounts by document date. Credit notes, exemptions, apportionment and filing rules are not modelled.</p>
        </Section>
      </div>
      <TaxRateDialog open={open} onOpenChange={setOpen} rate={editing} />
    </>
  )
}
