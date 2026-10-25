import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProjectCostEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { projectCostRepository } from '@/services'
import { sum } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { CostEntryDialog } from '../components/CostEntryDialog'
import { COST_TYPE_LABELS, toOptions } from '../lib/labels'

export default function CostEntriesPage() {
  const entries = useCollection('projectCosts')
  const projects = useCollection('projects')
  const lookups = useLookups()
  const canEdit = usePermission('projects.edit')
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; entry?: ProjectCostEntry }>({ open: false })

  const incurred = useMemo(() => entries.filter((e) => !e.committed), [entries])
  const committed = useMemo(() => entries.filter((e) => e.committed), [entries])

  const remove = async (e: ProjectCostEntry) => {
    const { confirmed } = await confirm({ title: 'Delete this cost entry?', description: `${e.description} (${formatCurrency(e.amount)}). Project actuals will be recalculated.`, destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(projectCostRepository.remove(e.id), 'Cost entry deleted')
  }

  const columns: DataColumn<ProjectCostEntry>[] = [
    { id: 'date', header: 'Date', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'project', header: 'Project', accessor: (r) => lookups.projectCode(r.projectId), cell: (r) => <Link to={`/projects/${r.projectId}?tab=costs`} className="text-primary hover:underline">{lookups.projectCode(r.projectId)}</Link>, exportValue: (r) => `${lookups.projectCode(r.projectId)} ${lookups.project(r.projectId)}` },
    { id: 'description', header: 'Description', accessor: (r) => r.description, alwaysVisible: true },
    { id: 'type', header: 'Type', accessor: (r) => COST_TYPE_LABELS[r.type] },
    { id: 'code', header: 'Cost code', accessor: (r) => (r.costCodeId ? lookups.master(r.costCodeId) : undefined), defaultHidden: true },
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
        canEdit ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Edit cost entry" onClick={() => setDialog({ open: true, entry: r })}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete cost entry" onClick={() => remove(r)}>
              <Trash2 />
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Cost entries"
        description="Manually recorded direct project costs and commitments. Labour, approved bills, expense claims and cloud usage are attributed to projects automatically."
        actions={
          canEdit ? (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus /> Add cost entry
            </Button>
          ) : null
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Incurred (manual)" value={formatCurrency(sum(incurred, (e) => e.amount))} hint={`${incurred.length} entries`} />
        <StatCard label="Committed" term="Committed cost" value={formatCurrency(sum(committed, (e) => e.amount))} hint={`${committed.length} open commitments`} />
        <StatCard label="Billable share" value={formatCurrency(sum(incurred.filter((e) => e.billable), (e) => e.amount))} hint="Rechargeable to clients" />
        <StatCard label="Projects with entries" value={new Set(entries.map((e) => e.projectId)).size} hint={`of ${projects.length} projects`} />
      </StatGrid>
      <DataTable
        caption="Project cost entries"
        data={entries}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="project-cost-entries"
        initialSort={{ id: 'date', desc: true }}
        searchPlaceholder="Search description, project…"
        selectable={canEdit}
        bulkActions={[
          {
            label: 'Mark as incurred',
            disabled: (rows) => !rows.some((r) => r.committed),
            onClick: async (rows) => {
              for (const r of rows.filter((x) => x.committed)) await projectCostRepository.update(r.id, { committed: false })
              await runWithToast(Promise.resolve(), `${rows.filter((x) => x.committed).length} commitment(s) marked as incurred`)
            },
          },
        ]}
        filters={[
          { id: 'project', label: 'Projects', options: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })), predicate: (r, v) => r.projectId === v },
          { id: 'type', label: 'Types', options: toOptions(COST_TYPE_LABELS), predicate: (r, v) => r.type === v },
          { id: 'state', label: 'States', options: [{ value: 'incurred', label: 'Incurred' }, { value: 'committed', label: 'Committed' }], predicate: (r, v) => r.committed === (v === 'committed') },
        ]}
      />
      <SimulatedNotice className="mt-4">Cost entries are illustrative records stored in this browser; nothing is posted to an accounting ledger.</SimulatedNotice>
      <CostEntryDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} entry={dialog.entry} />
    </>
  )
}
