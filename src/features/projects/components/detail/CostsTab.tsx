import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { CostType, Project, ProjectCostEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip, SERIES, axisProps, currencyTick, gridProps } from '@/components/charts/chartKit'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { runWithToast } from '@/hooks/useAction'
import { projectCostRepository } from '@/services'
import type { ProjectFinancials } from '@/lib/calculations/projects'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { COST_TYPE_LABELS } from '../../lib/labels'
import type { ProjectCostLine } from '../../lib/projectCosts'
import { CostEntryDialog } from '../CostEntryDialog'

export function CostsTab({ project, fin, lines, canEdit }: { project: Project; fin: ProjectFinancials; lines: ProjectCostLine[]; canEdit: boolean }) {
  const entries = useCollection('projectCosts')
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; entry?: ProjectCostEntry }>({ open: false })

  const byType = useMemo(
    () =>
      (Object.keys(COST_TYPE_LABELS) as CostType[])
        .map((t) => ({ name: COST_TYPE_LABELS[t], value: fin.breakdown[t] }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    [fin],
  )

  const removeEntry = async (id: string) => {
    const { confirmed } = await confirm({ title: 'Delete this cost entry?', description: 'Project actual cost and forecasts will be recalculated.', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(projectCostRepository.remove(id), 'Cost entry deleted')
  }

  const columns: DataColumn<ProjectCostLine>[] = [
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'description', header: 'Description', accessor: (r) => r.description, alwaysVisible: true },
    { id: 'source', header: 'Source', accessor: (r) => r.source },
    { id: 'type', header: 'Type', accessor: (r) => COST_TYPE_LABELS[r.type] },
    { id: 'billable', header: 'Billable', accessor: (r) => (r.billable ? 'Billable' : 'Non-billable') },
    { id: 'state', header: 'State', accessor: (r) => (r.committed ? 'Committed' : 'Incurred'), cell: (r) => <StatusBadge status={r.committed ? 'pending' : 'posted'} label={r.committed ? 'Committed' : 'Incurred'} /> },
    { id: 'amount', header: 'Amount', accessor: (r) => r.amount, align: 'right', cell: (r) => <Money value={r.amount} /> },
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
        canEdit && r.entryId ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Edit cost entry" onClick={() => setDialog({ open: true, entry: entries.find((e) => e.id === r.entryId) })}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete cost entry" onClick={() => removeEntry(r.entryId!)}>
              <Trash2 />
            </Button>
          </div>
        ) : r.entryId ? null : (
          <span className="text-muted-foreground text-xs">Read-only</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <ChartCard
        title="Incurred cost by type"
        description={`Total ${formatCurrency(fin.actualCost)} incurred · ${formatCurrency(fin.committedCost)} committed`}
        height={240}
        table={{ rows: byType, columns: [{ header: 'Type', value: (r) => r.name }, { header: 'Amount', value: (r) => formatCurrency(r.value), align: 'right' }] }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byType} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <Bar dataKey="value" name="Cost" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <DataTable
        caption={`Cost lines for ${project.code}`}
        data={lines}
        columns={columns}
        getRowId={(r) => r.id}
        exportName={`${project.code}-costs`}
        initialSort={{ id: 'date', desc: true }}
        searchPlaceholder="Search costs…"
        filters={[
          { id: 'source', label: 'Sources', options: ['Manual entry', 'Timesheets', 'Expense claim', 'Supplier bill', 'Cloud', 'AI usage'].map((s) => ({ value: s, label: s })), predicate: (r, v) => r.source === v },
          { id: 'type', label: 'Types', options: Object.entries(COST_TYPE_LABELS).map(([value, label]) => ({ value, label })), predicate: (r, v) => r.type === v },
          { id: 'billable', label: 'Billable', options: [{ value: 'yes', label: 'Billable' }, { value: 'no', label: 'Non-billable' }], predicate: (r, v) => r.billable === (v === 'yes') },
        ]}
        toolbar={
          canEdit ? (
            <Button size="sm" className="h-9" onClick={() => setDialog({ open: true })}>
              <Plus /> Add cost
            </Button>
          ) : null
        }
      />
      <CostEntryDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} entry={dialog.entry} projectId={project.id} />
    </div>
  )
}
