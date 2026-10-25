import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import type { ExpenseClaim, Payment } from '@/domain'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useDbSlice, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useAction } from '@/hooks/useAction'
import { expenseRepository } from '@/services'
import { bankBalance } from '@/lib/calculations/cash'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { useVisibleExpenses } from '../lib/useExpenseHelpers'

export default function ReimbursementsPage() {
  const { claims } = useVisibleExpenses()
  const { payments, bankAccounts } = useDbSlice('payments', 'bankAccounts')
  const employees = useCollection('employees')
  const lookups = useLookups()
  const navigate = useNavigate()
  const canPay = usePermission('payments.record')
  const [batch, setBatch] = useState<ExpenseClaim[] | null>(null)
  const [bankId, setBankId] = useState(bankAccounts.find((b) => b.id === 'bank-payroll')?.id ?? bankAccounts[0]?.id ?? '')

  const approved = claims.filter((c) => c.status === 'approved')
  const reimbursed = claims.filter((c) => c.status === 'reimbursed')
  const runs = payments.filter((p) => p.category === 'reimbursement')
  const byEmployee = new Set(approved.map((c) => c.employeeId)).size

  const run = useAction(async (ids: string[]) => expenseRepository.reimburse(ids, bankId), { success: (p) => `Simulated reimbursement ${p?.number ?? ''} recorded — no money was transferred` })

  const claimColumns: DataColumn<ExpenseClaim>[] = [
    { id: 'number', header: 'Claim', accessor: (c) => c.number, alwaysVisible: true, cell: (c) => <div><div className="font-medium">{c.number}</div><div className="text-muted-foreground line-clamp-1 text-xs">{c.description}</div></div> },
    { id: 'employee', header: 'Claimant', accessor: (c) => lookups.employee(c.employeeId) },
    { id: 'date', header: 'Date', accessor: (c) => c.date, cell: (c) => formatDate(c.date) },
    { id: 'approved', header: 'Approved', accessor: (c) => [...c.history].reverse().find((h) => h.status === 'approved')?.at ?? '', cell: (c) => formatDate([...c.history].reverse().find((h) => h.status === 'approved')?.at) },
    { id: 'category', header: 'Category', accessor: (c) => lookups.master(c.categoryId) },
    { id: 'amount', header: 'Amount', accessor: (c) => c.amount, align: 'right', cell: (c) => <Money value={c.amount} /> },
  ]

  const runColumns: DataColumn<Payment>[] = [
    { id: 'number', header: 'Payment', accessor: (p) => p.number, alwaysVisible: true },
    { id: 'date', header: 'Date', accessor: (p) => p.date, cell: (p) => formatDate(p.date) },
    { id: 'ref', header: 'Reference', accessor: (p) => p.reference },
    { id: 'account', header: 'From account', accessor: (p) => lookups.bankAccount(p.bankAccountId) },
    { id: 'amount', header: 'Amount', accessor: (p) => p.amount, align: 'right', cell: (p) => <Money value={p.amount} /> },
  ]

  const batchTotal = batch ? sum(batch, (c) => c.amount) : 0
  const bank = bankAccounts.find((b) => b.id === bankId)
  const available = bank ? bankBalance(bank, payments) : 0

  return (
    <>
      <PageHeader
        title="Reimbursements"
        description="Approved expense claims waiting to be repaid to employees, and past reimbursement runs."
        actions={canPay ? <Button disabled={!approved.length} onClick={() => setBatch(approved)}><Banknote /> Reimburse all approved</Button> : null}
      />
      <SimulatedNotice className="mb-4">Reimbursement runs are simulated: they create a payment record in this browser only. No bank transfer is made.</SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Awaiting reimbursement" value={formatCurrency(sum(approved, (c) => c.amount))} hint={`${approved.length} claims · ${byEmployee} people`} />
        <StatCard label="Reimbursed (all time)" value={formatCurrency(sum(reimbursed, (c) => c.amount))} hint={`${reimbursed.length} claims`} />
        <StatCard label="Reimbursement runs" value={runs.length} to="/finance/transactions" />
        <StatCard label="Active claimants" value={new Set(claims.map((c) => c.employeeId)).size} hint={`of ${employees.length} people`} />
      </StatGrid>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Awaiting ({approved.length})</TabsTrigger>
          <TabsTrigger value="runs">Past runs ({runs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-3">
          <DataTable
            caption="Approved claims awaiting reimbursement"
            data={approved}
            columns={claimColumns}
            getRowId={(c) => c.id}
            exportName="claims-awaiting-reimbursement"
            initialSort={{ id: 'date' }}
            onRowClick={(c) => navigate(`/finance/expenses/${c.id}`)}
            selectable={canPay}
            bulkActions={[{ label: 'Reimburse selected', icon: <Banknote />, variant: 'default', onClick: (rows) => setBatch(rows) }]}
            emptyState={<EmptyState title="Nothing to reimburse" description="Approved claims will appear here." className="border-0" />}
          />
        </TabsContent>
        <TabsContent value="runs" className="mt-3">
          <DataTable caption="Reimbursement runs" data={runs} columns={runColumns} getRowId={(p) => p.id} exportName="reimbursement-runs" initialSort={{ id: 'date', desc: true }} />
        </TabsContent>
      </Tabs>
      <FormDialog
        open={!!batch}
        onOpenChange={(o) => !o && setBatch(null)}
        title="Run simulated reimbursement"
        description={`${batch?.length ?? 0} claim(s) totalling ${formatCurrency(batchTotal)}.`}
        submitLabel="Record simulated payment"
        pending={run.pending}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!batch) return
          if (await run.run(batch.map((c) => c.id))) setBatch(null)
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="reimb-bank">Pay from (simulated)</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger id="reimb-bank" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{bankAccounts.filter((b) => b.active).map((b) => <SelectItem key={b.id} value={b.id}>{b.name} · {b.accountMask}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">Simulated balance {formatCurrency(available)}{available < batchTotal ? ' — insufficient for this run in the demo, but the record will still be created.' : ''}</p>
        </div>
        <ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
          {batch?.map((c) => (
            <li key={c.id} className="flex justify-between gap-2 px-3 py-1.5"><span className="truncate">{c.number} · {lookups.employee(c.employeeId)}</span><Money value={c.amount} /></li>
          ))}
        </ul>
        <SimulatedNotice tone="warning">No money will be transferred.</SimulatedNotice>
      </FormDialog>
    </>
  )
}
