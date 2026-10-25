import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SupplierBill } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip } from '@/components/charts/chartKit'
import { axisProps, currencyTick, gridProps } from '@/components/charts/chartTheme'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBillViews, useCollection, useLookups } from '@/hooks/useData'
import { AGEING_LABELS, ageingBucket, type AgeingBucket } from '@/lib/calculations/invoices'
import { add, sum } from '@/lib/calculations/money'
import { daysBetween, todayISO } from '@/lib/dates'
import { formatCurrency, formatDate } from '@/lib/formatting'

const BUCKETS: AgeingBucket[] = ['current', '1_30', '31_60', '61_90', '90_plus']
const BUCKET_COLOR: Record<AgeingBucket, string> = { current: 'var(--muted-foreground)', '1_30': '#86b6ef', '31_60': '#3987e5', '61_90': '#1c5cab', '90_plus': '#0d366b' }

interface OpenBill {
  bill: SupplierBill
  outstanding: number
  bucket: AgeingBucket
  daysToDue: number
}

export default function PayablesPage() {
  const bills = useCollection('supplierBills')
  const views = useBillViews()
  const lookups = useLookups()
  const navigate = useNavigate()
  const today = todayISO()

  const open = useMemo<OpenBill[]>(
    () =>
      bills
        .filter((b) => {
          const v = views.get(b.id)
          return v && (v.status === 'approved' || v.status === 'partially_paid') && v.balance.outstanding > 0
        })
        .map((bill) => ({ bill, outstanding: views.get(bill.id)!.balance.outstanding, bucket: ageingBucket(bill.dueDate, today), daysToDue: daysBetween(today, bill.dueDate) })),
    [bills, views, today],
  )
  const awaiting = bills.filter((b) => b.status === 'awaiting_approval')
  const total = sum(open, (b) => b.outstanding)
  const overdue = open.filter((b) => b.bucket !== 'current')
  const dueSoon = open.filter((b) => b.daysToDue >= 0 && b.daysToDue <= 30)
  const bucketTotals = BUCKETS.map((b) => ({ bucket: b, label: AGEING_LABELS[b], amount: sum(open.filter((x) => x.bucket === b), (x) => x.outstanding) }))

  const bySupplier = useMemo(() => {
    const m = new Map<string, { supplierId: string; total: number; overdue: number; count: number }>()
    for (const o of open) {
      const r = m.get(o.bill.supplierId) ?? { supplierId: o.bill.supplierId, total: 0, overdue: 0, count: 0 }
      r.total = add(r.total, o.outstanding)
      if (o.bucket !== 'current') r.overdue = add(r.overdue, o.outstanding)
      r.count++
      m.set(o.bill.supplierId, r)
    }
    return [...m.values()]
  }, [open])

  const columns: DataColumn<OpenBill>[] = [
    { id: 'number', header: 'Bill', accessor: (r) => r.bill.number, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.bill.number}</div><div className="text-muted-foreground line-clamp-1 text-xs">{r.bill.description}</div></div> },
    { id: 'supplier', header: 'Supplier', accessor: (r) => lookups.supplier(r.bill.supplierId) },
    { id: 'due', header: 'Due', accessor: (r) => r.bill.dueDate, cell: (r) => formatDate(r.bill.dueDate) },
    { id: 'days', header: 'Due in', accessor: (r) => r.daysToDue, align: 'right', cell: (r) => (r.daysToDue < 0 ? <span className="text-destructive">{-r.daysToDue} days late</span> : `${r.daysToDue} days`) },
    { id: 'status', header: 'Status', accessor: (r) => views.get(r.bill.id)?.status, cell: (r) => <StatusBadge status={views.get(r.bill.id)?.overdue ? 'overdue' : (views.get(r.bill.id)?.status ?? r.bill.status)} /> },
    { id: 'outstanding', header: 'Outstanding', accessor: (r) => r.outstanding, align: 'right', cell: (r) => <Money value={r.outstanding} /> },
  ]

  return (
    <>
      <PageHeader title="Payables" description="What the company owes suppliers for approved bills, derived from supplier bills and simulated payments." actions={<Button onClick={() => navigate('/procurement/bills')}>Manage supplier bills</Button>} />
      <StatGrid className="mb-6">
        <StatCard label="Outstanding payables" term="Accounts payable" value={formatCurrency(total)} hint={`${open.length} approved bills`} />
        <StatCard label="Overdue" value={formatCurrency(sum(overdue, (b) => b.outstanding))} hint={`${overdue.length} bills past due`} />
        <StatCard label="Due in next 30 days" value={formatCurrency(sum(dueSoon, (b) => b.outstanding))} hint={`${dueSoon.length} bills`} />
        <StatCard label="Awaiting approval" value={formatCurrency(sum(awaiting, (b) => add(b.subtotal, b.taxAmount)))} hint={`${awaiting.length} bills not yet payable`} to="/approvals" />
      </StatGrid>
      <ChartCard className="mb-6" title="Payables ageing" description="Outstanding approved bills by days past due" height={220} table={{ rows: bucketTotals, columns: [{ header: 'Bucket', value: (r) => r.label }, { header: 'Outstanding', value: (r) => formatCurrency(r.amount), align: 'right' }] }}>
        <ResponsiveContainer>
          <BarChart data={bucketTotals} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
            <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {bucketTotals.map((b) => <Cell key={b.bucket} fill={BUCKET_COLOR[b.bucket]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open bills</TabsTrigger>
          <TabsTrigger value="due">Due in 30 days ({dueSoon.length})</TabsTrigger>
          <TabsTrigger value="suppliers">By supplier</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-3">
          <DataTable caption="Open supplier bills" data={open} columns={columns} getRowId={(r) => r.bill.id} exportName="payables" initialSort={{ id: 'days' }} onRowClick={(r) => navigate(`/procurement/bills?bill=${r.bill.id}`)} filters={[{ id: 'b', label: 'Ageing buckets', options: BUCKETS.map((b) => ({ value: b, label: AGEING_LABELS[b] })), predicate: (r, v) => r.bucket === v }]} />
        </TabsContent>
        <TabsContent value="due" className="mt-3">
          <DataTable caption="Bills due in the next 30 days" data={dueSoon} columns={columns} getRowId={(r) => r.bill.id} exportName="payables-due-30" initialSort={{ id: 'days' }} onRowClick={(r) => navigate(`/procurement/bills?bill=${r.bill.id}`)} />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-3">
          <DataTable
            caption="Payables by supplier"
            data={bySupplier}
            getRowId={(r) => r.supplierId}
            exportName="payables-by-supplier"
            initialSort={{ id: 'total', desc: true }}
            onRowClick={(r) => navigate(`/procurement/suppliers/${r.supplierId}`)}
            columns={[
              { id: 'supplier', header: 'Supplier', accessor: (r) => lookups.supplier(r.supplierId), alwaysVisible: true },
              { id: 'count', header: 'Open bills', accessor: (r) => r.count, align: 'right' },
              { id: 'overdue', header: 'Overdue', accessor: (r) => r.overdue, align: 'right', cell: (r) => (r.overdue ? <Money value={r.overdue} className="text-destructive" /> : '—') },
              { id: 'total', header: 'Outstanding', accessor: (r) => r.total, align: 'right', cell: (r) => <Money value={r.total} /> },
            ]}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
