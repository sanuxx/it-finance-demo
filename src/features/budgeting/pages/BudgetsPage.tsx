import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, MoreHorizontal, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import type { Budget, BudgetScope } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { budgetRepository } from '@/services'
import type { BudgetActuals } from '@/lib/calculations/budgets'
import { percentOf, sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { SCOPE_LABELS, useAllBudgetActuals } from '../lib/budgetData'
import { BudgetFormDialog } from '../components/BudgetFormDialog'

type Tab = 'all' | BudgetScope | 'revenue'

interface Row {
  budget: Budget
  a: BudgetActuals
}

export default function BudgetsPage() {
  const budgets = useCollection('budgets')
  const actuals = useAllBudgetActuals()
  const lookups = useLookups()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const canEdit = usePermission('budgets.edit')
  const [tab, setTab] = useState<Tab>('all')
  const [dialog, setDialog] = useState<{ open: boolean; budget?: Budget }>({ open: false })

  const rows = useMemo<Row[]>(() => budgets.map((b) => ({ budget: b, a: actuals.get(b.id)! })).filter((r) => r.a), [budgets, actuals])
  const visible = useMemo(() => rows.filter((r) => (tab === 'all' ? true : tab === 'revenue' ? r.budget.kind === 'revenue' : r.budget.scope === tab && r.budget.kind === 'expense')), [rows, tab])

  const year = Number(todayISO().slice(0, 4))
  const company = rows.find((r) => r.budget.scope === 'company' && r.budget.kind === 'expense' && r.budget.status === 'approved' && r.budget.fiscalYear === year)
  const revenue = rows.find((r) => r.budget.kind === 'revenue' && r.budget.status === 'approved' && r.budget.fiscalYear === year)
  const approvedExpense = rows.filter((r) => r.budget.status === 'approved' && r.budget.kind === 'expense')
  const pending = rows.filter((r) => r.budget.status === 'submitted' || r.budget.status === 'revision').length

  const remove = async (b: Budget) => {
    const { confirmed } = await confirm({ title: `Delete ${b.name}?`, description: 'This removes the budget and its lines from this browser. Actual records are not affected.', destructive: true, confirmLabel: 'Delete budget' })
    if (confirmed) await runWithToast(budgetRepository.remove(b.id), 'Budget deleted')
  }
  const duplicate = async (b: Budget) => {
    const created = await runWithToast(budgetRepository.duplicate(b.id, b.fiscalYear + 1), `Draft created for FY${b.fiscalYear + 1}`)
    if (created) navigate(`/planning/budgets/${created.id}`)
  }

  const columns: DataColumn<Row>[] = [
    { id: 'name', header: 'Budget', accessor: (r) => r.budget.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.budget.name}</div><div className="text-muted-foreground text-xs">{formatDate(r.budget.periodStart)} – {formatDate(r.budget.periodEnd)}</div></div> },
    { id: 'scope', header: 'Scope', accessor: (r) => (r.budget.kind === 'revenue' ? 'Revenue' : SCOPE_LABELS[r.budget.scope]) },
    { id: 'owner', header: 'Owner / unit', accessor: (r) => (r.budget.projectId ? lookups.project(r.budget.projectId) : r.budget.departmentId ? lookups.master(r.budget.departmentId) : 'Company-wide'), cell: (r) => <div><div>{r.budget.projectId ? lookups.project(r.budget.projectId) : r.budget.departmentId ? lookups.master(r.budget.departmentId) : 'Company-wide'}</div><div className="text-muted-foreground text-xs">{lookups.user(r.budget.ownerId)}</div></div> },
    { id: 'fy', header: 'FY', accessor: (r) => r.budget.fiscalYear, align: 'right', defaultHidden: true },
    { id: 'total', header: 'Budget', accessor: (r) => r.a.total, align: 'right', cell: (r) => <Money value={r.a.total} /> },
    { id: 'actual', header: 'Actual', accessor: (r) => r.a.actual, align: 'right', cell: (r) => <Money value={r.a.actual} /> },
    { id: 'remaining', header: 'Remaining', accessor: (r) => r.a.remaining, align: 'right', cell: (r) => <Money value={r.a.remaining} signed /> },
    { id: 'util', header: 'Utilisation', accessor: (r) => r.a.utilisationPercent ?? -1, cell: (r) => <ProgressBar value={r.a.utilisationPercent} label={`Utilisation of ${r.budget.name}`} className="w-32" /> },
    { id: 'pace', header: 'Pacing', accessor: (r) => r.a.status, cell: (r) => (r.budget.kind === 'revenue' ? <StatusBadge status={r.a.status} label={r.a.status === 'under' ? 'Behind plan' : r.a.status === 'exceeded' ? 'Target exceeded' : r.a.status === 'over_pace' ? 'Ahead of plan' : 'On plan'} tone={r.a.status === 'under' ? 'warning' : 'success'} /> : <StatusBadge status={r.a.status} />) },
    { id: 'status', header: 'Status', accessor: (r) => r.budget.status, cell: (r) => <StatusBadge status={r.budget.status} /> },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      cell: (r) =>
        canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.budget.name}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem disabled={r.budget.status === 'approved' || r.budget.status === 'submitted'} onSelect={() => setDialog({ open: true, budget: r.budget })}><Pencil /> Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicate(r.budget)}><Copy /> Duplicate to FY{r.budget.fiscalYear + 1}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={r.budget.status === 'approved'} onSelect={() => remove(r.budget)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Approved budgets compared with eligible actual expenditure (or revenue) calculated from demo records."
        actions={canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> New budget</Button> : null}
      />
      <StatGrid className="mb-6">
        <StatCard label={`FY${year} operating budget`} term="Budget utilisation" value={company ? formatCurrency(company.a.total) : '—'} hint={company ? `${company.a.utilisationPercent ?? 0}% used · ${company.a.elapsedPercent.toFixed(0)}% of year elapsed` : 'No approved company budget'} to={company ? `/planning/budgets/${company.budget.id}` : undefined} />
        <StatCard label={`FY${year} revenue plan`} value={revenue ? formatCurrency(revenue.a.actual) : '—'} hint={revenue ? `${revenue.a.utilisationPercent ?? 0}% of ${formatCurrency(revenue.a.total, 'LKR', { compact: true })} target` : 'No approved revenue plan'} to={revenue ? `/planning/budgets/${revenue.budget.id}` : undefined} />
        <StatCard label="Approved expense budgets" value={formatCurrency(sum(approvedExpense, (r) => r.a.remaining))} hint={`Remaining across ${approvedExpense.length} budgets · ${percentOf(sum(approvedExpense, (r) => r.a.actual), sum(approvedExpense, (r) => r.a.total)) ?? 0}% used`} />
        <StatCard label="Awaiting decision" value={pending} hint="Submitted or in revision" to="/approvals" />
      </StatGrid>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="department">Department</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="cloud">Cloud & AI</TabsTrigger>
          <TabsTrigger value="personnel">Personnel</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        key={tab}
        caption="Budgets"
        data={visible}
        columns={columns}
        getRowId={(r) => r.budget.id}
        exportName="budgets"
        onRowClick={(r) => navigate(`/planning/budgets/${r.budget.id}`)}
        searchPlaceholder="Search budgets…"
        filters={[
          { id: 'status', label: 'Statuses', options: ['draft', 'submitted', 'approved', 'revision'].map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) })), predicate: (r, v) => r.budget.status === v },
          { id: 'fy', label: 'Fiscal years', options: [...new Set(budgets.map((b) => b.fiscalYear))].sort().map((y) => ({ value: String(y), label: `FY${y}` })), predicate: (r, v) => String(r.budget.fiscalYear) === v },
        ]}
        emptyState={<EmptyState icon={<Target />} title="No budgets in this view" description="Create a budget to track spending against plan." className="border-0" />}
      />
      <BudgetFormDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} budget={dialog.budget} onSaved={(b) => !dialog.budget && navigate(`/planning/budgets/${b.id}`)} />
    </>
  )
}
