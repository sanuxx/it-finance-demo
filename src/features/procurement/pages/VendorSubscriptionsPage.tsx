import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import type { SoftwareLicence } from '@/domain'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useCollection, useLookups } from '@/hooks/useData'
import { add, divide, multiply, percentOf } from '@/lib/calculations/money'
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatting'
import { daysBetween, todayISO } from '@/lib/dates'

/** Monthly equivalent cost of a licence (annual plans ÷ 12). Same rule as the expense ledger. */
function licenceMonthly(l: Pick<SoftwareLicence, 'seats' | 'costPerSeat' | 'billingCycle'>) {
  const cycle = multiply(l.seats, l.costPerSeat)
  return l.billingCycle === 'annual' ? divide(cycle, 12) : cycle
}

interface Row extends SoftwareLicence {
  monthly: number
  annual: number
  unusedMonthly: number
  daysToRenewal: number
}

export default function VendorSubscriptionsPage() {
  const licences = useCollection('licences')
  const suppliers = useCollection('suppliers')
  const lookups = useLookups()
  const today = todayISO()

  const rows = useMemo<Row[]>(
    () =>
      licences.map((l) => {
        const monthly = l.status === 'cancelled' ? 0 : licenceMonthly(l)
        const unusedSeats = Math.max(0, l.seats - l.seatsUsed)
        return { ...l, monthly, annual: multiply(monthly, 12), unusedMonthly: l.seats ? multiply(divide(monthly, l.seats, 6), unusedSeats) : 0, daysToRenewal: daysBetween(today, l.renewalDate) }
      }),
    [licences, today],
  )

  const vendors = useMemo(() => {
    const ids = [...new Set(rows.map((r) => r.vendorId))]
    return ids
      .map((id) => {
        const list = rows.filter((r) => r.vendorId === id && r.status !== 'cancelled')
        const seats = list.reduce((s, r) => s + r.seats, 0)
        const used = list.reduce((s, r) => s + r.seatsUsed, 0)
        return { id, name: lookups.supplier(id), count: list.length, monthly: list.reduce((s, r) => add(s, r.monthly), 0), seats, used, nextRenewal: list.map((r) => r.renewalDate).sort()[0] }
      })
      .sort((a, b) => b.monthly - a.monthly)
  }, [rows, lookups])

  const active = rows.filter((r) => r.status !== 'cancelled')
  const monthly = active.reduce((s, r) => add(s, r.monthly), 0)
  const unused = active.reduce((s, r) => add(s, r.unusedMonthly), 0)
  const renewals30 = active.filter((r) => r.daysToRenewal >= 0 && r.daysToRenewal <= 30)

  const columns: DataColumn<Row>[] = [
    { id: 'name', header: 'Subscription', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{lookups.supplier(r.vendorId)}</div></div> },
    { id: 'vendor', header: 'Vendor', accessor: (r) => lookups.supplier(r.vendorId), defaultHidden: true },
    { id: 'department', header: 'Department', accessor: (r) => lookups.master(r.departmentId) },
    { id: 'cycle', header: 'Billing', accessor: (r) => r.billingCycle, cell: (r) => (r.billingCycle === 'annual' ? 'Annual' : 'Monthly') },
    { id: 'seats', header: 'Seat use', accessor: (r) => percentOf(r.seatsUsed, r.seats), cell: (r) => <div className="min-w-32"><div className="text-muted-foreground mb-0.5 text-xs">{r.seatsUsed} / {r.seats} seats</div><ProgressBar value={r.seatsUsed} max={r.seats} tone="primary" label={`${r.name} seat utilisation`} /></div> },
    { id: 'monthly', header: 'Monthly equiv.', accessor: (r) => r.monthly, align: 'right', cell: (r) => <Money value={r.monthly} /> },
    { id: 'annual', header: 'Annualised', accessor: (r) => r.annual, align: 'right', cell: (r) => <Money value={r.annual} /> },
    { id: 'unused', header: 'Unused seats / mo', accessor: (r) => r.unusedMonthly, align: 'right', cell: (r) => (r.unusedMonthly > 0 ? <Money value={r.unusedMonthly} className="text-warning" /> : '—') },
    { id: 'renewal', header: 'Renews', accessor: (r) => r.renewalDate, cell: (r) => <span className={r.daysToRenewal <= 30 && r.daysToRenewal >= 0 ? 'font-medium' : undefined}>{formatDate(r.renewalDate)}{r.daysToRenewal >= 0 && r.daysToRenewal <= 30 ? <span className="text-muted-foreground ml-1 text-xs">({r.daysToRenewal} d)</span> : null}</span> },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Supplier subscriptions"
        description={
          <>
            Recurring software and service subscriptions grouped by vendor. Manage seats and plans in{' '}
            <Link to="/saas/licences" className="text-primary hover:underline">Software licences</Link>.
          </>
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Monthly subscription cost" value={formatCurrency(monthly)} hint={`${active.length} active subscriptions`} />
        <StatCard label="Annualised" value={formatCurrency(multiply(monthly, 12))} />
        <StatCard label="Unused seat cost / month" value={formatCurrency(unused)} hint={`${formatPercent(percentOf(unused, monthly))} of monthly cost`} estimate />
        <StatCard label="Renewals in 30 days" value={renewals30.length} hint={formatCurrency(renewals30.reduce((s, r) => add(s, r.billingCycle === 'annual' ? r.annual : r.monthly), 0)) + ' due'} />
      </StatGrid>
      <Section title="By vendor" className="mb-6">
        {vendors.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {vendors.map((v) => (
              <Link key={v.id} to={`/procurement/suppliers/${v.id}`} className="hover:border-primary/40 rounded-lg border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-muted-foreground text-xs">{v.count} subscription(s) · {v.used}/{v.seats} seats used</div>
                  </div>
                  <Money value={v.monthly} className="text-sm font-semibold" />
                </div>
                <ProgressBar className="mt-3" value={v.used} max={v.seats} tone="primary" label={`${v.name} seat utilisation`} />
                <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                  <CalendarClock className="size-3.5" /> Next renewal {formatDate(v.nextRenewal)}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No vendor subscriptions" />
        )}
      </Section>
      <DataTable caption="Supplier subscriptions" data={rows} columns={columns} getRowId={(r) => r.id} exportName="supplier-subscriptions" initialSort={{ id: 'monthly', desc: true }} filters={[{ id: 'vendor', label: 'Vendors', options: suppliers.filter((s) => rows.some((r) => r.vendorId === s.id)).map((s) => ({ value: s.id, label: s.name })), predicate: (r, v) => r.vendorId === v }]} />
      <p className="text-muted-foreground mt-3 text-xs">Unused seat cost = monthly equivalent ÷ seats × unused seats. It is an illustrative estimate of potential savings, assuming vendors allow seat reductions.</p>
    </>
  )
}
