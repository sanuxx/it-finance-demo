import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { ForecastScenario } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { NumberField, TextField, TextareaField } from '@/components/forms/fields'
import { useCollection, useLedgers } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useAction, runWithToast } from '@/hooks/useAction'
import { scenarioRepository } from '@/services'
import { newId } from '@/services/demo/demoStore'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatMonth, formatPercent } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { computeBaseline, projectCash, projectMonths } from '../lib/forecast'
import { useWorkingCapital } from '../lib/useForecast'
import { IllustrativeNotice } from '../components/ForecastControls'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a scenario name').max(60),
  description: z.string().trim().max(300),
  revenueGrowthPercent: z.number({ error: 'Enter a growth rate' }).min(-20, 'Minimum −20%').max(20, 'Maximum 20% per month'),
  expenseGrowthPercent: z.number({ error: 'Enter a growth rate' }).min(-20, 'Minimum −20%').max(20, 'Maximum 20% per month'),
  collectionRatePercent: z.number({ error: 'Enter a collection rate' }).min(0, 'Minimum 0%').max(100, 'Maximum 100%'),
  oneOffItems: z.array(
    z.object({
      id: z.string(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Choose a month'),
      label: z.string().trim().min(2, 'Describe the item'),
      amount: z.number({ error: 'Enter an amount' }).refine((v) => v !== 0, 'Amount cannot be zero'),
    }),
  ),
})
type Values = z.infer<typeof schema>

function ScenarioDialog({ open, onOpenChange, scenario }: { open: boolean; onOpenChange: (o: boolean) => void; scenario?: ForecastScenario }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const items = useFieldArray({ control: form.control, name: 'oneOffItems' })
  useEffect(() => {
    if (!open) return
    form.reset(
      scenario
        ? { ...scenario, oneOffItems: scenario.oneOffItems.map((o) => ({ ...o, month: o.month.slice(0, 7) })) }
        : { name: '', description: '', revenueGrowthPercent: 1, expenseGrowthPercent: 1, collectionRatePercent: 85, oneOffItems: [] },
    )
  }, [open, scenario, form])
  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, oneOffItems: v.oneOffItems.map((o) => ({ ...o, month: `${o.month}-01` })) }
      return scenario ? scenarioRepository.update(scenario.id, payload) : scenarioRepository.create({ ...payload, isDefault: false })
    },
    { success: scenario ? 'Scenario updated' : 'Scenario created' },
  )
  const c = form.control
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={scenario ? `Edit ${scenario.name}` : 'New scenario'}
      description="Assumptions drive the illustrative revenue, expense and cash projections."
      size="lg"
      pending={save.pending}
      onSubmit={form.handleSubmit(async (v) => {
        if (await save.run(v)) onOpenChange(false)
      })}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField control={c} name="name" label="Name" required className="sm:col-span-3" autoFocus />
        <TextareaField control={c} name="description" label="Description" rows={2} className="sm:col-span-3" />
        <NumberField control={c} name="revenueGrowthPercent" label="Revenue growth / month" suffix="%" step={0.1} required />
        <NumberField control={c} name="expenseGrowthPercent" label="Expense growth / month" suffix="%" step={0.1} required />
        <NumberField control={c} name="collectionRatePercent" label="Collection rate" suffix="%" step={1} required description="Share of each month's billing collected in that month." />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">One-off items</legend>
        <p className="text-muted-foreground text-xs">Positive amounts add revenue; negative amounts add cost.</p>
        {items.fields.map((f, i) => {
          const err = form.formState.errors.oneOffItems?.[i]
          return (
            <div key={f.id} className="grid grid-cols-[1fr_2fr_1fr_auto] items-start gap-2">
              <div>
                <Label className="sr-only" htmlFor={`oo-m-${i}`}>Month</Label>
                <Input id={`oo-m-${i}`} type="month" {...form.register(`oneOffItems.${i}.month`)} aria-invalid={!!err?.month} />
                {err?.month ? <p className="text-destructive text-xs">{err.month.message}</p> : null}
              </div>
              <div>
                <Label className="sr-only" htmlFor={`oo-l-${i}`}>Description</Label>
                <Input id={`oo-l-${i}`} placeholder="Description" {...form.register(`oneOffItems.${i}.label`)} aria-invalid={!!err?.label} />
                {err?.label ? <p className="text-destructive text-xs">{err.label.message}</p> : null}
              </div>
              <div>
                <Label className="sr-only" htmlFor={`oo-a-${i}`}>Amount</Label>
                <Input id={`oo-a-${i}`} type="number" step="any" className="tabular" placeholder="LKR" {...form.register(`oneOffItems.${i}.amount`, { valueAsNumber: true })} aria-invalid={!!err?.amount} />
                {err?.amount ? <p className="text-destructive text-xs">{err.amount.message}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => items.remove(i)} aria-label="Remove item">
                <Trash2 />
              </Button>
            </div>
          )
        })}
        <Button type="button" variant="outline" size="sm" onClick={() => items.append({ id: newId('oo'), month: todayISO().slice(0, 7), label: '', amount: 0 })}>
          <Plus /> Add one-off item
        </Button>
      </fieldset>
    </FormDialog>
  )
}

