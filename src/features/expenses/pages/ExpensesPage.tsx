import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Flag, MoreHorizontal, Paperclip, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import type { ExpenseClaim, ExpenseStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useLookups, useMasterList } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { ExpenseFormDialog } from '../components/ExpenseFormDialog'
import { useExpenseActions, useMyEmployeeId, useVisibleExpenses } from '../lib/useExpenseHelpers'

const STATUSES: ExpenseStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'reimbursed']

export default function ExpensesPage() {
  const { claims, scope } = useVisibleExpenses()
  const lookups = useLookups()
  const categories = useMasterList('expenseCategories')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const statusParam = params.get('status') ?? undefined
  const canApprove = usePermission('expenses.approve')
  const canSubmit = usePermission('expenses.submit')
  const mine = useMyEmployeeId()
  const actions = useExpenseActions()
  const [form, setForm] = useState<{ open: boolean; claim?: ExpenseClaim }>({ open: false })

  const pending = claims.filter((c) => c.status === 'submitted')
  const thisYear = todayISO().slice(0, 4)
  const approvedYtd = claims.filter((c) => (c.status === 'approved' || c.status === 'reimbursed') && c.date.startsWith(thisYear))
  const awaitingReimbursement = claims.filter((c) => c.status === 'approved')
  const canEditClaim = (c: ExpenseClaim) => (c.status === 'draft' || c.status === 'rejected') && (canApprove || c.employeeId === mine || scope === 'all')
  const usedCategories = useMemo(() => [...new Set(claims.map((c) => c.categoryId))], [claims])

  const columns: DataColumn<ExpenseClaim>[] = [
    {
      id: 'number', header: 'Claim', accessor: (c) => c.number, alwaysVisible: true,
      cell: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            {c.number}
            {c.flaggedForReview ? <Flag className="text-warning size-3.5" aria-label="Flagged for review by a business rule" /> : null}
            {c.receipts.length ? <Paperclip className="text-muted-foreground size-3" aria-label={`${c.receipts.length} receipt(s)`} /> : null}
          </div>
          <div className="text-muted-foreground line-clamp-1 text-xs">{c.description}</div>
        </div>
      ),
    },
    { id: 'description', header: 'Description', accessor: (c) => c.description, defaultHidden: true },
    { id: 'employee', header: 'Claimant', accessor: (c) => lookups.employee(c.employeeId) },
    { id: 'date', header: 'Date', accessor: (c) => c.date, cell: (c) => formatDate(c.date) },
    { id: 'category', header: 'Category', accessor: (c) => lookups.master(c.categoryId) },
    { id: 'project', header: 'Project', accessor: (c) => (c.projectId ? lookups.projectCode(c.projectId) : ''), cell: (c) => (c.projectId ? lookups.projectCode(c.projectId) : <span className="text-muted-foreground">—</span>) },
    { id: 'department', header: 'Department', accessor: (c) => lookups.master(c.departmentId), defaultHidden: true },
    { id: 'billable', header: 'Billable', accessor: (c) => (c.billable ? 'Yes' : 'No'), defaultHidden: true },
    { id: 'amount', header: 'Amount', accessor: (c) => c.amount, align: 'right', cell: (c) => <Money value={c.amount} /> },
    { id: 'status', header: 'Status', accessor: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.number}`}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/finance/expenses/${c.id}`)}>Open details</DropdownMenuItem>
            {canEditClaim(c) ? <DropdownMenuItem onSelect={() => setForm({ open: true, claim: c })}><Pencil /> Edit</DropdownMenuItem> : null}
            {canEditClaim(c) ? <DropdownMenuItem onSelect={() => actions.submit(c)}><Send /> Submit for approval</DropdownMenuItem> : null}
            {canApprove && c.status === 'submitted' ? (
              <>
                <DropdownMenuItem onSelect={() => actions.approve(c)}><Check /> Approve</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.reject(c)}><X /> Reject</DropdownMenuItem>
              </>
            ) : null}
            {canEditClaim(c) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => actions.remove(c)}><Trash2 /> Delete</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={scope === 'mine' ? 'My expense claims' : 'Expense claims'}
        description={scope === 'mine' ? 'Your claims only — the Employee role sees its own records in this demo.' : 'Employee expense claims, approvals and status history.'}
        actions={canSubmit ? <Button onClick={() => setForm({ open: true })}><Plus /> New claim</Button> : null}
      />
      <StatGrid className="mb-6">
        <StatCard label="Awaiting approval" value={pending.length} hint={formatCurrency(sum(pending, (c) => c.amount))} to="/finance/expenses?status=submitted" />
        <StatCard label="Approved this year" value={formatCurrency(sum(approvedYtd, (c) => c.amount))} hint={`${approvedYtd.length} claims`} />
        <StatCard label="Awaiting reimbursement" value={formatCurrency(sum(awaitingReimbursement, (c) => c.amount))} hint={`${awaitingReimbursement.length} approved claims`} to="/finance/reimbursements" />
        <StatCard label="Flagged by rules" value={claims.filter((c) => c.flaggedForReview && c.status === 'submitted').length} hint="Pending claims needing review" to="/config/rules" />
      </StatGrid>
      {scope === 'mine' && !mine ? <SimulatedNotice className="mb-4" tone="warning">The current demo user has no employee cost profile, so there are no personal claims to show.</SimulatedNotice> : null}
      <DataTable
        key={statusParam ?? 'all'}
        caption="Expense claims"
        data={claims}
        columns={columns}
        getRowId={(c) => c.id}
        exportName="expense-claims"
        initialSort={{ id: 'date', desc: true }}
        onRowClick={(c) => navigate(`/finance/expenses/${c.id}`)}
        selectable={canApprove}
        bulkActions={[
          { label: 'Approve', icon: <Check />, variant: 'default', disabled: (rows) => !rows.some((r) => r.status === 'submitted'), onClick: actions.bulkApprove },
          { label: 'Reject', icon: <X />, disabled: (rows) => !rows.some((r) => r.status === 'submitted'), onClick: actions.bulkReject },
        ]}
        filters={[
          { id: 'status', label: 'Statuses', options: STATUSES.map((s) => ({ value: s, label: humanize(s) })), predicate: (c, v) => c.status === v, defaultValue: statusParam },
          { id: 'category', label: 'Categories', options: categories.filter((m) => usedCategories.includes(m.id)).map((m) => ({ value: m.id, label: m.name })), predicate: (c, v) => c.categoryId === v },
          { id: 'flag', label: 'Flags', options: [{ value: 'flagged', label: 'Flagged for review' }, { value: 'billable', label: 'Billable' }, { value: 'noreceipt', label: 'Missing receipt' }], predicate: (c, v) => (v === 'flagged' ? !!c.flaggedForReview : v === 'billable' ? c.billable : c.receipts.length === 0) },
        ]}
        emptyState={<EmptyState title="No expense claims yet" description="Create a claim to see the approval flow in action." className="border-0" />}
      />
      <ExpenseFormDialog open={form.open} onOpenChange={(open) => setForm((f) => ({ ...f, open }))} claim={form.claim} />
    </>
  )
}
