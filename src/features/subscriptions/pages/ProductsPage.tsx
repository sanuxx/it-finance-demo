import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Boxes, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { SoftwareProduct } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { SelectField, SwitchField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups, useMasterList } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { productRepository } from '@/services'
import { newId } from '@/services/demo/demoStore'
import { isSubscriptionLive, subscriptionMrr } from '@/lib/calculations/saas'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, humanize } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'

const schema = z
  .object({
    code: z.string().trim().min(2, 'Enter a code').max(20),
    name: z.string().trim().min(2, 'Enter a name').max(80),
    description: z.string().trim().max(300),
    kind: z.enum(['saas', 'service', 'licence']),
    incomeCategoryId: z.string().min(1, 'Choose an income category'),
    active: z.boolean(),
    plans: z.array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, 'Plan name'),
        monthlyPrice: z.number({ error: 'Price' }).min(0, '≥ 0'),
        annualPrice: z.number({ error: 'Price' }).min(0, '≥ 0'),
      }),
    ),
  })
  .refine((v) => v.kind !== 'saas' || v.plans.length > 0, { path: ['plans'], message: 'SaaS products need at least one plan' })
type Values = z.infer<typeof schema>

function ProductDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product?: SoftwareProduct }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const plans = useFieldArray({ control: form.control, name: 'plans' })
  const incomeCats = useMasterList('incomeCategories')
  useEffect(() => {
    if (!open) return
    form.reset(product ?? { code: '', name: '', description: '', kind: 'saas', incomeCategoryId: 'inc-saas', active: true, plans: [{ id: newId('plan'), name: 'Standard', monthlyPrice: 0, annualPrice: 0 }] })
  }, [open, product, form])
  const save = useAction(async (v: Values) => (product ? productRepository.update(product.id, v) : productRepository.create(v)), { success: product ? 'Product updated' : 'Product created' })
  const c = form.control
  const plansError = form.formState.errors.plans?.message ?? form.formState.errors.plans?.root?.message
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={product ? `Edit ${product.name}` : 'New product or service'} description="Price changes apply to new subscriptions; existing subscriptions keep their agreed unit price." size="lg" pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Name" required autoFocus />
        <TextField control={c} name="code" label="Code" required />
        <SelectField control={c} name="kind" label="Type" required options={[{ value: 'saas', label: 'SaaS product' }, { value: 'service', label: 'Professional service' }, { value: 'licence', label: 'Licence' }]} />
        <SelectField control={c} name="incomeCategoryId" label="Revenue category" required options={incomeCats.map((m) => ({ value: m.id, label: m.name }))} />
        <TextareaField control={c} name="description" label="Description" rows={2} className="sm:col-span-2" />
        <SwitchField control={c} name="active" label="Active" description="Inactive products cannot be added to new subscriptions." className="sm:col-span-2" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Pricing plans (per seat / outlet)</legend>
        {plans.fields.length ? (
          <div className="text-muted-foreground grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-xs"><span>Plan</span><span>Monthly (LKR)</span><span>Annual (LKR)</span><span className="w-9" /></div>
        ) : null}
        {plans.fields.map((f, i) => {
          const err = form.formState.errors.plans?.[i]
          return (
            <div key={f.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-start gap-2">
              <div><Label htmlFor={`pl-n-${i}`} className="sr-only">Plan name</Label><Input id={`pl-n-${i}`} {...form.register(`plans.${i}.name`)} aria-invalid={!!err?.name} /></div>
              <div><Label htmlFor={`pl-m-${i}`} className="sr-only">Monthly price</Label><Input id={`pl-m-${i}`} type="number" min={0} step="any" className="tabular" {...form.register(`plans.${i}.monthlyPrice`, { valueAsNumber: true })} aria-invalid={!!err?.monthlyPrice} /></div>
              <div><Label htmlFor={`pl-a-${i}`} className="sr-only">Annual price</Label><Input id={`pl-a-${i}`} type="number" min={0} step="any" className="tabular" {...form.register(`plans.${i}.annualPrice`, { valueAsNumber: true })} aria-invalid={!!err?.annualPrice} /></div>
              <Button type="button" variant="ghost" size="icon" onClick={() => plans.remove(i)} aria-label={`Remove plan ${i + 1}`}><Trash2 /></Button>
              {err ? <p className="text-destructive col-span-4 text-xs">{err.name?.message ?? err.monthlyPrice?.message ?? err.annualPrice?.message}</p> : null}
            </div>
          )
        })}
        {plansError ? <p role="alert" className="text-destructive text-xs">{plansError}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => plans.append({ id: newId('plan'), name: '', monthlyPrice: 0, annualPrice: 0 })}><Plus /> Add plan</Button>
      </fieldset>
    </FormDialog>
  )
}

