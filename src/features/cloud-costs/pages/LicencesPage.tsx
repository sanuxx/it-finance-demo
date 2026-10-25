import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { SoftwareLicence } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatCard } from '@/components/data-display/StatCard'
import { Money, ProgressBar } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { useCollection, useLookups, useMasterList } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { licenceRepository } from '@/services'
import { multiply, percentOf, sum } from '@/lib/calculations/money'
import { licenceMonthly } from '../lib/licences'
import { formatCurrency, formatDate, humanize } from '@/lib/formatting'
import { daysBetween, todayISO } from '@/lib/dates'

const LICENCE_CATEGORIES = ['development', 'design', 'productivity', 'security', 'infrastructure', 'finance'] as const

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter a name').max(80),
    vendorId: z.string().min(1, 'Choose a vendor'),
    seats: z.number({ error: 'Enter seats' }).int('Whole number').min(1, 'At least one seat'),
    seatsUsed: z.number({ error: 'Enter seats in use' }).int('Whole number').min(0),
    costPerSeat: z.number({ error: 'Enter cost per seat' }).positive('Must be greater than zero'),
    billingCycle: z.enum(['monthly', 'annual']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a start date'),
    renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a renewal date'),
    departmentId: z.string().min(1, 'Choose a department'),
    category: z.enum(LICENCE_CATEGORIES),
    status: z.enum(['active', 'trial', 'cancelled']),
  })
  .refine((v) => v.seatsUsed <= v.seats, { path: ['seatsUsed'], message: 'Cannot exceed purchased seats' })
  .refine((v) => v.renewalDate >= v.startDate, { path: ['renewalDate'], message: 'Renewal must be after the start date' })
type Values = z.infer<typeof schema>

function LicenceDialog({ open, onOpenChange, licence }: { open: boolean; onOpenChange: (o: boolean) => void; licence?: SoftwareLicence }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const suppliers = useCollection('suppliers')
  const departments = useMasterList('departments')
  useEffect(() => {
    if (!open) return
    const t = todayISO()
    form.reset(licence ?? { name: '', vendorId: '', seats: 5, seatsUsed: 5, costPerSeat: undefined as unknown as number, billingCycle: 'monthly', startDate: t, renewalDate: t, departmentId: '', category: 'development', status: 'active' })
  }, [open, licence, form])
  const save = useAction(async (v: Values) => (licence ? licenceRepository.update(licence.id, v) : licenceRepository.create(v)), { success: licence ? 'Licence updated' : 'Licence added' })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={licence ? `Edit ${licence.name}` : 'Add software licence'} size="lg" pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Tool / licence" required className="sm:col-span-2" autoFocus />
        <SelectField control={c} name="vendorId" label="Vendor" required options={suppliers.filter((s) => s.isSoftwareVendor || s.id === licence?.vendorId).map((s) => ({ value: s.id, label: s.name }))} />
        <SelectField control={c} name="departmentId" label="Department" required options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        <NumberField control={c} name="seats" label="Seats purchased" step={1} min={1} required />
        <NumberField control={c} name="seatsUsed" label="Seats in use" step={1} min={0} required />
        <NumberField control={c} name="costPerSeat" label="Cost per seat (per cycle)" prefix="LKR" required min={0} />
        <SelectField control={c} name="billingCycle" label="Billing cycle" required options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]} />
        <TextField control={c} name="startDate" label="Start date" type="date" required />
        <TextField control={c} name="renewalDate" label="Next renewal" type="date" required />
        <SelectField control={c} name="category" label="Category" required options={LICENCE_CATEGORIES.map((x) => ({ value: x, label: humanize(x) }))} />
        <SelectField control={c} name="status" label="Status" required options={[{ value: 'active', label: 'Active' }, { value: 'trial', label: 'Trial' }, { value: 'cancelled', label: 'Cancelled' }]} />
      </div>
    </FormDialog>
  )
}

