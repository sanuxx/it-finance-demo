import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartTheme'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useLookups, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { assetBookValue, depreciationSchedule, type DepreciationRow } from '@/lib/calculations/depreciation'
import { formatCurrency, formatDate, formatMonth } from '@/lib/formatting'
import { monthLabel, todayISO } from '@/lib/dates'
import { AssetFormDialog } from '../components/AssetFormDialog'

export default function AssetDetailPage() {
  const { id } = useParams()
  const asset = useRecord('assets', id)
  const lookups = useLookups()
  const canEdit = usePermission('assets.edit')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const schedule = useMemo(() => (asset ? depreciationSchedule(asset) : []), [asset])

  if (!asset) {
    return <EmptyState title="Asset not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/assets">Back to assets</Link></Button>} className="mt-10" />
  }
  const today = todayISO()
  const { accumulated, bookValue } = assetBookValue(asset, today)
  const currentMonth = today.slice(0, 7)
  const thisMonth = schedule.find((r) => r.month === currentMonth)
  const endRow = schedule[schedule.length - 1]

  const columns: DataColumn<DepreciationRow>[] = [
    { id: 'month', header: 'Month', accessor: (r) => r.month, cell: (r) => <span className={r.month === currentMonth ? 'font-semibold' : undefined}>{formatMonth(r.month)}{r.month === currentMonth ? ' (current)' : ''}</span> },
    { id: 'opening', header: 'Opening value', accessor: (r) => r.opening, align: 'right', cell: (r) => <Money value={r.opening} /> },
    { id: 'depreciation', header: 'Depreciation', accessor: (r) => r.depreciation, align: 'right', cell: (r) => <Money value={r.depreciation} /> },
    { id: 'closing', header: 'Closing value', accessor: (r) => r.closing, align: 'right', cell: (r) => <Money value={r.closing} /> },
  ]

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/assets')}>
        <ArrowLeft /> Fixed assets
      </Button>
      <PageHeader
        title={asset.name}
        description={`${asset.tag} · ${lookups.master(asset.assetClassId)} · ${asset.location}`}
        meta={<StatusBadge status={asset.status} />}
        actions={canEdit && asset.status !== 'disposed' ? <Button variant="outline" onClick={() => setOpen(true)}><Pencil /> Edit</Button> : null}
      />
      <StatGrid className="mb-6">
        <StatCard label="Cost" value={formatCurrency(asset.cost)} hint={`Purchased ${formatDate(asset.purchaseDate)}`} />
        <StatCard label="Accumulated depreciation" term="Depreciation" value={formatCurrency(accumulated)} />
        <StatCard label="Book value today" value={formatCurrency(bookValue)} />
        <StatCard label="Depreciation this month" value={formatCurrency(asset.status === 'disposed' ? 0 : (thisMonth?.depreciation ?? 0))} hint={asset.method === 'straight_line' ? 'Straight line' : 'Double declining balance'} />
      </StatGrid>
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Section title="Asset details">
          <DetailList
            columns={1}
            items={[
              { label: 'Department', value: lookups.master(asset.departmentId) },
              { label: 'Supplier', value: asset.supplierId ? <Link className="text-primary hover:underline" to={`/procurement/suppliers/${asset.supplierId}`}>{lookups.supplier(asset.supplierId)}</Link> : '—' },
              { label: 'Useful life', value: `${asset.usefulLifeMonths} months` },
              { label: 'Salvage value', value: <Money value={asset.salvageValue} /> },
              { label: 'Fully depreciated by', value: endRow ? formatMonth(endRow.month) : '—' },
            ]}
          />
        </Section>
        <ChartCard
          className="xl:col-span-2"
          title="Book value over useful life"
          description="Closing value by month; the dashed line marks today"
          table={{ rows: schedule, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Depreciation', value: (r) => formatCurrency(r.depreciation), align: 'right' }, { header: 'Closing value', value: (r) => formatCurrency(r.closing), align: 'right' }] }}
        >
          <ResponsiveContainer>
            <AreaChart data={schedule} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={monthLabel} minTickGap={24} />
              <YAxis {...axisProps} tickFormatter={currencyTick} width={56} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
              {schedule.some((r) => r.month === currentMonth) ? <ReferenceLine x={currentMonth} stroke="var(--muted-foreground)" strokeDasharray="4 4" /> : null}
              <Area type="monotone" dataKey="closing" name="Book value" stroke={seriesColor(0)} strokeWidth={2} fill={seriesColor(0)} fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <Section title="Depreciation schedule" description="Depreciation starts the month after purchase.">
        <DataTable caption={`Depreciation schedule for ${asset.tag}`} data={schedule} columns={columns} getRowId={(r) => r.month} exportName={`depreciation-${asset.tag}`} pageSize={12} />
      </Section>
      <SimulatedNotice className="mt-4">Illustrative schedule computed in your browser. It is not a tax depreciation schedule.</SimulatedNotice>
      <AssetFormDialog open={open} onOpenChange={setOpen} asset={asset} />
    </>
  )
}
