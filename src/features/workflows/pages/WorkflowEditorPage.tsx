import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowLeft, ArrowUp, Bell, CheckCircle2, CircleSlash, Eye, GripVertical, Play, Plus, Save, Send, ShieldCheck, Trash2, Undo2, XCircle } from 'lucide-react'
import type { RoleKey, WorkflowDefinition, WorkflowEntity, WorkflowStage, WorkflowStageCondition } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useMasterList, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { workflowRepository } from '@/services'
import { ROLE_LABELS } from '@/app/state/preferences'
import { formatDateTime } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { conditionHolds, describeCondition, simulateWorkflow, type StageDecision } from '../lib/simulate'
import { WORKFLOW_ENTITY_LABELS } from '../lib/templates'
import type { WorkflowRun } from '@/domain'
import { useOnChange } from '@/hooks/useOnChange'

type Draft = Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>
const uid = () => `st-${Math.random().toString(36).slice(2, 8)}`
const ROLES = Object.keys(ROLE_LABELS) as RoleKey[]
const STAGE_TYPE_LABEL: Record<WorkflowStage['type'], string> = { approval: 'Approval', review: 'Review', notification: 'Notification' }
const COND_FIELD_LABEL: Record<WorkflowStageCondition['field'], string> = { amount: 'Amount (LKR)', departmentId: 'Department', categoryId: 'Category', projectId: 'Project' }

const BLANK: Draft = {
  name: 'New approval workflow',
  description: '',
  entity: 'expense',
  status: 'draft',
  version: 0,
  stages: [{ id: uid(), name: 'Manager approval', type: 'approval', assigneeRole: 'project_manager', slaHours: 24, requireComment: false }],
}

