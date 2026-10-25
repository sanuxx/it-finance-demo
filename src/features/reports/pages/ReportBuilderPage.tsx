import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Braces, Download, FilePlus2, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AggregateFn, ReportDatasetKey, ReportFilter, SavedReport } from '@/domain'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useDb } from '@/hooks/useData'
import { useCurrentUser, usePermission } from '@/hooks/useSession'
import { savedReportRepository } from '@/services'
import { exportCsv, exportJson, timestampedName } from '@/lib/export'
import { AGGREGATE_LABELS, DATASETS, DATASET_BY_KEY, NUMERIC_TYPES, OPERATORS_BY_TYPE, exportRows, runCustomReport, type ReportSpec } from '../datasets'
import { ReportResultView } from '../components/ReportResultView'

interface Draft extends ReportSpec {
  name: string
  description: string
}

const NONE = '__none__'

function blank(dataset: ReportDatasetKey = 'invoices'): Draft {
  const ds = DATASET_BY_KEY.get(dataset)!
  return { name: '', description: '', dataset, columns: ds.fields.slice(0, 5).map((f) => f.key), filters: [], presentation: 'table', dateRange: {} }
}

function fromSaved(r: SavedReport): Draft {
  return { name: r.name, description: r.description ?? '', dataset: r.dataset, columns: r.columns, groupBy: r.groupBy, metric: r.metric, filters: r.filters, dateRange: r.dateRange ?? {}, presentation: r.presentation }
}

