import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ListPlus, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldEntity, FieldType } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { SelectField, SwitchField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useAction, runWithToast } from '@/hooks/useAction'
import { customFieldRepository } from '@/services'
import { DynamicField } from '@/features/configuration/components/DynamicField'
import { FIELD_TYPE_LABELS } from '@/features/configuration/lib/fieldTypes'

const ENTITY_LABELS: Record<CustomFieldEntity, string> = { customer: 'Customer', project: 'Project', expense: 'Expense claim', invoice: 'Invoice', supplier: 'Supplier' }
const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[]

const schema = z
  .object({
    entity: z.enum(['customer', 'project', 'expense', 'invoice', 'supplier']),
    label: z.string().trim().min(2, 'Enter a label').max(60),
    key: z.string().trim().regex(/^[a-z][a-zA-Z0-9]*$/, 'Use camelCase letters and digits, starting with a lowercase letter').max(40),
    type: z.enum(FIELD_TYPES as [FieldType, ...FieldType[]]),
    optionsText: z.string().optional(),
    helpText: z.string().max(200).optional(),
    required: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if ((v.type === 'select' || v.type === 'multiselect') && !(v.optionsText ?? '').split('\n').some((s) => s.trim())) {
      ctx.addIssue({ code: 'custom', path: ['optionsText'], message: 'Add at least one option (one per line)' })
    }
  })
type Values = z.infer<typeof schema>

const toKey = (label: string) =>
  label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join('')

export default function CustomFieldsPage() {
  const fields = useCollection('customFields')
  const canEdit = usePermission('config.edit')
  const confirm = useConfirm()
  const [editing, setEditing] = useState<CustomFieldDefinition | undefined>()
  const [open, setOpen] = useState(false)
  const [previewValue, setPreviewValue] = useState<unknown>(undefined)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { entity: 'project', label: '', key: '', type: 'text', optionsText: '', helpText: '', required: false, active: true } })
  const w = useWatch({ control: form.control })

  const openDialog = (field?: CustomFieldDefinition) => {
    setEditing(field)
    setPreviewValue(undefined)
    form.reset(
      field
        ? { entity: field.entity, label: field.label, key: field.key, type: field.type, optionsText: (field.options ?? []).join('\n'), helpText: field.helpText ?? '', required: field.required, active: field.active }
        : { entity: 'project', label: '', key: '', type: 'text', optionsText: '', helpText: '', required: false, active: true },
    )
    setOpen(true)
  }

  // Auto-suggest a key from the label for new fields.
  useEffect(() => {
    if (!editing && open && w.label !== undefined && !form.getFieldState('key').isDirty) form.setValue('key', toKey(w.label))
  }, [w.label, editing, open, form])

  const save = useAction(
    async (v: Values) => {
      if (fields.some((f) => f.entity === v.entity && f.key === v.key && f.id !== editing?.id)) throw new Error(`A ${ENTITY_LABELS[v.entity].toLowerCase()} field with key "${v.key}" already exists.`)
      const payload = {
        entity: v.entity,
        label: v.label,
        key: v.key,
        type: v.type,
        required: v.required,
        active: v.active,
        helpText: v.helpText || undefined,
        options: v.type === 'select' || v.type === 'multiselect' ? (v.optionsText ?? '').split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
      }
      return editing ? customFieldRepository.update(editing.id, payload) : customFieldRepository.create(payload)
    },
    { success: editing ? 'Custom field updated' : 'Custom field created' },
  )

  const remove = async (f: CustomFieldDefinition) => {
    const { confirmed } = await confirm({ title: `Delete "${f.label}"?`, description: 'Values already captured on records stay in the data but will no longer be displayed.', confirmLabel: 'Delete field', destructive: true })
    if (confirmed) await runWithToast(customFieldRepository.remove(f.id), 'Custom field deleted')
  }

  const counts = useMemo(() => Object.fromEntries(Object.keys(ENTITY_LABELS).map((e) => [e, fields.filter((f) => f.entity === e && f.active).length])), [fields])

  const columns: DataColumn<CustomFieldDefinition>[] = [
    { id: 'label', header: 'Label', accessor: (r) => r.label, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.label}</div>{r.helpText ? <div className="text-muted-foreground text-xs">{r.helpText}</div> : null}</div> },
    { id: 'key', header: 'Key', accessor: (r) => r.key, cell: (r) => <code className="text-xs">{r.key}</code> },
    { id: 'entity', header: 'Applies to', accessor: (r) => ENTITY_LABELS[r.entity] },
    { id: 'type', header: 'Type', accessor: (r) => FIELD_TYPE_LABELS[r.type] },
    { id: 'options', header: 'Options', accessor: (r) => (r.options ?? []).join(', '), cell: (r) => <span className="text-muted-foreground text-xs">{(r.options ?? []).join(', ') || '—'}</span>, defaultHidden: true },
    { id: 'required', header: 'Required', accessor: (r) => r.required },
    { id: 'active', header: 'Status', accessor: (r) => (r.active ? 'active' : 'inactive'), cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) =>
        canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.label}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => openDialog(r)}><Pencil /> Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runWithToast(customFieldRepository.update(r.id, { active: !r.active }), r.active ? 'Field deactivated' : 'Field activated')}><Power /> {r.active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ]

  const previewOptions = (w.optionsText ?? '').split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <>
      <PageHeader
        title="Custom fields"
        description="Capture extra information on core records without code."
        meta={Object.entries(ENTITY_LABELS).map(([k, label]) => <span key={k} className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">{label}: {counts[k]}</span>)}
        actions={canEdit ? <Button onClick={() => openDialog()}><Plus /> New custom field</Button> : null}
      />
      <SimulatedNotice className="mb-4" tone="demo">Custom field definitions are stored in this browser. The future backend will persist custom values per record and include them in APIs and exports.</SimulatedNotice>
      <DataTable
        caption="Custom fields"
        data={fields}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="custom-fields"
        onRowClick={canEdit ? (r) => openDialog(r) : undefined}
        filters={[{ id: 'entity', label: 'Records', options: Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })), predicate: (r, v) => r.entity === v }]}
        emptyState={<EmptyState icon={<ListPlus />} title="No custom fields" description="Add a field to capture extra details." className="border-0" />}
      />
      <FormDialog open={open} onOpenChange={setOpen} title={editing ? `Edit ${editing.label}` : 'New custom field'} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) setOpen(false) })} pending={save.pending} size="lg">
        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="entity" label="Applies to" required options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))} />
            <SelectField control={form.control} name="type" label="Field type" required options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} />
            <TextField control={form.control} name="label" label="Label" required autoFocus />
            <TextField control={form.control} name="key" label="Key" required description="Used in exports and the API." />
            {w.type === 'select' || w.type === 'multiselect' ? <TextareaField control={form.control} name="optionsText" label="Options (one per line)" rows={4} className="sm:col-span-2" /> : null}
            <TextField control={form.control} name="helpText" label="Help text" className="sm:col-span-2" />
            <SwitchField control={form.control} name="required" label="Required" />
            <SwitchField control={form.control} name="active" label="Active" />
          </div>
          <div className="bg-muted/40 h-fit rounded-lg border p-4">
            <div className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Live preview</div>
            <DynamicField spec={{ type: (w.type ?? 'text') as FieldType, label: w.label || 'Field label', description: w.helpText, required: w.required, options: previewOptions }} value={previewValue} onChange={setPreviewValue} />
          </div>
        </div>
      </FormDialog>
    </>
  )
}
