import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CircleSlash, FlaskConical, Plus, Save, Trash2, XCircle, Zap } from 'lucide-react'
import type { BusinessRule, RoleKey, RuleAction, RuleActionType, RuleCondition, RuleEntity, RuleField, RuleOperator } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useDbSlice, useLookups, useMasterList, useProjectFinancials, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { ruleRepository } from '@/services'
import { NUMERIC_RULE_FIELDS, RULE_FIELD_LABELS, RULE_OPERATOR_LABELS, evaluateRule, type RuleContext } from '@/lib/rules/engine'
import { ROLE_LABELS } from '@/app/state/preferences'
import { documentTotals, invoiceTotals } from '@/lib/calculations/invoices'
import { add } from '@/lib/calculations/money'
import { daysBetween, todayISO } from '@/lib/dates'
import { formatCurrency } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { ACTION_LABELS, ENTITY_FIELDS, ENTITY_LABELS, STATUS_OPTIONS, describeValue } from '../lib/ruleLabels'

type Draft = Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt'>
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`

const BLANK: Draft = {
  name: 'New rule',
  description: '',
  entity: 'expense',
  match: 'all',
  conditions: [{ id: uid('c'), field: 'amount', operator: 'gte', value: 50_000 }],
  actions: [{ id: uid('a'), type: 'notify', message: 'Please review this item', targetRole: 'finance_manager' }],
  enabled: false,
  priority: 5,
}

const NUMERIC_OPS: RuleOperator[] = ['gte', 'gt', 'lte', 'lt', 'eq', 'neq']
const EQ_OPS: RuleOperator[] = ['eq', 'neq']

export default function RuleEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const stored = useRecord('rules', isNew ? undefined : id)
  const canEdit = usePermission('config.edit')
  const navigate = useNavigate()
  const confirm = useConfirm()
  const lookups = useLookups()
  const [draft, setDraft] = useState<Draft | null>(isNew ? structuredClone(BLANK) : null)
  const [sample, setSample] = useState<RuleContext>({ amount: 65_000, categoryId: 'exp-travel', projectId: 'prj-103', status: 'submitted', billable: true, budgetConsumptionPercent: 72, daysUntilDue: 3 })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (stored) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = structuredClone(stored)
      void _i
      void _c
      void _u
      setDraft(rest)
      setDirty(false)
    }
  }, [stored])

  const evaluation = useMemo(() => (draft ? evaluateRule({ ...draft, id: 'test', createdAt: '', updatedAt: '' }, sample) : null), [draft, sample])

  if (!draft) {
    return <EmptyState title="Rule not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/config/rules">Back to rules</Link></Button>} className="mt-10" />
  }

  const update = (p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
    setDirty(true)
  }
  const updateCond = (cid: string, p: Partial<RuleCondition>) => update({ conditions: draft.conditions.map((c) => (c.id === cid ? { ...c, ...p } : c)) })
  const updateAction = (aid: string, p: Partial<RuleAction>) => update({ actions: draft.actions.map((a) => (a.id === aid ? { ...a, ...p } : a)) })
  const fields = ENTITY_FIELDS[draft.entity]

  const validate = (): string | null => {
    if (!draft.name.trim()) return 'Give the rule a name.'
    if (!draft.conditions.length) return 'Add at least one condition.'
    if (!draft.actions.length) return 'Add at least one action.'
    for (const c of draft.conditions) {
      if (NUMERIC_RULE_FIELDS.includes(c.field) && (c.value === '' || !Number.isFinite(Number(c.value)))) return `Enter a number for "${RULE_FIELD_LABELS[c.field]}".`
    }
    if (draft.actions.some((a) => !a.message.trim())) return 'Every action needs a message.'
    if (!Number.isInteger(draft.priority) || draft.priority < 1 || draft.priority > 99) return 'Priority must be a whole number between 1 and 99.'
    return null
  }

  const save = async () => {
    const err = validate()
    if (err) return runWithToast(Promise.reject(new Error(err)))
    if (isNew) {
      const created = await runWithToast(ruleRepository.create(draft), 'Rule created')
      if (created) {
        setDirty(false)
        navigate(`/config/rules/${created.id}`, { replace: true })
      }
    } else if (stored) {
      if (await runWithToast(ruleRepository.update(stored.id, draft), 'Rule saved')) setDirty(false)
    }
  }

  const remove = async () => {
    if (!stored) return
    const { confirmed } = await confirm({ title: `Delete "${stored.name}"?`, confirmLabel: 'Delete rule', destructive: true })
    if (!confirmed) return
    await runWithToast(ruleRepository.remove(stored.id), 'Rule deleted')
    navigate('/config/rules')
  }

  const changeEntity = (entity: RuleEntity) => {
    const allowed = ENTITY_FIELDS[entity]
    update({ entity, conditions: draft.conditions.map((c) => (allowed.includes(c.field) ? c : { ...c, field: allowed[0]!, operator: 'gte', value: 0 })) })
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Back to rules"><Link to="/config/rules"><ArrowLeft /></Link></Button>
            {draft.name || 'Untitled rule'}
          </span>
        }
        description="Build the rule from plain conditions and actions, then test it with sample values or an existing record."
        meta={dirty ? <span className="text-warning text-xs font-medium">Unsaved changes</span> : null}
        actions={
          canEdit ? (
            <>
              {!isNew ? <Button variant="ghost" onClick={remove}><Trash2 /> Delete</Button> : null}
              <Button onClick={save}><Save /> Save rule</Button>
            </>
          ) : null
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-5">
          <Section title="Rule details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="r-name">Name</Label>
                <Input id="r-name" value={draft.name} disabled={!canEdit} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="r-desc">Description</Label>
                <Input id="r-desc" value={draft.description} disabled={!canEdit} onChange={(e) => update({ description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-entity">Applies to</Label>
                <Select value={draft.entity} disabled={!canEdit} onValueChange={(v) => changeEntity(v as RuleEntity)}>
                  <SelectTrigger id="r-entity" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_LABELS) as RuleEntity[]).map((e) => <SelectItem key={e} value={e}>{ENTITY_LABELS[e]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="r-priority">Priority (1 = first)</Label>
                  <Input id="r-priority" type="number" min={1} max={99} value={draft.priority} disabled={!canEdit} onChange={(e) => update({ priority: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch id="r-enabled" checked={draft.enabled} disabled={!canEdit} onCheckedChange={(c) => update({ enabled: c })} />
                  <Label htmlFor="r-enabled">Enabled</Label>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="When…"
            description="Conditions are evaluated against the record’s values."
            actions={
              <Select value={draft.match} disabled={!canEdit} onValueChange={(v) => update({ match: v as 'all' | 'any' })}>
                <SelectTrigger size="sm" className="w-48" aria-label="Match mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All conditions match</SelectItem>
                  <SelectItem value="any">Any condition matches</SelectItem>
                </SelectContent>
              </Select>
            }
          >
            <ol className="space-y-2">
              {draft.conditions.map((c, i) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                  <span className="text-muted-foreground w-10 text-xs font-medium">{i === 0 ? 'If' : draft.match === 'all' ? 'and' : 'or'}</span>
                  <Select value={c.field} disabled={!canEdit} onValueChange={(v) => updateCond(c.id, { field: v as RuleField, operator: NUMERIC_RULE_FIELDS.includes(v as RuleField) ? 'gte' : 'eq', value: NUMERIC_RULE_FIELDS.includes(v as RuleField) ? 0 : v === 'billable' ? true : '' })}>
                    <SelectTrigger size="sm" className="w-48" aria-label="Field"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => <SelectItem key={f} value={f}>{RULE_FIELD_LABELS[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={c.operator} disabled={!canEdit} onValueChange={(v) => updateCond(c.id, { operator: v as RuleOperator })}>
                    <SelectTrigger size="sm" className="w-40" aria-label="Operator"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(NUMERIC_RULE_FIELDS.includes(c.field) ? NUMERIC_OPS : EQ_OPS).map((o) => <SelectItem key={o} value={o}>{RULE_OPERATOR_LABELS[o]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <ValueInput field={c.field} entity={draft.entity} value={c.value} disabled={!canEdit} onChange={(v) => updateCond(c.id, { value: v })} />
                  <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remove condition" disabled={!canEdit || draft.conditions.length <= 1} onClick={() => update({ conditions: draft.conditions.filter((x) => x.id !== c.id) })}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ol>
            {canEdit ? <Button variant="outline" size="sm" className="mt-3" onClick={() => update({ conditions: [...draft.conditions, { id: uid('c'), field: fields[0]!, operator: 'gte', value: 0 }] })}><Plus /> Add condition</Button> : null}
          </Section>

          <Section title="Then…" description="Actions are simulated inside this browser: notifications, review flags and escalation notes.">
            <ol className="space-y-2">
              {draft.actions.map((a) => (
                <li key={a.id} className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[200px_1fr_180px_auto]">
                  <Select value={a.type} disabled={!canEdit} onValueChange={(v) => updateAction(a.id, { type: v as RuleActionType })}>
                    <SelectTrigger size="sm" className="w-full" aria-label="Action"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABELS) as RuleActionType[]).map((t) => <SelectItem key={t} value={t}>{ACTION_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input aria-label="Message" className="h-8" value={a.message} disabled={!canEdit} placeholder="Message shown to the user" onChange={(e) => updateAction(a.id, { message: e.target.value })} />
                  <Select value={a.targetRole ?? 'none'} disabled={!canEdit} onValueChange={(v) => updateAction(a.id, { targetRole: v === 'none' ? undefined : (v as RoleKey) })}>
                    <SelectTrigger size="sm" className="w-full" aria-label="Target role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Anyone (no role)</SelectItem>
                      {(Object.keys(ROLE_LABELS) as RoleKey[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove action" disabled={!canEdit || draft.actions.length <= 1} onClick={() => update({ actions: draft.actions.filter((x) => x.id !== a.id) })}><Trash2 /></Button>
                </li>
              ))}
            </ol>
            {canEdit ? <Button variant="outline" size="sm" className="mt-3" onClick={() => update({ actions: [...draft.actions, { id: uid('a'), type: 'notify', message: '' }] })}><Plus /> Add action</Button> : null}
          </Section>
          <SimulatedNotice tone="demo">
            {draft.entity === 'expense'
              ? 'Expense rules run automatically when a claim is submitted (Finance → Expenses).'
              : draft.entity === 'purchase_order'
                ? 'Purchase-order rules run automatically when an order is sent for approval.'
                : 'Rules for this record type can be designed and tested here; automatic execution is shown for expenses and purchase orders in this demo.'}{' '}
            This is a local demonstration configuration — the future backend will execute rules server-side.
          </SimulatedNotice>
        </div>

        <TestPanel entity={draft.entity} sample={sample} setSample={setSample} evaluation={evaluation} lookups={lookups} fields={fields} />
      </div>
    </>
  )
}

function ValueInput({ field, entity, value, onChange, disabled }: { field: RuleField; entity: RuleEntity; value: RuleCondition['value']; onChange: (v: RuleCondition['value']) => void; disabled?: boolean }) {
  const expenseCats = useMasterList('expenseCategories')
  const departments = useMasterList('departments')
  const { projects } = useDbSlice('projects')
  if (NUMERIC_RULE_FIELDS.includes(field)) {
    return <Input aria-label="Value" type="number" className="h-8 w-36" value={Array.isArray(value) ? '' : String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
  }
  const options: { value: string; label: string }[] =
    field === 'categoryId'
      ? expenseCats.map((c) => ({ value: c.id, label: c.name }))
      : field === 'departmentId'
        ? departments.map((d) => ({ value: d.id, label: d.name }))
        : field === 'projectId'
          ? [{ value: '__empty', label: '(no project)' }, ...projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]
          : field === 'status'
            ? STATUS_OPTIONS[entity].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))
            : [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
  const current = Array.isArray(value) ? (value[0] ?? '') : value === '' ? '__empty' : String(value)
  return (
    <Select value={current} disabled={disabled} onValueChange={(v) => onChange(v === '__empty' ? '' : field === 'billable' ? v === 'true' : v)}>
      <SelectTrigger size="sm" className="w-56" aria-label="Value"><SelectValue placeholder="Choose…" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function TestPanel({ entity, sample, setSample, evaluation, lookups, fields }: { entity: RuleEntity; sample: RuleContext; setSample: (s: RuleContext) => void; evaluation: ReturnType<typeof evaluateRule> | null; lookups: ReturnType<typeof useLookups>; fields: RuleField[] }) {
  const db = useDbSlice('expenses', 'purchaseOrders', 'projects', 'invoices', 'supplierBills')
  const fin = useProjectFinancials()
  const today = todayISO()

  const records = useMemo<{ id: string; label: string; ctx: RuleContext }[]>(() => {
    switch (entity) {
      case 'expense':
        return db.expenses.slice(-25).reverse().map((e) => {
          const pf = e.projectId ? fin.get(e.projectId) : undefined
          return { id: e.id, label: `${e.number} · ${formatCurrency(e.amount)} · ${e.description}`, ctx: { amount: e.amount, categoryId: e.categoryId, projectId: e.projectId ?? '', departmentId: e.departmentId, status: e.status, billable: e.billable, budgetConsumptionPercent: pf?.budgetConsumptionPercent ?? undefined } }
        })
      case 'purchase_order':
        return db.purchaseOrders.map((p) => ({ id: p.id, label: `${p.number} · ${formatCurrency(documentTotals(p.lines).total)}`, ctx: { amount: documentTotals(p.lines).total, projectId: p.projectId ?? '', departmentId: p.departmentId, status: p.status } }))
      case 'project':
        return db.projects.map((p) => ({ id: p.id, label: `${p.code} · ${p.name}`, ctx: { amount: p.contractValue, departmentId: p.departmentId, status: p.status, budgetConsumptionPercent: fin.get(p.id)?.budgetConsumptionPercent ?? 0 } }))
      case 'invoice':
        return db.invoices.slice(-25).reverse().map((i) => ({ id: i.id, label: `${i.number} · ${formatCurrency(invoiceTotals(i).total)}`, ctx: { amount: invoiceTotals(i).total, projectId: i.projectId ?? '', status: i.status, daysUntilDue: daysBetween(today, i.dueDate) } }))
      case 'supplier_bill':
        return db.supplierBills.slice(-25).reverse().map((b) => ({ id: b.id, label: `${b.number} · ${b.description}`, ctx: { amount: add(b.subtotal, b.taxAmount), categoryId: b.categoryId, projectId: b.projectId ?? '', departmentId: b.departmentId, status: b.status, daysUntilDue: daysBetween(today, b.dueDate) } }))
    }
  }, [entity, db, fin, today])

  return (
    <Section title={<span className="flex items-center gap-1.5"><FlaskConical className="size-4" /> Test mode</span>} description="Enter sample values or load an existing record. Nothing is changed." className="h-fit xl:sticky xl:top-20">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="t-record">Load values from a record</Label>
          <Select onValueChange={(v) => { const r = records.find((x) => x.id === v); if (r) setSample({ ...sample, ...r.ctx }) }}>
            <SelectTrigger id="t-record" className="w-full"><SelectValue placeholder={`Choose ${ENTITY_LABELS[entity].toLowerCase()}…`} /></SelectTrigger>
            <SelectContent>
              {records.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {fields.map((f) => (
            <div key={f} className="space-y-1">
              <Label className="text-xs">{RULE_FIELD_LABELS[f]}</Label>
              <ValueInput field={f} entity={entity} value={(sample[f] ?? '') as RuleCondition['value']} onChange={(v) => setSample({ ...sample, [f]: v as RuleContext[RuleField] })} />
            </div>
          ))}
        </div>
        {evaluation ? (
          <div className="space-y-3 border-t pt-4" aria-live="polite">
            <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium', evaluation.triggered ? 'border-success/40 bg-success/10' : 'bg-muted/40')}>
              {evaluation.triggered ? <Zap className="text-success size-4" /> : <CircleSlash className="text-muted-foreground size-4" />}
              {evaluation.triggered ? 'Rule would trigger' : 'Rule would not trigger'}
            </div>
            <ul className="space-y-1.5">
              {evaluation.conditions.map((c) => (
                <li key={c.condition.id} className="flex items-start gap-2 text-xs">
                  {c.passed ? <CheckCircle2 className="text-success mt-0.5 size-3.5 shrink-0" aria-label="Passed" /> : <XCircle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-label="Failed" />}
                  <span>
                    {RULE_FIELD_LABELS[c.condition.field]} {RULE_OPERATOR_LABELS[c.condition.operator]} <strong>{describeValue(c.condition.field, c.condition.value, lookups)}</strong>
                    <span className="text-muted-foreground"> — actual: {describeValue(c.condition.field, (c.actual ?? '') as RuleCondition['value'], lookups)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {evaluation.triggered ? (
              <div className="space-y-1">
                <div className="text-xs font-semibold">Simulated actions</div>
                {evaluation.rule.actions.map((a) => (
                  <div key={a.id} className="bg-muted/50 rounded-md px-2.5 py-1.5 text-xs">
                    <span className="font-medium">{ACTION_LABELS[a.type]}</span>
                    {a.targetRole ? <span className="text-muted-foreground"> → {ROLE_LABELS[a.targetRole]}</span> : null}: {a.message || '(no message)'}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Section>
  )
}
