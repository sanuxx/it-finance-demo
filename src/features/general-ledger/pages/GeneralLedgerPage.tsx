import { useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { RecordSheet } from '@/components/dialogs/FormDialog'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useLookups } from '@/hooks/useData'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'
import { accountSummaries, journalTotals, postedLines, withRunningBalance, type AccountSummary } from '../lib/ledger'

export default function GeneralLedgerPage() {
  const { accounts, journalEntries, periods } = useDbSlice('accounts', 'journalEntries', 'periods')
  const lookups = useLookups()
  const [periodId, setPeriodId] = useState('all')
  const [viewing, setViewing] = useState<AccountSummary | undefined>()
  const period = periods.find((p) => p.id === periodId)
  const lines = useMemo(() => postedLines(journalEntries, period?.startDate, period?.endDate), [journalEntries, period])
  const summaries = useMemo(() => accountSummaries(accounts, lines).filter((s) => s.lines > 0 || s.account.active), [accounts, lines])
  const totals = journalTotals(lines)

  const columns: DataColumn<AccountSummary>[] = [
    { id: 'code', header: 'Code', accessor: (s) => s.account.code },
    { id: 'name', header: 'Account', accessor: (s) => s.account.name, alwaysVisible: true, cell: (s) => <span className="font-medium">{s.account.name}</span> },
    { id: 'type', header: 'Type', accessor: (s) => s.account.type, cell: (s) => humanize(s.account.type) },
    { id: 'lines', header: 'Lines', accessor: (s) => s.lines, align: 'right' },
    { id: 'debit', header: 'Debits', accessor: (s) => s.debit, align: 'right', cell: (s) => <Money value={s.debit} />, footer: formatCurrency(totals.debit) },
    { id: 'credit', header: 'Credits', accessor: (s) => s.credit, align: 'right', cell: (s) => <Money value={s.credit} />, footer: formatCurrency(totals.credit) },
    { id: 'balance', header: 'Balance', accessor: (s) => s.balance, align: 'right', cell: (s) => <Money value={s.balance} signed /> },
  ]

  const accountLines = viewing ? withRunningBalance(lines.filter((l) => l.accountId === viewing.account.id), viewing.account.type) : []

  return (
    <>
      <PageHeader
        title="General ledger"
        description="Account activity built from posted journal entries. Draft journals are excluded."
        actions={
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="h-9 w-52" aria-label="Financial period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {[...periods].reverse().map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <SimulatedNotice className="mb-4" tone="warning">Illustrative ledger only. The sample journals cover recent invoices, payments and bills — this is not a complete or legally compliant accounting record, and browser storage is not a secure ledger.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Total debits" value={formatCurrency(totals.debit)} />
        <StatCard label="Total credits" value={formatCurrency(totals.credit)} />
        <StatCard label="Difference" term="Trial balance" value={formatCurrency(totals.difference)} hint={totals.difference === 0 ? 'Debits equal credits' : 'Out of balance'} />
        <StatCard label="Journal lines" value={lines.length} hint={`${new Set(lines.map((l) => l.entryId)).size} posted entries`} to="/finance/journals" />
      </StatGrid>
      <DataTable
        caption="Ledger accounts"
        data={summaries}
        columns={columns}
        getRowId={(s) => s.account.id}
        exportName="general-ledger"
        initialSort={{ id: 'code' }}
        onRowClick={setViewing}
        showFooter
        pageSize={50}
        filters={[{ id: 'type', label: 'Types', options: ['asset', 'liability', 'equity', 'income', 'expense'].map((t) => ({ value: t, label: humanize(t) })), predicate: (s, v) => s.account.type === v }, { id: 'activity', label: 'Activity', options: [{ value: 'with', label: 'With activity' }], predicate: (s) => s.lines > 0 }]}
      />
      <RecordSheet open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)} title={viewing ? `${viewing.account.code} · ${viewing.account.name}` : ''} description={viewing ? `${humanize(viewing.account.type)} · ${viewing.account.subtype} · balance ${formatCurrency(viewing.balance)}` : undefined} wide>
        {accountLines.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Entry</th><th className="p-2 text-left">Memo</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Balance</th></tr>
              </thead>
              <tbody>
                {accountLines.map((l) => (
                  <tr key={`${l.entryId}-${l.id}`} className="border-t">
                    <td className="p-2 whitespace-nowrap">{formatDate(l.date)}</td>
                    <td className="p-2"><span className="font-mono text-xs">{l.entryNumber}</span> <StatusBadge status={l.source} tone="neutral" className="ml-1" /></td>
                    <td className="p-2">{l.description ?? l.memo}{l.projectId ? <span className="text-muted-foreground block text-xs">{lookups.projectCode(l.projectId)}</span> : null}</td>
                    <td className="tabular p-2 text-right">{l.debit ? formatCurrency(l.debit) : ''}</td>
                    <td className="tabular p-2 text-right">{l.credit ? formatCurrency(l.credit) : ''}</td>
                    <td className="tabular p-2 text-right">{formatCurrency(l.running)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t font-semibold">
                <tr><td className="p-2" colSpan={3}>Total</td><td className="tabular p-2 text-right">{formatCurrency(sum(accountLines, (l) => l.debit))}</td><td className="tabular p-2 text-right">{formatCurrency(sum(accountLines, (l) => l.credit))}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No posted lines for this account in the selected period.</p>
        )}
      </RecordSheet>
    </>
  )
}