export default function LicencesPage() {
  const licences = useCollection('licences')
  const lookups = useLookups()
  const confirm = useConfirm()
  const canEdit = usePermission('saas.edit')
  const [dialog, setDialog] = useState<{ open: boolean; licence?: SoftwareLicence }>({ open: false })
  const today = todayISO()

  const live = useMemo(() => licences.filter((l) => l.status !== 'cancelled'), [licences])
  const monthly = sum(live, licenceMonthly)
  const seats = live.reduce((s, l) => s + l.seats, 0)
  const used = live.reduce((s, l) => s + l.seatsUsed, 0)
  const unusedMonthly = sum(live, (l) => (l.seats ? multiply(licenceMonthly(l), (l.seats - l.seatsUsed) / l.seats) : 0))
  const renewals = live.filter((l) => l.renewalDate >= today && daysBetween(today, l.renewalDate) <= 30).sort((a, b) => a.renewalDate.localeCompare(b.renewalDate))

  const remove = async (l: SoftwareLicence) => {
    const { confirmed } = await confirm({ title: `Delete ${l.name}?`, description: 'Historic months will no longer include this licence’s cost. To stop future cost only, mark it cancelled instead.', destructive: true, confirmLabel: 'Delete' })
    if (confirmed) await runWithToast(licenceRepository.remove(l.id), 'Licence deleted')
  }

  const columns: DataColumn<SoftwareLicence>[] = [
    { id: 'name', header: 'Tool', accessor: (l) => l.name, alwaysVisible: true, cell: (l) => <div><div className="font-medium">{l.name}</div><div className="text-muted-foreground text-xs">{lookups.supplier(l.vendorId)}</div></div> },
    { id: 'category', header: 'Category', accessor: (l) => humanize(l.category) },
    { id: 'department', header: 'Department', accessor: (l) => lookups.master(l.departmentId) },
    { id: 'seats', header: 'Seats used', accessor: (l) => l.seatsUsed, align: 'right', cell: (l) => `${l.seatsUsed} / ${l.seats}` },
    { id: 'util', header: 'Utilisation', accessor: (l) => percentOf(l.seatsUsed, l.seats) ?? 0, cell: (l) => <ProgressBar value={percentOf(l.seatsUsed, l.seats)} tone="primary" label={`Seat utilisation for ${l.name}`} className="w-28" /> },
    { id: 'cycle', header: 'Cycle', accessor: (l) => humanize(l.billingCycle), defaultHidden: true },
    { id: 'perSeat', header: 'Per seat', accessor: (l) => l.costPerSeat, align: 'right', cell: (l) => <Money value={l.costPerSeat} />, defaultHidden: true },
    { id: 'monthly', header: 'Monthly equivalent', accessor: (l) => licenceMonthly(l), align: 'right', cell: (l) => <Money value={licenceMonthly(l)} /> },
    { id: 'unused', header: 'Unused seat cost / mo', accessor: (l) => multiply(licenceMonthly(l), (l.seats - l.seatsUsed) / l.seats), align: 'right', cell: (l) => { const v = multiply(licenceMonthly(l), (l.seats - l.seatsUsed) / l.seats); return v > 0 ? <Money value={v} className="text-warning" /> : <span className="text-muted-foreground">—</span> } },
    { id: 'renewal', header: 'Renewal', accessor: (l) => l.renewalDate, cell: (l) => formatDate(l.renewalDate) },
    { id: 'status', header: 'Status', accessor: (l) => l.status, cell: (l) => <StatusBadge status={l.status} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true,
      cell: (l) => canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ open: true, licence: l })}><Pencil /> Edit</DropdownMenuItem>
            {l.status !== 'cancelled' ? <DropdownMenuItem onSelect={() => runWithToast(licenceRepository.update(l.id, { status: 'cancelled' }), `${l.name} marked cancelled`)}>Mark cancelled</DropdownMenuItem> : null}
            {l.seatsUsed < l.seats ? <DropdownMenuItem onSelect={() => runWithToast(licenceRepository.update(l.id, { seats: l.seatsUsed || 1 }), `Reduced ${l.name} to ${l.seatsUsed || 1} seat(s)`)}>Right-size to seats in use</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => remove(l)}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Software licences" description="Seat-based tools and SaaS subscriptions the company pays for. Monthly equivalents feed the expense ledger." actions={canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> Add licence</Button> : null} />
      <StatGrid className="mb-6">
        <StatCard label="Monthly licence cost" value={formatCurrency(monthly)} hint={`${live.length} active tools`} />
        <StatCard label="Annualised" value={formatCurrency(multiply(monthly, 12))} />
        <StatCard label="Seat utilisation" term="Utilisation" value={`${percentOf(used, seats) ?? 0}%`} hint={`${used} of ${seats} seats in use`} />
        <StatCard label="Unused seats / month" value={formatCurrency(unusedMonthly)} hint="Potential saving from right-sizing" />
      </StatGrid>
      <Section title="Renewals in the next 30 days" className="mb-4">
        {renewals.length ? (
          <ul className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {renewals.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0"><span className="block truncate font-medium">{l.name}</span><span className="text-muted-foreground text-xs">{formatDate(l.renewalDate)} · in {daysBetween(today, l.renewalDate)} days</span></span>
                <Money value={l.billingCycle === 'annual' ? multiply(l.seats, l.costPerSeat) : licenceMonthly(l)} className="text-sm" />
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground text-sm">No renewals due in the next 30 days.</p>}
      </Section>
      <DataTable
        caption="Software licences"
        data={licences}
        columns={columns}
        getRowId={(l) => l.id}
        exportName="software-licences"
        initialSort={{ id: 'monthly', desc: true }}
        searchPlaceholder="Search tools, vendors…"
        filters={[
          { id: 'category', label: 'Categories', options: LICENCE_CATEGORIES.map((c) => ({ value: c, label: humanize(c) })), predicate: (l, v) => l.category === v },
          { id: 'status', label: 'Statuses', options: ['active', 'trial', 'cancelled'].map((c) => ({ value: c, label: humanize(c) })), predicate: (l, v) => l.status === v },
        ]}
        emptyState={<EmptyState icon={<KeyRound />} title="No licences yet" className="border-0" />}
      />
      <LicenceDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} licence={dialog.licence} />
    </>
  )
}
