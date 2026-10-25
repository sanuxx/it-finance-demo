import { useMemo } from 'react'
import { Lock, LockOpen, Hourglass } from 'lucide-react'
import type { FinancialPeriod, PeriodStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useLedgers } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { periodRepository } from '@/services'
import { subtract, sum } from '@/lib/calculations/money'
import { formatDate } from '@/lib/formatting'

export default function FinancialPeriodsPage() {
  const { periods, journalEntries } = useDbSlice('periods', 'journalEntries')
  const { revenue, expenses } = useLedgers()
  const canManage = usePermission('periods.manage')
  const confirm = useConfirm()

  const stats = useMemo(
    () =>
      new Map(
        periods.map((p) => {
          const rev = sum(revenue.filter((r) => r.date >= p.startDate && r.date <= p.endDate), (r) => r.amount)
          const exp = sum(expenses.filter((r) => r.date >= p.startDate && r.date <= p.endDate), (r) => r.amount)
          const drafts = journalEntries.filter((j) => j.status === 'draft' && j.date >= p.startDate && j.date <= p.endDate).length
          return [p.id, { rev, exp, profit: subtract(rev, exp), drafts }]
        }),
      ),
    [periods, revenue, expenses, journalEntries],
  )

  const move = async (p: FinancialPeriod, to: PeriodStatus) => {
    const drafts = stats.get(p.id)?.drafts ?? 0
    if (to === 'closed' && drafts > 0) return runWithToast(Promise.reject(new Error(`${p.name} has ${drafts} draft journal(s). Post or delete them before closing.`)))
    const reopening = to === 'open' && p.status !== 'open'
    const { confirmed, reason } = await confirm({
      title: reopening ? `Reopen ${p.name}?` : to === 'closing' ? `Start closing ${p.name}?` : `Close ${p.name}?`,
      description: reopening
        ? 'Reopening allows journals to be dated in this period again. A reason is recorded in the audit log.'
        : to === 'closed'
          ? 'Once closed, new journals cannot be dated in this period (in this demo). This is an illustrative period close — no statutory filing happens.'
          : 'Marks the period as under review before final close.',
      confirmLabel: reopening ? 'Reopen period' : to === 'closed' ? 'Close period' : 'Start closing',
      requireReason: reopening,
      reasonLabel: 'Reason for reopening',
    })
    if (confirmed) await runWithToast(periodRepository.update(p.id, { status: to, name: p.name }), reopening ? `${p.name} reopened: ${reason}` : `${p.name} → ${to}`)
  }

  const columns: DataColumn<FinancialPeriod>[] = [
    { id: 'name', header: 'Period', accessor: (p) => p.name, alwaysVisible: true, cell: (p) => <span className="font-medium">{p.name}</span> },
    { id: 'start', header: 'Start', accessor: (p) => p.startDate, cell: (p) => formatDate(p.startDate) },
    { id: 'end', header: 'End', accessor: (p) => p.endDate, cell: (p) => formatDate(p.endDate) },
    { id: 'rev', header: 'Revenue', accessor: (p) => stats.get(p.id)?.rev, align: 'right', cell: (p) => <Money value={stats.get(p.id)?.rev} /> },
    { id: 'exp', header: 'Expenses', accessor: (p) => stats.get(p.id)?.exp, align: 'right', cell: (p) => <Money value={stats.get(p.id)?.exp} /> },
    { id: 'profit', header: 'Net profit', accessor: (p) => stats.get(p.id)?.profit, align: 'right', cell: (p) => <Money value={stats.get(p.id)?.profit} signed /> },
    { id: 'drafts', header: 'Draft journals', accessor: (p) => stats.get(p.id)?.drafts, align: 'right' },
    { id: 'status', header: 'Status', accessor: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (p) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            {p.status === 'open' ? <Button size="xs" variant="outline" onClick={() => move(p, 'closing')}><Hourglass /> Start close</Button> : null}
            {p.status === 'closing' ? <Button size="xs" variant="outline" onClick={() => move(p, 'closed')}><Lock /> Close</Button> : null}
            {p.status !== 'open' ? <Button size="xs" variant="ghost" onClick={() => move(p, 'open')}><LockOpen /> Reopen</Button> : null}
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Financial periods" description="Monthly accounting periods move from open → closing → closed. Figures are derived from the demo revenue and expense ledgers." />
      <SimulatedNotice className="mb-4">Period closing is illustrative. It only prevents new demo journals from being dated in a closed period.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Open periods" value={periods.filter((p) => p.status === 'open').length} />
        <StatCard label="Closing" value={periods.filter((p) => p.status === 'closing').length} hint="Under review" />
        <StatCard label="Closed" value={periods.filter((p) => p.status === 'closed').length} />
        <StatCard label="Draft journals" value={journalEntries.filter((j) => j.status === 'draft').length} to="/finance/journals" />
      </StatGrid>
      <DataTable caption="Financial periods" data={periods} columns={columns} getRowId={(p) => p.id} initialSort={{ id: 'start', desc: true }} exportName="financial-periods" filters={[{ id: 'st', label: 'Statuses', options: ['open', 'closing', 'closed'].map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) })), predicate: (p, v) => p.status === v }]} />
    </>
  )
}
