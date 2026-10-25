import { useNavigate } from 'react-router-dom'
import { Copy, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2, Workflow } from 'lucide-react'
import type { WorkflowDefinition, WorkflowRun } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { workflowRepository } from '@/services'
import { formatDateTime } from '@/lib/formatting'
import { WORKFLOW_ENTITY_LABELS, WORKFLOW_TEMPLATES, type WorkflowTemplate } from '../lib/templates'

const uid = () => `st-${Math.random().toString(36).slice(2, 8)}`

export default function WorkflowsPage() {
  const workflows = useCollection('workflows')
  const runs = useCollection('workflowRuns')
  const canEdit = usePermission('config.edit')
  const navigate = useNavigate()
  const confirm = useConfirm()

  const fromTemplate = async (t: WorkflowTemplate) => {
    const created = await runWithToast(
      workflowRepository.create({ name: `${t.name} (new)`, description: t.description, entity: t.entity, stages: t.stages.map((s) => ({ ...s, id: uid() })), status: 'draft', version: 0 }),
      'Workflow created from template',
    )
    if (created) navigate(`/config/workflows/${created.id}`)
  }
  const duplicate = async (w: WorkflowDefinition) => {
    const created = await runWithToast(workflowRepository.create({ name: `${w.name} (copy)`, description: w.description, entity: w.entity, stages: w.stages.map((s) => ({ ...s, id: uid() })), status: 'draft', version: 0 }), 'Workflow duplicated')
    if (created) navigate(`/config/workflows/${created.id}`)
  }
  const remove = async (w: WorkflowDefinition) => {
    const { confirmed } = await confirm({ title: `Delete "${w.name}"?`, description: 'Past simulation runs remain in the execution history.', confirmLabel: 'Delete workflow', destructive: true })
    if (confirmed) await runWithToast(workflowRepository.remove(w.id), 'Workflow deleted')
  }

  const columns: DataColumn<WorkflowDefinition>[] = [
    { id: 'name', header: 'Workflow', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground line-clamp-1 text-xs">{r.description}</div></div> },
    { id: 'entity', header: 'Applies to', accessor: (r) => WORKFLOW_ENTITY_LABELS[r.entity] },
    { id: 'stages', header: 'Stages', accessor: (r) => r.stages.length, align: 'right' },
    { id: 'version', header: 'Version', accessor: (r) => r.version, align: 'right', cell: (r) => (r.version ? `v${r.version}` : '—') },
    { id: 'runs', header: 'Runs', accessor: (r) => runs.filter((x) => x.workflowId === r.id).length, align: 'right' },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'updated', header: 'Updated', accessor: (r) => r.updatedAt, cell: (r) => formatDateTime(r.updatedAt), defaultHidden: true },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/config/workflows/${r.id}`)}><Pencil /> Edit & simulate</DropdownMenuItem>
            {canEdit ? (
              <>
                <DropdownMenuItem onSelect={() => duplicate(r)}><Copy /> Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const runColumns: DataColumn<WorkflowRun>[] = [
    { id: 'at', header: 'When', accessor: (r) => r.createdAt, cell: (r) => formatDateTime(r.createdAt) },
    { id: 'workflow', header: 'Workflow', accessor: (r) => r.workflowName },
    { id: 'record', header: 'Record', accessor: (r) => r.recordLabel, cell: (r) => <span className="line-clamp-1">{r.recordLabel}</span> },
    { id: 'kind', header: 'Type', accessor: (r) => (r.simulated ? 'Sandbox simulation' : 'Demo record') },
    { id: 'steps', header: 'Path', accessor: (r) => r.steps.map((s) => `${s.stageName}: ${s.outcome}`).join(' → '), cell: (r) => <span className="text-muted-foreground text-xs">{r.steps.map((s) => s.outcome).join(' → ')}</span> },
    { id: 'outcome', header: 'Outcome', accessor: (r) => r.outcome, cell: (r) => <StatusBadge status={r.outcome} /> },
  ]

  return (
    <>
      <PageHeader title="Workflow builder" description="Design multi-stage approval workflows with conditional stages, role assignments and SLAs — then simulate them." actions={canEdit ? <Button onClick={() => navigate('/config/workflows/new')}><Plus /> New workflow</Button> : null} />
      <SimulatedNotice className="mb-5" tone="demo">Workflows are browser-side demonstration configuration. Simulations and runs never authorise real financial operations; the future backend will execute and enforce approvals.</SimulatedNotice>

      {canEdit ? (
        <Section title="Start from a template" className="mb-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {WORKFLOW_TEMPLATES.map((t) => (
              <div key={t.key} className="flex flex-col rounded-lg border p-4">
                <div className="flex items-center gap-2 font-medium"><LayoutTemplate className="text-muted-foreground size-4" /> {t.name}</div>
                <p className="text-muted-foreground mt-1 flex-1 text-xs">{t.description}</p>
                <div className="text-muted-foreground mt-2 text-[11px]">{t.stages.length} stages · {WORKFLOW_ENTITY_LABELS[t.entity]}</div>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => fromTemplate(t)}>Use template</Button>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <DataTable
        caption="Workflows"
        data={workflows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="workflows"
        onRowClick={(r) => navigate(`/config/workflows/${r.id}`)}
        filters={[{ id: 'status', label: 'Statuses', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }], predicate: (r, v) => r.status === v }]}
        emptyState={<EmptyState icon={<Workflow />} title="No workflows" description="Create one from a template above." className="border-0" />}
      />
      <h2 className="mt-8 mb-3 text-sm font-semibold">Execution history</h2>
      <DataTable caption="Workflow runs" data={runs} columns={runColumns} getRowId={(r) => r.id} exportName="workflow-runs" initialSort={{ id: 'at', desc: true }} pageSize={10} emptyState={<EmptyState title="No runs yet" description="Run a simulation from a workflow’s editor." className="border-0" />} />
    </>
  )
}
