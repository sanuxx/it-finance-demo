import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { AccountType, LedgerAccount } from '@/domain'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { useConfirm } from '@/components/dialogs/ConfirmDialog'
import { SelectField, SwitchField, TextField, TextareaField } from '@/components/forms/fields'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { accountRepository } from '@/services'
import { humanize } from '@/lib/formatting'
import { accountSummaries, postedLines } from '../lib/ledger'

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']
const CODE_RANGE: Record<AccountType, string> = { asset: '1000–1999', liability: '2000–2999', equity: '3000–3999', income: '4000–4999', expense: '5000–5999' }

function makeSchema(existing: LedgerAccount[], editingId?: string) {
  return z
    .object({
      code: z.string().trim().regex(/^\d{4}$/, 'Use a 4-digit code'),
      name: z.string().trim().min(2, 'Enter an account name'),
      type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
      subtype: z.string().trim().min(2, 'Enter a subtype, e.g. Operating'),
      description: z.string().max(300).optional(),
      active: z.boolean(),
    })
    .refine((v) => !existing.some((a) => a.code === v.code && a.id !== editingId), { message: 'This code is already used', path: ['code'] })
    .refine((v) => String(TYPES.indexOf(v.type) + 1) === v.code[0], { message: 'Code must start with the digit for its type (1 asset … 5 expense)', path: ['code'] })
}
type Values = z.infer<ReturnType<typeof makeSchema>>

function AccountDialog({ open, onOpenChange, account, accounts }: { open: boolean; onOpenChange: (o: boolean) => void; account?: LedgerAccount; accounts: LedgerAccount[] }) {
  const schema = useMemo(() => makeSchema(accounts, account?.id), [accounts, account])
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) form.reset(account ? { ...account, description: account.description ?? '' } : { code: '', name: '', type: 'expense', subtype: 'Operating', description: '', active: true })
  }, [open, account, form])
  const save = useAction((v: Values) => (account ? accountRepository.update(account.id, v) : accountRepository.create(v)), { success: account ? 'Account updated' : 'Account created' })
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={account ? `Edit ${account.code}` : 'New ledger account'} onSubmit={onSubmit} pending={save.pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={c} name="type" label="Type" required options={TYPES.map((t) => ({ value: t, label: `${humanize(t)} (${CODE_RANGE[t]})` }))} />
        <TextField control={c} name="code" label="Code" required />
        <TextField control={c} name="name" label="Name" required className="sm:col-span-2" />
        <TextField control={c} name="subtype" label="Subtype" required className="sm:col-span-2" />
        <TextareaField control={c} name="description" label="Description" className="sm:col-span-2" />
        <SwitchField control={c} name="active" label="Active" description="Inactive accounts cannot be used on new journals." className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function ChartOfAccountsPage() {
  const accounts = useCollection('accounts')
  const entries = useCollection('journalEntries')
  const canEdit = usePermission('finance.edit')
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<{ open: boolean; account?: LedgerAccount }>({ open: false })
  const balances = useMemo(() => new Map(accountSummaries(accounts, postedLines(entries)).map((s) => [s.account.id, s])), [accounts, entries])

  const remove = async (a: LedgerAccount) => {
    const { confirmed } = await confirm({ title: `Delete ${a.code} ${a.name}?`, description: 'Accounts used on journal lines cannot be deleted — deactivate them instead.', destructive: true, confirmLabel: 'Delete account' })
    if (confirmed) await runWithToast(accountRepository.remove(a.id), 'Account deleted')
  }

  const columns: DataColumn<LedgerAccount>[] = [
    { id: 'code', header: 'Code', accessor: (a) => a.code, cell: (a) => <span className="font-mono text-xs">{a.code}</span> },
    { id: 'name', header: 'Account', accessor: (a) => a.name, alwaysVisible: true, cell: (a) => <div><div className="font-medium">{a.name}</div>{a.description ? <div className="text-muted-foreground text-xs">{a.description}</div> : null}</div> },
    { id: 'type', header: 'Type', accessor: (a) => a.type, cell: (a) => humanize(a.type) },
    { id: 'subtype', header: 'Subtype', accessor: (a) => a.subtype },
    { id: 'balance', header: 'Ledger balance', accessor: (a) => balances.get(a.id)?.balance ?? 0, align: 'right', cell: (a) => <Money value={balances.get(a.id)?.balance ?? 0} signed /> },
    { id: 'status', header: 'Status', accessor: (a) => (a.active ? 'active' : 'inactive'), cell: (a) => <StatusBadge status={a.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (a) =>
        canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDialog({ open: true, account: a })}><Pencil /> Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runWithToast(accountRepository.update(a.id, { active: !a.active }), a.active ? 'Account deactivated' : 'Account activated')}><Power /> {a.active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => remove(a)}><Trash2 /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Chart of accounts" description="Ledger accounts used by illustrative journals. Codes follow 1 asset · 2 liability · 3 equity · 4 income · 5 expense." actions={canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> New account</Button> : null} />
      <StatGrid className="mb-6 xl:grid-cols-5">
        {TYPES.map((t) => (
          <StatCard key={t} label={humanize(t)} value={accounts.filter((a) => a.type === t && a.active).length} hint={`Codes ${CODE_RANGE[t]}`} />
        ))}
      </StatGrid>
      <DataTable
        caption="Chart of accounts"
        data={accounts}
        columns={columns}
        getRowId={(a) => a.id}
        exportName="chart-of-accounts"
        initialSort={{ id: 'code' }}
        pageSize={50}
        filters={[
          { id: 'type', label: 'Types', options: TYPES.map((t) => ({ value: t, label: humanize(t) })), predicate: (a, v) => a.type === v },
          { id: 'status', label: 'Statuses', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], predicate: (a, v) => (v === 'active') === a.active },
        ]}
      />
      <AccountDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} account={dialog.account} accounts={accounts} />
    </>
  )
}
