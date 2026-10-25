import { useMemo, useState } from 'react'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Project, ProjectAllocation } from '@/domain'
import { Button } from '@/components/ui/button'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { allocationRepository } from '@/services'
import { multiply, round2 } from '@/lib/calculations/money'
import { formatDate, formatNumber } from '@/lib/formatting'
import { AllocationDialog } from '../AllocationDialog'

interface Row {
  id: string
  employeeId: string
  name: string
  role: string
  allocation?: ProjectAllocation
  plannedHours: number
  hours: number
  billableHours: number
  cost: number
  billableValue: number
}

export function TeamTab({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const allocations = useCollection('allocations')
  const timesheets = useCollection('timesheets')
  const employees = useCollection('employees')
  const lookups = useLookups()
  const sensitive = usePermission('costs.sensitive')
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; allocation?: ProjectAllocation }>({ open: false })

  const rows = useMemo<Row[]>(() => {
    const emp = new Map(employees.map((e) => [e.id, e]))
    const map = new Map<string, Row>()
    for (const a of allocations.filter((x) => x.projectId === project.id)) {
      map.set(a.employeeId, { id: a.id, employeeId: a.employeeId, name: lookups.employee(a.employeeId), role: a.roleOnProject, allocation: a, plannedHours: a.plannedHours, hours: 0, billableHours: 0, cost: 0, billableValue: 0 })
    }
    for (const t of timesheets) {
      if (t.projectId !== project.id || t.status === 'rejected' || t.status === 'draft') continue
      const e = emp.get(t.employeeId)
      let row = map.get(t.employeeId)
      if (!row) {
        row = { id: `ts:${t.employeeId}`, employeeId: t.employeeId, name: lookups.employee(t.employeeId), role: e ? lookups.master(e.roleId) : '—', plannedHours: 0, hours: 0, billableHours: 0, cost: 0, billableValue: 0 }
        map.set(t.employeeId, row)
      }
      row.hours += t.hours
      row.cost = round2(row.cost + multiply(t.hours, e?.hourlyCostRate ?? 0))
      if (t.billable) {
        row.billableHours += t.hours
        row.billableValue = round2(row.billableValue + multiply(t.hours, e?.hourlyBillRate ?? 0))
      }
    }
    return [...map.values()]
  }, [allocations, timesheets, employees, project.id, lookups])

  const remove = async (a: ProjectAllocation) => {
    const { confirmed } = await confirm({ title: 'Remove this allocation?', description: 'Logged timesheets are kept; only the planned allocation is removed.', destructive: true, confirmLabel: 'Remove' })
    if (confirmed) await runWithToast(allocationRepository.remove(a.id), 'Allocation removed')
  }

  const columns: DataColumn<Row>[] = [
    { id: 'name', header: 'Person', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.role}</div></div> },
    { id: 'period', header: 'Allocated', accessor: (r) => r.allocation?.startDate, cell: (r) => (r.allocation ? `${formatDate(r.allocation.startDate)} – ${formatDate(r.allocation.endDate)}` : <span className="text-muted-foreground">Not allocated</span>), defaultHidden: true },
    { id: 'planned', header: 'Planned hours', accessor: (r) => r.plannedHours, align: 'right', cell: (r) => formatNumber(r.plannedHours) },
    { id: 'hours', header: 'Logged hours', accessor: (r) => r.hours, align: 'right', cell: (r) => formatNumber(r.hours) },
    { id: 'progress', header: 'Of plan', accessor: (r) => (r.plannedHours ? r.hours / r.plannedHours : 0), cell: (r) => (r.plannedHours ? <ProgressBar value={r.hours} max={r.plannedHours} label={`${r.name} hours against plan`} className="min-w-24" /> : '—') },
    { id: 'billable', header: 'Billable hours', accessor: (r) => r.billableHours, align: 'right', cell: (r) => formatNumber(r.billableHours) },
    ...(sensitive
      ? ([
          { id: 'cost', header: 'Labour cost', accessor: (r) => r.cost, align: 'right', cell: (r) => <Money value={r.cost} /> },
          { id: 'value', header: 'Billable value', accessor: (r) => r.billableValue, align: 'right', cell: (r) => <Money value={r.billableValue} /> },
        ] satisfies DataColumn<Row>[])
      : []),
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      align: 'right',
      cell: (r) =>
        canEdit && r.allocation ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit allocation for ${r.name}`} onClick={() => setDialog({ open: true, allocation: r.allocation })}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove allocation for ${r.name}`} onClick={() => remove(r.allocation!)}>
              <Trash2 />
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      {!sensitive ? (
        <SimulatedNotice>
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" /> Cost rates and labour cost are hidden for your demo role (simulated permission). Switch to Finance Manager or Director to see them.
          </span>
        </SimulatedNotice>
      ) : null}
      <DataTable
        caption={`Team on ${project.code}`}
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        exportName={`${project.code}-team`}
        initialSort={{ id: 'hours', desc: true }}
        toolbar={
          canEdit ? (
            <Button size="sm" className="h-9" onClick={() => setDialog({ open: true })}>
              <Plus /> Allocate person
            </Button>
          ) : null
        }
      />
      <AllocationDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} project={project} allocation={dialog.allocation} />
    </div>
  )
}
