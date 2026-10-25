import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  CheckSquare,
  ChevronDown,
  Copy,
  DollarSign,
  Eye,
  GripVertical,
  Hash,
  Link2,
  List,
  ListChecks,
  Mail,
  Paperclip,
  Pencil,
  Percent,
  Plus,
  Save,
  Send,
  Trash2,
  Type,
  AlignLeft,
  Upload,
} from 'lucide-react'
import type { FieldType, FormDefinition, FormFieldDefinition, FormSection, VisibilityCondition } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection, useRecord } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { formRepository, formSubmissionRepository } from '@/services'
import { formatDateTime } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { DynamicField } from '../components/DynamicField'
import { FIELD_TYPE_LABELS } from '../lib/fieldTypes'
import { FormRenderer } from '../components/FormRenderer'
import { visibleValues } from '../lib/formSchema'
import { useOnChange } from '@/hooks/useOnChange'

const PALETTE: { type: FieldType; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'text', icon: Type },
  { type: 'textarea', icon: AlignLeft },
  { type: 'number', icon: Hash },
  { type: 'currency', icon: DollarSign },
  { type: 'percentage', icon: Percent },
  { type: 'date', icon: Calendar },
  { type: 'select', icon: List },
  { type: 'multiselect', icon: ListChecks },
  { type: 'checkbox', icon: CheckSquare },
  { type: 'email', icon: Mail },
  { type: 'url', icon: Link2 },
  { type: 'file', icon: Paperclip },
]

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

function blankForm(): FormDefinition {
  const now = new Date().toISOString()
  return { id: 'new', name: 'Untitled form', description: '', entity: 'custom', layout: 'sections', status: 'draft', sections: [{ id: uid('sec'), title: 'Details' }], fields: [], createdAt: now, updatedAt: now }
}

const NUMERIC: FieldType[] = ['number', 'currency', 'percentage']
const TEXTUAL: FieldType[] = ['text', 'textarea', 'email', 'url']

function SortableField({ field, index, count, selected, onSelect, onMove, onRemove, onDuplicate, disabled }: { field: FormFieldDefinition; index: number; count: number; selected: boolean; onSelect: () => void; onMove: (dir: -1 | 1) => void; onRemove: () => void; onDuplicate: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('bg-card group relative rounded-lg border p-3 transition-shadow', field.width === 'full' ? 'sm:col-span-2' : '', selected ? 'ring-primary border-primary/50 ring-2' : 'hover:border-primary/30', isDragging && 'z-10 shadow-lg')}
      onClick={onSelect}
    >
      <div className="relative z-10 mb-2 flex items-center gap-1">
        <button type="button" className="text-muted-foreground hover:text-foreground cursor-grab rounded p-0.5 active:cursor-grabbing disabled:cursor-not-allowed" aria-label={`Drag to reorder ${field.label}`} disabled={disabled} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{FIELD_TYPE_LABELS[field.type]}</span>
        {field.visibleWhen ? <span className="bg-info/10 text-info ml-1 rounded px-1.5 text-[10px] font-medium">Conditional</span> : null}
        <div className="ml-auto flex items-center opacity-70 group-hover:opacity-100 focus-within:opacity-100">
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Move up" disabled={disabled || index === 0} onClick={(e) => { e.stopPropagation(); onMove(-1) }}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Move down" disabled={disabled || index === count - 1} onClick={(e) => { e.stopPropagation(); onMove(1) }}>
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Duplicate field" disabled={disabled} onClick={(e) => { e.stopPropagation(); onDuplicate() }}>
            <Copy />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove field" disabled={disabled} onClick={(e) => { e.stopPropagation(); onRemove() }}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="pointer-events-none" aria-hidden>
        <DynamicField spec={field} value={field.type === 'checkbox' ? field.defaultValue === 'true' : field.type === 'multiselect' ? [] : (field.defaultValue ?? '')} onChange={() => undefined} disabled />
      </div>
      <button type="button" className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring outline-none" aria-label={`Edit settings for ${field.label}`} onClick={onSelect} />
    </div>
  )
}

