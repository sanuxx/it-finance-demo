import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, Plus, Trash2 } from 'lucide-react'
import type { DemoUser, RoleKey } from '@/domain'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { SelectField, TextField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { ROLE_LABELS, usePreferences } from '@/app/state/preferences'
import { useCollection, useLookups, useMasterList } from '@/hooks/useData'
import { useCurrentUser, usePermission } from '@/hooks/useSession'
import { useAction, runWithToast } from '@/hooks/useAction'
import { userRepository } from '@/services'
import { initials } from '@/lib/formatting'

const ROLES = Object.keys(ROLE_LABELS) as RoleKey[]
const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(60),
  email: z.email('Enter a valid email').refine((e) => e.endsWith('.example'), 'Use a fictional address ending in .example'),
  role: z.enum(['director', 'finance_manager', 'accountant', 'project_manager', 'employee']),
  title: z.string().trim().min(2, 'Enter a job title').max(60),
  department: z.string().min(1, 'Choose a department'),
})
type Values = z.infer<typeof schema>

export default function UsersPage() {
  const users = useCollection('users')
  const me = useCurrentUser()
  const setPrefs = usePreferences((s) => s.set)
  const canManage = usePermission('admin.manage')
  const departments = useMasterList('departments')
  const lookups = useLookups()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', role: 'employee', title: '', department: 'dept-engineering' } })
  useEffect(() => {
    if (open) form.reset({ name: '', email: '', role: 'employee', title: '', department: 'dept-engineering' })
  }, [open, form])

  const create = useAction((v: Values) => userRepository.create({ ...v, initials: initials(v.name) }), { success: 'Demo user added' })

  const remove = async (u: DemoUser) => {
    const { confirmed } = await confirm({ title: `Remove ${u.name}?`, confirmLabel: 'Remove user', destructive: true })
    if (!confirmed) return
    if (u.id === me.id) setPrefs({ currentUserId: 'u-fm' })
    await runWithToast(userRepository.remove(u.id), 'Demo user removed')
  }

  const columns: DataColumn<DemoUser>[] = [
    {
      id: 'name', header: 'User', accessor: (r) => r.name, alwaysVisible: true,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-semibold">{r.initials}</span>
          <div><div className="font-medium">{r.name}{r.id === me.id ? <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span> : null}</div><div className="text-muted-foreground text-xs">{r.email}</div></div>
        </div>
      ),
    },
    { id: 'title', header: 'Job title', accessor: (r) => r.title },
    { id: 'department', header: 'Department', accessor: (r) => lookups.master(r.department) },
    {
      id: 'role', header: 'Role', accessor: (r) => ROLE_LABELS[r.role],
      cell: (r) =>
        canManage ? (
          <Select value={r.role} onValueChange={(v) => runWithToast(userRepository.update(r.id, { role: v as RoleKey }), `${r.name} is now ${ROLE_LABELS[v as RoleKey]}`)}>
            <SelectTrigger size="sm" className="w-44" aria-label={`Role for ${r.name}`} onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((x) => <SelectItem key={x} value={x}>{ROLE_LABELS[x]}</SelectItem>)}</SelectContent>
          </Select>
        ) : ROLE_LABELS[r.role],
    },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" disabled={r.id === me.id} onClick={() => setPrefs({ currentUserId: r.id })}><LogIn /> Switch to</Button>
          {canManage && !r.id.startsWith('u-') ? <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name}`} onClick={() => remove(r)}><Trash2 /></Button> : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Users & roles" description="Fictional demo users. Switch user to see how screens and actions change by role." actions={canManage ? <Button onClick={() => setOpen(true)}><Plus /> Add demo user</Button> : null} />
      <SimulatedNotice className="mb-4" tone="warning">There is no real sign-in or password in this public demo. Roles only change what the interface shows — they are not security. The future backend will authenticate users and enforce permissions.</SimulatedNotice>
      <DataTable caption="Demo users" data={users} columns={columns} getRowId={(r) => r.id} exportName="demo-users" filters={[{ id: 'role', label: 'Roles', options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })), predicate: (u, v) => u.role === v }]} />
      <FormDialog open={open} onOpenChange={setOpen} title="Add demo user" description="Use fictional details only — no real people or email addresses." onSubmit={form.handleSubmit(async (v) => { if (await create.run(v)) setOpen(false) })} pending={create.pending}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="name" label="Name" required autoFocus />
          <TextField control={form.control} name="email" label="Email" type="email" required placeholder="name@kelanibyte.example" />
          <TextField control={form.control} name="title" label="Job title" required />
          <SelectField control={form.control} name="role" label="Role" required options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
          <SelectField control={form.control} name="department" label="Department" required className="sm:col-span-2" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        </div>
      </FormDialog>
    </>
  )
}