export default function ReportBuilderPage() {
  const [params, setParams] = useSearchParams()
  const id = params.get('id') ?? undefined
  const saved = useCollection('savedReports')
  const existing = id ? saved.find((r) => r.id === id) : undefined
  const db = useDb()
  const user = useCurrentUser()
  const canBuild = usePermission('reports.build')
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => (existing ? fromSaved(existing) : blank()))
  const [nameError, setNameError] = useState<string>()

  useEffect(() => {
    setDraft(existing ? fromSaved(existing) : blank())
    setNameError(undefined)
    // Reload only when switching to a different saved report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const ds = DATASET_BY_KEY.get(draft.dataset)!
  const numericFields = ds.fields.filter((f) => NUMERIC_TYPES.includes(f.type))
  const groupable = ds.fields.filter((f) => f.type === 'text' || f.key === 'month' || f.type === 'date')
  const result = useMemo(() => runCustomReport(db, draft), [db, draft])

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const changeDataset = (key: ReportDatasetKey) => setDraft((d) => ({ ...blank(key), name: d.name, description: d.description, presentation: d.presentation }))
  const toggleColumn = (key: string, on: boolean) => patch({ columns: on ? ds.fields.filter((f) => f.key === key || draft.columns.includes(f.key)).map((f) => f.key) : draft.columns.filter((c) => c !== key) })
  const addFilter = () => {
    const f = ds.fields[0]!
    patch({ filters: [...draft.filters, { id: `rf-${Date.now()}`, field: f.key, operator: OPERATORS_BY_TYPE[f.type][0]!.value, value: '' }] })
  }
  const updateFilter = (fid: string, p: Partial<ReportFilter>) => patch({ filters: draft.filters.map((f) => (f.id === fid ? { ...f, ...p } : f)) })

  const save = async (asNew = false) => {
    if (!draft.name.trim()) {
      setNameError('Give the report a name before saving.')
      return
    }
    const payload = { ...draft, name: draft.name.trim(), description: draft.description.trim() || undefined, ownerName: existing?.ownerName ?? user.name }
    try {
      if (existing && !asNew) {
        await savedReportRepository.update(existing.id, payload)
        toast.success('Report definition updated in this browser')
      } else {
        const created = await savedReportRepository.create({ ...payload, ownerName: user.name, name: asNew && existing ? `${payload.name} (copy)` : payload.name })
        toast.success('Report saved in this browser')
        setParams({ id: created.id })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the report.')
    }
  }

  const grouped = !!(draft.groupBy && draft.metric)

  return (
    <>
      <PageHeader
        title={existing ? `Edit report: ${existing.name}` : 'Custom report builder'}
        description="Build a report from an approved demo dataset: pick columns, filters and an optional grouping. Definitions are saved in this browser."
        actions={
          <>
            {existing ? (
              <Button variant="outline" onClick={() => navigate('/reports/builder')}>
                <FilePlus2 /> New report
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/reports/saved">Saved reports</Link>
            </Button>
            {existing ? (
              <Button variant="outline" onClick={() => save(true)} disabled={!canBuild}>
                Save as copy
              </Button>
            ) : null}
            <Button onClick={() => save()} disabled={!canBuild}>
              <Save /> {existing ? 'Update report' : 'Save report'}
            </Button>
          </>
        }
      />
      <SimulatedNotice className="mb-4">The builder works only with whitelisted datasets and fields. Arbitrary queries or SQL are intentionally not supported.</SimulatedNotice>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Section title="1. Details">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rb-name">
                  Report name<span className="text-destructive">*</span>
                </Label>
                <Input id="rb-name" value={draft.name} onChange={(e) => { patch({ name: e.target.value }); setNameError(undefined) }} aria-invalid={!!nameError} aria-describedby={nameError ? 'rb-name-err' : undefined} maxLength={100} placeholder="e.g. Overdue invoices by customer" />
                {nameError ? <p id="rb-name-err" role="alert" className="text-destructive text-xs">{nameError}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-desc">Description</Label>
                <Textarea id="rb-desc" rows={2} value={draft.description} onChange={(e) => patch({ description: e.target.value })} maxLength={300} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rb-ds">Dataset</Label>
                <Select value={draft.dataset} onValueChange={(v) => changeDataset(v as ReportDatasetKey)}>
                  <SelectTrigger id="rb-ds" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATASETS.map((d) => (
                      <SelectItem key={d.key} value={d.key}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{ds.description}</p>
              </div>
            </div>
          </Section>

          <Section title="2. Columns" description={grouped ? 'Columns are replaced by the grouping while a group is set.' : 'Shown in the order listed.'}>
            <fieldset className="grid grid-cols-2 gap-2" disabled={grouped}>
              <legend className="sr-only">Columns</legend>
              {ds.fields.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={draft.columns.includes(f.key)} onCheckedChange={(v) => toggleColumn(f.key, !!v)} />
                  {f.label}
                </label>
              ))}
            </fieldset>
          </Section>

          <Section title="3. Filters" actions={<Button size="xs" variant="outline" onClick={addFilter}><Plus /> Add filter</Button>}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="rb-from" className="text-xs">From ({ds.fields.find((f) => f.key === ds.dateField)?.label})</Label>
                  <Input id="rb-from" type="date" value={draft.dateRange?.from ?? ''} onChange={(e) => patch({ dateRange: { ...draft.dateRange, from: e.target.value || undefined } })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rb-to" className="text-xs">To</Label>
                  <Input id="rb-to" type="date" value={draft.dateRange?.to ?? ''} onChange={(e) => patch({ dateRange: { ...draft.dateRange, to: e.target.value || undefined } })} />
                </div>
              </div>
              {draft.filters.map((f) => {
                const field = ds.fields.find((x) => x.key === f.field) ?? ds.fields[0]!
                return (
                  <div key={f.id} className="flex flex-wrap items-center gap-1.5 rounded-md border p-2">
                    <Select value={f.field} onValueChange={(v) => { const nf = ds.fields.find((x) => x.key === v)!; updateFilter(f.id, { field: v, operator: OPERATORS_BY_TYPE[nf.type][0]!.value, value: '' }) }}>
                      <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Filter field"><SelectValue /></SelectTrigger>
                      <SelectContent>{ds.fields.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={f.operator} onValueChange={(v) => updateFilter(f.id, { operator: v as ReportFilter['operator'] })}>
                      <SelectTrigger size="sm" className="w-28" aria-label="Operator"><SelectValue /></SelectTrigger>
                      <SelectContent>{OPERATORS_BY_TYPE[field.type].map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="h-8 min-w-0 flex-1" aria-label="Filter value" type={field.type === 'date' ? 'date' : NUMERIC_TYPES.includes(field.type) ? 'number' : 'text'} value={f.value} onChange={(e) => updateFilter(f.id, { value: e.target.value })} />
                    <Button size="icon-sm" variant="ghost" onClick={() => patch({ filters: draft.filters.filter((x) => x.id !== f.id) })} aria-label="Remove filter"><X /></Button>
                  </div>
                )
              })}
              {!draft.filters.length ? <p className="text-muted-foreground text-xs">No field filters. Text matches ignore case.</p> : null}
            </div>
          </Section>

          <Section title="4. Grouping & presentation">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rb-group">Group by</Label>
                <Select value={draft.groupBy ?? NONE} onValueChange={(v) => patch(v === NONE ? { groupBy: undefined, metric: undefined } : { groupBy: v, metric: draft.metric ?? { field: numericFields[0]?.key ?? v, fn: numericFields.length ? 'sum' : 'count' } })}>
                  <SelectTrigger id="rb-group" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No grouping (list rows)</SelectItem>
                    {groupable.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {draft.groupBy ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-fn">Aggregate</Label>
                    <Select value={draft.metric?.fn ?? 'sum'} onValueChange={(v) => patch({ metric: { field: draft.metric?.field ?? numericFields[0]?.key ?? '', fn: v as AggregateFn } })}>
                      <SelectTrigger id="rb-fn" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(AGGREGATE_LABELS) as AggregateFn[]).filter((fn) => fn === 'count' || numericFields.length).map((fn) => <SelectItem key={fn} value={fn}>{AGGREGATE_LABELS[fn]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rb-metric">Of field</Label>
                    <Select value={draft.metric?.field ?? ''} onValueChange={(v) => patch({ metric: { fn: draft.metric?.fn ?? 'sum', field: v } })} disabled={draft.metric?.fn === 'count' || !numericFields.length}>
                      <SelectTrigger id="rb-metric" className="w-full"><SelectValue placeholder="Records" /></SelectTrigger>
                      <SelectContent>{numericFields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>Presentation</Label>
                <RadioGroup value={draft.presentation} onValueChange={(v) => patch({ presentation: v as Draft['presentation'] })} className="grid grid-cols-4 gap-2">
                  {(['table', 'bar', 'line', 'pie'] as const).map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm capitalize">
                      <RadioGroupItem value={p} /> {p}
                    </label>
                  ))}
                </RadioGroup>
                {!grouped && draft.presentation !== 'table' ? <p className="text-muted-foreground text-xs">Charts need a grouping — choose a “Group by” field.</p> : null}
              </div>
            </div>
          </Section>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Preview <span className="text-muted-foreground font-normal">· {result.rowCount} matching record(s)</span>
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!result.rows.length} onClick={() => { const rows = exportRows(db, draft); exportCsv(timestampedName(draft.name || 'custom-report'), rows, Object.keys(rows[0] ?? {}).map((h) => ({ header: h, value: (r: Record<string, unknown>) => r[h] as string | number | null }))) }}>
                <Download /> CSV
              </Button>
              <Button size="sm" variant="outline" disabled={!result.rows.length} onClick={() => exportJson(timestampedName(draft.name || 'custom-report'), { definition: draft, rows: exportRows(db, draft) })}>
                <Braces /> JSON
              </Button>
              {existing ? (
                <Button size="sm" variant="ghost" onClick={async () => { await savedReportRepository.remove(existing.id); toast.success('Report deleted'); navigate('/reports/saved') }} disabled={!canBuild}>
                  <Trash2 /> Delete
                </Button>
              ) : null}
            </div>
          </div>
          <ReportResultView result={result} title={draft.name || 'Untitled report'} />
        </div>
      </div>
    </>
  )
}
