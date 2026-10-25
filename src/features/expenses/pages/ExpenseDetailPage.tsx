import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CircleCheck, CircleDashed, CircleMinus, FileText, Flag, Pencil, Send, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { ActivityTimeline, DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useLookups, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { expenseRepository, expenseRuleContext } from '@/services'
import { evaluateRules, RULE_FIELD_LABELS, RULE_OPERATOR_LABELS } from '@/lib/rules/engine'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatting'
import { ROLE_LABELS } from '@/app/state/preferences'
import { ExpenseFormDialog } from '../components/ExpenseFormDialog'
import { useExpenseActions, useMyEmployeeId } from '../lib/useExpenseHelpers'

export default function ExpenseDetailPage() {
  const { id } = useParams()
  const claim = useRecord('expenses', id)
  const rules = useCollection('rules')
  const workflows = useCollection('workflows')
  const lookups = useLookups()
  const navigate = useNavigate()
  const canApprove = usePermission('expenses.approve')
  // Finance roles may correct drafts on behalf of employees.
  const canFinanceEdit = usePermission('finance.edit')
  const mine = useMyEmployeeId()
  const actions = useExpenseActions()
  const [editOpen, setEditOpen] = useState(false)
  const [note, setNote] = useState('')

  const evaluations = useMemo(() => (claim ? evaluateRules(rules, 'expense', expenseRuleContext({ ...claim, status: claim.status === 'draft' ? 'submitted' : claim.status })) : []), [claim, rules])
  const workflow = workflows.find((w) => w.entity === 'expense' && w.status === 'published')

  if (!claim) {
    return <EmptyState title="Expense claim not found" description="It may have been deleted or the demo data was reset." action={<Button asChild size="sm"><Link to="/finance/expenses">Back to expenses</Link></Button>} className="mt-10" />
  }

  const editable = claim.status === 'draft' || claim.status === 'rejected'
  const isOwner = claim.employeeId === mine
  const canEdit = editable && (isOwner || canApprove || canFinanceEdit)
  const triggered = evaluations.filter((e) => e.triggered)

  // Simulated workflow progress based on the published expense workflow.
  const stageState = (index: number, conditionMet: boolean) => {
    if (!conditionMet) return 'skipped'
    if (claim.status === 'approved' || claim.status === 'reimbursed') return 'done'
    if (claim.status === 'rejected') return index === 0 ? 'rejected' : 'pending'
    if (claim.status === 'submitted') return index === 0 ? 'current' : 'pending'
    return 'pending'
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/finance/expenses')}><ArrowLeft /> Expense claims</Button>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">{claim.number}<StatusBadge status={claim.status} />{claim.flaggedForReview ? <StatusBadge status="flagged" tone="warning" label="Flagged for review" /> : null}</span>}
        description={claim.description}
        actions={
          <>
            {canEdit ? <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button> : null}
            {canEdit ? <Button onClick={() => actions.submit(claim)}><Send /> Submit</Button> : null}
            {canApprove && claim.status === 'submitted' ? (
              <>
                <Button variant="outline" onClick={() => actions.reject(claim)}><X /> Reject</Button>
                <Button onClick={() => actions.approve(claim)}><Check /> Approve</Button>
              </>
            ) : null}
            {canEdit ? <Button variant="ghost" onClick={async () => { if (await actions.remove(claim)) navigate('/finance/expenses') }}><Trash2 /> Delete</Button> : null}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Overview">
            <DetailList
              items={[
                { label: 'Claimant', value: lookups.employee(claim.employeeId) },
                { label: 'Expense date', value: formatDate(claim.date) },
                { label: 'Category', value: lookups.master(claim.categoryId) },
                { label: 'Department', value: lookups.master(claim.departmentId) },
                { label: 'Amount', value: <Money value={claim.amount} className="text-base font-semibold" /> },
                { label: 'Billable', value: claim.billable ? 'Yes — recharged at cost' : 'No' },
                { label: 'Project', value: claim.projectId ? <Link className="text-primary hover:underline" to={`/projects/${claim.projectId}`}>{lookups.projectCode(claim.projectId)} · {lookups.project(claim.projectId)}</Link> : 'Not project related' },
                { label: 'Created', value: formatDateTime(claim.createdAt) },
              ]}
            />
          </Section>
          <Section title="Receipts" description="Demo attachments — only file metadata is stored.">
            {claim.receipts.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {claim.receipts.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="text-muted-foreground size-4" />
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-muted-foreground text-xs">{r.sizeKb} KB · added {formatDate(r.addedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No receipts attached.{claim.amount > 5000 ? ' Policy requires an itemised receipt above LKR 5,000.' : ''}</p>
            )}
          </Section>
          <Section title="Business rules" description="Rules from the Configuration centre evaluated against this claim.">
            {evaluations.length ? (
              <ul className="space-y-3">
                {evaluations.map((ev) => (
                  <li key={ev.rule.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {ev.triggered ? <Flag className="text-warning size-4" /> : <CircleMinus className="text-muted-foreground size-4" />}
                      {ev.rule.name}
                      <StatusBadge status={ev.triggered ? 'triggered' : 'not_triggered'} tone={ev.triggered ? 'warning' : 'muted'} label={ev.triggered ? 'Triggered' : 'Not triggered'} />
                    </div>
                    <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
                      {ev.conditions.map((c) => (
                        <li key={c.condition.id}>
                          {c.passed ? '✓' : '✗'} {RULE_FIELD_LABELS[c.condition.field]} {RULE_OPERATOR_LABELS[c.condition.operator]} {c.condition.field === 'categoryId' ? lookups.master(String(c.condition.value)) : c.condition.field === 'amount' ? formatCurrency(Number(c.condition.value)) : String(c.condition.value) || '(empty)'}
                        </li>
                      ))}
                    </ul>
                    {ev.triggered ? <p className="mt-1.5 text-xs">{ev.rule.actions.map((a) => a.message).join(' · ')}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No enabled expense rules. <Link className="text-primary hover:underline" to="/config/rules">Configure rules</Link></p>
            )}
            {triggered.length && claim.status === 'draft' ? <SimulatedNotice className="mt-3">These rules will run when the claim is submitted.</SimulatedNotice> : null}
          </Section>
          <Section title="Notes">
            {claim.notes.length ? (
              <ul className="mb-3 space-y-2">
                {claim.notes.map((n) => (
                  <li key={n.id} className="bg-muted/40 rounded-md p-2.5 text-sm">
                    <div className="text-muted-foreground mb-0.5 text-xs">{n.by} · {formatDateTime(n.at)}</div>
                    {n.text}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="exp-note">Add a note</Label>
              <Textarea id="exp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" variant="outline" disabled={!note.trim()} onClick={async () => { if (await runWithToast(expenseRepository.addNote(claim.id, note), 'Note added')) setNote('') }}>Add note</Button>
            </div>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Approval workflow" description={workflow ? `${workflow.name} v${workflow.version} (simulated)` : 'No published expense workflow'}>
            {workflow ? (
              <ol className="space-y-3">
                {workflow.stages.map((s, i) => {
                  const met = !s.condition || (s.condition.field === 'amount' ? (s.condition.operator === 'gte' ? claim.amount >= Number(s.condition.value) : s.condition.operator === 'lt' ? claim.amount < Number(s.condition.value) : claim.amount === Number(s.condition.value)) : true)
                  const st = stageState(i, met)
                  return (
                    <li key={s.id} className="flex gap-2 text-sm">
                      {st === 'done' ? <CircleCheck className="text-success mt-0.5 size-4" /> : st === 'rejected' ? <X className="text-destructive mt-0.5 size-4" /> : st === 'skipped' ? <CircleMinus className="text-muted-foreground mt-0.5 size-4" /> : <CircleDashed className={st === 'current' ? 'text-warning mt-0.5 size-4' : 'text-muted-foreground mt-0.5 size-4'} />}
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {ROLE_LABELS[s.assigneeRole]} · {st === 'skipped' ? 'Skipped — condition not met' : st === 'current' ? 'Awaiting action' : st === 'done' ? (s.type === 'notification' ? 'Notified' : 'Completed') : st === 'rejected' ? 'Rejected' : 'Pending'}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <Link className="text-primary text-sm hover:underline" to="/config/workflows">Set up a workflow</Link>
            )}
          </Section>
          <Section title="Status history">
            <ActivityTimeline items={claim.history} />
          </Section>
        </div>
      </div>
      <ExpenseFormDialog open={editOpen} onOpenChange={setEditOpen} claim={claim} />
    </>
  )
}
