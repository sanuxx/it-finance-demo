import { useMemo, useState } from 'react'
import type { AuditEntry } from '@/domain'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { ROLE_LABELS } from '@/app/state/preferences'
import { useCollection } from '@/hooks/useData'
import { inRange, presetRange, type DatePreset } from '@/lib/dates'
import { formatDateTime, humanize } from '@/lib/formatting'

export default function AuditLogPage() {
  const log = useCollection('auditLog')
  const [preset, setPreset] = useState<DatePreset>('all')
  const data = useMemo(() => {
    const r = presetRange(preset)
    return log.filter((e) => inRange(e.at.slice(0, 10), r.from, r.to))
  }, [log, preset])

  const uniq = (pick: (e: AuditEntry) => string) => [...new Set(log.map(pick))].sort().map((v) => ({ value: v, label: humanize(v) }))

  const columns: DataColumn<AuditEntry>[] = [
    { id: 'at', header: 'When', accessor: (r) => r.at, cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.at)}</span> },
    { id: 'actor', header: 'User', accessor: (r) => r.actor, cell: (r) => <div><div>{r.actor}</div><div className="text-muted-foreground text-xs">{ROLE_LABELS[r.role]}</div></div> },
    { id: 'action', header: 'Action', accessor: (r) => humanize(r.action) },
    { id: 'entity', header: 'Record type', accessor: (r) => humanize(r.entity) },
    { id: 'summary', header: 'Summary', accessor: (r) => r.summary, alwaysVisible: true },
    { id: 'entityId', header: 'Record id', accessor: (r) => r.entityId, defaultHidden: true },
  ]

  return (
    <>
      <PageHeader title="Audit log" description="Every change made through the demo in this browser, newest first (up to 500 entries)." />
      <SimulatedNotice className="mb-4" tone="demo">A demonstration activity trail stored locally — it is not a tamper-proof audit record.</SimulatedNotice>
      <DataTable
        caption="Audit log"
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="audit-log"
        initialSort={{ id: 'at', desc: true }}
        pageSize={25}
        toolbar={<DateRangeSelect value={preset} onChange={setPreset} />}
        filters={[
          { id: 'actor', label: 'Users', options: [...new Set(log.map((e) => e.actor))].sort().map((v) => ({ value: v, label: v })), predicate: (r, v) => r.actor === v },
          { id: 'entity', label: 'Record types', options: uniq((e) => e.entity), predicate: (r, v) => r.entity === v },
          { id: 'action', label: 'Actions', options: uniq((e) => e.action), predicate: (r, v) => r.action === v },
        ]}
      />
    </>
  )
}
