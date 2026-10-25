import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BillingModel, Contract } from '@/domain'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip, SERIES, axisProps, gridProps } from '@/components/charts/chartKit'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useInvoiceViews, useLookups, useProjectFinancials } from '@/hooks/useData'
import { percentOf, subtract, sum } from '@/lib/calculations/money'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/formatting'
import { BILLING_MODEL_LABELS, toOptions } from '../lib/labels'

interface Row {
  contract: Contract
  client: string
  projectCode?: string
  value: number
  invoiced: number
  cost: number
  forecastCost: number
  profit: number
  margin: number | null
}

export default function ContractProfitabilityPage() {
  const contracts = useCollection('contracts')
  const projects = useCollection('projects')
  const invoices = useCollection('invoices')
  const fins = useProjectFinancials()
  const views = useInvoiceViews()
  const lookups = useLookups()

  const rows = useMemo<Row[]>(() => {
    return contracts.map((c) => {
      const project = projects.find((p) => p.id === c.projectId || p.contractId === c.id)
      const fin = project ? fins.get(project.id) : undefined
      const invoiced = fin
        ? fin.invoiced
        : sum(
            invoices.filter((i) => i.contractId === c.id && i.status !== 'draft' && i.status !== 'void'),
            (i) => views.get(i.id)?.totals.netAmount ?? 0,
          )
      const cost = fin?.actualCost ?? 0
      const forecastCost = fin?.forecastCost ?? 0
      const profit = subtract(c.value, forecastCost)
      return { contract: c, client: lookups.customer(c.customerId), projectCode: project?.code, value: c.value, invoiced, cost, forecastCost, profit, margin: fin ? percentOf(profit, c.value) : null }
    })
  }, [contracts, projects, invoices, fins, views, lookups])

  const byModel = useMemo(() => {
    const models = [...new Set(rows.map((r) => r.contract.billingModel))] as BillingModel[]
    return models
      .map((m) => {
        const list = rows.filter((r) => r.contract.billingModel === m && r.margin !== null)
        const value = sum(list, (r) => r.value)
        const profit = sum(list, (r) => r.profit)
        return { name: BILLING_MODEL_LABELS[m], value, profit, margin: percentOf(profit, value) ?? 0, count: rows.filter((r) => r.contract.billingModel === m).length }
      })
      .filter((m) => m.value > 0)
      .sort((a, b) => b.margin - a.margin)
  }, [rows])

  const withCost = rows.filter((r) => r.margin !== null)
  const totalValue = sum(withCost, (r) => r.value)
  const totalProfit = sum(withCost, (r) => r.profit)

  const columns: DataColumn<Row>[] = [
    { id: 'contract', header: 'Contract', accessor: (r) => `${r.contract.number} ${r.contract.title}`, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.contract.title}</div><div className="text-muted-foreground text-xs">{r.contract.number}</div></div> },
    { id: 'client', header: 'Client', accessor: (r) => r.client },
    { id: 'project', header: 'Project', accessor: (r) => r.projectCode, cell: (r) => (r.projectCode && r.contract.projectId ? <Link to={`/projects/${r.contract.projectId}`} className="text-primary hover:underline">{r.projectCode}</Link> : <span className="text-muted-foreground">—</span>) },
    { id: 'model', header: 'Billing model', accessor: (r) => BILLING_MODEL_LABELS[r.contract.billingModel] },
    { id: 'status', header: 'Status', accessor: (r) => r.contract.status, cell: (r) => <StatusBadge status={r.contract.status} /> },
    { id: 'value', header: 'Contract value', accessor: (r) => r.value, align: 'right', cell: (r) => <Money value={r.value} /> },
    { id: 'invoiced', header: 'Invoiced (net)', accessor: (r) => r.invoiced, align: 'right', cell: (r) => <Money value={r.invoiced} /> },
    { id: 'cost', header: 'Cost to date', accessor: (r) => r.cost, align: 'right', cell: (r) => <Money value={r.cost} /> },
    { id: 'forecast', header: 'Forecast cost', accessor: (r) => r.forecastCost, align: 'right', cell: (r) => (r.margin === null ? <span className="text-muted-foreground">Not tracked</span> : <Money value={r.forecastCost} />) },
    { id: 'profit', header: 'Est. profit', accessor: (r) => (r.margin === null ? undefined : r.profit), align: 'right', cell: (r) => (r.margin === null ? '—' : <Money value={r.profit} signed />) },
    { id: 'margin', header: 'Est. margin', accessor: (r) => r.margin ?? undefined, align: 'right', cell: (r) => formatPercent(r.margin) },
  ]

  return (
    <>
      <PageHeader title="Contract profitability" description="Estimated direct-cost margin for each contract, based on linked project costs and illustrative forecasts." />
      <StatGrid className="mb-6">
        <StatCard label="Contracts" value={rows.length} hint={`${rows.filter((r) => r.contract.status === 'active').length} active`} />
        <StatCard label="Contract value tracked" term="Contract value" value={formatCompactCurrency(totalValue)} hint="Contracts linked to costed projects" />
        <StatCard label="Est. profit" term="Direct-cost margin" value={formatCompactCurrency(totalProfit)} estimate />
        <StatCard label="Est. margin" term="Direct-cost margin" value={formatPercent(percentOf(totalProfit, totalValue))} hint="Before allocated overhead" estimate />
      </StatGrid>
      <ChartCard
        className="mb-6"
        title="Estimated margin by billing model"
        description="Weighted by contract value. Subscription and support contracts without project costing are excluded."
        height={240}
        table={{
          rows: byModel,
          columns: [
            { header: 'Billing model', value: (r) => r.name },
            { header: 'Contracts', value: (r) => r.count, align: 'right' },
            { header: 'Value', value: (r) => formatCurrency(r.value), align: 'right' },
            { header: 'Est. profit', value: (r) => formatCurrency(r.profit), align: 'right' },
            { header: 'Margin', value: (r) => formatPercent(r.margin), align: 'right' },
          ],
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byModel} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={(v: number) => `${v}%`} width={44} {...axisProps} />
            <Tooltip content={<ChartTooltip format="percent" />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="margin" name="Est. margin" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable
        caption="Contract profitability"
        data={rows}
        columns={columns}
        getRowId={(r) => r.contract.id}
        exportName="contract-profitability"
        initialSort={{ id: 'margin', desc: true }}
        filters={[{ id: 'model', label: 'Billing models', options: toOptions(BILLING_MODEL_LABELS), predicate: (r, v) => r.contract.billingModel === v }]}
      />
      <SimulatedNotice className="mt-4">Estimated profit = contract value − forecast cost at completion. Figures are illustrative and exclude allocated overhead.</SimulatedNotice>
    </>
  )
}
