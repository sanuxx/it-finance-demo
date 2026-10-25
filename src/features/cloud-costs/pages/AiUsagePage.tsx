import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Bot, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AiUsageEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { aiUsageRepository } from '@/services'
import { groupSum } from '@/lib/calculations/ledgers'
import { divide, multiply, sum } from '@/lib/calculations/money'
import { formatCurrency, formatMonth, formatNumber } from '@/lib/formatting'
import { inRange, monthLabel, presetRange, todayISO, type DatePreset } from '@/lib/dates'
import { BreakdownList } from '../components/BreakdownList'

const schema = z.object({
  provider: z.string().trim().min(2, 'Enter a provider').max(40),
  model: z.string().trim().min(2, 'Enter a model').max(60),
  useCase: z.string().trim().min(3, 'Describe the use case').max(80),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Choose a month'),
  requests: z.number({ error: 'Enter requests' }).int('Whole number').min(0),
  inputTokens: z.number({ error: 'Enter input tokens' }).int('Whole number').min(0),
  outputTokens: z.number({ error: 'Enter output tokens' }).int('Whole number').min(0),
  amount: z.number({ error: 'Enter a cost' }).positive('Cost must be greater than zero'),
  projectId: z.string().optional(),
  productId: z.string().optional(),
})
type Values = z.infer<typeof schema>

function AiUsageDialog({ open, onOpenChange, entry }: { open: boolean; onOpenChange: (o: boolean) => void; entry?: AiUsageEntry }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const projects = useCollection('projects')
  const products = useCollection('products')
  useEffect(() => {
    if (!open) return
    form.reset(entry ? { ...entry, month: entry.month.slice(0, 7) } : { provider: '', model: '', useCase: '', month: todayISO().slice(0, 7), requests: 0, inputTokens: 0, outputTokens: 0, amount: undefined as unknown as number })
  }, [open, entry, form])
  const save = useAction(
    async (v: Values) => {
      const payload = { ...v, month: `${v.month}-01` }
      return entry ? aiUsageRepository.update(entry.id, payload) : aiUsageRepository.create(payload)
    },
    { success: entry ? 'Usage updated' : 'Usage entry added' },
  )
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={entry ? 'Edit AI usage' : 'Add AI usage'} description="Illustrative usage record — no AI provider is connected." size="lg" pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="provider" label="Provider" required placeholder="e.g. Anthropic" />
        <TextField control={c} name="model" label="Model" required />
        <TextField control={c} name="useCase" label="Use case" required className="sm:col-span-2" />
        <TextField control={c} name="month" label="Month" type="month" required />
        <NumberField control={c} name="amount" label="Cost" prefix="LKR" required min={0} />
        <NumberField control={c} name="requests" label="Requests" step={1} min={0} />
        <div />
        <NumberField control={c} name="inputTokens" label="Input tokens" step={1} min={0} />
        <NumberField control={c} name="outputTokens" label="Output tokens" step={1} min={0} />
        <SelectField control={c} name="productId" label="Product" allowNone options={products.filter((p) => p.kind === 'saas').map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField control={c} name="projectId" label="Project" allowNone options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />
      </div>
    </FormDialog>
  )
}