export default function FormBuilderPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const stored = useRecord('forms', isNew ? undefined : id)
  const submissions = useCollection('formSubmissions')
  const canEdit = usePermission('config.edit')
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<FormDefinition | null>(isNew ? blankForm() : null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'design' | 'preview'>('design')
  const [dirty, setDirty] = useState(false)

  useOnChange([stored], () => {
    if (stored && (!draft || draft.id !== stored.id)) {
      setDraft(structuredClone(stored))
      setDirty(false)
    }
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const formSubs = useMemo(() => submissions.filter((s) => s.formId === draft?.id).slice(0, 8), [submissions, draft?.id])

  if (!draft) {
    return (
      <EmptyState
        title="Form not found"
        description="It may have been deleted or the demo data was reset."
        action={
          <Button asChild size="sm">
            <Link to="/config/forms">Back to forms</Link>
          </Button>
        }
        className="mt-10"
      />
    )
  }

  const update = (patch: Partial<FormDefinition>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
  }
  const updateField = (fid: string, patch: Partial<FormFieldDefinition>) => update({ fields: draft.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })
  const selected = draft.fields.find((f) => f.id === selectedId)
  const targetSection = selected?.sectionId ?? draft.sections[draft.sections.length - 1]?.id

  const addField = (type: FieldType) => {
    if (!targetSection) return
    const field: FormFieldDefinition = {
      id: uid('fld'),
      type,
      label: FIELD_TYPE_LABELS[type],
      required: false,
      sectionId: targetSection,
      width: type === 'textarea' || type === 'multiselect' || type === 'file' ? 'full' : 'half',
      options: type === 'select' || type === 'multiselect' ? ['Option 1', 'Option 2'] : undefined,
    }
    update({ fields: [...draft.fields, field] })
    setSelectedId(field.id)
  }

  const removeField = (fid: string) => {
    update({ fields: draft.fields.filter((f) => f.id !== fid).map((f) => (f.visibleWhen?.fieldId === fid ? { ...f, visibleWhen: undefined } : f)) })
    if (selectedId === fid) setSelectedId(null)
  }

  const duplicateField = (fid: string) => {
    const idx = draft.fields.findIndex((f) => f.id === fid)
    const src = draft.fields[idx]
    if (!src) return
    const copy = { ...structuredClone(src), id: uid('fld'), label: `${src.label} (copy)` }
    const fields = [...draft.fields]
    fields.splice(idx + 1, 0, copy)
    update({ fields })
    setSelectedId(copy.id)
  }

  const moveWithinSection = (fid: string, dir: -1 | 1) => {
    const f = draft.fields.find((x) => x.id === fid)
    if (!f) return
    const sectionFields = draft.fields.filter((x) => x.sectionId === f.sectionId)
    const i = sectionFields.findIndex((x) => x.id === fid)
    const j = i + dir
    if (j < 0 || j >= sectionFields.length) return
    const a = draft.fields.indexOf(sectionFields[i]!)
    const b = draft.fields.indexOf(sectionFields[j]!)
    update({ fields: arrayMove(draft.fields, a, b) })
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const a = draft.fields.findIndex((f) => f.id === active.id)
    const b = draft.fields.findIndex((f) => f.id === over.id)
    if (a < 0 || b < 0) return
    const target = draft.fields[b]!
    const moved = arrayMove(draft.fields, a, b).map((f) => (f.id === active.id ? { ...f, sectionId: target.sectionId } : f))
    update({ fields: moved })
  }

  const addSection = () => {
    const s: FormSection = { id: uid('sec'), title: `Section ${draft.sections.length + 1}` }
    update({ sections: [...draft.sections, s] })
  }
  const removeSection = async (s: FormSection) => {
    if (draft.sections.length <= 1) return
    const count = draft.fields.filter((f) => f.sectionId === s.id).length
    if (count) {
      const { confirmed } = await confirm({ title: `Delete "${s.title}"?`, description: `Its ${count} field(s) will move to the first remaining section.`, confirmLabel: 'Delete section', destructive: true })
      if (!confirmed) return
    }
    const rest = draft.sections.filter((x) => x.id !== s.id)
    update({ sections: rest, fields: draft.fields.map((f) => (f.sectionId === s.id ? { ...f, sectionId: rest[0]!.id } : f)) })
  }

  const validateDefinition = (): string | null => {
    if (!draft.name.trim()) return 'Give the form a name.'
    if (!draft.fields.length) return 'Add at least one field.'
    const blank = draft.fields.find((f) => !f.label.trim())
    if (blank) return 'Every field needs a label.'
    const noOpts = draft.fields.find((f) => (f.type === 'select' || f.type === 'multiselect') && !(f.options ?? []).filter(Boolean).length)
    if (noOpts) return `"${noOpts.label}" needs at least one option.`
    const badPattern = draft.fields.find((f) => {
      if (!f.validation?.pattern) return false
      try {
        new RegExp(f.validation.pattern)
        return false
      } catch {
        return true
      }
    })
    if (badPattern) return `"${badPattern.label}" has an invalid pattern.`
    return null
  }

  const save = async (status?: FormDefinition['status']) => {
    const err = validateDefinition()
    if (err) {
      await runWithToast(Promise.reject(new Error(err)))
      return
    }
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = { ...draft, status: status ?? draft.status }
    void _id
    void _c
    void _u
    if (isNew) {
      const created = await runWithToast(formRepository.create(rest), status === 'published' ? 'Form created and published' : 'Form saved')
      if (created) {
        setDirty(false)
        navigate(`/config/forms/${created.id}`, { replace: true })
      }
    } else {
      const saved = await runWithToast(formRepository.update(draft.id, rest), status === 'published' ? 'Form published (demo configuration)' : 'Form saved')
      if (saved) {
        setDraft(structuredClone(saved))
        setDirty(false)
      }
    }
  }

  const submitTest = async (values: Record<string, unknown>) => {
    if (isNew) {
      await runWithToast(Promise.reject(new Error('Save the form before submitting test entries.')))
      return
    }
    await runWithToast(formSubmissionRepository.create({ formId: draft.id, values: visibleValues(draft, values), submittedBy: 'Preview' }), 'Test submission saved in this browser')
  }

  const otherFields = draft.fields.filter((f) => f.id !== selected?.id)

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Back to forms">
              <Link to="/config/forms">
                <ArrowLeft />
              </Link>
            </Button>
            {draft.name || 'Untitled form'}
          </span>
        }
        description="Drag fields to reorder, click a field to configure it, then preview the live form."
        meta={
          <>
            <StatusBadge status={draft.status} />
            {dirty ? <span className="text-warning text-xs font-medium">Unsaved changes</span> : null}
          </>
        }
        actions={
          <>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'design' | 'preview')}>
              <TabsList>
                <TabsTrigger value="design">
                  <Pencil /> Design
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye /> Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {canEdit ? (
              <>
                <Button variant="outline" onClick={() => save()}>
                  <Save /> Save
                </Button>
                <Button onClick={() => save(draft.status === 'published' ? 'draft' : 'published')}>
                  {draft.status === 'published' ? <><Upload /> Unpublish</> : <><Send /> Publish</>}
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <SimulatedNotice className="mb-4" tone="demo">
        Form definitions are local demo configuration stored in this browser. The future backend will version and enforce them server-side.
      </SimulatedNotice>

      {mode === 'preview' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Section title={draft.name} description={draft.description || 'Live preview with validation and conditional visibility.'}>
            {draft.fields.length ? <FormRenderer key={JSON.stringify(draft.fields) + draft.layout} definition={draft} onSubmit={submitTest} /> : <EmptyState title="No fields yet" description="Switch to Design and add fields from the palette." />}
          </Section>
          <Section title="Recent test submissions" description="Stored only in this browser.">
            {formSubs.length ? (
              <ul className="space-y-3">
                {formSubs.map((s) => (
                  <li key={s.id} className="rounded-md border p-2.5 text-xs">
                    <div className="text-muted-foreground mb-1">{formatDateTime(s.createdAt)}</div>
                    <dl className="space-y-0.5">
                      {Object.entries(s.values).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="text-muted-foreground shrink-0">{k}:</dt>
                          <dd className="truncate">{Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Submit the preview form to see entries here.</p>
            )}
          </Section>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[220px_1fr_320px] lg:grid-cols-[200px_1fr]">
          {/* Palette */}
          <Section title="Field palette" className="h-fit lg:sticky lg:top-20">
            <p className="text-muted-foreground mb-3 text-xs">Adds to {selected ? 'the selected field’s section' : 'the last section'}.</p>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
              {PALETTE.map(({ type, icon: Icon }) => (
                <Button key={type} variant="outline" size="sm" className="justify-start" disabled={!canEdit} onClick={() => addField(type)}>
                  <Icon className="size-4" /> {FIELD_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </Section>

          {/* Canvas */}
          <div className="min-w-0 space-y-4">
            <Section title="Form settings">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fb-name">Form name</Label>
                  <Input id="fb-name" value={draft.name} disabled={!canEdit} onChange={(e) => update({ name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fb-entity">Used for</Label>
                  <Select value={draft.entity} onValueChange={(v) => update({ entity: v as FormDefinition['entity'] })} disabled={!canEdit}>
                    <SelectTrigger id="fb-entity" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense_request">Expense request</SelectItem>
                      <SelectItem value="project_intake">Project intake</SelectItem>
                      <SelectItem value="purchase_request">Purchase request</SelectItem>
                      <SelectItem value="vendor_onboarding">Vendor onboarding</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="fb-desc">Description</Label>
                  <Input id="fb-desc" value={draft.description} disabled={!canEdit} onChange={(e) => update({ description: e.target.value })} />
                </div>
                <div className="flex items-center gap-3">
                  <Label>Layout</Label>
                  <Tabs value={draft.layout} onValueChange={(v) => canEdit && update({ layout: v as FormDefinition['layout'] })}>
                    <TabsList>
                      <TabsTrigger value="sections">Sections</TabsTrigger>
                      <TabsTrigger value="tabs">Tabs</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </Section>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={draft.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {draft.sections.map((s, si) => {
                  const fields = draft.fields.filter((f) => f.sectionId === s.id)
                  return (
                    <section key={s.id} className="bg-muted/30 rounded-xl border border-dashed p-4" aria-label={`Section ${s.title}`}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-xs font-medium">{draft.layout === 'tabs' ? `Tab ${si + 1}` : `Section ${si + 1}`}</span>
                        <Input aria-label="Section title" value={s.title} disabled={!canEdit} className="h-8 max-w-64 font-medium" onChange={(e) => update({ sections: draft.sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })} />
                        <Input aria-label="Section description" placeholder="Optional description" value={s.description ?? ''} disabled={!canEdit} className="h-8 max-w-72 flex-1" onChange={(e) => update({ sections: draft.sections.map((x) => (x.id === s.id ? { ...x, description: e.target.value } : x)) })} />
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete section ${s.title}`} disabled={!canEdit || draft.sections.length <= 1} onClick={() => removeSection(s)}>
                          <Trash2 />
                        </Button>
                      </div>
                      {fields.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {fields.map((f, i) => (
                            <SortableField
                              key={f.id}
                              field={f}
                              index={i}
                              count={fields.length}
                              selected={f.id === selectedId}
                              disabled={!canEdit}
                              onSelect={() => setSelectedId(f.id)}
                              onMove={(dir) => moveWithinSection(f.id, dir)}
                              onRemove={() => removeField(f.id)}
                              onDuplicate={() => duplicateField(f.id)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground py-6 text-center text-sm">Empty section — select it by adding a field from the palette, or move a field here from its settings.</p>
                      )}
                    </section>
                  )
                })}
              </SortableContext>
            </DndContext>
            {canEdit ? (
              <Button variant="outline" onClick={addSection}>
                <Plus /> Add {draft.layout === 'tabs' ? 'tab' : 'section'}
              </Button>
            ) : null}
          </div>

          {/* Settings */}
          <Section title="Field settings" className="h-fit lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20">
            {selected ? (
              <FieldSettings
                key={selected.id}
                field={selected}
                sections={draft.sections}
                otherFields={otherFields}
                disabled={!canEdit}
                onChange={(patch) => updateField(selected.id, patch)}
              />
            ) : (
              <p className="text-muted-foreground text-sm">Select a field on the canvas to edit its label, validation and visibility.</p>
            )}
          </Section>
        </div>
      )}
    </>
  )
}

function FieldSettings({ field, sections, otherFields, disabled, onChange }: { field: FormFieldDefinition; sections: FormSection[]; otherFields: FormFieldDefinition[]; disabled: boolean; onChange: (patch: Partial<FormFieldDefinition>) => void }) {
  const v = field.validation ?? {}
  const setV = (patch: Partial<NonNullable<FormFieldDefinition['validation']>>) => onChange({ validation: { ...v, ...patch } })
  const num = (s: string) => (s === '' ? undefined : Number(s))
  const cond = field.visibleWhen
  const setCond = (patch: Partial<VisibilityCondition> | null) => onChange({ visibleWhen: patch === null ? undefined : ({ ...(cond ?? { fieldId: otherFields[0]?.id ?? '', operator: 'equals' }), ...patch } as VisibilityCondition) })
  const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'))
  const hasOptions = field.type === 'select' || field.type === 'multiselect'

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fs-type">Field type</Label>
        <Select value={field.type} onValueChange={(t) => onChange({ type: t as FieldType, options: t === 'select' || t === 'multiselect' ? (field.options ?? ['Option 1']) : field.options })} disabled={disabled}>
          <SelectTrigger id="fs-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PALETTE.map((p) => (
              <SelectItem key={p.type} value={p.type}>
                {FIELD_TYPE_LABELS[p.type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fs-label">Label</Label>
        <Input id="fs-label" value={field.label} disabled={disabled} onChange={(e) => onChange({ label: e.target.value })} aria-invalid={!field.label.trim()} />
        {!field.label.trim() ? <p className="text-destructive text-xs">A label is required.</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fs-desc">Help text</Label>
        <Input id="fs-desc" value={field.description ?? ''} disabled={disabled} onChange={(e) => onChange({ description: e.target.value || undefined })} />
      </div>
      {field.type !== 'checkbox' && field.type !== 'file' && field.type !== 'multiselect' ? (
        <div className="space-y-1.5">
          <Label htmlFor="fs-ph">Placeholder</Label>
          <Input id="fs-ph" value={field.placeholder ?? ''} disabled={disabled} onChange={(e) => onChange({ placeholder: e.target.value || undefined })} />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="fs-def">Default value</Label>
        {field.type === 'checkbox' ? (
          <div className="flex items-center gap-2">
            <Switch id="fs-def" checked={field.defaultValue === 'true'} disabled={disabled} onCheckedChange={(c) => onChange({ defaultValue: c ? 'true' : undefined })} />
            <span className="text-muted-foreground text-xs">Ticked by default</span>
          </div>
        ) : (
          <Input id="fs-def" value={field.defaultValue ?? ''} disabled={disabled} placeholder={field.type === 'multiselect' ? 'Comma-separated options' : undefined} type={field.type === 'date' ? 'date' : NUMERIC.includes(field.type) ? 'number' : 'text'} onChange={(e) => onChange({ defaultValue: e.target.value || undefined })} />
        )}
      </div>
      {hasOptions ? (
        <div className="space-y-1.5">
          <Label htmlFor="fs-opts">Options (one per line)</Label>
          <Textarea
            id="fs-opts"
            rows={4}
            value={optionsText}
            disabled={disabled}
            onChange={(e) => {
              setOptionsText(e.target.value)
              onChange({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
            }}
          />
          {!(field.options ?? []).length ? <p className="text-destructive text-xs">Add at least one option.</p> : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <Label htmlFor="fs-req">Required</Label>
        <Switch id="fs-req" checked={field.required} disabled={disabled} onCheckedChange={(c) => onChange({ required: c })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="fs-width">Width</Label>
          <Select value={field.width} onValueChange={(w) => onChange({ width: w as 'full' | 'half' })} disabled={disabled}>
            <SelectTrigger id="fs-width" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="half">Half</SelectItem>
              <SelectItem value="full">Full</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fs-sec">Section</Label>
          <Select value={field.sectionId} onValueChange={(s) => onChange({ sectionId: s })} disabled={disabled}>
            <SelectTrigger id="fs-sec" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <details className="group rounded-md border" open={!!(v.min !== undefined || v.max !== undefined || v.minLength || v.maxLength || v.pattern)}>
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium">
          Validation <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t p-3">
          {NUMERIC.includes(field.type) ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fs-min">Minimum</Label>
                <Input id="fs-min" type="number" value={v.min ?? ''} disabled={disabled} onChange={(e) => setV({ min: num(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fs-max">Maximum</Label>
                <Input id="fs-max" type="number" value={v.max ?? ''} disabled={disabled} onChange={(e) => setV({ max: num(e.target.value) })} />
              </div>
            </div>
          ) : null}
          {TEXTUAL.includes(field.type) ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fs-minl">Min length</Label>
                  <Input id="fs-minl" type="number" min={0} value={v.minLength ?? ''} disabled={disabled} onChange={(e) => setV({ minLength: num(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fs-maxl">Max length</Label>
                  <Input id="fs-maxl" type="number" min={0} value={v.maxLength ?? ''} disabled={disabled} onChange={(e) => setV({ maxLength: num(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fs-pat">Pattern (regular expression)</Label>
                <Input id="fs-pat" value={v.pattern ?? ''} placeholder="e.g. PO-[0-9]{4}" disabled={disabled} onChange={(e) => setV({ pattern: e.target.value || undefined })} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fs-patm">Pattern error message</Label>
                <Input id="fs-patm" value={v.patternMessage ?? ''} disabled={disabled} onChange={(e) => setV({ patternMessage: e.target.value || undefined })} />
              </div>
            </>
          ) : null}
          {!NUMERIC.includes(field.type) && !TEXTUAL.includes(field.type) ? <p className="text-muted-foreground text-xs">Only the required setting applies to this field type.</p> : null}
        </div>
      </details>

      <details className="group rounded-md border" open={!!cond}>
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium">
          Conditional visibility <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="fs-cond">Show only when…</Label>
            <Switch id="fs-cond" checked={!!cond} disabled={disabled || !otherFields.length} onCheckedChange={(c) => setCond(c ? {} : null)} />
          </div>
          {cond ? (
            <>
              <Select value={cond.fieldId} onValueChange={(fid) => setCond({ fieldId: fid })} disabled={disabled}>
                <SelectTrigger className="w-full" aria-label="Controlling field">
                  <SelectValue placeholder="Choose a field" />
                </SelectTrigger>
                <SelectContent>
                  {otherFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cond.operator} onValueChange={(op) => setCond({ operator: op as VisibilityCondition['operator'] })} disabled={disabled}>
                <SelectTrigger className="w-full" aria-label="Condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">equals</SelectItem>
                  <SelectItem value="not_equals">does not equal</SelectItem>
                  <SelectItem value="greater_than">is greater than</SelectItem>
                  <SelectItem value="less_than">is less than</SelectItem>
                  <SelectItem value="is_checked">is ticked</SelectItem>
                  <SelectItem value="is_not_empty">is not empty</SelectItem>
                </SelectContent>
              </Select>
              {cond.operator !== 'is_checked' && cond.operator !== 'is_not_empty' ? <Input aria-label="Condition value" value={cond.value ?? ''} disabled={disabled} onChange={(e) => setCond({ value: e.target.value })} placeholder="Value" /> : null}
            </>
          ) : (
            <p className="text-muted-foreground text-xs">{otherFields.length ? 'Always visible.' : 'Add another field to use conditions.'}</p>
          )}
        </div>
      </details>
    </div>
  )
}
