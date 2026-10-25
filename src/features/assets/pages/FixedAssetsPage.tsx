import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, HardDrive, Pencil, Plus, Trash2 } from 'lucide-react'
import type { FixedAsset } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { statusLabel } from '@/components/data-display/statusMeta'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { assetRepository } from '@/services'
import { add } from '@/lib/calculations/money'
import { formatCurrency, formatDate } from '@/lib/formatting'
import { RowActions } from '@/features/procurement/components/shared'
import { AssetFormDialog } from '../components/AssetFormDialog'
import { useAssetRows, type AssetRow } from '../components/useAssetRows'

export default function FixedAssetsPage() {
  const rows = useAssetRows()
  const lookups = useLookups()
  const canEdit = usePermission('assets.edit')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FixedAsset | undefined>()

  const active = rows.filter((r) => r.status !== 'disposed')
  const totals = {
    cost: active.reduce((s, r) => add(s, r.cost), 0),
    accumulated: active.reduce((s, r) => add(s, r.accumulated), 0),
    book: active.reduce((s, r) => add(s, r.bookValue), 0),
    monthly: active.reduce((s, r) => add(s, r.monthly), 0),
  }

  const dispose = async (a: AssetRow) => {
    const { confirmed, reason } = await confirm({
      title: `Dispose of ${a.tag}?`,
      description: `${a.name} will stop depreciating and be removed from book value totals. This is an illustrative register change — no disposal journal or gain/loss is calculated.`,
      requireReason: true,
      reasonLabel: 'Disposal note',
      confirmLabel: 'Mark disposed',
      destructive: true,
    })
    if (confirmed) await runWithToast(assetRepository.update(a.id, { status: 'disposed', location: `Disposed — ${reason}` }), `${a.tag} marked as disposed`)
  }
  const remove = async (a: AssetRow) => {
    const { confirmed } = await confirm({ title: `Delete ${a.tag}?`, description: 'The asset and its depreciation history will be removed from this browser’s demo data. Consider disposing of it instead.', confirmLabel: 'Delete', destructive: true })
    if (confirmed) await runWithToast(assetRepository.remove(a.id), 'Asset deleted')
  }

  const columns: DataColumn<AssetRow>[] = [
    { id: 'tag', header: 'Asset', accessor: (r) => r.tag, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.tag}</div></div> },
    { id: 'name', header: 'Name', accessor: (r) => r.name, defaultHidden: true },
    { id: 'class', header: 'Class', accessor: (r) => lookups.master(r.assetClassId) },
    { id: 'department', header: 'Department', accessor: (r) => lookups.master(r.departmentId), defaultHidden: true },
    { id: 'location', header: 'Location', accessor: (r) => r.location, defaultHidden: true },
    { id: 'purchased', header: 'Purchased', accessor: (r) => r.purchaseDate, cell: (r) => formatDate(r.purchaseDate) },
    { id: 'method', header: 'Method', accessor: (r) => (r.method === 'straight_line' ? 'Straight line' : 'Declining balance'), defaultHidden: true },
    { id: 'cost', header: 'Cost', accessor: (r) => r.cost, align: 'right', cell: (r) => <Money value={r.cost} /> },
    { id: 'accumulated', header: 'Accum. depreciation', accessor: (r) => r.accumulated, align: 'right', cell: (r) => <Money value={r.accumulated} /> },
    { id: 'book', header: 'Book value', accessor: (r) => r.bookValue, align: 'right', cell: (r) => <Money value={r.bookValue} className="font-medium" /> },
    { id: 'consumed', header: 'Life used', accessor: (r) => r.consumed, cell: (r) => (r.consumed === null ? '—' : <ProgressBar value={r.consumed} tone="primary" className="min-w-28" label={`${r.tag} depreciated`} />) },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
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
          <RowActions
            label={r.tag}
            actions={[
              { label: 'Edit', icon: <Pencil />, onSelect: () => { setEditing(r); setOpen(true) }, disabled: r.status === 'disposed' },
              ...(r.status !== 'disposed' ? [{ label: 'Dispose…', icon: <Archive />, onSelect: () => dispose(r) }] : []),
              { label: 'Delete', icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => remove(r) },
            ]}
          />
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Fixed assets"
        description="Asset register with depreciation calculated from cost, salvage value, useful life and method."
        actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> Add asset</Button> : null}
      />
      <StatGrid className="mb-6">
        <StatCard label="Cost (in use)" value={formatCurrency(totals.cost)} hint={`${active.length} assets`} />
        <StatCard label="Accumulated depreciation" term="Depreciation" value={formatCurrency(totals.accumulated)} />
        <StatCard label="Net book value" value={formatCurrency(totals.book)} />
        <StatCard label="Depreciation this month" value={formatCurrency(totals.monthly)} to="/assets/depreciation" />
      </StatGrid>
      <DataTable
        caption="Fixed asset register"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="fixed-assets"
        initialSort={{ id: 'book', desc: true }}
        onRowClick={(r) => navigate(`/assets/${r.id}`)}
        filters={[
          { id: 'status', label: 'Statuses', options: ['active', 'fully_depreciated', 'disposed'].map((s) => ({ value: s, label: statusLabel(s) })), predicate: (r, v) => r.status === v },
          { id: 'class', label: 'Classes', options: [...new Set(rows.map((r) => r.assetClassId))].map((id) => ({ value: id, label: lookups.master(id) })), predicate: (r, v) => r.assetClassId === v },
        ]}
        emptyState={<EmptyState icon={<HardDrive />} title="No assets registered" className="border-0" />}
      />
      <SimulatedNotice className="mt-4">Depreciation is an illustrative calculation for this demo and does not post journals or constitute accounting advice.</SimulatedNotice>
      <AssetFormDialog open={open} onOpenChange={setOpen} asset={editing} />
    </>
  )
}
