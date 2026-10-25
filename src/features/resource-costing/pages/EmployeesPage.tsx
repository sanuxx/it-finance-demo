import { useMemo, useState } from 'react'
import { Lock, MoreHorizontal, Pencil, Plus, Trash2, UserX } from 'lucide-react'
import type { EmployeeProfile } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups, useMasterList } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { employeeRepository } from '@/services'
import { divide, multiply, percentOf, sum } from '@/lib/calculations/money'
import { formatCompactCurrency, formatCurrency, formatDate, formatPercent } from '@/lib/formatting'
import { EmployeeFormDialog } from '../components/EmployeeFormDialog'

export default function EmployeesPage() {
  const employees = useCollection('employees')
  const lookups = useLookups()
  const departments = useMasterList('departments')
  const roles = useMasterList('employeeRoles')
  const sensitive = usePermission('costs.sensitive')
  const canEdit = usePermission('projects.edit') && sensitive
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; employee?: EmployeeProfile }>({ open: false })

  const active = useMemo(() => employees.filter((e) => e.active), [employees])
  const monthly = sum(active, (e) => e.monthlyCost)
  const contractors = active.filter((e) => e.employmentType === 'contractor')
  const billable = active.filter((e) => e.hourlyBillRate > 0)
  const avgMarkup = percentOf(
    sum(billable, (e) => e.hourlyBillRate - e.hourlyCostRate),
    sum(billable, (e) => e.hourlyBillRate),
  )

  if (!sensitive) {
    return (
      <>
        <PageHeader title="People cost profiles" />
        <EmptyState icon={<Lock />} title="Cost profiles are restricted" description="Employee cost rates are only visible to finance and director roles in this simulated permission model." />
      </>
    )
  }

  const remove = async (e: EmployeeProfile) => {
    const { confirmed } = await confirm({ title: `Delete ${e.name}?`, description: 'People with timesheets cannot be deleted — mark them inactive instead.', destructive: true, confirmLabel: 'Delete profile' })
    if (confirmed) await runWithToast(employeeRepository.remove(e.id), 'Cost profile deleted')
  }

  const columns: DataColumn<EmployeeProfile>[] = [
    { id: 'name', header: 'Person', accessor: (r) => r.name, alwaysVisible: true, cell: (r) => <div><div className="font-medium">{r.name}</div><div className="text-muted-foreground text-xs">{r.code}</div></div> },
    { id: 'role', header: 'Role', accessor: (r) => lookups.master(r.roleId) },
    { id: 'dept', header: 'Department', accessor: (r) => lookups.master(r.departmentId) },
    { id: 'type', header: 'Type', accessor: (r) => (r.employmentType === 'contractor' ? 'Contractor' : 'Employee') },
    { id: 'start', header: 'Start date', accessor: (r) => r.startDate, cell: (r) => formatDate(r.startDate), defaultHidden: true },
    { id: 'monthly', header: 'Monthly cost', accessor: (r) => r.monthlyCost, align: 'right', cell: (r) => <Money value={r.monthlyCost} /> },
    { id: 'costRate', header: 'Cost / hour', accessor: (r) => r.hourlyCostRate, align: 'right', cell: (r) => <Money value={r.hourlyCostRate} /> },
    { id: 'billRate', header: 'Bill / hour', accessor: (r) => r.hourlyBillRate, align: 'right', cell: (r) => (r.hourlyBillRate ? <Money value={r.hourlyBillRate} /> : <span className="text-muted-foreground">Non-billable</span>) },
    { id: 'markup', header: 'Rate margin', accessor: (r) => percentOf(r.hourlyBillRate - r.hourlyCostRate, r.hourlyBillRate) ?? undefined, align: 'right', cell: (r) => formatPercent(percentOf(r.hourlyBillRate - r.hourlyCostRate, r.hourlyBillRate)) },
    { id: 'capacity', header: 'Capacity', accessor: (r) => r.capacityHoursPerWeek, align: 'right', cell: (r) => `${r.capacityHoursPerWeek} h/wk`, defaultHidden: true },
    { id: 'status', header: 'Status', accessor: (r) => (r.active ? 'active' : 'inactive'), cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
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
        canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDialog({ open: true, employee: r })}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runWithToast(employeeRepository.update(r.id, { active: !r.active }), r.active ? `${r.name} marked inactive` : `${r.name} reactivated`)}>
                <UserX /> {r.active ? 'Mark inactive' : 'Reactivate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove(r)}>
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
        title="People cost profiles"
        description="Fictional employee and contractor cost profiles used for labour costing, utilisation and personnel cost."
        actions={
          canEdit ? (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus /> New profile
            </Button>
          ) : null
        }
      />
      <SimulatedNotice tone="warning" className="mb-6">
        All people, names and compensation figures are fictional sample data. Visibility of this screen is controlled by a simulated, browser-only permission — real access control will be enforced by the backend.
      </SimulatedNotice>
      <StatGrid className="mb-6">
        <StatCard label="Active people" value={active.length} hint={`${contractors.length} contractor(s)`} />
        <StatCard label="Monthly personnel cost" value={formatCompactCurrency(monthly)} hint={`${formatCompactCurrency(multiply(monthly, 12))} annualised`} />
        <StatCard label="Avg cost per hour" value={formatCurrency(divide(sum(active, (e) => e.hourlyCostRate), active.length))} hint="Unweighted average" />
        <StatCard label="Avg rate margin" value={formatPercent(avgMarkup)} hint={`${billable.length} billable people`} />
      </StatGrid>
      <DataTable
        caption="People cost profiles"
        data={employees}
        columns={columns}
        getRowId={(r) => r.id}
        exportName="people-cost-profiles"
        initialSort={{ id: 'monthly', desc: true }}
        searchPlaceholder="Search name, code…"
        filters={[
          { id: 'dept', label: 'Departments', options: departments.map((d) => ({ value: d.id, label: d.name })), predicate: (r, v) => r.departmentId === v },
          { id: 'role', label: 'Roles', options: roles.map((d) => ({ value: d.id, label: d.name })), predicate: (r, v) => r.roleId === v },
          { id: 'type', label: 'Types', options: [{ value: 'employee', label: 'Employee' }, { value: 'contractor', label: 'Contractor' }], predicate: (r, v) => r.employmentType === v },
          { id: 'status', label: 'Statuses', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], predicate: (r, v) => r.active === (v === 'active') },
        ]}
      />
      <EmployeeFormDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} employee={dialog.employee} />
    </>
  )
}
