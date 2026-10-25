import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Mail, Plus, Save, Send, Trash2 } from 'lucide-react'
import type { DocumentTemplate, TemplateKind } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useDb } from '@/hooks/useData'
import { useCurrentUser, usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { templateRepository } from '@/services'
import { invoiceBalance, invoiceTotals } from '@/lib/calculations/invoices'
import { documentTotals } from '@/lib/calculations/invoices'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { cn } from '@/lib/utils'

const KIND_LABELS: Record<TemplateKind, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  statement: 'Customer statement',
  purchase_order: 'Purchase order',
  approval_email: 'Approval notification email',
  overdue_email: 'Overdue reminder email',
}

/** The controlled set of placeholders. Anything else is shown as unknown. */
const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'organization.name', label: 'Organisation name' },
  { key: 'today', label: 'Today’s date' },
  { key: 'customer.name', label: 'Customer name' },
  { key: 'customer.contact', label: 'Customer contact' },
  { key: 'customer.outstanding', label: 'Customer outstanding balance' },
  { key: 'invoice.number', label: 'Invoice number' },
  { key: 'invoice.total', label: 'Invoice total' },
  { key: 'invoice.dueDate', label: 'Invoice due date' },
  { key: 'invoice.balance', label: 'Invoice balance' },
  { key: 'payment.amount', label: 'Payment amount' },
  { key: 'payment.date', label: 'Payment date' },
  { key: 'po.number', label: 'Purchase order number' },
  { key: 'po.total', label: 'Purchase order total' },
  { key: 'supplier.name', label: 'Supplier name' },
  { key: 'record.label', label: 'Approval record' },
  { key: 'record.amount', label: 'Approval amount' },
  { key: 'approver.name', label: 'Approver name' },
  { key: 'requester.name', label: 'Requester name' },
]

const TOKEN = /\{\{\s*([a-zA-Z.]+)\s*\}\}/g

function renderTemplate(body: string, values: Record<string, string>) {
  const parts: { text: string; kind: 'text' | 'value' | 'unknown' }[] = []
  let last = 0
  for (const m of body.matchAll(TOKEN)) {
    if (m.index! > last) parts.push({ text: body.slice(last, m.index), kind: 'text' })
    const v = values[m[1]!]
    parts.push(v !== undefined ? { text: v, kind: 'value' } : { text: m[0], kind: 'unknown' })
    last = m.index! + m[0].length
  }
  if (last < body.length) parts.push({ text: body.slice(last), kind: 'text' })
  return parts
}

