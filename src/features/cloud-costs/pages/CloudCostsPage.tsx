import { useMemo, useState } from 'react'
import { Cloud, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CloudCostEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartLegend, ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { cloudCostRepository } from '@/services'
import { groupSum } from '@/lib/calculations/ledgers'
import { percentOf, sum } from '@/lib/calculations/money'
import { formatCurrency, formatMonth, humanize } from '@/lib/formatting'
import { inRange, monthLabel, monthsBetween, presetRange, todayISO, type DatePreset } from '@/lib/dates'
import { BreakdownList } from '../components/BreakdownList'
import { CloudCostFormDialog } from '../components/CloudCostFormDialog'
import { PROVIDERS } from '../lib/cloud'

export default function CloudCostsPage() {
  const entries = useCollection('cloudCosts')
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('saas.edit')
  const [preset, setPreset] = useState<DatePreset>('last_6_months')
  const [dialog, setDialog] = useState<{ open: boolean; entry?: CloudCostEntry }>({ open: false })

  const range = presetRange(preset)
  const inScope = useMemo(() => entries.filter((e) => inRange(e.month, range.from, range.to)), [entries, range.from, range.to])

  const months = useMemo(() => {
    if (range.from && range.to) return monthsBetween(range.from, range.to > todayISO() ? todayISO() : range.to)
    return [...new Set(entries.map((e) => e.month.slice(0, 7)))].sort()
  }, [entries, range.from, range.to])

  const providersPresent = PROVIDERS.filter((p) => inScope.some((e) => e.provider === p))
  const trend = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, number | string> = { month: m }
        for (const p of providersPresent) row[p] = sum(inScope.filter((e) => e.provider === p && e.month.slice(0, 7) === m), (e) => e.amount)
        row.total = sum(inScope.filter((e) => e.month.slice(0, 7) === m), (e) => e.amount)
        return row
      }),
    [months, inScope, providersPresent],
  )

  const thisMonth = todayISO().slice(0, 7)
  const lastMonthKey = (() => {
    const d = new Date(`${thisMonth}-01T00:00:00`)
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const prevMonthKey = (() => {
    const d = new Date(`${lastMonthKey}-01T00:00:00`)
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const monthTotal = (k: string) => sum(entries.filter((e) => e.month.slice(0, 7) === k), (e) => e.amount)
  const last = monthTotal(lastMonthKey)
  const prev = monthTotal(prevMonthKey)
  const total = sum(inScope, (e) => e.amount)

  const breakdowns = useMemo(
    () => ({
      provider: groupSum(inScope, (e) => e.provider).map((g) => ({ ...g, label: g.key })),
      category: groupSum(inScope, (e) => e.category).map((g) => ({ ...g, label: humanize(g.key) })),
      product: groupSum(inScope, (e) => e.productId).map((g) => ({ ...g, label: g.key === 'unassigned' ? 'Not product-specific' : lookups.product(g.key) })),
      project: groupSum(inScope, (e) => e.projectId).map((g) => ({ ...g, label: g.key === 'unassigned' ? 'Not project-specific' : lookups.project(g.key) })),
      department: groupSum(inScope, (e) => e.departmentId).map((g) => ({ ...g, label: g.key === 'unassigned' ? 'Unassigned' : lookups.master(g.key) })),
      environment: groupSum(inScope, (e) => e.environment).map((g) => ({ ...g, label: humanize(g.key) })),
    }),
    [inScope, lookups],
  )

  // Month-over-month change per service (last complete month vs the one before).
  const movers = useMemo(() => {
    const key = (e: CloudCostEntry) => `${e.provider} · ${e.service}`
    const lastBy = groupSum(entries.filter((e) => e.month.slice(0, 7) === lastMonthKey), key)
    const prevMap = new Map(groupSum(entries.filter((e) => e.month.slice(0, 7) === prevMonthKey), key).map((g) => [g.key, g.amount]))
    return lastBy
      .map((g) => ({ service: g.key, last: g.amount, prev: prevMap.get(g.key) ?? 0 }))
      .map((r) => ({ ...r, change: r.last - r.prev, pct: percentOf(r.last - r.prev, r.prev) }))
      .sort((a, b) => b.change - a.change)
  }, [entries, lastMonthKey, prevMonthKey])

  const remove = async (e: CloudCostEntry) => {
    const { confirmed } = await confirm({ title: 'Delete this cloud cost entry?', description: `${e.provider} — ${e.service} for ${formatMonth(e.month)} (${formatCurrency(e.amount)}). Dashboards, budgets and project costs will update.`, destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(cloudCostRepository.remove(e.id), 'Cloud cost deleted')
  }

  const columns: DataColumn<CloudCostEntry>[] = [
    { id: 'month', header: 'Month', accessor: (e) => e.month, cell: (e) => formatMonth(e.month) },
    { id: 'provider', header: 'Provider', accessor: (e) => e.provider },
    { id: 'service', header: 'Service', accessor: (e) => e.service, alwaysVisible: true },
    { id: 'category', header: 'Category', accessor: (e) => humanize(e.category) },
    { id: 'env', header: 'Environment', accessor: (e) => humanize(e.environment), defaultHidden: true },
    { id: 'product', header: 'Product', accessor: (e) => (e.productId ? lookups.product(e.productId) : ''), defaultHidden: true },
    { id: 'project', header: 'Project', accessor: (e) => (e.projectId ? lookups.projectCode(e.projectId) : '') },
    { id: 'department', header: 'Department', accessor: (e) => (e.departmentId ? lookups.master(e.departmentId) : ''), defaultHidden: true },
    { id: 'amount', header: 'Amount', accessor: (e) => e.amount, align: 'right', cell: (e) => <Money value={e.amount} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true,
      cell: (e) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.service}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
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
        title="Cloud expenditure"
        description="Cloud spend by provider, category, product, project and department. Entries are sample usage records — no provider is connected."
        actions={
          <>
            <DateRangeSelect value={preset} onChange={setPreset} presets={['this_month', 'last_3_months', 'last_6_months', 'last_12_months', 'ytd', 'all']} />
            {canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> Add cost</Button> : null}
          </>
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Spend in period" value={formatCurrency(total)} hint={`${inScope.length} entries · ${months.length} month(s)`} />
        <StatCard label={`Last month (${formatMonth(lastMonthKey)})`} value={formatCurrency(last)} delta={percentOf(last - prev, prev)} invertDelta deltaLabel="month on month" />
        <StatCard label="Month to date" value={formatCurrency(monthTotal(thisMonth))} hint="Current month entries (partial)" />
        <StatCard label="Average per month" value={formatCurrency(months.length ? total / months.length : 0)} to="/saas/infrastructure-budgets" hint="Compare with budget" />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly spend by provider"
          height={300}
          table={{ rows: trend, columns: [{ header: 'Month', value: (r) => formatMonth(String(r.month)) }, ...providersPresent.map((p) => ({ header: p, value: (r: Record<string, number | string>) => formatCurrency(Number(r[p])), align: 'right' as const })), { header: 'Total', value: (r) => formatCurrency(Number(r.total)), align: 'right' }] }}
        >
          <ChartLegend items={providersPresent.map((p) => ({ label: p, color: seriesColor(PROVIDERS.indexOf(p)) }))} />
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} cursor={{ fill: 'var(--muted)' }} />
              {providersPresent.map((p, i) => (
                <Bar key={p} dataKey={p} name={p} stackId="a" fill={seriesColor(PROVIDERS.indexOf(p))} stroke="var(--card)" strokeWidth={1} radius={i === providersPresent.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Section title="Breakdown" description="For the selected period.">
          <Tabs defaultValue="category">
            <TabsList className="mb-3 flex-wrap">
              <TabsTrigger value="category">Category</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
              <TabsTrigger value="project">Project</TabsTrigger>
              <TabsTrigger value="department">Dept</TabsTrigger>
              <TabsTrigger value="environment">Env</TabsTrigger>
            </TabsList>
            {(['category', 'product', 'project', 'department', 'environment'] as const).map((k) => (
              <TabsContent key={k} value={k}>
                <BreakdownList items={breakdowns[k]} />
              </TabsContent>
            ))}
          </Tabs>
        </Section>
      </div>

      <Section title="Biggest month-on-month changes" description={`${formatMonth(lastMonthKey)} vs ${formatMonth(prevMonthKey)}, by service.`} className="mt-4">
        {movers.length ? (
          <ul className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
            {movers.slice(0, 8).map((m) => (
              <li key={m.service} className="flex justify-between gap-3 border-b pb-2 last:border-0">
                <span className="truncate">{m.service}</span>
                <span className="tabular shrink-0">
                  {formatCurrency(m.last)}{' '}
                  <span className={m.change > 0 ? 'text-destructive' : 'text-success'}>
                    {m.change > 0 ? '▲' : m.change < 0 ? '▼' : '•'} {m.pct === null ? 'new' : `${Math.abs(m.pct).toFixed(1)}%`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground text-sm">No data for last month.</p>}
      </Section>

      <SimulatedNotice className="my-4">Project-tagged cloud costs also appear as infrastructure cost on the project’s financial profile and count towards the cloud &amp; AI budget.</SimulatedNotice>
      <DataTable
        caption="Cloud cost entries"
        data={inScope}
        columns={columns}
        getRowId={(e) => e.id}
        exportName="cloud-costs"
        initialSort={{ id: 'month', desc: true }}
        searchPlaceholder="Search provider, service…"
        filters={[
          { id: 'provider', label: 'Providers', options: PROVIDERS.map((p) => ({ value: p, label: p })), predicate: (e, v) => e.provider === v },
          { id: 'category', label: 'Categories', options: [...new Set(entries.map((e) => e.category))].map((c) => ({ value: c, label: humanize(c) })), predicate: (e, v) => e.category === v },
          { id: 'env', label: 'Environments', options: ['production', 'staging', 'development'].map((c) => ({ value: c, label: humanize(c) })), predicate: (e, v) => e.environment === v },
        ]}
        emptyState={<EmptyState icon={<Cloud />} title="No cloud costs in this period" className="border-0" />}
      />
      <CloudCostFormDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} entry={dialog.entry} />
    </>
  )
}