export default function AiUsagePage() {
  const entries = useCollection('aiUsage')
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('saas.edit')
  const [preset, setPreset] = useState<DatePreset>('last_6_months')
  const [dialog, setDialog] = useState<{ open: boolean; entry?: AiUsageEntry }>({ open: false })
  const range = presetRange(preset)
  const inScope = useMemo(() => entries.filter((e) => inRange(e.month, range.from, range.to)), [entries, range.from, range.to])
  const providers = useMemo(() => [...new Set(entries.map((e) => e.provider))].sort(), [entries])

  const trend = useMemo(() => {
    const months = [...new Set(inScope.map((e) => e.month.slice(0, 7)))].sort()
    return months.map((m) => {
      const row: Record<string, number | string> = { month: m }
      for (const p of providers) row[p] = sum(inScope.filter((e) => e.provider === p && e.month.slice(0, 7) === m), (e) => e.amount)
      return row
    })
  }, [inScope, providers])

  const cost = sum(inScope, (e) => e.amount)
  const requests = inScope.reduce((s, e) => s + e.requests, 0)
  const tokensIn = inScope.reduce((s, e) => s + e.inputTokens, 0)
  const tokensOut = inScope.reduce((s, e) => s + e.outputTokens, 0)

  const breakdowns = useMemo(
    () => ({
      model: groupSum(inScope, (e) => `${e.provider} · ${e.model}`).map((g) => ({ ...g, label: g.key })),
      useCase: groupSum(inScope, (e) => e.useCase).map((g) => ({ ...g, label: g.key })),
      product: groupSum(inScope, (e) => e.productId).map((g) => ({ ...g, label: g.key === 'unassigned' ? 'Not product-specific' : lookups.product(g.key) })),
      project: groupSum(inScope, (e) => e.projectId).map((g) => ({ ...g, label: g.key === 'unassigned' ? 'Not project-specific' : lookups.project(g.key) })),
    }),
    [inScope, lookups],
  )

  const remove = async (e: AiUsageEntry) => {
    const { confirmed } = await confirm({ title: 'Delete this usage entry?', description: `${e.provider} ${e.model} for ${formatMonth(e.month)}.`, destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(aiUsageRepository.remove(e.id), 'Usage entry deleted')
  }

  const columns: DataColumn<AiUsageEntry>[] = [
    { id: 'month', header: 'Month', accessor: (e) => e.month, cell: (e) => formatMonth(e.month) },
    { id: 'provider', header: 'Provider', accessor: (e) => e.provider },
    { id: 'model', header: 'Model', accessor: (e) => e.model, alwaysVisible: true },
    { id: 'useCase', header: 'Use case', accessor: (e) => e.useCase },
    { id: 'alloc', header: 'Allocated to', accessor: (e) => (e.productId ? lookups.product(e.productId) : e.projectId ? lookups.projectCode(e.projectId) : 'Internal') },
    { id: 'requests', header: 'Requests', accessor: (e) => e.requests, align: 'right', cell: (e) => formatNumber(e.requests) },
    { id: 'tokens', header: 'Tokens (in / out)', accessor: (e) => e.inputTokens + e.outputTokens, align: 'right', cell: (e) => `${formatNumber(e.inputTokens, { compact: true })} / ${formatNumber(e.outputTokens, { compact: true })}` },
    { id: 'per1k', header: 'Cost / 1k req.', accessor: (e) => (e.requests ? divide(multiply(e.amount, 1000), e.requests) : null), align: 'right', cell: (e) => (e.requests ? <Money value={divide(multiply(e.amount, 1000), e.requests)} /> : '—') },
    { id: 'amount', header: 'Cost', accessor: (e) => e.amount, align: 'right', cell: (e) => <Money value={e.amount} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true,
      cell: (e) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.model}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ open: true, entry: e })}><Pencil /> Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => remove(e)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="AI & API usage"
        description="Model inference spend, request volumes and token usage allocated to products and projects."
        actions={<><DateRangeSelect value={preset} onChange={setPreset} presets={['this_month', 'last_3_months', 'last_6_months', 'last_12_months', 'ytd', 'all']} />{canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> Add usage</Button> : null}</>}
      />
      <SimulatedNotice className="mb-5">Usage figures are fictional sample records. Provider names are shown for realism only; no API is called.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="AI spend in period" value={formatCurrency(cost)} hint={`${inScope.length} usage records`} />
        <StatCard label="Requests" value={formatNumber(requests, { compact: true })} />
        <StatCard label="Tokens processed" value={formatNumber(tokensIn + tokensOut, { compact: true })} hint={`${formatNumber(tokensIn, { compact: true })} in · ${formatNumber(tokensOut, { compact: true })} out`} />
        <StatCard label="Cost per 1k requests" value={requests ? formatCurrency(divide(multiply(cost, 1000), requests)) : '—'} hint="Blended across models" />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly AI spend by provider"
          height={300}
          table={{ rows: trend, columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...providers.map((p) => ({ header: p, value: (r: Record<string, number | string>) => formatCurrency(Number(r[p] ?? 0)), align: 'right' as const }))] }}
        >
          <ChartLegend items={providers.map((p, i) => ({ label: p, color: seriesColor(i) }))} />
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)' }} />
              {providers.map((p, i) => <Bar key={p} dataKey={p} name={p} stackId="a" fill={seriesColor(i)} stroke="var(--card)" strokeWidth={1} maxBarSize={36} />)}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Section title="Breakdown">
          <Tabs defaultValue="model">
            <TabsList className="mb-3 flex-wrap">
              <TabsTrigger value="model">Model</TabsTrigger>
              <TabsTrigger value="useCase">Use case</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
              <TabsTrigger value="project">Project</TabsTrigger>
            </TabsList>
            {(['model', 'useCase', 'product', 'project'] as const).map((k) => <TabsContent key={k} value={k}><BreakdownList items={breakdowns[k]} /></TabsContent>)}
          </Tabs>
        </Section>
      </div>
      <div className="mt-4">
        <DataTable caption="AI usage entries" data={inScope} columns={columns} getRowId={(e) => e.id} exportName="ai-usage" initialSort={{ id: 'month', desc: true }} searchPlaceholder="Search provider, model, use case…" filters={[{ id: 'provider', label: 'Providers', options: providers.map((p) => ({ value: p, label: p })), predicate: (e, v) => e.provider === v }]} emptyState={<EmptyState icon={<Bot />} title="No AI usage in this period" className="border-0" />} />
      </div>
      <AiUsageDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} entry={dialog.entry} />
    </>
  )
}