export default function TemplatesPage() {
  const db = useDb()
  const user = useCurrentUser()
  const templates = db.templates
  const canEdit = usePermission('config.edit')
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '')
  const [draft, setDraft] = useState<DocumentTemplate | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId)
    setDraft(t ? structuredClone(t) : null)
  }, [selectedId, templates])

  // Sample values from real demo records (an open invoice and related data).
  const sample = useMemo<Record<string, string>>(() => {
    const open = db.invoices.find((i) => i.status === 'partially_paid') ?? db.invoices.find((i) => i.status === 'issued') ?? db.invoices[0]
    const customer = db.customers.find((c) => c.id === open?.customerId)
    const bal = open ? invoiceBalance(open, db.payments, db.creditNotes) : undefined
    const pay = db.payments.find((p) => p.invoiceId === open?.id) ?? db.payments.find((p) => p.direction === 'incoming')
    const outstanding = customer ? db.invoices.filter((i) => i.customerId === customer.id).reduce((s, i) => s + invoiceBalance(i, db.payments, db.creditNotes).outstanding, 0) : 0
    const po = db.purchaseOrders[0]
    const supplier = db.suppliers.find((s) => s.id === po?.supplierId)
    const pending = db.expenses.find((e) => e.status === 'submitted')
    const requester = db.employees.find((e) => e.id === pending?.employeeId)
    return {
      'organization.name': db.organization.name,
      today: formatDate(new Date().toISOString().slice(0, 10)),
      'customer.name': customer?.name ?? '—',
      'customer.contact': customer?.contactName ?? '—',
      'customer.outstanding': formatCurrency(outstanding),
      'invoice.number': open?.number ?? '—',
      'invoice.total': open ? formatCurrency(invoiceTotals(open).total) : '—',
      'invoice.dueDate': formatDate(open?.dueDate),
      'invoice.balance': formatCurrency(bal?.outstanding ?? 0),
      'payment.amount': formatCurrency(pay?.amount ?? 0),
      'payment.date': formatDate(pay?.date),
      'po.number': po?.number ?? '—',
      'po.total': po ? formatCurrency(documentTotals(po.lines).total) : '—',
      'supplier.name': supplier?.name ?? '—',
      'record.label': pending ? `${pending.number} — ${pending.description}` : 'Expense claim',
      'record.amount': formatCurrency(pending?.amount ?? 0),
      'approver.name': user.name,
      'requester.name': requester?.name ?? 'A team member',
    }
  }, [db, user.name])

  const patch = (p: Partial<DocumentTemplate>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const insert = (key: string) => {
    if (!draft) return
    const el = bodyRef.current
    const token = `{{${key}}}`
    const start = el?.selectionStart ?? draft.body.length
    const end = el?.selectionEnd ?? draft.body.length
    patch({ body: draft.body.slice(0, start) + token + draft.body.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const unknownTokens = useMemo(() => {
    if (!draft) return []
    const text = `${draft.subject ?? ''}\n${draft.body}`
    return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1]!).filter((k) => !PLACEHOLDERS.some((p) => p.key === k)))]
  }, [draft])

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return runWithToast(Promise.reject(new Error('Give the template a name.')))
    if (!draft.body.trim()) return runWithToast(Promise.reject(new Error('The template body cannot be empty.')))
    if (unknownTokens.length) return runWithToast(Promise.reject(new Error(`Unknown placeholder(s): ${unknownTokens.join(', ')}`)))
    const { id, createdAt: _c, updatedAt: _u, ...rest } = draft
    void _c
    void _u
    await runWithToast(templateRepository.update(id, rest), 'Template saved')
  }

  const create = async () => {
    const created = await runWithToast(
      templateRepository.create({ name: 'New template', kind: 'invoice', channel: 'document', accentColor: '#1d4ed8', isDefault: false, body: 'Dear {{customer.name}},\n\n' }),
      'Template created',
    )
    if (created) setSelectedId(created.id)
  }

  const remove = async () => {
    if (!draft) return
    const { confirmed } = await confirm({ title: `Delete "${draft.name}"?`, confirmLabel: 'Delete', destructive: true })
    if (confirmed) {
      await runWithToast(templateRepository.remove(draft.id), 'Template deleted')
      setSelectedId(templates.find((t) => t.id !== draft.id)?.id ?? '')
    }
  }

  const sendTest = () => {
    toast.success('Test email simulated', { description: `Nothing was sent. In production this would go to ${user.email}.` })
  }

  return (
    <>
      <PageHeader
        title="Document & email templates"
        description="Configure invoice, receipt, statement and purchase order layouts and notification emails using a controlled set of placeholders."
        actions={canEdit ? <Button onClick={create}><Plus /> New template</Button> : null}
      />
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <Section title="Templates" className="h-fit">
          <ul className="-mx-2 space-y-0.5">
            {templates.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} aria-current={t.id === selectedId ? 'true' : undefined} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', t.id === selectedId ? 'bg-accent font-medium' : 'hover:bg-accent/60')}>
                  {t.channel === 'email' ? <Mail className="text-muted-foreground size-4 shrink-0" /> : <FileText className="text-muted-foreground size-4 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block truncate">{t.name}</span>
                    <span className="text-muted-foreground block truncate text-[11px] font-normal">{KIND_LABELS[t.kind]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
        {draft ? (
          <div className="grid min-w-0 gap-5 xl:grid-cols-2">
            <Section
              title="Edit template"
              actions={
                canEdit ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={remove}><Trash2 /> Delete</Button>
                    <Button size="sm" onClick={save}><Save /> Save</Button>
                  </>
                ) : null
              }
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-name">Name</Label>
                    <Input id="tpl-name" value={draft.name} disabled={!canEdit} onChange={(e) => patch({ name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-kind">Type</Label>
                    <Select value={draft.kind} disabled={!canEdit} onValueChange={(v) => patch({ kind: v as TemplateKind, channel: v.endsWith('_email') ? 'email' : 'document' })}>
                      <SelectTrigger id="tpl-kind" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => (
                          <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {draft.channel === 'email' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-subject">Subject</Label>
                    <Input id="tpl-subject" value={draft.subject ?? ''} disabled={!canEdit} onChange={(e) => patch({ subject: e.target.value })} />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-body">Body</Label>
                  <Textarea id="tpl-body" ref={bodyRef} rows={9} value={draft.body} disabled={!canEdit} onChange={(e) => patch({ body: e.target.value })} className="font-mono text-xs" />
                  {unknownTokens.length ? <p className="text-destructive text-xs" role="alert">Unknown placeholder(s): {unknownTokens.map((t) => `{{${t}}}`).join(', ')}</p> : null}
                </div>
                <div>
                  <div className="mb-1.5 text-sm font-medium">Insert placeholder</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((p) => (
                      <Button key={p.key} type="button" variant="outline" size="xs" disabled={!canEdit} title={p.label} onClick={() => insert(p.key)} className="font-mono">
                        {p.key}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tpl-color">Accent colour</Label>
                    <input id="tpl-color" type="color" value={draft.accentColor} disabled={!canEdit} onChange={(e) => patch({ accentColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded border bg-transparent" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="tpl-default" checked={draft.isDefault} disabled={!canEdit} onCheckedChange={(c) => patch({ isDefault: c })} />
                    <Label htmlFor="tpl-default">Default for this type</Label>
                  </div>
                </div>
              </div>
            </Section>
            <Section
              title="Preview with sample data"
              description="Placeholders are filled from real demo records."
              actions={draft.channel === 'email' ? <Button variant="outline" size="sm" onClick={sendTest}><Send /> Send test (simulated)</Button> : null}
            >
              <div className="bg-background overflow-hidden rounded-lg border">
                <div className="h-1.5" style={{ background: draft.accentColor }} />
                <div className="space-y-3 p-5">
                  {draft.channel === 'email' ? (
                    <div className="text-muted-foreground space-y-0.5 border-b pb-3 text-xs">
                      <div><span className="font-medium">To:</span> {sample['customer.contact']} (simulated)</div>
                      <div className="text-foreground text-sm font-medium">
                        <TemplateText parts={renderTemplate(draft.subject ?? '', sample)} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between border-b pb-3">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: draft.accentColor }}>{db.organization.name}</div>
                        <div className="text-muted-foreground text-xs">{db.organization.address}</div>
                      </div>
                      <div className="text-right text-xs font-semibold tracking-wide uppercase">{KIND_LABELS[draft.kind]}</div>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    <TemplateText parts={renderTemplate(draft.body, sample)} />
                  </p>
                </div>
              </div>
              <SimulatedNotice className="mt-3" tone="demo">Previews only — this demo never sends emails or delivers documents.</SimulatedNotice>
            </Section>
          </div>
        ) : null}
      </div>
    </>
  )
}

function TemplateText({ parts }: { parts: ReturnType<typeof renderTemplate> }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : p.kind === 'value' ? (
          <mark key={i} className="bg-primary/10 text-foreground rounded px-0.5">{p.text}</mark>
        ) : (
          <mark key={i} className="bg-destructive/15 text-destructive rounded px-0.5">{p.text}</mark>
        ),
      )}
    </>
  )
}
