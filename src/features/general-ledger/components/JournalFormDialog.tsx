import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import type { JournalEntry } from '@/domain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { TextField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { useCollection } from '@/hooks/useData'
import { useAction } from '@/hooks/useAction'
import { journalRepository } from '@/services'
import { newId, nextNumber, getDb } from '@/services/demo/demoStore'
import { round2 } from '@/lib/calculations/money'
import { todayISO } from '@/lib/dates'
import { formatCurrency } from '@/lib/formatting'
import { cn } from '@/lib/utils'
import { journalTotals } from '../lib/ledger'

const lineSchema = z
  .object({
    accountId: z.string().min(1, 'Choose an account'),
    description: z.string().max(200).optional(),
    debit: z.number({ error: 'Enter a number' }).min(0, 'Cannot be negative'),
    credit: z.number({ error: 'Enter a number' }).min(0, 'Cannot be negative'),
  })
  .refine((l) => (l.debit > 0) !== (l.credit > 0), { message: 'Enter either a debit or a credit', path: ['debit'] })

const journalSchema = z
  .object({
    date: z.string().min(1, 'Choose a date'),
    memo: z.string().trim().min(3, 'Describe the journal'),
    lines: z.array(lineSchema).min(2, 'A journal needs at least two lines'),
  })
  .superRefine((v, ctx) => {
    const t = journalTotals(v.lines.map((l) => ({ debit: l.debit || 0, credit: l.credit || 0 })))
    if (!t.balanced) ctx.addIssue({ code: 'custom', path: ['lines'], message: `Debits and credits must be equal (difference ${formatCurrency(t.difference)}).` })
  })

type Values = z.infer<typeof journalSchema>

const blankLine = () => ({ accountId: '', description: '', debit: 0, credit: 0 })

export function JournalFormDialog({ open, onOpenChange, entry }: { open: boolean; onOpenChange: (o: boolean) => void; entry?: JournalEntry }) {
  const accounts = useCollection('accounts').filter((a) => a.active)
  const periods = useCollection('periods')
  const form = useForm<Values>({ resolver: zodResolver(journalSchema), defaultValues: { date: todayISO(), memo: '', lines: [blankLine(), blankLine()] } })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? []
  const totals = journalTotals(lines.map((l) => ({ debit: Number(l?.debit) || 0, credit: Number(l?.credit) || 0 })))

  useEffect(() => {
    if (!open) return
    form.reset(entry ? { date: entry.date, memo: entry.memo, lines: entry.lines.map((l) => ({ accountId: l.accountId, description: l.description ?? '', debit: l.debit, credit: l.credit })) } : { date: todayISO(), memo: '', lines: [blankLine(), blankLine()] })
  }, [open, entry, form])

  const save = useAction(
    async (v: Values) => {
      const closed = periods.find((p) => p.status === 'closed' && v.date >= p.startDate && v.date <= p.endDate)
      if (closed) throw new Error(`${closed.name} is closed. Choose a date in an open period.`)
      const payload = {
        date: v.date,
        memo: v.memo,
        source: 'manual' as const,
        status: 'draft' as const,
        lines: v.lines.map((l) => ({ id: newId('jl'), accountId: l.accountId, description: l.description || undefined, debit: round2(l.debit || 0), credit: round2(l.credit || 0) })),
      }
      if (entry) return journalRepository.update(entry.id, payload)
      return journalRepository.create({ ...payload, number: nextNumber(getDb().journalEntries.map((j) => j.number), 'JE-', 5) })
    },
    { success: entry ? 'Draft journal updated' : 'Draft journal saved' },
  )

  const onSubmit = form.handleSubmit(async (v) => {
    if (await save.run(v)) onOpenChange(false)
  })

  const linesError = form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={entry ? `Edit ${entry.number}` : 'New journal entry'} description="Saved as a draft. Post it from the journal list." onSubmit={onSubmit} pending={save.pending} size="xl" submitLabel="Save draft">
      <SimulatedNotice>Illustrative double-entry journal stored in this browser — not a real accounting posting.</SimulatedNotice>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField control={form.control} name="date" label="Date" type="date" required />
        <TextField control={form.control} name="memo" label="Memo" required className="sm:col-span-2" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr><th className="pb-1 text-left font-medium">Account</th><th className="pb-1 text-left font-medium">Description</th><th className="w-36 pb-1 text-right font-medium">Debit</th><th className="w-36 pb-1 text-right font-medium">Credit</th><th className="w-10" /></tr>
          </thead>
          <tbody>
            {fields.map((f, i) => {
              const err = form.formState.errors.lines?.[i]
              return (
                <tr key={f.id} className="align-top">
                  <td className="py-1 pr-2">
                    <Select value={lines[i]?.accountId ?? ''} onValueChange={(v) => form.setValue(`lines.${i}.accountId`, v, { shouldValidate: form.formState.isSubmitted })}>
                      <SelectTrigger className="w-full" aria-label={`Line ${i + 1} account`} aria-invalid={!!err?.accountId}><SelectValue placeholder="Account…" /></SelectTrigger>
                      <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {err?.accountId ? <p className="text-destructive mt-1 text-xs">{err.accountId.message}</p> : null}
                  </td>
                  <td className="py-1 pr-2"><Input aria-label={`Line ${i + 1} description`} {...form.register(`lines.${i}.description`)} /></td>
                  <td className="py-1 pr-2">
                    <Input type="number" step="0.01" min={0} className="tabular text-right" aria-label={`Line ${i + 1} debit`} aria-invalid={!!err?.debit} {...form.register(`lines.${i}.debit`, { setValueAs: (v) => (v === '' ? 0 : Number(v)) })} />
                    {err?.debit ? <p className="text-destructive mt-1 text-xs">{err.debit.message}</p> : null}
                  </td>
                  <td className="py-1 pr-2"><Input type="number" step="0.01" min={0} className="tabular text-right" aria-label={`Line ${i + 1} credit`} {...form.register(`lines.${i}.credit`, { setValueAs: (v) => (v === '' ? 0 : Number(v)) })} /></td>
                  <td className="py-1"><Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={fields.length <= 2} aria-label={`Remove line ${i + 1}`}><Trash2 /></Button></td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="pt-2" colSpan={2}><Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}><Plus /> Add line</Button></td>
              <td className="tabular pt-2 text-right">{formatCurrency(totals.debit)}</td>
              <td className="tabular pt-2 text-right">{formatCurrency(totals.credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={cn('text-xs', totals.balanced ? 'text-success' : 'text-muted-foreground')} aria-live="polite">
        {totals.balanced ? 'Balanced — debits equal credits.' : `Out of balance by ${formatCurrency(Math.abs(totals.difference))}.`}
      </p>
      {linesError ? <p role="alert" className="text-destructive text-xs">{linesError}</p> : null}
    </FormDialog>
  )
}
