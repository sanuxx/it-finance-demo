import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSearch, Lock, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { DateRangeSelect } from '@/components/forms/DateRangeSelect'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useDb } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { exportCsv, timestampedName } from '@/lib/export'
import { DATE_PRESET_LABELS, presetRange, todayISO, type DatePreset } from '@/lib/dates'
import { formatDate } from '@/lib/formatting'
import { REPORT_BY_KEY } from '../registry'
import { ReportResultView, reportExportColumns } from '../components/ReportResultView'

export default function ReportViewerPage() {
  const { reportKey = '' } = useParams()
  const def = REPORT_BY_KEY.get(reportKey)
  const db = useDb()
  const [preset, setPreset] = useState<DatePreset>('ytd')
  const allowed = usePermission(def?.permission ?? 'reports.view')
  const asOf = todayISO()
  const range = useMemo(() => presetRange(preset), [preset])
  const result = useMemo(() => (def && allowed ? def.build(db, { range, asOf }) : undefined), [def, allowed, db, range, asOf])

  if (!def) {
    return (
      <EmptyState
        icon={<FileSearch />}
        title="Report not found"
        description="This report does not exist in the demo report centre."
        action={
          <Button asChild size="sm">
            <Link to="/reports">Back to report centre</Link>
          </Button>
        }
        className="mt-10"
      />
    )
  }
  if (!allowed || !result) {
    return <EmptyState icon={<Lock />} title="Not available to your demo role" description="This report contains fictional employee cost data and needs the simulated 'view employee cost rates' permission. Switch role from the user menu." className="mt-10" />
  }

  const periodLabel = def.dateMode === 'asOf' ? `As at ${formatDate(asOf)}` : `${DATE_PRESET_LABELS[preset]}${range.from ? ` · ${formatDate(range.from)} – ${formatDate(range.to)}` : ''}`

  return (
    <>
      <PageHeader
        title={def.title}
        description={def.description}
        meta={<span className="text-muted-foreground text-xs">{periodLabel}</span>}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reports">
                <ArrowLeft /> All reports
              </Link>
            </Button>
            {def.dateMode === 'range' ? <DateRangeSelect value={preset} onChange={setPreset} /> : null}
            <Button variant="outline" size="sm" className="h-9" onClick={() => exportCsv(timestampedName(def.key), result.totals ? [...result.rows.filter((r) => r._kind !== 'section'), result.totals] : result.rows, reportExportColumns(result))}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </>
        }
      />
      <SimulatedNotice tone="demo" className="mb-4">
        Illustrative — not a statutory financial statement. Calculated in your browser from fictional demo records.
      </SimulatedNotice>
      <ReportResultView result={result} title={def.title} />
    </>
  )
}
