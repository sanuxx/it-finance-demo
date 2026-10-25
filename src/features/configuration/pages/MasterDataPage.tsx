import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { MasterListKey, MasterRecord } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SwitchField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useAction, runWithToast } from '@/hooks/useAction'
import { masterDataRepository } from '@/services'
import { SYSTEM_MASTER_IDS } from '@/data/seed'
import { cn } from '@/lib/utils'
import { MASTER_LISTS } from '../lib/masterLists'

const schema = z.object({
  code: z.string().trim().min(1, 'Enter a code').max(20, 'Max 20 characters'),
  name: z.string().trim().min(2, 'Enter a name').max(80),
  description: z.string().max(300).optional(),
  active: z.boolean(),
  attribute: z.number().int('Whole numbers only').min(0, 'Cannot be negative').max(600, 'Too large').optional(),
})
type Values = z.infer<typeof schema>

export default function MasterDataPage() {
  const { list: listParam } = useParams()
  const navigate = useNavigate()
  const listKey = (MASTER_LISTS.some((l) => l.key === listParam) ? listParam : 'expenseCategories') as MasterListKey
  const meta = MASTER_LISTS.find((l) => l.key === listKey)!
  const records = useCollection('masterData')
  const canEdit = usePermission('config.edit')
  const confirm = useConfirm()
  const [editing, setEditing] = useState<MasterRecord | undefined>()
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => records.filter((r) => r.list === listKey), [records, listKey])
  const counts = useMemo(() => Object.fromEntries(MASTER_LISTS.map((l) => [l.key, records.filter((r) => r.list === l.key).length])), [records])

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { code: '', name: '', description: '', active: true } })
  useEffect(() => {
    if (open) {
      const attr = meta.attribute && editing?.attributes?.[meta.attribute.key]
      form.reset(editing ? { code: editing.code, name: editing.name, description: editing.description ?? '', active: editing.active, attribute: typeof attr === 'number' ? attr : undefined } : { code: '', name: '', description: '', active: true, attribute: undefined })
    }
  }, [open, editing, form, meta.attribute])

  const save = useAction(
    async (v: Values) => {
      const dupe = rows.find((r) => r.code.toLowerCase() === v.code.toLowerCase() && r.id !== editing?.id)
      if (dupe) throw new Error(`Code ${v.code} is already used by "${dupe.name}".`)
      if (meta.attribute && v.attribute === undefined) throw new Error(`${meta.attribute.label} is required for ${meta.label.toLowerCase()}.`)
      const attributes = meta.attribute ? { ...(editing?.attributes ?? {}), [meta.attribute.key]: v.attribute! } : editing?.attributes
      const payload = { list: listKey, code: v.code, name: v.name, description: v.description || undefined, active: v.active, attributes }
      return editing ? masterDataRepository.update(editing.id, payload) : masterDataRepository.create(payload)
    },
    { success: editing ? 'Record updated' : 'Record created' },
  )

  const submit = form.handleSubmit(async (v) => {
    if (await save.run(v)) setOpen(false)
  })

  const remove = async (r: MasterRecord) => {
    const { confirmed } = await confirm({ title: `Delete "${r.name}"?`, description: 'Existing records that reference this value will show “—”. Consider deactivating it instead so history stays readable.', confirmLabel: 'Delete', destructive: true })
    if (confirmed) await runWithToast(masterDataRepository.remove(r.id), 'Record deleted')
  }

  const attr = meta.attribute
  const columns: DataColumn<MasterRecord>[] = [
    { id: 'code', header: 'Code', accessor: (r) => r.code, cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    {
      id: 'name',
      header: 'Name',
      accessor: (r) => r.name,
      alwaysVisible: true,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 font-medium">
          {r.name}
          {SYSTEM_MASTER_IDS.has(r.id) ? <Lock className="text-muted-foreground size-3" aria-label="System record (used by calculations)" /> : null}
        </span>
      ),
    },
    { id: 'description', header: 'Description', accessor: (r) => r.description, cell: (r) => <span className="text-muted-foreground">{r.description || '—'}</span> },
    ...(attr
      ? [{ id: 'attr', header: attr.label, accessor: (r: MasterRecord) => r.attributes?.[attr.key] as number | undefined, align: 'right' as const, cell: (r: MasterRecord) => `${r.attributes?.[attr.key] ?? '—'} ${attr.suffix}` }]
      : []),
    { id: 'active', header: 'Status', accessor: (r) => (r.active ? 'active' : 'inactive'), cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) =>
        canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => { setEditing(r); setOpen(true) }}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runWithToast(masterDataRepository.update(r.id, { active: !r.active }), r.active ? 'Deactivated — hidden from new selections' : 'Activated')}>
                <Power /> {r.active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={SYSTEM_MASTER_IDS.has(r.id)} onSelect={() => remove(r)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Master data"
        description="Configurable reference lists used across forms, budgets and reports. Inactive values stay on existing records but are hidden from new selections."
        actions={
          canEdit ? (
            <Button onClick={() => { setEditing(undefined); setOpen(true) }}>
              <Plus /> New record
            </Button>
          ) : null
        }
      />
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Master data lists" className="hidden lg:block">
          <ul className="space-y-0.5">
            {MASTER_LISTS.map((l) => (
              <li key={l.key}>
                <button
                  type="button"
                  onClick={() => navigate(`/config/master-data/${l.key}`)}
                  aria-current={l.key === listKey ? 'page' : undefined}
                  className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', l.key === listKey ? 'bg-accent font-medium' : 'hover:bg-accent/60')}
                >
                  {l.label}
                  <span className="text-muted-foreground tabular text-xs">{counts[l.key]}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-3">
          <div className="lg:hidden">
            <Select value={listKey} onValueChange={(v) => navigate(`/config/master-data/${v}`)}>
              <SelectTrigger className="w-full" aria-label="Choose list">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MASTER_LISTS.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {l.label} ({counts[l.key]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <h2 className="font-semibold">{meta.label}</h2>
            <p className="text-muted-foreground text-sm">{meta.description} Records with a lock icon are used by built-in calculations and can only be deactivated.</p>
          </div>
          <DataTable
            key={listKey}
            caption={meta.label}
            data={rows}
            columns={columns}
            getRowId={(r) => r.id}
            exportName={`master-${listKey}`}
            initialSort={{ id: 'name' }}
            filters={[{ id: 'active', label: 'Statuses', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], predicate: (r, v) => (v === 'active' ? r.active : !r.active) }]}
          />
        </div>
      </div>
      <FormDialog open={open} onOpenChange={setOpen} title={editing ? `Edit ${editing.name}` : `New record — ${meta.label}`} onSubmit={submit} pending={save.pending}>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <TextField control={form.control} name="code" label="Code" required autoFocus />
          <TextField control={form.control} name="name" label="Name" required />
        </div>
        <TextareaField control={form.control} name="description" label="Description" rows={2} />
        {attr ? <NumberField control={form.control} name="attribute" label={attr.label} suffix={attr.suffix} step={1} min={0} required /> : null}
        <SwitchField control={form.control} name="active" label="Active" description="Inactive values are hidden from new selections." />
      </FormDialog>
    </>
  )
}