export default function ScenariosPage() {
  const scenarios = useCollection('scenarios')
  const ledgers = useLedgers()
  const wc = useWorkingCapital()
  const canEdit = usePermission('budgets.edit')
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; scenario?: ForecastScenario }>({ open: false })

  const results = useMemo(() => {
    const asOf = todayISO()
    const baseline = computeBaseline(ledgers.revenue, ledgers.expenses, asOf)
    return new Map(
      scenarios.map((s) => {
        const f = projectMonths(baseline, s, asOf, 12)
        const cash = projectCash(f, { openingCash: wc.cash, receivables: wc.receivables, payables: wc.payables, collectionRatePercent: s.collectionRatePercent })
        const revenue = sum(f, (x) => x.revenue)
        const expenses = sum(f, (x) => x.expenses)
        return [s.id, { revenue, expenses, profit: revenue - expenses, closing: cash[cash.length - 1]?.closing ?? wc.cash, lowest: Math.min(...cash.map((c) => c.closing)) }]
      }),
    )
  }, [scenarios, ledgers, wc])

  const remove = async (s: ForecastScenario) => {
    const { confirmed } = await confirm({ title: `Delete ${s.name}?`, description: 'The scenario and its one-off items will be removed from this browser.', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(scenarioRepository.remove(s.id), 'Scenario deleted')
  }
  const makeDefault = async (s: ForecastScenario) => {
    for (const other of scenarios) if (other.isDefault && other.id !== s.id) await scenarioRepository.update(other.id, { isDefault: false })
    await runWithToast(scenarioRepository.update(s.id, { isDefault: true }), `${s.name} is now the default scenario`)
  }
  const duplicate = (s: ForecastScenario) => runWithToast(scenarioRepository.create({ ...s, name: `${s.name} (copy)`, isDefault: false, oneOffItems: s.oneOffItems.map((o) => ({ ...o, id: newId('oo') })) }), 'Scenario duplicated')

  const metrics: { label: string; value: (id: string) => number; format?: 'pct' }[] = [
    { label: 'Projected revenue (12 mo)', value: (id) => results.get(id)?.revenue ?? 0 },
    { label: 'Projected expenses (12 mo)', value: (id) => results.get(id)?.expenses ?? 0 },
    { label: 'Projected profit (12 mo)', value: (id) => results.get(id)?.profit ?? 0 },
    { label: 'Closing cash (month 12)', value: (id) => results.get(id)?.closing ?? 0 },
    { label: 'Lowest monthly cash', value: (id) => results.get(id)?.lowest ?? 0 },
  ]

  return (
    <>
      <PageHeader
        title="Financial scenarios"
        description="Assumption sets used by the revenue, expense and cash flow forecasts."
        actions={canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> New scenario</Button> : null}
      />
      <IllustrativeNotice />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => (
          <Section
            key={s.id}
            title={
              <span className="inline-flex items-center gap-2">
                {s.name}
                {s.isDefault ? <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">Default</span> : null}
              </span>
            }
            description={s.description}
            actions={
              canEdit ? (
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, scenario: s })} aria-label={`Edit ${s.name}`}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => duplicate(s)} aria-label={`Duplicate ${s.name}`}><Copy /></Button>
                  {!s.isDefault ? <Button variant="ghost" size="icon-sm" onClick={() => makeDefault(s)} aria-label={`Make ${s.name} default`}><Star /></Button> : null}
                  {!s.isDefault ? <Button variant="ghost" size="icon-sm" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}><Trash2 /></Button> : null}
                </div>
              ) : null
            }
          >
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-muted-foreground text-xs">Revenue growth</dt><dd className="tabular">{formatPercent(s.revenueGrowthPercent)} / mo</dd></div>
              <div><dt className="text-muted-foreground text-xs">Expense growth</dt><dd className="tabular">{formatPercent(s.expenseGrowthPercent)} / mo</dd></div>
              <div><dt className="text-muted-foreground text-xs">Collection rate</dt><dd className="tabular">{formatPercent(s.collectionRatePercent, 0)}</dd></div>
            </dl>
            {s.oneOffItems.length ? (
              <ul className="mt-3 space-y-1 border-t pt-3 text-xs">
                {s.oneOffItems.map((o) => (
                  <li key={o.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">{formatMonth(o.month)} · {o.label}</span>
                    <span className={cn('tabular', o.amount < 0 && 'text-destructive')}>{formatCurrency(o.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">No one-off items.</p>}
          </Section>
        ))}
      </div>
      <Section title="Side-by-side comparison" description="12-month illustrative projection for each scenario." className="mt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Measure</TableHead>
                {scenarios.map((s) => <TableHead key={s.id} className="text-right">{s.name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.label}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  {scenarios.map((s) => {
                    const v = m.value(s.id)
                    return <TableCell key={s.id} className={cn('tabular text-right', v < 0 && 'text-destructive')}>{formatCurrency(v)}</TableCell>
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
      <ScenarioDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} scenario={dialog.scenario} />
    </>
  )
}
