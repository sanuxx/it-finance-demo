import { useMemo, useState } from 'react'
import { CheckCheck, Link2, Link2Off, Plus, Undo2 } from 'lucide-react'
import type { BankStatementLine, Payment } from '@/domain'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { RecordSheet, FormDialog } from '@/components/dialogs/FormDialog'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { Term } from '@/components/data-display/Term'
import { useDbSlice } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { bankStatementRepository } from '@/services'
import { signedPayment } from '@/lib/calculations/cash'
import { compare, round2, sum } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'

type LineStatus = 'reconciled' | 'matched' | 'unmatched'

function lineStatus(l: BankStatementLine): LineStatus {
  return l.reconciled ? 'reconciled' : l.matchedPaymentId ? 'matched' : 'unmatched'
}

export default function BankReconciliationPage() {
  const { bankAccounts, bankStatementLines, payments } = useDbSlice('bankAccounts', 'bankStatementLines', 'payments')
  const canEdit = usePermission('finance.edit')
  const withLines = bankAccounts.filter((a) => bankStatementLines.some((l) => l.bankAccountId === a.id))
  const [accountId, setAccountId] = useState(withLines[0]?.id ?? bankAccounts[0]?.id ?? '')
  const [selected, setSelected] = useState<BankStatementLine | undefined>()
  const [note, setNote] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState({ date: todayISO(), description: '', amount: '' })
  const [draftError, setDraftError] = useState('')

  const lines = useMemo(() => bankStatementLines.filter((l) => l.bankAccountId === accountId), [bankStatementLines, accountId])
  const matchedIds = useMemo(() => new Set(bankStatementLines.map((l) => l.matchedPaymentId).filter(Boolean) as string[]), [bankStatementLines])
  const windowStart = lines.reduce((m, l) => (l.date < m ? l.date : m), todayISO())
  const unmatchedBook = payments.filter((p) => p.bankAccountId === accountId && p.date >= windowStart && !matchedIds.has(p.id))
  const current = selected ? bankStatementLines.find((l) => l.id === selected.id) : undefined

  const candidates = (line: BankStatementLine): Payment[] =>
    payments
      .filter((p) => p.bankAccountId === line.bankAccountId && !matchedIds.has(p.id) && compare(signedPayment(p), line.amount) === 0)
      .sort((a, b) => Math.abs(new Date(a.date).getTime() - new Date(line.date).getTime()) - Math.abs(new Date(b.date).getTime() - new Date(line.date).getTime()))
      .slice(0, 5)

  const statementNet = sum(lines, (l) => l.amount)
  const reconciledNet = sum(lines.filter((l) => l.reconciled), (l) => l.amount)
  const unreconciledNet = sum(lines.filter((l) => !l.reconciled), (l) => l.amount)

  const update = (id: string, patch: Partial<BankStatementLine>, msg: string) => runWithToast(bankStatementRepository.update(id, patch), msg)

  const columns: DataColumn<BankStatementLine>[] = [
    { id: 'date', header: 'Date', accessor: (l) => l.date, cell: (l) => formatDate(l.date) },
    { id: 'desc', header: 'Statement description', accessor: (l) => l.description, alwaysVisible: true, cell: (l) => <span className="line-clamp-1 font-mono text-xs">{l.description}</span> },
    { id: 'amount', header: 'Amount', accessor: (l) => l.amount, align: 'right', cell: (l) => <Money value={l.amount} signed /> },
    { id: 'match', header: 'Matched payment', accessor: (l) => payments.find((p) => p.id === l.matchedPaymentId)?.number ?? '', cell: (l) => { const p = payments.find((x) => x.id === l.matchedPaymentId); return p ? <span className="text-xs">{p.number} · {formatDate(p.date)}</span> : <span className="text-muted-foreground text-xs">{l.reference && !l.matchedPaymentId ? l.reference : '—'}</span> } },
    { id: 'status', header: 'Status', accessor: (l) => lineStatus(l), cell: (l) => <StatusBadge status={lineStatus(l)} tone={lineStatus(l) === 'reconciled' ? 'success' : lineStatus(l) === 'matched' ? 'info' : 'warning'} /> },
  ]

  return (
    <>
      <PageHeader
        title="Bank reconciliation"
        description="Match simulated bank statement lines to payments recorded in the demo, then mark them reconciled."
        actions={
          <>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 w-56" aria-label="Bank account"><SelectValue /></SelectTrigger>
              <SelectContent>{bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.accountMask}</SelectItem>)}</SelectContent>
            </Select>
            {canEdit ? <Button variant="outline" onClick={() => { setDraft({ date: todayISO(), description: '', amount: '' }); setDraftError(''); setAddOpen(true) }}><Plus /> Add statement line</Button> : null}
          </>
        }
      />
      <SimulatedNotice className="mb-4">Statement lines are sample data generated for this demo (the “bank feed” integration is simulated). Reconciling here does not post anything to a real bank or ledger.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Statement net movement" value={formatCurrency(statementNet)} hint={`${lines.length} lines since ${formatDate(windowStart)}`} />
        <StatCard label="Reconciled" term="Reconciliation" value={formatCurrency(reconciledNet)} hint={`${lines.filter((l) => l.reconciled).length} lines`} />
        <StatCard label="Unreconciled difference" value={formatCurrency(unreconciledNet)} hint={`${lines.filter((l) => !l.reconciled).length} lines to review`} />
        <StatCard label="Book payments without a statement line" value={unmatchedBook.length} hint={formatCurrency(sum(unmatchedBook, signedPayment))} />
      </StatGrid>

      <DataTable
        caption="Bank statement lines"
        data={lines}
        columns={columns}
        getRowId={(l) => l.id}
        initialSort={{ id: 'date', desc: true }}
        exportName="bank-statement"
        onRowClick={(l) => { setSelected(l); setNote(l.reference ?? '') }}
        filters={[{ id: 'st', label: 'Statuses', options: [{ value: 'unmatched', label: 'Unmatched' }, { value: 'matched', label: 'Matched' }, { value: 'reconciled', label: 'Reconciled' }], predicate: (l, v) => lineStatus(l) === v }]}
        selectable={canEdit}
        bulkActions={[
          {
            label: 'Reconcile matched',
            icon: <CheckCheck />,
            disabled: (rows) => !rows.some((r) => r.matchedPaymentId && !r.reconciled),
            onClick: async (rows) => {
              const targets = rows.filter((r) => r.matchedPaymentId && !r.reconciled)
              for (const r of targets) await bankStatementRepository.update(r.id, { reconciled: true })
              await runWithToast(Promise.resolve(), `${targets.length} line(s) reconciled`)
            },
          },
        ]}
      />

      <Section className="mt-6" title="Recorded payments not yet on the statement" description="Timing differences — e.g. cheques or transfers not yet cleared.">
        {unmatchedBook.length ? (
          <ul className="divide-y text-sm">
            {unmatchedBook.slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{formatDate(p.date)} · {p.number} · {p.reference ?? humanize(p.category)}</span>
                <Money value={signedPayment(p)} signed />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Every recorded payment in this window appears on the statement.</p>
        )}
      </Section>

      <RecordSheet open={!!current} onOpenChange={(o) => !o && setSelected(undefined)} title="Statement line" description={current ? <span className="font-mono text-xs">{current.description}</span> : undefined}>
        {current ? (
          <>
            <DetailList items={[{ label: 'Date', value: formatDate(current.date) }, { label: 'Amount', value: <Money value={current.amount} signed /> }, { label: 'Status', value: <StatusBadge status={lineStatus(current)} /> }, { label: 'Reference', value: current.reference }]} />
            {current.matchedPaymentId ? (
              <Section title="Matched payment">
                {(() => {
                  const p = payments.find((x) => x.id === current.matchedPaymentId)
                  return p ? <p className="text-sm">{p.number} · {formatDate(p.date)} · {p.reference ?? humanize(p.category)} · {formatCurrency(signedPayment(p))}</p> : <p className="text-sm">Payment no longer exists.</p>
                })()}
              </Section>
            ) : (
              <Section title={<Term term="Reconciliation">Suggested matches</Term>} description="Recorded payments on this account with exactly the same amount.">
                {candidates(current).length ? (
                  <ul className="space-y-2">
                    {candidates(current).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                        <span className="min-w-0 truncate">{p.number} · {formatDate(p.date)} · {p.reference ?? humanize(p.category)}</span>
                        {canEdit ? <Button size="sm" variant="outline" onClick={() => update(current.id, { matchedPaymentId: p.id }, 'Line matched')}><Link2 /> Match</Button> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No payment with this exact amount. Bank fees or interest can be reconciled as an adjustment with a note.</p>
                )}
              </Section>
            )}
            {canEdit ? (
              <div className="space-y-2">
                <Label htmlFor="recon-note">Adjustment note</Label>
                <Textarea id="recon-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Monthly bank service charge" />
                <div className="flex flex-wrap gap-2">
                  {current.matchedPaymentId && !current.reconciled ? <Button size="sm" onClick={() => update(current.id, { reconciled: true }, 'Line reconciled')}><CheckCheck /> Mark reconciled</Button> : null}
                  {!current.matchedPaymentId && !current.reconciled ? (
                    <Button size="sm" disabled={!note.trim()} onClick={() => update(current.id, { reconciled: true, reference: `Adjustment: ${note.trim().replace(/^Adjustment:\s*/, '')}` }, 'Reconciled as adjustment')}>
                      <CheckCheck /> Reconcile as adjustment
                    </Button>
                  ) : null}
                  {current.reconciled ? <Button size="sm" variant="outline" onClick={() => update(current.id, { reconciled: false }, 'Reconciliation undone')}><Undo2 /> Undo reconcile</Button> : null}
                  {current.matchedPaymentId && !current.reconciled ? <Button size="sm" variant="outline" onClick={() => update(current.id, { matchedPaymentId: undefined }, 'Match removed')}><Link2Off /> Unmatch</Button> : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </RecordSheet>

      <FormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add statement line (simulated)"
        description="Simulates a line arriving from a bank feed. Positive = money in, negative = money out."
        submitLabel="Add line"
        onSubmit={async (e) => {
          e.preventDefault()
          const amount = Number(draft.amount)
          if (!draft.description.trim()) return setDraftError('Enter a description.')
          if (!Number.isFinite(amount) || amount === 0) return setDraftError('Enter a non-zero amount.')
          await runWithToast(bankStatementRepository.create({ bankAccountId: accountId, date: draft.date, description: draft.description.trim().toUpperCase(), amount: round2(amount), reconciled: false }), 'Statement line added')
          setAddOpen(false)
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="sl-date">Date</Label><Input id="sl-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="sl-amt">Amount (LKR)</Label><Input id="sl-amt" type="number" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sl-desc">Description</Label><Input id="sl-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          {draftError ? <p role="alert" className="text-destructive text-xs sm:col-span-2">{draftError}</p> : null}
        </div>
      </FormDialog>
    </>
  )
}
