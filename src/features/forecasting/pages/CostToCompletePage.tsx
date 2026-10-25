import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Save } from 'lucide-react'
import type { Project } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { Term } from '@/components/data-display/Term'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useDbSlice, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { projectRepository } from '@/services'
import { projectFinancials, type ProjectFinancials } from '@/lib/calculations/projects'
import { subtract, sum } from '@/lib/calculations/money'
import { formatCurrency } from '@/lib/formatting'
import { cn } from '@/lib/utils'

interface Row {
  project: Project
  saved: ProjectFinancials
  whatIf: ProjectFinancials
  pct: number
  changed: boolean
}

export default function CostToCompletePage() {
  const db = useDbSlice('projects', 'projectCosts', 'timesheets', 'employees', 'expenses', 'supplierBills', 'cloudCosts', 'aiUsage', 'invoices', 'payments', 'creditNotes')
  const lookups = useLookups()
  const canEdit = usePermission('projects.edit')
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const rows = useMemo<Row[]>(
    () =>
      db.projects
        .filter((p) => p.status === 'active' || p.status === 'on_hold' || p.status === 'planning')
        .map((p) => {
          const pct = overrides[p.id] ?? p.percentComplete
          const saved = projectFinancials(p, db)
          const whatIf = pct === p.percentComplete ? saved : projectFinancials({ ...p, percentComplete: pct }, db)
          return { project: p, saved, whatIf, pct, changed: pct !== p.percentComplete }
        }),
    [db, overrides],
  )

  const totals = useMemo(
    () => ({
      budget: sum(rows, (r) => r.project.budget),
      actual: sum(rows, (r) => r.whatIf.actualCost),
      eac: sum(rows, (r) => r.whatIf.forecastCost),
      ctc: sum(rows, (r) => r.whatIf.costToComplete),
    }),
    [rows],
  )

  const setPct = (id: string, value: string) => {
    const n = Number(value)
    if (value === '' || Number.isNaN(n)) return
    setOverrides((o) => ({ ...o, [id]: Math.max(0, Math.min(100, Math.round(n))) }))
  }

  const clearOverride = (id: string) =>
    setOverrides((o) => {
      const next = { ...o }
      delete next[id]
      return next
    })

  const save = async (r: Row) => {
    const done = await runWithToast(projectRepository.update(r.project.id, { percentComplete: r.pct }), `Saved ${r.pct}% complete for ${r.project.code}`)
    if (done) clearOverride(r.project.id)
  }

  const columns: DataColumn<Row>[] = [
    { id: 'project', header: 'Project', accessor: (r) => r.project.name, alwaysVisible: true, cell: (r) => <Link to={`/projects/${r.project.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}><div className="font-medium">{r.project.name}</div><div className="text-muted-foreground text-xs">{r.project.code} · {lookups.customer(r.project.customerId)}</div></Link> },
    { id: 'status', header: 'Status', accessor: (r) => r.project.status, cell: (r) => <StatusBadge status={r.project.status} /> },
    { id: 'budget', header: 'Budget', accessor: (r) => r.project.budget, align: 'right', cell: (r) => <Money value={r.project.budget} /> },
    { id: 'actual', header: 'Actual cost', accessor: (r) => r.whatIf.actualCost, align: 'right', cell: (r) => <Money value={r.whatIf.actualCost} /> },
    { id: 'committed', header: 'Committed', accessor: (r) => r.whatIf.committedCost, align: 'right', cell: (r) => <Money value={r.whatIf.committedCost} />, defaultHidden: true },
    {
      id: 'pct',
      header: '% complete (what-if)',
      accessor: (r) => r.pct,
      align: 'right',
      searchable: false,
      cell: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Input type="number" min={0} max={100} step={1} value={r.pct} onChange={(e) => setPct(r.project.id, e.target.value)} className={cn('tabular h-8 w-20 text-right', r.changed && 'border-primary')} aria-label={`What-if percent complete for ${r.project.name}`} />
          <span className="text-muted-foreground text-xs">%</span>
        </div>
      ),
    },
    { id: 'eac', header: 'Estimate at completion', accessor: (r) => r.whatIf.forecastCost, align: 'right', cell: (r) => <div><Money value={r.whatIf.forecastCost} />{r.changed ? <div className="text-muted-foreground text-[11px]">saved: {formatCurrency(r.saved.forecastCost, 'LKR', { compact: true })}</div> : null}</div> },
    { id: 'ctc', header: 'Cost to complete', accessor: (r) => r.whatIf.costToComplete, align: 'right', cell: (r) => <Money value={r.whatIf.costToComplete} /> },
    {
      id: 'variance',
      header: 'Variance to budget',
      accessor: (r) => subtract(r.project.budget, r.whatIf.forecastCost),
      align: 'right',
      cell: (r) => {
        const v = subtract(r.project.budget, r.whatIf.forecastCost)
        return <span className={cn('tabular', v < 0 ? 'text-destructive font-medium' : 'text-success')}>{v < 0 ? '' : '+'}{formatCurrency(v)}</span>
      },
    },
    { id: 'consumption', header: 'Budget used', accessor: (r) => r.whatIf.budgetConsumptionPercent ?? 0, cell: (r) => <ProgressBar value={r.whatIf.budgetConsumptionPercent} label={`Budget used for ${r.project.name}`} className="w-32" /> },
    { id: 'health', header: 'Health', accessor: (r) => r.whatIf.health, cell: (r) => <StatusBadge status={r.whatIf.health} /> },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      cell: (r) =>
        r.changed ? (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit ? <Button size="xs" onClick={() => save(r)}><Save /> Save</Button> : null}
            <Button size="icon-xs" variant="ghost" aria-label="Reset what-if" onClick={() => clearOverride(r.project.id)}><RotateCcw /></Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Cost-to-complete estimates" description="Remaining cost for active, planned and paused projects. Adjust % complete to test what-if scenarios before saving." />
      <SimulatedNotice tone="demo" className="mb-5">
        <Term term="Estimate at completion">Estimate at completion</Term> is illustrative: once work has started it is actual cost ÷ % complete (never below actual + committed); otherwise the approved budget. What-if values are not saved until you click Save.
      </SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Approved budgets" value={formatCurrency(totals.budget)} hint={`${rows.length} open projects`} />
        <StatCard label="Actual to date" value={formatCurrency(totals.actual)} />
        <StatCard label="Estimate at completion" term="EAC" value={formatCurrency(totals.eac)} estimate delta={totals.budget ? ((totals.eac - totals.budget) / totals.budget) * 100 : null} invertDelta deltaLabel="vs budget" />
        <StatCard label="Cost to complete" value={formatCurrency(totals.ctc)} estimate />
      </StatGrid>
      <DataTable caption="Cost to complete by project" data={rows} columns={columns} getRowId={(r) => r.project.id} exportName="cost-to-complete" initialSort={{ id: 'variance' }} searchPlaceholder="Search projects…" rowClassName={(r) => (r.changed ? 'bg-primary/5' : undefined)} />
    </>
  )
}
