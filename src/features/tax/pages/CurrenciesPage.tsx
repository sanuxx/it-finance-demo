import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRightLeft, Pencil, Power } from 'lucide-react'
import type { CurrencySetting } from '@/domain'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { DataTable, type DataColumn } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SwitchField, TextField } from '@/components/forms/fields'
import { useCollection, useDb } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { currencyRepository } from '@/services'
import { divide, multiply } from '@/lib/calculations/money'
import { formatCurrency, formatNumber } from '@/lib/formatting'
import { RowActions } from '@/features/procurement/components/shared'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  symbol: z.string().trim().min(1, 'Enter a symbol').max(4),
  rateToBase: z.number({ error: 'Enter a rate' }).positive('Rate must be greater than zero'),
  active: z.boolean(),
})
type Values = z.infer<typeof schema>

function CurrencyDialog({ open, onOpenChange, currency, base }: { open: boolean; onOpenChange: (o: boolean) => void; currency?: CurrencySetting; base: string }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open && currency) form.reset({ name: currency.name, symbol: currency.symbol, rateToBase: currency.rateToBase, active: currency.active })
  }, [open, currency, form])
  const save = useAction(async (v: Values) => currencyRepository.update(currency!.id, v), { success: 'Currency updated' })
  const c = form.control
  const isBase = currency?.code === base
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Edit ${currency?.code ?? ''}`} description="Exchange rates are illustrative and never fetched from a live source." pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(isBase ? { ...v, rateToBase: 1, active: true } : v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="name" label="Name" required />
        <TextField control={c} name="symbol" label="Symbol" required />
        <NumberField control={c} name="rateToBase" label={`1 ${currency?.code ?? ''} in ${base}`} required min={0} disabled={isBase} description={isBase ? 'The base currency always has a rate of 1.' : undefined} />
        <SwitchField control={c} name="active" label="Available in forms" disabled={isBase} />
      </div>
    </FormDialog>
  )
}

export default function CurrenciesPage() {
  const currencies = useCollection('currencies')
  const db = useDb()
  const base = db.organization.baseCurrency
  const canEdit = usePermission('assets.edit')
  const [editing, setEditing] = useState<CurrencySetting | undefined>()
  const [amount, setAmount] = useState('1000')
  const [from, setFrom] = useState<string>('USD')
  const [to, setTo] = useState<string>(base)

  const active = currencies.filter((c) => c.active)
  const converted = useMemo(() => {
    const f = currencies.find((c) => c.code === from)
    const t = currencies.find((c) => c.code === to)
    const value = Number(amount)
    if (!f || !t || !Number.isFinite(value)) return null
    return divide(multiply(value, f.rateToBase), t.rateToBase, 4)
  }, [currencies, from, to, amount])

  const columns: DataColumn<CurrencySetting>[] = [
    { id: 'code', header: 'Code', accessor: (r) => r.code, cell: (r) => <span className="font-medium">{r.code}{r.code === base ? <span className="text-muted-foreground ml-2 text-xs">Base</span> : null}</span> },
    { id: 'name', header: 'Name', accessor: (r) => r.name },
    { id: 'symbol', header: 'Symbol', accessor: (r) => r.symbol },
    { id: 'rate', header: `Rate (1 unit in ${base})`, accessor: (r) => r.rateToBase, align: 'right', cell: (r) => formatNumber(r.rateToBase) },
    { id: 'inverse', header: `1 ${base} =`, accessor: (r) => divide(1, r.rateToBase, 6), align: 'right', cell: (r) => `${formatNumber(divide(1, r.rateToBase, 6))} ${r.code}`, defaultHidden: true },
    { id: 'status', header: 'Status', accessor: (r) => (r.active ? 'active' : 'inactive'), cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} /> },
    {
      id: 'actions', header: '', accessor: () => '', sortable: false, searchable: false, noExport: true, alwaysVisible: true, align: 'right',
      cell: (r) =>
        canEdit ? (
          <RowActions
            label={r.code}
            actions={[
              { label: 'Edit rate', icon: <Pencil />, onSelect: () => setEditing(r) },
              { label: r.active ? 'Deactivate' : 'Activate', icon: <Power />, disabled: r.code === base, onSelect: () => runWithToast(currencyRepository.update(r.id, { active: !r.active }), `${r.code} ${r.active ? 'deactivated' : 'activated'}`) },
            ]}
          />
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader title="Multi-currency" description={`Currencies available in the demo and illustrative exchange rates to the base currency (${base}). Transactions in this demo are recorded in ${base}.`} />
      <SimulatedNotice className="mb-6">Exchange rates are fixed sample values for demonstration. No live market data is used and no revaluation is performed.</SimulatedNotice>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DataTable caption="Currencies" data={currencies} columns={columns} getRowId={(r) => r.id} exportName="currencies" pageSize={10} />
        </div>
        <Section title="Converter" description="Uses the illustrative rates on this page">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fx-amount">Amount</Label>
              <Input id="fx-amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="fx-from">From</Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger id="fx-from" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{active.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <button type="button" className="hover:bg-accent mb-1 rounded-md p-2" aria-label="Swap currencies" onClick={() => { setFrom(to); setTo(from) }}>
                <ArrowRightLeft className="size-4" />
              </button>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="fx-to">To</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger id="fx-to" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{active.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="bg-muted/50 rounded-md p-3" aria-live="polite">
              <div className="text-muted-foreground text-xs">Result</div>
              <div className="tabular text-xl font-semibold">{converted === null ? '—' : formatCurrency(converted, to)}</div>
            </div>
          </div>
        </Section>
      </div>
      <CurrencyDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} currency={editing} base={base} />
    </>
  )
}
