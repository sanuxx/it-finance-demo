import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Landmark, Pencil, Plus } from 'lucide-react'
import type { BankAccount, Payment } from '@/domain'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader, Section, StatGrid } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/data-display/StatCard'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { DetailList, Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip, axisProps, currencyTick, gridProps, seriesColor } from '@/components/charts/chartKit'
import { FormDialog, RecordSheet } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, SwitchField, TextField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection, useDbSlice, useLookups } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useAction } from '@/hooks/useAction'
import { bankAccountRepository } from '@/services'
import { bankBalance, cashPosition, monthlyCashFlow, signedPayment } from '@/lib/calculations/cash'
import { add, sum } from '@/lib/calculations/money'
import { subDays } from 'date-fns'
import { lastNMonths, toISODate, todayISO } from '@/lib/dates'
import { formatCurrency, formatDate, formatMonth, humanize } from '@/lib/formatting'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter an account name'),
  bankName: z.string().trim().min(2, 'Enter the bank name'),
  last4: z.string().trim().regex(/^\d{4}$/, 'Enter exactly 4 digits (only the last four digits are stored)'),
  currency: z.enum(['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR']),
  openingBalance: z.number({ error: 'Enter an opening balance' }),
  ledgerAccountId: z.string().min(1, 'Choose a ledger account'),
  active: z.boolean(),
})
type Values = z.infer<typeof schema>

function BankAccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: BankAccount }) {
  const accounts = useCollection('accounts')
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open)
      form.reset(
        account
          ? { name: account.name, bankName: account.bankName, last4: account.accountMask.replace(/\D/g, '').slice(-4) || '0000', currency: account.currency, openingBalance: account.openingBalance, ledgerAccountId: account.ledgerAccountId, active: account.active }
          : { name: '', bankName: '', last4: '', currency: 'LKR', openingBalance: 0, ledgerAccountId: 'acc-1000', active: true },
      )
  }, [open, account, form])
  const save = useAction(
    async (v: Values) => {
      const payload = { name: v.name, bankName: v.bankName, accountMask: `•••• ${v.last4}`, currency: v.currency, openingBalance: v.openingBalance, ledgerAccountId: v.ledgerAccountId, active: v.active }
      return account ? bankAccountRepository.update(account.id, payload) : bankAccountRepository.create(payload)
    },
    { success: account ? 'Bank account updated' : 'Bank account added' },
  )
  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={account ? 'Edit bank account' : 'Add bank account'} description="Simulated account — never enter real bank credentials or full account numbers." onSubmit={onSubmit} pending={save.pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Account name" required className="sm:col-span-2" />
        <TextField control={c} name="bankName" label="Bank" required />
        <TextField control={c} name="last4" label="Last 4 digits" required description="Display only, e.g. 1234" />
        <SelectField control={c} name="currency" label="Currency" options={['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR'].map((x) => ({ value: x, label: x }))} />
        <NumberField control={c} name="openingBalance" label="Opening balance" prefix="LKR" />
        <SelectField control={c} name="ledgerAccountId" label="Ledger account" className="sm:col-span-2" options={accounts.filter((a) => a.subtype === 'Cash & bank' && a.active).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))} />
        <SwitchField control={c} name="active" label="Active" className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function BankAccountsPage() {
  const { bankAccounts, payments, currencies } = useDbSlice('bankAccounts', 'payments', 'currencies')
  const lookups = useLookups()
  const canEdit = usePermission('finance.edit')
  const [dialog, setDialog] = useState<{ open: boolean; account?: BankAccount }>({ open: false })
  const [viewing, setViewing] = useState<BankAccount | undefined>()
  const today = todayISO()

  const months = useMemo(() => lastNMonths(12), [])
  const flows = useMemo(() => monthlyCashFlow(payments, months), [payments, months])
  const total = cashPosition({ bankAccounts, payments, currencies }, today)
  const opening = sum(bankAccounts.filter((a) => a.active), (a) => a.openingBalance)
  const balanceSeries = useMemo(() => {
    const startOfWindow = `${months[0]}-01`
    let running = add(opening, sum(payments.filter((p) => p.date < startOfWindow && bankAccounts.some((a) => a.active && a.id === p.bankAccountId)), signedPayment))
    return flows.map((f) => {
      running = add(running, f.net)
      return { month: f.month, balance: running }
    })
  }, [flows, opening, payments, bankAccounts, months])

  const since = daysAgoISO(30)
  const last30 = payments.filter((p) => p.date > since && p.date <= today)

  const movementColumns: DataColumn<Payment>[] = [
    { id: 'date', header: 'Date', accessor: (p) => p.date, cell: (p) => formatDate(p.date) },
    { id: 'ref', header: 'Reference', accessor: (p) => p.reference ?? p.number, cell: (p) => <span className="line-clamp-1">{p.reference ?? p.number}</span> },
    { id: 'cat', header: 'Type', accessor: (p) => humanize(p.category) },
    { id: 'amount', header: 'Amount', accessor: (p) => signedPayment(p), align: 'right', cell: (p) => <Money value={signedPayment(p)} signed /> },
  ]

  return (
    <>
      <PageHeader
        title="Cash & bank"
        description="Simulated bank accounts. Balances = opening balance ± recorded receipts and payments."
        actions={canEdit ? <Button onClick={() => setDialog({ open: true })}><Plus /> Add account</Button> : null}
      />
      <StatGrid className="mb-6">
        <StatCard label="Cash position" value={formatCurrency(total)} hint="All active accounts" />
        <StatCard label="Money in (30 days)" value={formatCurrency(sum(last30.filter((p) => p.direction === 'incoming'), (p) => p.amount))} to="/finance/transactions" />
        <StatCard label="Money out (30 days)" value={formatCurrency(sum(last30.filter((p) => p.direction === 'outgoing'), (p) => p.amount))} to="/finance/transactions" />
        <StatCard label="Accounts" value={bankAccounts.filter((a) => a.active).length} hint={`${bankAccounts.length} in total`} />
      </StatGrid>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bankAccounts.map((a) => {
          const bal = bankBalance(a, payments, today)
          return (
            <Card key={a.id} className="gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"><Landmark className="size-4" /></span>
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-muted-foreground text-xs">{a.bankName} · {a.accountMask}</div>
                  </div>
                </div>
                <StatusBadge status={a.active ? 'active' : 'inactive'} />
              </div>
              <div className="tabular text-2xl font-semibold">{formatCurrency(bal, a.currency)}</div>
              <div className="text-muted-foreground text-xs">Ledger: {lookups.account(a.ledgerAccountId)}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewing(a)}>View movements</Button>
                {canEdit ? <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, account: a })}><Pencil /> Edit</Button> : null}
              </div>
            </Card>
          )
        })}
      </div>

      <ChartCard
        title="Combined cash balance"
        description="Month-end simulated balance across active accounts"
        table={{ rows: balanceSeries, columns: [{ header: 'Month', value: (r) => formatMonth(r.month) }, { header: 'Balance', value: (r) => formatCurrency(r.balance), align: 'right' }] }}
      >
        <ResponsiveContainer>
          <AreaChart data={balanceSeries} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" tickFormatter={(v) => formatMonth(String(v)).slice(0, 3)} {...axisProps} />
            <YAxis tickFormatter={currencyTick} width={56} {...axisProps} />
            <Tooltip content={<ChartTooltip labelFormatter={(l) => formatMonth(String(l))} />} />
            <Area type="monotone" dataKey="balance" name="Balance" stroke={seriesColor(0)} fill={seriesColor(0)} fillOpacity={0.12} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <BankAccountDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} account={dialog.account} />
      <RecordSheet open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)} title={viewing?.name ?? ''} description={viewing ? `${viewing.bankName} · ${viewing.accountMask}` : undefined} wide>
        {viewing ? (
          <>
            <SimulatedNotice>These movements are simulated records in this browser. No bank was contacted.</SimulatedNotice>
            <Section title="Summary">
              <DetailList
                items={[
                  { label: 'Opening balance', value: <Money value={viewing.openingBalance} /> },
                  { label: 'Current balance', value: <Money value={bankBalance(viewing, payments, today)} /> },
                  { label: 'Money in', value: <Money value={sum(payments.filter((p) => p.bankAccountId === viewing.id && p.direction === 'incoming'), (p) => p.amount)} /> },
                  { label: 'Money out', value: <Money value={sum(payments.filter((p) => p.bankAccountId === viewing.id && p.direction === 'outgoing'), (p) => p.amount)} /> },
                ]}
              />
            </Section>
            <DataTable caption="Account movements" data={payments.filter((p) => p.bankAccountId === viewing.id)} columns={movementColumns} getRowId={(p) => p.id} initialSort={{ id: 'date', desc: true }} pageSize={10} exportName={`bank-${viewing.name}`} dense />
          </>
        ) : null}
      </RecordSheet>
    </>
  )
}

function daysAgoISO(days: number): string {
  return toISODate(subDays(new Date(), days))
}
