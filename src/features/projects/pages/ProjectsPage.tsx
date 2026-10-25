import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Project, ProjectStatus } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups, useProjectFinancials } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { projectRepository } from '@/services'
import { PROJECT_HEALTH_LABEL, type ProjectFinancials } from '@/lib/calculations/projects'
import { percentOf, sum } from '@/lib/calculations/money'
import { formatCompactCurrency, formatPercent } from '@/lib/formatting'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import { BILLING_MODEL_LABELS, PROJECT_STATUS_LABELS, toOptions } from '../lib/labels'

type Row = Project & { fin: ProjectFinancials; client: string }

export default function ProjectsPage() {
  const projects = useCollection('projects')
  const fins = useProjectFinancials()
  const lookups = useLookups()
  const canEdit = usePermission('projects.edit')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Project | undefined>()

  const rows = useMemo<Row[]>(() => projects.map((p) => ({ ...p, fin: fins.get(p.id)!, client: p.isInternal ? 'Internal' : lookups.customer(p.customerId) })).filter((r) => r.fin), [projects, fins, lookups])

  const kpis = useMemo(() => {
    const live = rows.filter((r) => r.status === 'active' || r.status === 'on_hold' || r.status === 'planning')
    const contract = sum(live.filter((r) => !r.isInternal), (r) => r.contractValue)
    const profit = sum(live.filter((r) => !r.isInternal), (r) => r.fin.estimatedProfit)
    return {
      active: rows.filter((r) => r.status === 'active').length,
      contract,
      budget: sum(live, (r) => r.budget),
      actual: sum(live, (r) => r.fin.actualCost),
      margin: percentOf(profit, contract),
      atRisk: rows.filter((r) => r.status !== 'completed' && (r.fin.health === 'at_risk' || r.fin.health === 'over_budget')).length,
    }
  }, [rows])

  const openForm = (p?: Project) => {
    setEditing(p)
    setFormOpen(true)
  }

  const remove = async (p: Project) => {
    const { confirmed } = await confirm({
      title: `Delete ${p.code}?`,
      description: 'Projects with invoices, timesheets or costs cannot be deleted — cancel or complete them instead. This only affects this browser’s demo data.',
      confirmLabel: 'Delete project',
      destructive: true,
    })
    if (confirmed) await runWithToast(projectRepository.remove(p.id), 'Project deleted')
  }

  const columns: DataColumn<Row>[] = [
    {
      id: 'name',
      header: 'Project',
      accessor: (r) => `${r.code} ${r.name}`,
      alwaysVisible: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.name}</div>
          <div className="text-muted-foreground text-xs">{r.code}</div>
        </div>
      ),
      exportValue: (r) => `${r.code} — ${r.name}`,
    },
    { id: 'client', header: 'Client', accessor: (r) => r.client },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'billing', header: 'Billing model', accessor: (r) => BILLING_MODEL_LABELS[r.billingModel], defaultHidden: true },
    { id: 'contract', header: 'Contract value', accessor: (r) => r.contractValue, align: 'right', cell: (r) => (r.isInternal ? <span className="text-muted-foreground">Internal</span> : <Money value={r.contractValue} compact />) },
    { id: 'budget', header: 'Budget', accessor: (r) => r.budget, align: 'right', cell: (r) => <Money value={r.budget} compact /> },
    { id: 'actual', header: 'Actual cost', accessor: (r) => r.fin.actualCost, align: 'right', cell: (r) => <Money value={r.fin.actualCost} compact /> },
    {
      id: 'consumption',
      header: 'Budget used',
      accessor: (r) => r.fin.budgetConsumptionPercent ?? 0,
      cell: (r) => <ProgressBar value={r.fin.actualCost} max={r.budget} label={`Budget consumption for ${r.code}`} className="min-w-28" />,
      exportValue: (r) => r.fin.budgetConsumptionPercent,
    },
    { id: 'complete', header: '% complete', accessor: (r) => r.percentComplete, align: 'right', cell: (r) => `${r.percentComplete}%` },
    { id: 'forecast', header: 'Forecast cost (est.)', accessor: (r) => r.fin.forecastCost, align: 'right', cell: (r) => <Money value={r.fin.forecastCost} compact /> },
    {
      id: 'margin',
      header: 'Est. margin',
      accessor: (r) => r.fin.estimatedMarginPercent ?? undefined,
      align: 'right',
      cell: (r) => (r.fin.estimatedMarginPercent === null ? <span className="text-muted-foreground">n/a</span> : <span className={r.fin.estimatedMarginPercent < 15 ? 'text-destructive font-medium' : ''}>{formatPercent(r.fin.estimatedMarginPercent)}</span>),
    },
    { id: 'health', header: 'Health', accessor: (r) => PROJECT_HEALTH_LABEL[r.fin.health], cell: (r) => <StatusBadge status={r.fin.health} /> },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      align: 'right',
      cell: (r) =>
        canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.code}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => openForm(r)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">Change status</DropdownMenuLabel>
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[])
                .filter((s) => s !== r.status)
                .map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => runWithToast(projectRepository.setStatus(r.id, s), `${r.code} marked ${PROJECT_STATUS_LABELS[s].toLowerCase()}`)}>
                    {PROJECT_STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Projects"
        description="Software delivery projects with costs, billing and illustrative forecasts derived from timesheets, cost entries, bills, cloud usage and invoices."
        actions={
          canEdit ? (
            <Button onClick={() => openForm()}>
              <Plus /> New project
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Active projects" value={kpis.active} hint={`${rows.length} projects in total`} />
        <StatCard label="Contract value" term="Contract value" value={formatCompactCurrency(kpis.contract)} hint="Open projects (planning, active, on hold)" />
        <StatCard label="Budget used" term="Budget utilisation" value={formatPercent(percentOf(kpis.actual, kpis.budget))} hint={`${formatCompactCurrency(kpis.actual)} of ${formatCompactCurrency(kpis.budget)}`} to="/projects/budgets" />
        <StatCard label="Est. portfolio margin" term="Direct-cost margin" value={formatPercent(kpis.margin)} hint={`${kpis.atRisk} project(s) at risk or over budget`} estimate to="/projects/profitability" />
      </StatGrid>
      <DataTable
        caption="Projects"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Search code, name, client…"
        exportName="projects"
        initialSort={{ id: 'actual', desc: true }}
        onRowClick={(r) => navigate(`/projects/${r.id}`)}
        filters={[
          { id: 'status', label: 'Statuses', options: toOptions(PROJECT_STATUS_LABELS), predicate: (r, v) => r.status === v },
          { id: 'billing', label: 'Billing models', options: toOptions(BILLING_MODEL_LABELS), predicate: (r, v) => r.billingModel === v },
          {
            id: 'health',
            label: 'Health',
            options: Object.entries(PROJECT_HEALTH_LABEL).map(([value, label]) => ({ value, label })),
            predicate: (r, v) => r.fin.health === v,
          },
        ]}
        emptyState={<EmptyState icon={<FolderKanban />} title="No projects yet" description="Create a project to start tracking budgets and costs." className="border-0" />}
      />
      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} onSaved={(p) => !editing && navigate(`/projects/${p.id}`)} />
    </>
  )
}
