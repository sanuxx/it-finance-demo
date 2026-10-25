import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { FormDefinition } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { formRepository } from '@/services'
import { formatDateTime, humanize } from '@/lib/formatting'

interface Row extends FormDefinition {
  submissions: number
}

export default function FormsPage() {
  const forms = useCollection('forms')
  const subs = useCollection('formSubmissions')
  const canEdit = usePermission('config.edit')
  const navigate = useNavigate()
  const confirm = useConfirm()

  const rows = useMemo<Row[]>(() => forms.map((f) => ({ ...f, submissions: subs.filter((s) => s.formId === f.id).length })), [forms, subs])

  const duplicate = async (f: FormDefinition) => {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = structuredClone(f)
    void _i
    void _c
    void _u
    const created = await runWithToast(formRepository.create({ ...rest, name: `${f.name} (copy)`, status: 'draft' }), 'Form duplicated')
    if (created) navigate(`/config/forms/${created.id}`)
  }
  const remove = async (f: Row) => {
    const { confirmed } = await confirm({ title: `Delete "${f.name}"?`, description: f.submissions ? `${f.submissions} test submission(s) will remain in the dataset but will no longer be linked to a form.` : 'This removes the form definition from this browser.', confirmLabel: 'Delete form', destructive: true })
    if (confirmed) await runWithToast(formRepository.remove(f.id), 'Form deleted')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'name', header: 'Form', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground line-clamp-1 text-xs">{r.description}</div></div> },
    { id: 'entity', header: 'Used for', accessor: (r) => humanize(r.entity) },
    { id: 'layout', header: 'Layout', accessor: (r) => humanize(r.layout) },
    { id: 'fields', header: 'Fields', accessor: (r) => r.fields.length, align: 'right' },
    { id: 'submissions', header: 'Test submissions', accessor: (r) => r.submissions, align: 'right' },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'updated', header: 'Last updated', accessor: (r) => r.updatedAt, cell: (r) => formatDateTime(r.updatedAt) },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/config/forms/${r.id}`)}>
              <Pencil /> Open builder
            </DropdownMenuItem>
            {canEdit ? (
              <>
                <DropdownMenuItem onSelect={() => duplicate(r)}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Form builder"
        description="Design custom request and intake forms with drag-and-drop fields, validation and conditional logic."
        actions={
          canEdit ? (
            <Button onClick={() => navigate('/config/forms/new')}>
              <Plus /> New form
            </Button>
          ) : null
        }
      />
      <SimulatedNotice className="mb-4" tone="demo">
        Try it: open <strong>Expense request (custom)</strong>, switch to Preview and tick “Rechargeable to a client” to reveal a conditional field.
      </SimulatedNotice>
      <DataTable
        caption="Form definitions"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="forms"
        onRowClick={(r) => navigate(`/config/forms/${r.id}`)}
        filters={[{ id: 'status', label: 'Statuses', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }], predicate: (r, v) => r.status === v }]}
        emptyState={<EmptyState icon={<FileText />} title="No forms yet" description="Create a form to start designing." className="border-0" />}
      />
    </>
  )
}
