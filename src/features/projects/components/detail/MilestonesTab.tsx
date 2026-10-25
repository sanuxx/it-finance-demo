import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Milestone, MilestoneStatus, Project } from '@/domain'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection } from '@/hooks/useData'
import { runWithToast } from '@/hooks/useAction'
import { milestoneRepository } from '@/services'
import { compare, subtract, sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { todayISO } from '@/lib/dates'
import { MILESTONE_STATUS_LABELS } from '../../lib/labels'
import { MilestoneDialog } from '../MilestoneDialog'

export function MilestonesTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const milestones = useCollection('milestones')
  const invoices = useCollection('invoices')
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; milestone?: Milestone }>({ open: false })
  const rows = useMemo(() => milestones.filter((m) => m.projectId === project.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [milestones, project.id])
  const total = sum(rows, (m) => m.amount)
  const diff = subtract(project.contractValue, total)
  const today = todayISO()

  const remove = async (m: Milestone) => {
    const { confirmed } = await confirm({ title: `Delete “${m.name}”?`, destructive: true, confirmLabel: 'Delete milestone' })
    if (confirmed) await runWithToast(milestoneRepository.remove(m.id), 'Milestone deleted')
  }

  const columns: DataColumn<Milestone>[] = [
    { id: 'name', header: 'Milestone', accessor: (m) => m.name, alwaysVisible: true, cell: (m) => <span className="font-medium">{m.name}</span> },
    {
      id: 'due',
      header: 'Due',
      accessor: (m) => m.dueDate,
      cell: (m) => (
        <span className={m.dueDate < today && (m.status === 'pending' || m.status === 'in_progress') ? 'text-destructive' : ''}>
          {formatDate(m.dueDate)}
          {m.dueDate < today && (m.status === 'pending' || m.status === 'in_progress') ? ' · late' : ''}
        </span>
      ),
    },
    { id: 'amount', header: 'Amount', accessor: (m) => m.amount, align: 'right', cell: (m) => <Money value={m.amount} /> },
    {
      id: 'status',
      header: 'Status',
      accessor: (m) => m.status,
      cell: (m) =>
        canEdit && m.status !== 'invoiced' ? (
          <Select value={m.status} onValueChange={(v) => runWithToast(milestoneRepository.update(m.id, { status: v as MilestoneStatus }), 'Milestone status updated')}>
            <SelectTrigger size="sm" className="h-8 w-36" aria-label={`Status of ${m.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['pending', 'in_progress', 'completed'] as MilestoneStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {MILESTONE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <StatusBadge status={m.status} />
        ),
    },
    {
      id: 'invoice',
      header: 'Invoice',
      accessor: (m) => invoices.find((i) => i.id === m.invoiceId)?.number,
      cell: (m) => {
        const inv = invoices.find((i) => i.id === m.invoiceId)
        return inv ? <Link to={`/sales/invoices/${inv.id}`} className="text-primary hover:underline">{inv.number}</Link> : <span className="text-muted-foreground">—</span>
      },
    },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      align: 'right',
      cell: (m) =>
        canEdit ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${m.name}`} onClick={() => setDialog({ open: true, milestone: m })}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${m.name}`} disabled={m.status === 'invoiced'} onClick={() => remove(m)}>
              <Trash2 />
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      {rows.length && !project.isInternal && compare(total, project.contractValue) !== 0 ? (
        <SimulatedNotice tone="warning">
          Milestones total {formatCurrency(total)}, which is {diff > 0 ? `${formatCurrency(diff)} below` : `${formatCurrency(-diff)} above`} the contract value of {formatCurrency(project.contractValue)}.
        </SimulatedNotice>
      ) : null}
      <DataTable
        caption={`Milestones for ${project.code}`}
        data={rows}
        columns={columns}
        getRowId={(m) => m.id}
        exportName={`${project.code}-milestones`}
        initialSort={{ id: 'due' }}
        toolbar={
          canEdit ? (
            <Button size="sm" className="h-9" onClick={() => setDialog({ open: true })}>
              <Plus /> Add milestone
            </Button>
          ) : null
        }
      />
      <MilestoneDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} projectId={project.id} milestone={dialog.milestone} />
    </div>
  )
}
