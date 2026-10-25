import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal, Pencil, Plus, Repeat, Trash2, XCircle } from 'lucide-react'
import type { CustomerSubscription } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { subscriptionRepository } from '@/services'
import { isSubscriptionLive, saasMetrics, subscriptionMrr } from '@/lib/calculations/saas'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { CancelSubscriptionDialog, SubscriptionFormDialog } from '../components/SubscriptionDialogs'

interface Row extends CustomerSubscription {
  mrr: number
  live: boolean
  planName: string
}

export default function SubscriptionsPage() {
  const subscriptions = useCollection('subscriptions')
  const products = useCollection('products')
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('saas.edit')
  const [form, setForm] = useState<{ open: boolean; sub?: CustomerSubscription }>({ open: false })
  const [cancel, setCancel] = useState<{ open: boolean; sub?: CustomerSubscription }>({ open: false })
  const today = todayISO()

  const rows = useMemo<Row[]>(
    () =>
      subscriptions.map((s) => {
        const live = isSubscriptionLive(s, today)
        return { ...s, live, mrr: live ? subscriptionMrr(s) : 0, planName: products.find((p) => p.id === s.productId)?.plans.find((pl) => pl.id === s.planId)?.name ?? '—' }
      }),
    [subscriptions, products, today],
  )
  const metrics = useMemo(() => saasMetrics(subscriptions, today), [subscriptions, today])

  const remove = async (s: CustomerSubscription) => {
    const { confirmed } = await confirm({ title: 'Delete this subscription?', description: 'Historic MRR and churn will be recalculated without it. Use “Cancel” to record a real churn event instead.', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(subscriptionRepository.remove(s.id), 'Subscription deleted')
  }

  const label = (s?: CustomerSubscription) => (s ? `${lookups.customer(s.customerId)} — ${lookups.product(s.productId)}` : '')

  const columns: DataColumn<Row>[] = [
    { id: 'customer', header: 'Customer', accessor: (r) => lookups.customer(r.customerId), alwaysVisible: true, cell: (r) => <Link to={`/sales/customers/${r.customerId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{lookups.customer(r.customerId)}</Link> },
    { id: 'product', header: 'Product / plan', accessor: (r) => `${lookups.product(r.productId)} ${r.planName}`, cell: (r) => <div><div>{lookups.product(r.productId)}</div><div className="text-muted-foreground text-xs">{r.planName} · {r.billingCycle}</div></div> },
    { id: 'seats', header: 'Seats', accessor: (r) => r.seats, align: 'right' },
    { id: 'price', header: 'Unit price', accessor: (r) => r.unitPrice, align: 'right', cell: (r) => <span><Money value={r.unitPrice} /><span className="text-muted-foreground text-xs">/{r.billingCycle === 'annual' ? 'yr' : 'mo'}</span></span>, defaultHidden: true },
    { id: 'mrr', header: 'MRR', accessor: (r) => r.mrr, align: 'right', cell: (r) => (r.live ? <Money value={r.mrr} /> : <span className="text-muted-foreground text-xs">{r.status === 'trial' ? 'Trial' : '—'}</span>) },
    { id: 'start', header: 'Started', accessor: (r) => r.startDate, cell: (r) => formatDate(r.startDate) },
    { id: 'renewal', header: 'Renewal', accessor: (r) => (r.status === 'cancelled' ? r.cancelledDate : r.renewalDate), cell: (r) => (r.status === 'cancelled' ? <span className="text-muted-foreground">Ended {formatDate(r.cancelledDate)}</span> : formatDate(r.renewalDate)) },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true,
      cell: (r) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Subscription actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {r.status !== 'cancelled' ? <DropdownMenuItem onSelect={() => setForm({ open: true, sub: r })}><Pencil /> Edit</DropdownMenuItem> : null}
            {r.status === 'trial' ? <DropdownMenuItem onSelect={() => runWithToast(subscriptionRepository.update(r.id, { status: 'active', startDate: today }), 'Trial converted to paid — MRR updated')}>Convert trial to paid</DropdownMenuItem> : null}
            {r.status === 'past_due' ? <DropdownMenuItem onSelect={() => runWithToast(subscriptionRepository.update(r.id, { status: 'active' }), 'Marked as active')}>Mark payment received</DropdownMenuItem> : null}
            {r.status !== 'cancelled' ? <DropdownMenuItem onSelect={() => setCancel({ open: true, sub: r })}><XCircle /> Cancel subscription</DropdownMenuItem> : <DropdownMenuItem onSelect={() => runWithToast(subscriptionRepository.update(r.id, { status: 'active', cancelledDate: undefined }), 'Subscription reactivated')}><Repeat /> Reactivate</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Customer subscriptions" description="Live, trial, past-due and cancelled SaaS subscriptions. MRR normalises annual plans to a monthly value." actions={canEdit ? <Button onClick={() => setForm({ open: true })}><Plus /> New subscription</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="MRR" term="MRR" value={formatCurrency(metrics.mrr)} to="/saas/metrics" />
        <StatCard label="Live subscriptions" value={metrics.activeSubscriptions} hint={`${metrics.customers} paying customers`} />
        <StatCard label="Trials" value={metrics.trialSubscriptions} hint="Excluded from MRR" />
        <StatCard label="Renewing in 30 days" value={metrics.renewalsNext30Days.length} hint={formatCurrency(metrics.renewalsNext30Days.reduce((s, r) => s + subscriptionMrr(r), 0)) + ' MRR'} />
      </StatGrid>
      <DataTable
        caption="Customer subscriptions"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="subscriptions"
        initialSort={{ id: 'mrr', desc: true }}
        searchPlaceholder="Search customer, product…"
        filters={[
          { id: 'status', label: 'Statuses', options: [{ value: 'active', label: 'Active' }, { value: 'trial', label: 'Trial' }, { value: 'past_due', label: 'Past due' }, { value: 'cancelled', label: 'Cancelled' }], predicate: (r, v) => r.status === v },
          { id: 'product', label: 'Products', options: products.filter((p) => p.kind === 'saas').map((p) => ({ value: p.id, label: p.name })), predicate: (r, v) => r.productId === v },
          { id: 'cycle', label: 'Billing cycles', options: [{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }], predicate: (r, v) => r.billingCycle === v },
        ]}
        rowClassName={(r) => (r.status === 'cancelled' ? 'opacity-70' : undefined)}
        emptyState={<EmptyState icon={<Repeat />} title="No subscriptions" className="border-0" />}
      />
      <SubscriptionFormDialog open={form.open} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} subscription={form.sub} />
      <CancelSubscriptionDialog open={cancel.open} onOpenChange={(open) => setCancel((c) => ({ ...c, open }))} subscription={cancel.sub} label={label(cancel.sub)} />
    </>
  )
}
