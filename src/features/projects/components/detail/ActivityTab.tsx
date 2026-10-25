import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, FileText, History, Receipt, Wrench } from 'lucide-react'
import type { Project } from '@/domain'
import { Section } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/feedback/Feedback'
import { useDbSlice } from '@/hooks/useData'
import { invoiceTotals } from '@/lib/calculations/invoices'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/formatting'

interface Event {
  id: string
  at: string
  kind: 'invoice' | 'payment' | 'cost' | 'milestone' | 'audit'
  title: string
  detail?: string
  to?: string
}

const ICON = { invoice: FileText, payment: CircleDollarSign, cost: Wrench, milestone: Receipt, audit: History }

export function ActivityTab({ project }: { project: Project }) {
  const db = useDbSlice('invoices', 'payments', 'projectCosts', 'milestones', 'auditLog', 'allocations')
  const events = useMemo<Event[]>(() => {
    const out: Event[] = []
    const invs = db.invoices.filter((i) => i.projectId === project.id)
    const invIds = new Set(invs.map((i) => i.id))
    for (const i of invs) {
      for (const h of i.history) out.push({ id: `${i.id}:${h.at}:${h.status}`, at: h.at, kind: 'invoice', title: `${i.number} ${h.status.replace('_', ' ')}`, detail: h.note ?? formatCurrency(invoiceTotals(i).total), to: `/sales/invoices/${i.id}` })
    }
    for (const p of db.payments) if (p.invoiceId && invIds.has(p.invoiceId)) out.push({ id: p.id, at: `${p.date}T12:00:00.000Z`, kind: 'payment', title: `Simulated receipt ${p.number}`, detail: formatCurrency(p.amount) })
    for (const c of db.projectCosts) if (c.projectId === project.id) out.push({ id: c.id, at: c.createdAt, kind: 'cost', title: `${c.committed ? 'Committed' : 'Cost'}: ${c.description}`, detail: formatCurrency(c.amount) })
    const related = new Set([project.id, ...invIds, ...db.projectCosts.filter((c) => c.projectId === project.id).map((c) => c.id), ...db.milestones.filter((m) => m.projectId === project.id).map((m) => m.id), ...db.allocations.filter((a) => a.projectId === project.id).map((a) => a.id)])
    for (const a of db.auditLog) if (a.entityId && related.has(a.entityId)) out.push({ id: a.id, at: a.at, kind: 'audit', title: a.summary, detail: `${a.actor} · ${a.entity.replace(/_/g, ' ')}` })
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80)
  }, [db, project.id])

  return (
    <Section title="Financial activity" description="Invoices, simulated payments, cost entries and changes made in this browser.">
      {events.length ? (
        <ol className="space-y-3">
          {events.map((e) => {
            const Icon = ICON[e.kind]
            return (
              <li key={e.id} className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{e.to ? <Link to={e.to} className="hover:underline">{e.title}</Link> : e.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {e.kind === 'payment' ? formatDate(e.at.slice(0, 10)) : formatDateTime(e.at)}
                    {e.detail ? ` · ${e.detail}` : ''}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState title="No activity yet" className="border-0" />
      )}
    </Section>
  )
}