interface Row extends SoftwareProduct {
  liveSubs: number
  mrr: number
}

export default function ProductsPage() {
  const products = useCollection('products')
  const subscriptions = useCollection('subscriptions')
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('saas.edit')
  const [dialog, setDialog] = useState<{ open: boolean; product?: SoftwareProduct }>({ open: false })

  const rows = useMemo<Row[]>(() => {
    const today = todayISO()
    return products.map((p) => {
      const live = subscriptions.filter((s) => s.productId === p.id && isSubscriptionLive(s, today))
      return { ...p, liveSubs: live.length, mrr: sum(live, subscriptionMrr) }
    })
  }, [products, subscriptions])

  const remove = async (p: SoftwareProduct) => {
    const { confirmed } = await confirm({ title: `Delete ${p.name}?`, description: 'Products used on subscriptions or invoices cannot be deleted — deactivate them instead.', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(productRepository.remove(p.id), 'Product deleted')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'name', header: 'Product', accessor: (p) => p.name, alwaysVisible: true, cell: (p) => <div><div className="font-medium">{p.name}</div><div className="text-muted-foreground text-xs">{p.code} · {p.description}</div></div> },
    { id: 'kind', header: 'Type', accessor: (p) => (p.kind === 'saas' ? 'SaaS' : humanize(p.kind)) },
    { id: 'category', header: 'Revenue category', accessor: (p) => lookups.master(p.incomeCategoryId), defaultHidden: true },
    { id: 'plans', header: 'Plans & prices', accessor: (p) => p.plans.map((pl) => pl.name).join(', '), cell: (p) => p.plans.length ? <ul className="space-y-0.5 text-xs">{p.plans.map((pl) => <li key={pl.id}><span className="font-medium">{pl.name}</span> <span className="text-muted-foreground">{formatCurrency(pl.monthlyPrice)}/mo · {formatCurrency(pl.annualPrice)}/yr</span></li>)}</ul> : <span className="text-muted-foreground text-xs">Priced per quote</span> },
    { id: 'subs', header: 'Live subscriptions', accessor: (p) => p.liveSubs, align: 'right' },
    { id: 'mrr', header: 'MRR', accessor: (p) => p.mrr, align: 'right', cell: (p) => (p.kind === 'saas' ? <Money value={p.mrr} /> : <span className="text-muted-foreground">—</span>) },
    { id: 'status', header: 'Status', accessor: (p) => (p.active ? 'active' : 'inactive'), cell: (p) => <StatusBadge status={p.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true,
      cell: (p) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ open: true, product: p })}><Pencil /> Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => runWithToast(productRepository.update(p.id, { active: !p.active }), p.active ? 'Product deactivated' : 'Product activated')}>{p.active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(p)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ]

  const saas = rows.filter((r) => r.kind === 'saas')
  return (
    <>
      <PageHeader title="Software products" description="SaaS products, professional services and licences with their pricing plans." actions={canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> New product</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="SaaS products" value={saas.length} hint={`${rows.length} products & services in total`} />
        <StatCard label="MRR" value={formatCurrency(sum(saas, (r) => r.mrr))} to="/saas/metrics" />
        <StatCard label="Live subscriptions" value={saas.reduce((s, r) => s + r.liveSubs, 0)} to="/saas/subscriptions" />
        <StatCard label="Pricing plans" value={rows.reduce((s, r) => s + r.plans.length, 0)} />
      </StatGrid>
      <DataTable caption="Products" data={rows} columns={columns} getRowId={(r) => r.id} exportName="products" searchPlaceholder="Search products…" filters={[{ id: 'kind', label: 'Types', options: [{ value: 'saas', label: 'SaaS' }, { value: 'service', label: 'Service' }, { value: 'licence', label: 'Licence' }], predicate: (r, v) => r.kind === v }]} emptyState={<EmptyState icon={<Boxes />} title="No products yet" className="border-0" />} />
      <ProductDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} product={dialog.product} />
    </>
  )
}