function StageCard({ stage, index, count, disabled, onChange, onMove, onRemove }: { stage: WorkflowStage; index: number; count: number; disabled: boolean; onChange: (p: Partial<WorkflowStage>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id, disabled })
  const departments = useMasterList('departments')
  const categories = useMasterList('expenseCategories')
  const projects = useCollection('projects')
  const cond = stage.condition
  const setCond = (p: Partial<WorkflowStageCondition> | null) => onChange({ condition: p === null ? undefined : ({ ...(cond ?? { field: 'amount', operator: 'gte', value: 0 }), ...p } as WorkflowStageCondition) })
  const valueOptions = cond?.field === 'departmentId' ? departments.map((d) => ({ v: d.id, l: d.name })) : cond?.field === 'categoryId' ? categories.map((c) => ({ v: c.id, l: c.name })) : cond?.field === 'projectId' ? projects.map((p) => ({ v: p.id, l: `${p.code} · ${p.name}` })) : null

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('bg-card rounded-lg border p-3', isDragging && 'z-10 shadow-lg')}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-muted-foreground hover:text-foreground cursor-grab rounded p-0.5" aria-label={`Drag to reorder ${stage.name}`} disabled={disabled} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-semibold">{index + 1}</span>
        <Input aria-label="Stage name" value={stage.name} disabled={disabled} className="h-8 min-w-40 flex-1" onChange={(e) => onChange({ name: e.target.value })} />
        <Button variant="ghost" size="icon-sm" aria-label="Move stage up" disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Move stage down" disabled={disabled || index === count - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Remove stage" disabled={disabled || count <= 1} onClick={onRemove}><Trash2 /></Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={stage.type} disabled={disabled} onValueChange={(v) => onChange({ type: v as WorkflowStage['type'] })}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(STAGE_TYPE_LABEL) as WorkflowStage['type'][]).map((t) => <SelectItem key={t} value={t}>{STAGE_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Assigned role</Label>
          <Select value={stage.assigneeRole} disabled={disabled} onValueChange={(v) => onChange({ assigneeRole: v as RoleKey })}>
            <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SLA (hours)</Label>
          <Input type="number" min={0} className="h-8" value={stage.slaHours} disabled={disabled} onChange={(e) => onChange({ slaHours: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
        <div className="flex items-end gap-2 pb-1.5">
          <Switch checked={stage.requireComment} disabled={disabled} onCheckedChange={(c) => onChange({ requireComment: c })} aria-label="Require comment" />
          <span className="text-xs">Require comment</span>
        </div>
      </div>
      <div className="bg-muted/40 mt-3 flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2">
        <Switch checked={!!cond} disabled={disabled} onCheckedChange={(c) => setCond(c ? {} : null)} aria-label="Run only when condition holds" />
        <span className="text-xs">{cond ? 'Only run this stage when' : 'Always runs (no condition)'}</span>
        {cond ? (
          <>
            <Select value={cond.field} disabled={disabled} onValueChange={(v) => setCond({ field: v as WorkflowStageCondition['field'], operator: v === 'amount' ? 'gte' : 'eq', value: v === 'amount' ? 0 : '' })}>
              <SelectTrigger size="sm" className="w-36" aria-label="Condition field"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(COND_FIELD_LABEL) as WorkflowStageCondition['field'][]).map((f) => <SelectItem key={f} value={f}>{COND_FIELD_LABEL[f]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={cond.operator} disabled={disabled} onValueChange={(v) => setCond({ operator: v as WorkflowStageCondition['operator'] })}>
              <SelectTrigger size="sm" className="w-24" aria-label="Condition operator"><SelectValue /></SelectTrigger>
              <SelectContent>
                {cond.field === 'amount' ? <><SelectItem value="gte">≥</SelectItem><SelectItem value="lt">&lt;</SelectItem></> : null}
                <SelectItem value="eq">=</SelectItem>
              </SelectContent>
            </Select>
            {valueOptions ? (
              <Select value={String(cond.value) || undefined} disabled={disabled} onValueChange={(v) => setCond({ value: v })}>
                <SelectTrigger size="sm" className="w-48" aria-label="Condition value"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{valueOptions.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input aria-label="Condition value" type="number" className="h-8 w-36" value={String(cond.value)} disabled={disabled} onChange={(e) => setCond({ value: Number(e.target.value) || 0 })} />
            )}
          </>
        ) : null}
      </div>
    </li>
  )
}

export default function WorkflowEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const stored = useRecord('workflows', isNew ? undefined : id)
  const allRuns = useCollection('workflowRuns')
  const departments = useMasterList('departments')
  const categories = useMasterList('expenseCategories')
  const projects = useCollection('projects')
  const canEdit = usePermission('config.edit')
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [draft, setDraft] = useState<Draft | null>(isNew ? structuredClone(BLANK) : null)
  const [dirty, setDirty] = useState(false)
  const [sample, setSample] = useState<Record<string, string | number>>({ amount: 120_000, departmentId: 'dept-engineering', categoryId: 'exp-travel', projectId: '' })
  const [decisions, setDecisions] = useState<Record<string, StageDecision>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  useOnChange([stored], () => {
    if (stored) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = structuredClone(stored)
      void _i
      void _c
      void _u
      setDraft(rest)
      setDirty(false)
    }
  })

  const preview = useMemo(() => (draft ? simulateWorkflow(draft, sample, decisions) : null), [draft, sample, decisions])
  const runs = useMemo(() => (stored ? allRuns.filter((r) => r.workflowId === stored.id) : []), [allRuns, stored])

  if (!draft) return <EmptyState title="Workflow not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/config/workflows">Back to workflows</Link></Button>} className="mt-10" />

  const update = (p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
    setDirty(true)
  }
  const updateStage = (sid: string, p: Partial<WorkflowStage>) => update({ stages: draft.stages.map((s) => (s.id === sid ? { ...s, ...p } : s)) })
  const moveStage = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= draft.stages.length) return
    update({ stages: arrayMove(draft.stages, i, j) })
  }
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const a = draft.stages.findIndex((s) => s.id === e.active.id)
    const b = draft.stages.findIndex((s) => s.id === e.over!.id)
    update({ stages: arrayMove(draft.stages, a, b) })
  }

  const validate = () => {
    if (!draft.name.trim()) return 'Give the workflow a name.'
    if (!draft.stages.length) return 'Add at least one stage.'
    if (draft.stages.some((s) => !s.name.trim())) return 'Every stage needs a name.'
    if (draft.stages.some((s) => s.condition && s.condition.field !== 'amount' && !s.condition.value)) return 'Choose a value for each stage condition.'
    return null
  }

  /** Persist the draft; returns the saved id. */
  const persist = async (patch: Partial<Draft> = {}): Promise<string | undefined> => {
    const err = validate()
    if (err) {
      await runWithToast(Promise.reject(new Error(err)))
      return undefined
    }
    const body = { ...draft, ...patch }
    if (isNew) {
      const created = await runWithToast(workflowRepository.create(body))
      if (created) {
        setDirty(false)
        navigate(`/config/workflows/${created.id}`, { replace: true })
      }
      return created?.id
    }
    const saved = await runWithToast(workflowRepository.update(stored!.id, body))
    if (saved) setDirty(false)
    return saved?.id
  }

  const save = async () => {
    if (await persist()) runWithToast(Promise.resolve(), 'Workflow saved')
  }
  const publish = async () => {
    const savedId = await persist()
    if (savedId) await runWithToast(workflowRepository.publish(savedId), 'Workflow published (demo configuration)')
  }
  const unpublish = async () => {
    if (stored) await runWithToast(workflowRepository.update(stored.id, { status: 'draft' }), 'Workflow moved back to draft')
  }
  const remove = async () => {
    if (!stored) return
    const { confirmed } = await confirm({ title: `Delete "${stored.name}"?`, confirmLabel: 'Delete workflow', destructive: true })
    if (!confirmed) return
    await runWithToast(workflowRepository.remove(stored.id), 'Workflow deleted')
    navigate('/config/workflows')
  }

  const runSimulation = async () => {
    if (!stored || dirty) {
      await runWithToast(Promise.reject(new Error('Save the workflow before recording a simulation run.')))
      return
    }
    const result = simulateWorkflow(draft, sample, decisions)
    await runWithToast(
      workflowRepository.recordRun({
        workflowId: stored.id,
        workflowName: draft.name,
        entity: draft.entity,
        recordLabel: `Sandbox — LKR ${Number(sample.amount || 0).toLocaleString('en-LK')}`,
        sample,
        steps: result.steps,
        outcome: result.outcome,
        simulated: true,
      }),
      `Simulation recorded: ${result.outcome}`,
    )
  }

  const runColumns: DataColumn<WorkflowRun>[] = [
    { id: 'at', header: 'When', accessor: (r) => r.createdAt, cell: (r) => formatDateTime(r.createdAt) },
    { id: 'record', header: 'Record', accessor: (r) => r.recordLabel },
    { id: 'path', header: 'Path', accessor: (r) => r.steps.map((s) => `${s.stageName}: ${s.outcome}`).join(' → '), cell: (r) => <span className="text-muted-foreground text-xs">{r.steps.map((s) => `${s.stageName}: ${s.outcome}`).join(' → ')}</span> },
    { id: 'outcome', header: 'Outcome', accessor: (r) => r.outcome, cell: (r) => <StatusBadge status={r.outcome} /> },
  ]

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Button asChild variant="ghost" size="icon-sm" aria-label="Back to workflows"><Link to="/config/workflows"><ArrowLeft /></Link></Button>{draft.name || 'Untitled workflow'}</span>}
        description="Arrange stages, add conditions and simulate the approval path with sample values."
        meta={<><StatusBadge status={draft.status} />{draft.version ? <span className="text-muted-foreground text-xs">v{draft.version}</span> : null}{dirty ? <span className="text-warning text-xs font-medium">Unsaved changes</span> : null}</>}
        actions={
          canEdit ? (
            <>
              {!isNew ? <Button variant="ghost" onClick={remove}><Trash2 /> Delete</Button> : null}
              <Button variant="outline" onClick={save}><Save /> Save draft</Button>
              {draft.status === 'published' && !dirty ? <Button variant="outline" onClick={unpublish}><Undo2 /> Unpublish</Button> : <Button onClick={publish}><Send /> {draft.status === 'published' ? 'Publish new version' : 'Publish'}</Button>}
            </>
          ) : null
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          <Section title="Workflow details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="wf-name">Name</Label><Input id="wf-name" value={draft.name} disabled={!canEdit} onChange={(e) => update({ name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-entity">Applies to</Label>
                <Select value={draft.entity} disabled={!canEdit} onValueChange={(v) => update({ entity: v as WorkflowEntity })}>
                  <SelectTrigger id="wf-entity" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(WORKFLOW_ENTITY_LABELS) as WorkflowEntity[]).map((e) => <SelectItem key={e} value={e}>{WORKFLOW_ENTITY_LABELS[e]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="wf-desc">Description</Label><Input id="wf-desc" value={draft.description} disabled={!canEdit} onChange={(e) => update({ description: e.target.value })} /></div>
            </div>
          </Section>
          <Section title="Stages" description="Drag the handle or use the arrow buttons to reorder. Stages run top to bottom.">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={draft.stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-3">
                  {draft.stages.map((s, i) => (
                    <StageCard key={s.id} stage={s} index={i} count={draft.stages.length} disabled={!canEdit} onChange={(p) => updateStage(s.id, p)} onMove={(d) => moveStage(i, d)} onRemove={() => update({ stages: draft.stages.filter((x) => x.id !== s.id) })} />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            {canEdit ? <Button variant="outline" size="sm" className="mt-3" onClick={() => update({ stages: [...draft.stages, { id: uid(), name: `Stage ${draft.stages.length + 1}`, type: 'approval', assigneeRole: 'finance_manager', slaHours: 24, requireComment: false }] })}><Plus /> Add stage</Button> : null}
          </Section>
          {runs.length ? (
            <Section title="Execution history" description="Runs recorded for this workflow in this browser.">
              <DataTable caption="Runs for this workflow" data={runs} columns={runColumns} getRowId={(r) => r.id} initialSort={{ id: 'at', desc: true }} pageSize={10} exportName="workflow-runs" />
            </Section>
          ) : null}
        </div>

        <div className="space-y-5 xl:sticky xl:top-20 xl:h-fit">
          <Section title={<span className="flex items-center gap-1.5"><Eye className="size-4" /> Flow preview & simulation</span>} description="Set sample values and a decision per stage, then record a sandbox run.">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label htmlFor="sim-amount" className="text-xs">Amount (LKR)</Label><Input id="sim-amount" type="number" value={sample.amount} onChange={(e) => setSample({ ...sample, amount: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1">
                <Label className="text-xs">Department</Label>
                <Select value={String(sample.departmentId || '')} onValueChange={(v) => setSample({ ...sample, departmentId: v })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={String(sample.categoryId || '')} onValueChange={(v) => setSample({ ...sample, categoryId: v })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Project</Label>
                <Select value={String(sample.projectId || 'none')} onValueChange={(v) => setSample({ ...sample, projectId: v === 'none' ? '' : v })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">(no project)</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} · {p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <ol className="mt-5 space-y-0" aria-label="Simulated path">
              <li className="text-muted-foreground flex items-center gap-2 pb-3 text-xs"><Play className="size-3.5" /> Request submitted</li>
              {draft.stages.map((s) => {
                const step = preview?.steps.find((x) => x.stageId === s.id)
                const runs = !s.condition || conditionHolds(s.condition, sample)
                const Icon = step?.outcome === 'approved' ? CheckCircle2 : step?.outcome === 'rejected' ? XCircle : step?.outcome === 'notified' ? Bell : CircleSlash
                return (
                  <li key={s.id} className="relative border-l pb-4 pl-5 last:pb-0">
                    <Icon className={cn('bg-card absolute top-0 -left-2 size-4', step?.outcome === 'approved' ? 'text-success' : step?.outcome === 'rejected' ? 'text-destructive' : step?.outcome === 'notified' ? 'text-info' : 'text-muted-foreground')} aria-hidden />
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-muted-foreground text-xs">{STAGE_TYPE_LABEL[s.type]} · {ROLE_LABELS[s.assigneeRole]}{s.slaHours ? ` · SLA ${s.slaHours}h` : ''}</div>
                    {s.condition ? <div className="text-xs">If {describeCondition(s.condition)} <span className="text-muted-foreground">else skip</span></div> : null}
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={step?.outcome ?? 'pending'} label={step?.outcome === 'skipped' ? 'Skipped' : undefined} />
                      {runs && s.type !== 'notification' && step?.outcome !== 'skipped' ? (
                        <Select value={decisions[s.id] ?? 'approved'} onValueChange={(v) => setDecisions({ ...decisions, [s.id]: v as StageDecision })}>
                          <SelectTrigger size="sm" className="h-7 w-32" aria-label={`Decision at ${s.name}`}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="approved">Approve</SelectItem><SelectItem value="rejected">Reject</SelectItem></SelectContent>
                        </Select>
                      ) : null}
                    </div>
                    {step?.reason ? <div className="text-muted-foreground mt-0.5 text-[11px]">{step.reason}</div> : null}
                  </li>
                )
              })}
              <li className="flex items-center gap-2 pt-3 text-sm font-medium">
                <ShieldCheck className="size-4" /> Outcome: <StatusBadge status={preview?.outcome ?? 'pending'} />
              </li>
            </ol>
            <Button className="mt-4 w-full" onClick={runSimulation}><Play /> Record simulation run</Button>
            <SimulatedNotice className="mt-3" tone="demo">Sandbox simulation in your browser. It does not approve, pay or authorise anything.</SimulatedNotice>
          </Section>
        </div>
      </div>
    </>
  )
}
