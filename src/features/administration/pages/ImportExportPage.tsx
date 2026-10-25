import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Database, Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react'
import type { CollectionKey } from '@/domain'
import { Button } from '@/components/ui/button'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useDb } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useDemoStore } from '@/services'
import { exportCsv, exportJson, timestampedName } from '@/lib/export'
import { humanize } from '@/lib/formatting'
import { MAX_IMPORT_BYTES, collectionKeys, columnsFor, parseBackup } from '../lib/dataTransfer'

interface Row {
  key: CollectionKey
  count: number
}

export default function ImportExportPage() {
  const db = useDb()
  const canManage = usePermission('admin.manage')
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const rows = useMemo<Row[]>(() => collectionKeys(db).map((key) => ({ key, count: (db[key] as unknown[]).length })), [db])

  const exportCollectionCsv = (key: CollectionKey) => {
    const data = db[key] as unknown as Record<string, unknown>[]
    if (!data.length) return toast.info('This collection is empty.')
    exportCsv(timestampedName(`demo-${key}`), data, columnsFor(data))
  }

  const onFile = async (file: File | undefined) => {
    setImportError(null)
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return setImportError('The file is larger than 8 MB.')
    const result = parseBackup(await file.text())
    if (fileRef.current) fileRef.current.value = ''
    if (!result.ok) return setImportError(result.error)
    const { confirmed } = await confirm({
      title: 'Replace the demo data with this backup?',
      description: (
        <div className="space-y-2">
          <p>
            “{file.name}” contains {result.counts.toLocaleString('en-LK')} records{result.migrated ? ' and will be upgraded to the current format' : ''}. All current demo data in this browser will be replaced.
          </p>
          <p>Tip: export a backup of the current data first if you might want it back.</p>
        </div>
      ),
      confirmLabel: 'Replace demo data',
      destructive: true,
    })
    if (!confirmed) return
    useDemoStore.getState().replace(result.db)
    toast.success('Backup imported — data replaced in this browser only')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'name', header: 'Collection', accessor: (r) => humanize(r.key.replace(/([A-Z])/g, ' $1').toLowerCase()), alwaysVisible: true, cell: (r) => <div><div className="font-medium">{humanize(r.key.replace(/([A-Z])/g, ' $1').toLowerCase())}</div><code className="text-muted-foreground text-[11px]">{r.key}</code></div> },
    { id: 'count', header: 'Records', accessor: (r) => r.count, align: 'right' },
    {
      id: 'actions', header: 'Export', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="outline" size="sm" disabled={!r.count} onClick={() => exportCollectionCsv(r.key)}><FileSpreadsheet /> CSV</Button>
          <Button variant="outline" size="sm" disabled={!r.count} onClick={() => exportJson(timestampedName(`demo-${r.key}`), db[r.key])}><FileJson /> JSON</Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Import & export" description="Download demo data as CSV or JSON, or restore a JSON backup into this browser." />
      <SimulatedNotice className="mb-5">Files are generated and read entirely in your browser — nothing is uploaded to any server.</SimulatedNotice>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title="Full backup" description="Everything in this demo, as one JSON file.">
          <Button onClick={() => exportJson(timestampedName('it-finance-demo-backup'), db)}><Download /> Download backup (.json)</Button>
        </Section>
        <Section title="Restore from backup" description="Replace the current demo data with a backup file exported from this demo (max 8 MB).">
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" id="import-file" onChange={(e) => onFile(e.target.files?.[0])} disabled={!canManage} />
          <Button variant="outline" disabled={!canManage} onClick={() => fileRef.current?.click()}><Upload /> Choose backup file…</Button>
          {!canManage ? <p className="text-muted-foreground mt-2 text-xs">Your demo role cannot import data.</p> : null}
          {importError ? <p role="alert" className="text-destructive mt-2 text-sm">Import failed: {importError}</p> : null}
        </Section>
      </div>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Database className="size-4" /> Collections</h2>
      <DataTable caption="Data collections" data={rows} columns={columns} getRowId={(r) => r.key} pageSize={25} initialSort={{ id: 'count', desc: true }} />
    </>
  )
}
