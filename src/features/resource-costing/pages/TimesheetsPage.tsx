import { useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import type { TimesheetEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups } from '@/hooks/useData'
import { usePermission, useRole } from '@/hooks/useSession'
import { runWithToast } from '@/hooks/useAction'
import { timesheetRepository } from '@/services'
import { formatDate, formatNumber, formatPercent } from '@/lib/formatting'
import { percentOf } from '@/lib/calculations/money'
import { TimesheetDialog } from '../components/TimesheetDialog'
import { weekStart } from '../lib/week'
import { todayISO } from '@/lib/dates'

/** The demo "Employee" user (Ishara Gunawardena) maps to this cost profile. */
const DEMO_EMPLOYEE_PROFILE = 'emp-05'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export default function TimesheetsPage() {
  const all = useCollection('timesheets')
  const employees = useCollection('employees')
  const projects = useCollection('projects')
  const lookups = useLookups()
  const role = useRole()
  const canApprove = usePermission('timesheets.approve')
  const confirm = useConfirm()
  const ownOnly = role === 'employee'
  const [dialog, setDialog] = useState<{ open: boolean; entry?: TimesheetEntry }>({ open: false })
  const latestWeek = useMemo(() => all.reduce((m, t) => (t.date > m ? t.date : m), '') || weekStart(todayISO()), [all])
  const [week, setWeek] = useState(latestWeek)

  const timesheets = useMemo(() => (ownOnly ? all.filter((t) => t.employeeId === DEMO_EMPLOYEE_PROFILE) : all), [all, ownOnly])
  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, approved: 0, rejected: 0 }
    for (const t of timesheets) c[t.status]++
    return c
  }, [timesheets])
  const last4 = format(addDays(parseISO(latestWeek), -27), 'yyyy-MM-dd')
  const recent = timesheets.filter((t) => t.date >= last4 && t.status !== 'rejected')
  const recentHours = recent.reduce((s, t) => s + t.hours, 0)
  const recentBillable = recent.filter((t) => t.billable).reduce((s, t) => s + t.hours, 0)

  const transition = async (rows: TimesheetEntry[], status: TimesheetEntry['status'], reason?: string) => {
    for (const r of rows) await timesheetRepository.update(r.id, { status, description: reason ? `${r.description} — rejected: ${reason}` : r.description })
  }
  const submit = (rows: TimesheetEntry[]) => runWithToast(transition(rows.filter((r) => r.status === 'draft' || r.status === 'rejected'), 'submitted'), `Submitted ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`)
  const approve = (rows: TimesheetEntry[]) => runWithToast(transition(rows.filter((r) => r.status === 'submitted'), 'approved'), 'Timesheets approved (simulated approval)')
  const reject = async (rows: TimesheetEntry[]) => {
    const { confirmed, reason } = await confirm({ title: `Reject ${rows.length} timesheet entr${rows.length === 1 ? 'y' : 'ies'}?`, requireReason: true, reasonLabel: 'Reason for rejection', confirmLabel: 'Reject', destructive: true })
    if (confirmed) await runWithToast(transition(rows.filter((r) => r.status === 'submitted'), 'rejected', reason.trim()), 'Timesheets rejected')
  }
  const remove = async (t: TimesheetEntry) => {
    const { confirmed } = await confirm({ title: 'Delete this timesheet entry?', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(timesheetRepository.remove(t.id), 'Timesheet entry deleted')
  }

  const columns: DataColumn<TimesheetEntry>[] = [
    { id: 'week', header: 'Week of', accessor: (r) => r.date, cell: (r) => formatDate(r.date) },
    { id: 'person', header: 'Person', accessor: (r) => lookups.employee(r.employeeId), alwaysVisible: true },
    { id: 'project', header: 'Project', accessor: (r) => lookups.projectCode(r.projectId), cell: (r) => <span title={lookups.project(r.projectId)}>{lookups.projectCode(r.projectId)}</span> },
    { id: 'description', header: 'Work', accessor: (r) => r.description },
    { id: 'hours', header: 'Hours', accessor: (r) => r.hours, align: 'right', cell: (r) => formatNumber(r.hours) },
    { id: 'billable', header: 'Billable', accessor: (r) => (r.billable ? 'Billable' : 'Non-billable') },
    { id: 'status', header: 'Status', accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: 'actions',
      header: '',
      accessor: () => '',
      sortable: false,
      searchable: false,
      noExport: true,
      alwaysVisible: true,
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {r.status === 'draft' || r.status === 'rejected' ? (
            <>
              <Button variant="ghost" size="icon-sm" aria-label="Edit entry" onClick={() => setDialog({ open: true, entry: r })}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Submit entry" onClick={() => submit([r])}>
                <Send />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete entry" onClick={() => remove(r)}>
                <Trash2 />
              </Button>
            </>
          ) : null}
          {r.status === 'submitted' && canApprove ? (
            <>
              <Button variant="ghost" size="icon-sm" aria-label="Approve entry" onClick={() => approve([r])}>
                <Check />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Reject entry" onClick={() => reject([r])}>
                <X />
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ]

  // Weekly grid: people × projects for the selected week.
  const weekRows = timesheets.filter((t) => t.date === week)
  const gridPeople = [...new Set(weekRows.map((t) => t.employeeId))].sort((a, b) => lookups.employee(a).localeCompare(lookups.employee(b)))
  const gridProjects = [...new Set(weekRows.map((t) => t.projectId))].sort((a, b) => lookups.projectCode(a).localeCompare(lookups.projectCode(b)))
  const cell = (e: string, p: string) => weekRows.filter((t) => t.employeeId === e && t.projectId === p).reduce((s, t) => s + t.hours, 0)
  const capacityOf = (id: string) => employees.find((e) => e.id === id)?.capacityHoursPerWeek ?? 40

  return (
    <>
      <PageHeader
        title="Timesheets"
        description={ownOnly ? 'Your logged hours (demo employee profile). Submitted hours are costed at your fictional cost rate.' : 'Weekly hours by person and project. Submitted and approved hours drive project labour cost and utilisation.'}
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus /> Log hours
          </Button>
        }
      />
      <StatGrid className="mb-6">
        <StatCard label="Hours (last 4 weeks)" value={formatNumber(recentHours)} hint={`${formatNumber(recentBillable)} billable`} />
        <StatCard label="Billable share" term="Utilisation" value={formatPercent(percentOf(recentBillable, recentHours))} hint="Of hours logged in the last 4 weeks" />
        <StatCard label="Awaiting approval" value={counts.submitted} hint={canApprove ? 'Select entries below to approve' : 'Approved by project managers'} />
        <StatCard label="Drafts" value={counts.draft} hint={`${counts.rejected} rejected`} />
      </StatGrid>
      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">All entries</TabsTrigger>
          <TabsTrigger value="week">Weekly grid</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <DataTable
            caption="Timesheet entries"
            data={timesheets}
            columns={columns}
            getRowId={(r) => r.id}
            exportName="timesheets"
            initialSort={{ id: 'week', desc: true }}
            selectable
            searchPlaceholder="Search person, project, work…"
            bulkActions={[
              { label: 'Submit', icon: <Send />, onClick: submit, disabled: (rows) => !rows.some((r) => r.status === 'draft' || r.status === 'rejected') },
              ...(canApprove
                ? [
                    { label: 'Approve', icon: <Check />, onClick: approve, variant: 'default' as const, disabled: (rows: TimesheetEntry[]) => !rows.some((r) => r.status === 'submitted') },
                    { label: 'Reject', icon: <X />, onClick: reject, variant: 'destructive' as const, disabled: (rows: TimesheetEntry[]) => !rows.some((r) => r.status === 'submitted') },
                  ]
                : []),
            ]}
            filters={[
              { id: 'status', label: 'Statuses', options: STATUS_OPTIONS, predicate: (r, v) => r.status === v },
              { id: 'project', label: 'Projects', options: projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })), predicate: (r, v) => r.projectId === v },
              ...(ownOnly ? [] : [{ id: 'person', label: 'People', options: employees.map((e) => ({ value: e.id, label: e.name })), predicate: (r: TimesheetEntry, v: string) => r.employeeId === v }]),
            ]}
          />
        </TabsContent>
        <TabsContent value="week">
          <Section
            title={`Week of ${formatDate(week)}`}
            description="Hours per person and project. Totals above weekly capacity are highlighted."
            actions={
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" aria-label="Previous week" onClick={() => setWeek(format(addDays(parseISO(week), -7), 'yyyy-MM-dd'))}>
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeek(latestWeek)}>
                  Latest
                </Button>
                <Button variant="outline" size="icon-sm" aria-label="Next week" onClick={() => setWeek(format(addDays(parseISO(week), 7), 'yyyy-MM-dd'))}>
                  <ChevronRight />
                </Button>
              </div>
            }
          >
            {gridPeople.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      {gridProjects.map((p) => (
                        <TableHead key={p} className="text-right" title={lookups.project(p)}>
                          {lookups.projectCode(p)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gridPeople.map((e) => {
                      const total = gridProjects.reduce((s, p) => s + cell(e, p), 0)
                      return (
                        <TableRow key={e}>
                          <TableCell className="font-medium">{lookups.employee(e)}</TableCell>
                          {gridProjects.map((p) => (
                            <TableCell key={p} className="tabular text-right">
                              {cell(e, p) ? formatNumber(cell(e, p)) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          ))}
                          <TableCell className={`tabular text-right font-semibold ${total > capacityOf(e) ? 'text-destructive' : ''}`}>
                            {formatNumber(total)}
                            {total > capacityOf(e) ? ' (over capacity)' : ''}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      {gridProjects.map((p) => (
                        <TableCell key={p} className="tabular text-right font-semibold">
                          {formatNumber(gridPeople.reduce((s, e) => s + cell(e, p), 0))}
                        </TableCell>
                      ))}
                      <TableCell className="tabular text-right font-semibold">{formatNumber(weekRows.reduce((s, t) => s + t.hours, 0))}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            ) : (
              <EmptyState title="No hours logged for this week" description="Use the arrows to move between weeks or log hours." className="border-0" />
            )}
          </Section>
        </TabsContent>
      </Tabs>
      <SimulatedNotice className="mt-4">Approvals here are a UI simulation and do not authorise payroll or billing. Draft entries are excluded from project costs until submitted.</SimulatedNotice>
      <TimesheetDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} entry={dialog.entry} lockedEmployeeId={ownOnly ? DEMO_EMPLOYEE_PROFILE : undefined} />
    </>
  )
}
