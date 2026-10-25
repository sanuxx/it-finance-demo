import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useLookups } from '@/hooks/useData'
import { signedPayment } from '@/lib/calculations/cash'
import { subtract, sum } from '@/lib/calculations/money'
import { inRange, presetRange, type DatePreset } from '@/lib/dates'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'

interface TxRow {
  id: string
  date: string
  source: 'payment' | 'statement'
  direction: 'incoming' | 'outgoing'
  category: string
  description: string
  counterparty: string
  amount: number
  accountId: string
  reference?: string
  link?: string
  status: string
}

export default function TransactionsPage() {
  const { payments, bankStatementLines } = useDbSlice('payments', 'bankStatementLines')
  const lookups = useLookups()
  const navigate = useNavigate()
  const [preset, setPreset] = useState<DatePreset>('last_3_months')
  const range = presetRange(preset)

  const rows = useMemo<TxRow[]>(() => {
    const out: TxRow[] = payments.map((p) => ({
      id: p.id,
      date: p.date,
      source: 'payment',
      direction: p.direction,
      category: p.category,
      description: p.reference ?? p.number,
      counterparty: p.customerId ? lookups.customer(p.customerId) : p.supplierId ? lookups.supplier(p.supplierId) : humanize(p.category),
      amount: signedPayment(p),
      accountId: p.bankAccountId,
      reference: p.number,
      link: p.invoiceId ? `/sales/invoices/${p.invoiceId}` : p.billId ? '/procurement/bills' : undefined,
      status: 'recorded',
    }))
    // Statement-only lines (bank fees, interest) are not payments yet — include them so all movements are visible.
    for (const l of bankStatementLines) {
      if (l.matchedPaymentId) continue
      out.push({
        id: l.id,
        date: l.date,
        source: 'statement',
        direction: l.amount >= 0 ? 'incoming' : 'outgoing',
        category: 'bank_statement',
        description: l.description,
        counterparty: 'Bank',
        amount: l.amount,
        accountId: l.bankAccountId,
        reference: l.reference,
        link: '/finance/reconciliation',
        status: l.reconciled ? 'reconciled' : 'unmatched',
      })
    }
    return out
  }, [payments, bankStatementLines, lookups])

  const visible = useMemo(() => rows.filter((r) => inRange(r.date, range.from, range.to)), [rows, range.from, range.to])
  const inflow = sum(visible.filter((r) => r.amount > 0), (r) => r.amount)
  const outflow = sum(visible.filter((r) => r.amount < 0), (r) => -r.amount)
  const categories = [...new Set(rows.map((r) => r.category))]

  const columns: DataColumn<TxRow>[] = [
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'description', header: 'Description', accessor: (r) => r.description, alwaysVisible: true, cell: (r) => <span className="line-clamp-1">{r.description}</span> },
    { id: 'counterparty', header: 'Counterparty', accessor: (r) => r.counterparty },
    { id: 'category', header: 'Type', accessor: (r) => humanize(r.category) },
    { id: 'account', header: 'Account', accessor: (r) => lookups.bankAccount(r.accountId) },
    { id: 'ref', header: 'Reference', accessor: (r) => r.reference, defaultHidden: true },
    { id: 'source', header: 'Source', accessor: (r) => r.source, cell: (r) => <StatusBadge status={r.status} tone={r.source === 'payment' ? 'neutral' : r.status === 'reconciled' ? 'success' : 'warning'} label={r.source === 'payment' ? 'Recorded payment' : `Bank line · ${r.status}`} /> },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} signed /> },
  ]

  return (
    <>
      <PageHeader title="Financial transactions" description="Every simulated money movement: customer receipts, supplier payments, payroll, card settlements, reimbursements and bank-only items." actions={<DateRangeSelect value={preset} onChange={setPreset} />} />
      <SimulatedNotice className="mb-4">All transactions are simulated records stored in this browser. No money has been moved.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Money in" value={formatCurrency(inflow)} />
        <StatCard label="Money out" value={formatCurrency(outflow)} />
        <StatCard label="Net cash flow" value={formatCurrency(subtract(inflow, outflow))} />
        <StatCard label="Transactions" value={visible.length} hint="In the selected range" />
      </StatGrid>
      <DataTable
        caption="Transactions"
        data={visible}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="transactions"
        initialSort={{ id: 'date', desc: true }}
        onRowClick={(r) => r.link && navigate(r.link)}
        filters={[
          { id: 'dir', label: 'Directions', options: [{ value: 'incoming', label: 'Money in' }, { value: 'outgoing', label: 'Money out' }], predicate: (r, v) => r.direction === v },
          { id: 'cat', label: 'Types', options: categories.map((c) => ({ value: c, label: humanize(c) })), predicate: (r, v) => r.category === v },
          { id: 'src', label: 'Sources', options: [{ value: 'payment', label: 'Recorded payments' }, { value: 'statement', label: 'Bank-only lines' }], predicate: (r, v) => r.source === v },
        ]}
      />
    </>
  )
}
