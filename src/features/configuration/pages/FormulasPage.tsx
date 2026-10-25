import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Copy, Plus, Save, Sigma, Trash2, XCircle } from 'lucide-react'
import type { FormulaDefinition, FormulaVariable } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { formulaRepository } from '@/services'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { FORMULA_FUNCTIONS, evaluateFormula } from '../lib/formula'

type Draft = Omit<FormulaDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

const BLANK: Draft = { name: 'New formula', description: '', expression: 'a + b', format: 'number', variables: [{ key: 'a', label: 'Value A', sampleValue: 10 }, { key: 'b', label: 'Value B', sampleValue: 5 }] }

const KEY_RE = /^[a-z_][a-z0-9_]*$/

function formatResult(value: number, format: FormulaDefinition['format']) {
  return format === 'currency' ? formatCurrency(value) : format === 'percent' ? formatPercent(value, 2) : formatNumber(value)
}

export default function FormulasPage() {
  const formulas = useCollection('formulas')
  const canEdit = usePermission('config.edit')
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(formulas[0]?.id ?? null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const exprRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (selectedId === 'new') return
    const f = formulas.find((x) => x.id === selectedId)
    setDraft(f ? structuredClone(f) : null)
  }, [selectedId, formulas])

  const vars = useMemo(() => Object.fromEntries((draft?.variables ?? []).filter((v) => v.key).map((v) => [v.key, Number(v.sampleValue)])), [draft?.variables])
  const result = useMemo(() => (draft ? evaluateFormula(draft.expression, vars) : null), [draft, vars])
  const variableErrors = useMemo(() => {
    const errs: string[] = []
    const seen = new Set<string>()
    for (const v of draft?.variables ?? []) {
      if (!KEY_RE.test(v.key)) errs.push(`"${v.key || '(blank)'}" — field keys use lowercase letters, numbers and _ and must start with a letter.`)
      if (seen.has(v.key)) errs.push(`Duplicate field key "${v.key}".`)
      if (FORMULA_FUNCTIONS.some((f) => f.name === v.key.toUpperCase())) errs.push(`"${v.key}" is a reserved function name.`)
      seen.add(v.key)
    }
    return errs
  }, [draft?.variables])

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d))
  const patchVar = (i: number, p: Partial<FormulaVariable>) => patch({ variables: draft!.variables.map((v, j) => (j === i ? { ...v, ...p } : v)) })

  const insert = (text: string) => {
    const el = exprRef.current
    if (!draft) return
    const start = el?.selectionStart ?? draft.expression.length
    const end = el?.selectionEnd ?? draft.expression.length
    const next = draft.expression.slice(0, start) + text + draft.expression.slice(end)
    patch({ expression: next })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return runWithToast(Promise.reject(new Error('Give the formula a name.')))
    if (variableErrors.length) return runWithToast(Promise.reject(new Error(variableErrors[0])))
    if (result && !result.ok && !/Division by zero|no numeric value/.test(result.error)) return runWithToast(Promise.reject(new Error(`Fix the formula first: ${result.error}`)))
    const { id, ...rest } = draft
    if (id) await runWithToast(formulaRepository.update(id, rest), 'Formula saved')
    else {
      const created = await runWithToast(formulaRepository.create(rest), 'Formula created')
      if (created) setSelectedId(created.id)
    }
  }

  const remove = async () => {
    if (!draft?.id) return
    const { confirmed } = await confirm({ title: `Delete "${draft.name}"?`, confirmLabel: 'Delete', destructive: true })
    if (confirmed) {
      await runWithToast(formulaRepository.remove(draft.id), 'Formula deleted')
      setSelectedId(formulas.find((f) => f.id !== draft.id)?.id ?? null)
    }
  }

  const errorPos = result && !result.ok ? result.pos : null

  return (
    <>
      <PageHeader
        title="Formula builder"
        description="Define calculated fields from approved inputs using a safe, sandboxed expression language — no code is executed."
        actions={
          canEdit ? (
            <Button onClick={() => { setSelectedId('new'); setDraft(structuredClone(BLANK)) }}>
              <Plus /> New formula
            </Button>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Section title="Formulas" className="h-fit">
          <ul className="-mx-2 space-y-0.5">
            {formulas.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  aria-current={f.id === selectedId ? 'true' : undefined}
                  className={cn('w-full rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', f.id === selectedId ? 'bg-accent' : 'hover:bg-accent/60')}
                >
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-muted-foreground truncate font-mono text-[11px]">{f.expression}</div>
                </button>
              </li>
            ))}
            {selectedId === 'new' ? <li className="bg-accent rounded-md px-2 py-2 text-sm font-medium">{draft?.name} (unsaved)</li> : null}
          </ul>
        </Section>

        {draft ? (
          <div className="min-w-0 space-y-5">
            <Section
              title="Definition"
              actions={
                canEdit ? (
                  <>
                    {draft.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { const { id: _id, ...rest } = draft; void _id; setSelectedId('new'); setDraft({ ...structuredClone(rest), name: `${draft.name} (copy)` }) }}>
                          <Copy /> Duplicate
                        </Button>
                        <Button variant="ghost" size="sm" onClick={remove}>
                          <Trash2 /> Delete
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" onClick={save}>
                      <Save /> Save
                    </Button>
                  </>
                ) : null
              }
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div className="space-y-1.5">
                  <Label htmlFor="fx-name">Name</Label>
                  <Input id="fx-name" value={draft.name} disabled={!canEdit} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fx-format">Result format</Label>
                  <Select value={draft.format} onValueChange={(v) => patch({ format: v as FormulaDefinition['format'] })} disabled={!canEdit}>
                    <SelectTrigger id="fx-format" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="currency">Currency (LKR)</SelectItem>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fx-desc">Description</Label>
                  <Input id="fx-desc" value={draft.description} disabled={!canEdit} onChange={(e) => patch({ description: e.target.value })} />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Label htmlFor="fx-expr">Expression</Label>
                <div className="flex flex-wrap gap-1.5" aria-label="Insert field">
                  {draft.variables.filter((v) => v.key).map((v) => (
                    <Button key={v.key} type="button" variant="secondary" size="xs" disabled={!canEdit} onClick={() => insert(v.key)} title={`Insert ${v.label}`}>
                      {v.key}
                    </Button>
                  ))}
                  <span className="bg-border mx-1 w-px" aria-hidden />
                  {FORMULA_FUNCTIONS.map((f) => (
                    <Button key={f.name} type="button" variant="outline" size="xs" disabled={!canEdit} title={`${f.signature} — ${f.description}`} onClick={() => insert(`${f.name}(`)}>
                      {f.name}
                    </Button>
                  ))}
                  {['+', '-', '*', '/', '(', ')', '>', '>='].map((op) => (
                    <Button key={op} type="button" variant="outline" size="xs" className="font-mono" disabled={!canEdit} onClick={() => insert(` ${op} `.replace('( ', '(').replace(' )', ')'))} aria-label={`Insert ${op}`}>
                      {op}
                    </Button>
                  ))}
                </div>
                <Textarea
                  id="fx-expr"
                  ref={exprRef}
                  rows={3}
                  value={draft.expression}
                  disabled={!canEdit}
                  onChange={(e) => patch({ expression: e.target.value })}
                  className="font-mono text-sm"
                  spellCheck={false}
                  aria-invalid={!!result && !result.ok}
                  aria-describedby="fx-result"
                />
                {errorPos !== null && draft.expression ? (
                  <pre className="text-muted-foreground overflow-x-auto font-mono text-xs" aria-hidden>
                    {draft.expression}
                    {'\n'}
                    {' '.repeat(Math.min(errorPos, draft.expression.length))}
                    <span className="text-destructive">^</span>
                  </pre>
                ) : null}
              </div>
            </Section>

            <div className="grid gap-5 md:grid-cols-2">
              <Section title="Approved input fields" description="Only these fields can be referenced. Sample values drive the live test.">
                <div className="space-y-2">
                  <div className="text-muted-foreground grid grid-cols-[1fr_1.3fr_1fr_auto] gap-2 text-xs font-medium">
                    <span>Key</span>
                    <span>Label</span>
                    <span>Sample value</span>
                    <span className="sr-only">Remove</span>
                  </div>
                  {draft.variables.map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1.3fr_1fr_auto] gap-2">
                      <Input aria-label="Field key" value={v.key} disabled={!canEdit} className="h-8 font-mono text-xs" onChange={(e) => patchVar(i, { key: e.target.value.trim() })} aria-invalid={!KEY_RE.test(v.key)} />
                      <Input aria-label="Field label" value={v.label} disabled={!canEdit} className="h-8" onChange={(e) => patchVar(i, { label: e.target.value })} />
                      <Input aria-label={`Sample value for ${v.key}`} type="number" value={Number.isFinite(v.sampleValue) ? v.sampleValue : ''} className="tabular h-8" onChange={(e) => patchVar(i, { sampleValue: e.target.value === '' ? 0 : Number(e.target.value) })} />
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${v.key}`} disabled={!canEdit} onClick={() => patch({ variables: draft.variables.filter((_, j) => j !== i) })}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  {canEdit ? (
                    <Button variant="outline" size="sm" onClick={() => patch({ variables: [...draft.variables, { key: `field_${draft.variables.length + 1}`, label: 'New field', sampleValue: 0 }] })}>
                      <Plus /> Add field
                    </Button>
                  ) : null}
                  {variableErrors.length ? (
                    <ul className="text-destructive space-y-0.5 text-xs" role="alert">
                      {variableErrors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Section>
              <Section title="Live test result">
                <div id="fx-result" aria-live="polite">
                  {result?.ok ? (
                    <div className="space-y-2">
                      <div className="text-success flex items-center gap-1.5 text-xs font-medium">
                        <CheckCircle2 className="size-4" /> Valid formula
                      </div>
                      <div className="tabular text-3xl font-semibold tracking-tight">{formatResult(result.value, draft.format)}</div>
                      <p className="text-muted-foreground text-xs">Calculated from the sample values. Comparisons return 1 (true) or 0 (false).</p>
                    </div>
                  ) : result ? (
                    <div className="space-y-2">
                      <div className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                        <XCircle className="size-4" /> Cannot evaluate
                      </div>
                      <p className="text-sm">{result.error}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 border-t pt-4">
                  <h3 className="mb-2 text-xs font-semibold">Available functions</h3>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {FORMULA_FUNCTIONS.map((f) => (
                      <li key={f.name}>
                        <code className="text-foreground">{f.signature}</code> — {f.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>
            </div>
            <SimulatedNotice tone="demo">Formulas are parsed by a constrained interpreter (numbers, approved fields, + − × ÷, comparisons and five functions). They are stored as local demo configuration.</SimulatedNotice>
          </div>
        ) : (
          <EmptyState icon={<Sigma />} title="No formula selected" description="Choose a formula from the list or create a new one." />
        )}
      </div>
    </>
  )
}
