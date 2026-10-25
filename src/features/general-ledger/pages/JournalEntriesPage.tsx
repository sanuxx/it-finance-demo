import { useState } from 'react'
import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { JournalEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { RecordSheet } from '@/components/dialogs/FormDialog'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { journalRepository } from '@/services'
import { getDb, newId, nextNumber } from '@/services/demo/demoStore'
import { todayISO } from '@/lib/dates'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'
import { journalTotals } from '../lib/ledger'
import { JournalFormDialog } from '../components/JournalFormDialog'

export default function JournalEntriesPage() {
  const entries = useCollection('journalEntries')
  const periods = useCollection('periods')
  const lookups = useLookups()
  const canPost = usePermission('ledger.post')
  const confirm = useConfirm()
  const [form, setForm] = useState<{ open: boolean; entry?: JournalEntry }>({ open: false })
  const [viewId, setViewId] = useState<string | undefined>()
  const viewing = entries.find((e) => e.id === viewId)

  const inClosedPeriod = (date: string) => periods.find((p) => p.status === 'closed' && date >= p.startDate && date <= p.endDate)

  const post = async (e: JournalEntry) => {
    const t = journalTotals(e.lines)
    if (!t.balanced) return runWithToast(Promise.reject(new Error('Journal does not balance.')))
    const closed = inClosedPeriod(e.date)
    if (closed) return runWithToast(Promise.reject(new Error(`${closed.name} is closed — reopen it or change the date.`)))
    const { confirmed } = await confirm({ title: `Post ${e.number}?`, description: 'Posting adds this illustrative journal to the general ledger view. Posted journals can only be reversed, not edited.', confirmLabel: 'Post journal' })
    if (confirmed) await runWithToast(journalRepository.update(e.id, { status: 'posted' }), `${e.number} posted (illustrative)`)
  }

  const reverse = async (e: JournalEntry) => {
    const { confirmed, reason } = await confirm({ title: `Reverse ${e.number}?`, description: 'A new posted journal with debits and credits swapped will be created, dated today. The original is marked reversed.', confirmLabel: 'Create reversal', requireReason: true, reasonLabel: 'Reason for reversal' })
    if (!confirmed) return
    const today = todayISO()
    const closed = inClosedPeriod(today)
    if (closed) return runWithToast(Promise.reject(new Error(`${closed.name} is closed.`)))
    const reversal = await runWithToast(
      journalRepository.create({
        number: nextNumber(getDb().journalEntries.map((j) => j.number), 'JE-', 5),
        date: today,
        memo: `Reversal of ${e.number}: ${reason}`,
        source: 'manual',
        sourceId: e.id,
        status: 'posted',
        lines: e.lines.map((l) => ({ ...l, id: newId('jl'), debit: l.credit, credit: l.debit })),
      }),
    )
    if (reversal) await runWithToast(journalRepository.update(e.id, { status: 'reversed' }), `${e.number} reversed by ${reversal.number}`)
  }

  const remove = async (e: JournalEntry) => {
    const { confirmed } = await confirm({ title: `Delete draft ${e.number}?`, description: 'The draft journal will be removed from this browser.', destructive: true, confirmLabel: 'Delete draft' })
    if (confirmed) {
      await runWithToast(journalRepository.remove(e.id), 'Draft deleted')
      setViewId(undefined)
    }
  }

  const columns: DataColumn<JournalEntry>[] = [
    { id: 'number', header: 'Entry', accessor: (e) => e.number, alwaysVisible: true, cell: (e) => <span className="font-mono text-xs font-medium">{e.number}</span> },
    { id: 'date', header: 'Date', accessor: (e) => e.date, cell: (e) => formatDate(e.date) },
    { id: 'memo', header: 'Memo', accessor: (e) => e.memo, cell: (e) => <span className="line-clamp-1">{e.memo}</span> },
    { id: 'source', header: 'Source', accessor: (e) => humanize(e.source) },
    { id: 'lines', header: 'Lines', accessor: (e) => e.lines.length, align: 'right', defaultHidden: true },
    { id: 'amount', header: 'Amount', accessor: (e) => journalTotals(e.lines).debit, align: 'right', cell: (e) => <Money value={journalTotals(e.lines).debit} /> },
    { id: 'status', header: 'Status', accessor: (e) => e.status, cell: (e) => <StatusBadge status={e.status} /> },
  ]

  return (
    <>
      <PageHeader title="Journal entries" description="Illustrative double-entry journals. Source journals are generated from sample invoices, payments and bills; manual journals can be added here." actions={canPost ? <Button onClick={() => setForm({ open: true })}><Plus /> New journal</Button> : null} />
      <SimulatedNotice className="mb-4" tone="warning">Demonstration ledger — postings are illustrative and stored only in this browser.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Posted" value={entries.filter((e) => e.status === 'posted').length} />
        <StatCard label="Drafts" value={entries.filter((e) => e.status === 'draft').length} hint="Awaiting posting" />
        <StatCard label="Reversed" value={entries.filter((e) => e.status === 'reversed').length} />
        <StatCard label="Manual journals" value={entries.filter((e) => e.source === 'manual').length} />
      </StatGrid>
      <DataTable
        caption="Journal entries"
        data={entries}
        columns={columns}
        getRowId={(e) => e.id}
        exportName="journal-entries"
        initialSort={{ id: 'date', desc: true }}
        onRowClick={(e) => setViewId(e.id)}
        filters={[
          { id: 'status', label: 'Statuses', options: ['draft', 'posted', 'reversed'].map((s) => ({ value: s, label: humanize(s) })), predicate: (e, v) => e.status === v },
          { id: 'source', label: 'Sources', options: ['manual', 'invoice', 'payment', 'bill', 'expense', 'depreciation', 'payroll'].map((s) => ({ value: s, label: humanize(s) })), predicate: (e, v) => e.source === v },
        ]}
      />
      <JournalFormDialog open={form.open} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} entry={form.entry} />
      <RecordSheet
        open={!!viewing}
        onOpenChange={(o) => !o && setViewId(undefined)}
        title={viewing ? `${viewing.number}` : ''}
        description={viewing?.memo}
        wide
        actions={
          viewing && canPost ? (
            <>
              {viewing.status === 'draft' ? (
                <>
                  <Button size="sm" onClick={() => post(viewing)}><CheckCircle2 /> Post</Button>
                  <Button size="sm" variant="outline" onClick={() => setForm({ open: true, entry: viewing })}><Pencil /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(viewing)}><Trash2 /> Delete</Button>
                </>
              ) : null}
              {viewing.status === 'posted' ? <Button size="sm" variant="outline" onClick={() => reverse(viewing)}><RotateCcw /> Reverse</Button> : null}
            </>
          ) : null
        }
      >
        {viewing ? (
          <>
            <DetailList items={[{ label: 'Date', value: formatDate(viewing.date) }, { label: 'Status', value: <StatusBadge status={viewing.status} /> }, { label: 'Source', value: humanize(viewing.source) }, { label: 'Total', value: <Money value={journalTotals(viewing.lines).debit} /> }]} />
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Detail</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead>
                <tbody>
                  {viewing.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{lookups.account(l.accountId)}</td>
                      <td className="text-muted-foreground p-2 text-xs">{[l.description, l.projectId && lookups.projectCode(l.projectId), l.departmentId && lookups.master(l.departmentId)].filter(Boolean).join(' · ')}</td>
                      <td className="tabular p-2 text-right">{l.debit ? formatCurrency(l.debit) : ''}</td>
                      <td className="tabular p-2 text-right">{l.credit ? formatCurrency(l.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t font-semibold"><tr><td className="p-2" colSpan={2}>Totals</td><td className="tabular p-2 text-right">{formatCurrency(journalTotals(viewing.lines).debit)}</td><td className="tabular p-2 text-right">{formatCurrency(journalTotals(viewing.lines).credit)}</td></tr></tfoot>
              </table>
            </div>
          </>
        ) : null}
      </RecordSheet>
    </>
  )
}
