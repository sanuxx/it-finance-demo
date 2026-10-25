import { useNavigate } from 'react-router-dom'
import { Copy, GitBranch, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { BusinessRule } from '@/domain'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { ruleRepository } from '@/services'
import { formatDateTime } from '@/lib/formatting'
import { ENTITY_LABELS, describeCondition, ACTION_LABELS } from '../lib/ruleLabels'
import { useLookups } from '@/hooks/useData'

export default function RulesPage() {
  const rules = useCollection('rules')
  const canEdit = usePermission('config.edit')
  const navigate = useNavigate()
  const confirm = useConfirm()
  const lookups = useLookups()

  const duplicate = async (r: BusinessRule) => {
    const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = structuredClone(r)
    void _i
    void _c
    void _u
    const created = await runWithToast(ruleRepository.create({ ...rest, name: `${r.name} (copy)`, enabled: false }), 'Rule duplicated (disabled)')
    if (created) navigate(`/config/rules/${created.id}`)
  }
  const remove = async (r: BusinessRule) => {
    const { confirmed } = await confirm({ title: `Delete "${r.name}"?`, description: 'The rule will stop running immediately.', confirmLabel: 'Delete rule', destructive: true })
    if (confirmed) await runWithToast(ruleRepository.remove(r.id), 'Rule deleted')
  }

  const columns: DataColumn<BusinessRule>[] = [
    { id: 'priority', header: 'Priority', accessor: (r) => r.priority, align: 'right' },
    { id: 'name', header: 'Rule', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div className="max-w-md"><div className="font-medium">{r.name}</div><div className="text-muted-foreground line-clamp-1 text-xs">{r.description}</div></div> },
    { id: 'entity', header: 'Applies to', accessor: (r) => ENTITY_LABELS[r.entity] },
    {
      id: 'when',
      header: 'When',
      accessor: (r) => r.conditions.map((c) => describeCondition(c, lookups)).join(r.match === 'all' ? ' AND ' : ' OR '),
      cell: (r) => <span className="text-muted-foreground text-xs">{r.conditions.map((c) => describeCondition(c, lookups)).join(r.match === 'all' ? ' and ' : ' or ') || '—'}</span>,
    },
    { id: 'then', header: 'Then', accessor: (r) => r.actions.map((a) => ACTION_LABELS[a.type]).join(', '), cell: (r) => <span className="text-xs">{r.actions.map((a) => ACTION_LABELS[a.type]).join(', ')}</span> },
    { id: 'updated', header: 'Updated', accessor: (r) => r.updatedAt, cell: (r) => formatDateTime(r.updatedAt), defaultHidden: true },
    {
      id: 'enabled',
      header: 'Enabled',
      accessor: (r) => r.enabled,
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={r.enabled} disabled={!canEdit} aria-label={`${r.enabled ? 'Disable' : 'Enable'} ${r.name}`} onCheckedChange={(c) => runWithToast(ruleRepository.update(r.id, { enabled: c }), c ? 'Rule enabled' : 'Rule disabled')} />
        </div>
      ),
    },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/config/rules/${r.id}`)}><Pencil /> Edit & test</DropdownMenuItem>
            {canEdit ? (
              <>
                <DropdownMenuItem onSelect={() => duplicate(r)}><Copy /> Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}><Trash2 /> Delete</DropdownMenuItem>
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
        title="Rules builder"
        description="Condition → action rules that flag records for review, notify roles, escalate approvals and warn about budgets."
        actions={canEdit ? <Button onClick={() => navigate('/config/rules/new')}><Plus /> New rule</Button> : null}
      />
      <SimulatedNotice className="mb-4" tone="demo">
        Rules are local demo configuration. Enabled expense rules run automatically when a claim is submitted, and purchase-order rules run when an order is sent for approval — the results appear as notifications and review flags. Nothing outside this browser is affected.
      </SimulatedNotice>
      <DataTable
        caption="Business rules"
        data={rules}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="business-rules"
        initialSort={{ id: 'priority' }}
        onRowClick={(r) => navigate(`/config/rules/${r.id}`)}
        filters={[
          { id: 'entity', label: 'Records', options: Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })), predicate: (r, v) => r.entity === v },
          { id: 'enabled', label: 'States', options: [{ value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }], predicate: (r, v) => (v === 'on' ? r.enabled : !r.enabled) },
        ]}
        emptyState={<EmptyState icon={<GitBranch />} title="No rules yet" description="Create a rule to automate checks." className="border-0" />}
      />
    </>
  )
}
