import { useNavigate } from 'react-router-dom'
import { Copy, FileStack, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { SavedReport } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { EmptyState } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { useCurrentUser, usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { savedReportRepository } from '@/services'
import { formatDateTime, humanize } from '@/lib/formatting'
import { DATASET_BY_KEY } from '../datasets'

export default function SavedReportsPage() {
  const reports = useCollection('savedReports')
  const canBuild = usePermission('reports.build')
  const user = useCurrentUser()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const duplicate = (r: SavedReport) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = r
    void _id
    void _c
    void _u
    return runWithToast(savedReportRepository.create({ ...rest, name: `${r.name} (copy)`, ownerName: user.name }), 'Report duplicated')
  }

  const remove = async (r: SavedReport) => {
    const { confirmed } = await confirm({ title: `Delete “${r.name}”?`, description: 'The saved definition is removed from this browser. Underlying data is not affected.', confirmLabel: 'Delete', destructive: true })
    if (confirmed) await runWithToast(savedReportRepository.remove(r.id), 'Report deleted')
  }

  const columns: DataColumn<SavedReport>[] = [
    { id: 'name', header: 'Report', alwaysVisible: true, accessor: (r) => r.name, cell: (r) => <div><div className="font-medium">{r.name}</div>{r.description ? <div className="text-muted-foreground text-xs">{r.description}</div> : null}</div> },
    { id: 'dataset', header: 'Dataset', accessor: (r) => DATASET_BY_KEY.get(r.dataset)?.label ?? r.dataset },
    { id: 'shape', header: 'Layout', accessor: (r) => (r.groupBy ? `Grouped by ${r.groupBy}` : `${r.columns.length} columns`) },
    { id: 'presentation', header: 'Presentation', accessor: (r) => humanize(r.presentation) },
    { id: 'filters', header: 'Filters', accessor: (r) => r.filters.length, align: 'right' },
    { id: 'owner', header: 'Owner', accessor: (r) => r.ownerName },
    { id: 'updated', header: 'Updated', accessor: (r) => r.updatedAt, cell: (r) => formatDateTime(r.updatedAt) },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      align: 'right',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/reports/builder?id=${r.id}`)}>
              <Pencil /> Open
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => duplicate(r)} disabled={!canBuild}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(r)} disabled={!canBuild}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Saved reports"
        description="Custom report definitions saved in this browser. Open one to view, edit or export it."
        actions={
          canBuild ? (
            <Button onClick={() => navigate('/reports/builder')}>
              <Plus /> New report
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Saved reports"
        data={reports}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => navigate(`/reports/builder?id=${r.id}`)}
        initialSort={{ id: 'updated', desc: true }}
        exportName="saved-reports"
        emptyState={<EmptyState icon={<FileStack />} title="No saved reports" description="Build a report and save it to see it here." className="border-0" />}
      />
    </>
  )
}
