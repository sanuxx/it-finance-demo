import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { NumberField, SelectField, TextField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { usePreferences, type Preferences } from '@/app/state/preferences'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { useAction } from '@/hooks/useAction'
import { organizationRepository, useDemoStore } from '@/services'
import { STORAGE_NAMESPACE, STORAGE_VERSION, readJSON, writeJSON } from '@/lib/storage/demoStorage'
import { useNow } from '@/hooks/useNow'

/** Illustrative document defaults kept under the demo's storage namespace. */
export const SYSTEM_SETTINGS_KEY = `${STORAGE_NAMESPACE}:${STORAGE_VERSION}:system-settings`

const schema = z.object({
  invoicePrefix: z.string().trim().min(1, 'Required').max(10).regex(/^[A-Z0-9-]+$/, 'Use capital letters, digits and hyphens'),
  quotePrefix: z.string().trim().min(1, 'Required').max(10).regex(/^[A-Z0-9-]+$/, 'Use capital letters, digits and hyphens'),
  poPrefix: z.string().trim().min(1, 'Required').max(10).regex(/^[A-Z0-9-]+$/, 'Use capital letters, digits and hyphens'),
  expensePrefix: z.string().trim().min(1, 'Required').max(10).regex(/^[A-Z0-9-]+$/, 'Use capital letters, digits and hyphens'),
  includeYear: z.boolean(),
  padding: z.number().int().min(3, 'Min 3').max(8, 'Max 8'),
  defaultTermsDays: z.number({ error: 'Enter days' }).int().min(0).max(180),
  defaultTaxRateId: z.string().min(1, 'Choose a tax rate'),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
})
type Values = z.infer<typeof schema>

const DEFAULTS: Omit<Values, 'fiscalYearStartMonth'> = { invoicePrefix: 'INV', quotePrefix: 'QUO', poPrefix: 'PO', expensePrefix: 'EXP', includeYear: true, padding: 4, defaultTermsDays: 30, defaultTaxRateId: 'tax-vat18' }

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: format(new Date(2026, i, 1), 'MMMM') }))

export default function SystemPreferencesPage() {
  const canEdit = usePermission('config.edit')
  const org = useDemoStore((s) => s.db.organization)
  const taxRates = useCollection('taxRates')
  const prefs = usePreferences()
  const stored = useMemo(() => ({ ...DEFAULTS, ...(readJSON<Partial<Values>>(SYSTEM_SETTINGS_KEY) ?? {}) }), [])

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { ...stored, fiscalYearStartMonth: org.fiscalYearStartMonth } })
  useEffect(() => form.setValue('fiscalYearStartMonth', org.fiscalYearStartMonth), [org.fiscalYearStartMonth, form])
  const w = useWatch({ control: form.control })
  const now = useNow()
  const year = now.getFullYear()
  const sample = (prefix?: string) => `${prefix || '—'}-${w.includeYear ? `${year}-` : ''}${'1'.padStart(Number(w.padding) || 4, '0')}`

  const save = useAction(
    async (v: Values) => {
      const { fiscalYearStartMonth, ...rest } = v
      const r = writeJSON(SYSTEM_SETTINGS_KEY, rest)
      if (!r.ok) throw new Error('Could not save settings to browser storage.')
      if (fiscalYearStartMonth !== org.fiscalYearStartMonth) await organizationRepository.update({ fiscalYearStartMonth })
      return true
    },
    { success: 'System preferences saved in this browser' },
  )

  return (
    <>
      <PageHeader
        title="System preferences"
        description="Defaults for document numbering, payment terms, tax and display."
        actions={canEdit ? <Button onClick={form.handleSubmit((v) => save.run(v))} disabled={save.pending}><Save /> Save preferences</Button> : null}
      />
      <SimulatedNotice className="mb-5" tone="demo">
        Numbering, default terms and tax are illustrative settings in this prototype: they are saved in your browser and shown as previews, while built-in sample documents keep their existing numbers. Fiscal year start updates the organisation profile. Display options apply immediately.
      </SimulatedNotice>
      <form onSubmit={form.handleSubmit((v) => save.run(v))} noValidate className="grid gap-5 lg:grid-cols-2">
        <Section title="Document numbering" description="Preview of the next number for each document type.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="invoicePrefix" label="Invoice prefix" disabled={!canEdit} description={`Next: ${sample(w.invoicePrefix)}`} />
            <TextField control={form.control} name="quotePrefix" label="Quotation prefix" disabled={!canEdit} description={`Next: ${sample(w.quotePrefix)}`} />
            <TextField control={form.control} name="poPrefix" label="Purchase order prefix" disabled={!canEdit} description={`Next: ${sample(w.poPrefix)}`} />
            <TextField control={form.control} name="expensePrefix" label="Expense claim prefix" disabled={!canEdit} description={`Next: ${sample(w.expensePrefix)}`} />
            <NumberField control={form.control} name="padding" label="Number padding" suffix="digits" step={1} disabled={!canEdit} />
            <div className="flex items-center gap-2 pt-7">
              <Switch id="sp-year" checked={!!w.includeYear} disabled={!canEdit} onCheckedChange={(c) => form.setValue('includeYear', c, { shouldDirty: true })} />
              <Label htmlFor="sp-year">Include year</Label>
            </div>
          </div>
        </Section>
        <Section title="Commercial defaults">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField control={form.control} name="defaultTermsDays" label="Default payment terms" suffix="days" step={1} min={0} disabled={!canEdit} />
            <SelectField control={form.control} name="defaultTaxRateId" label="Default sales tax" disabled={!canEdit} options={taxRates.filter((t) => t.type === 'sales' && t.active).map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` }))} />
            <div className="space-y-1.5">
              <Label htmlFor="sp-fy">Fiscal year starts</Label>
              <Select value={String(w.fiscalYearStartMonth ?? 1)} disabled={!canEdit} onValueChange={(v) => form.setValue('fiscalYearStartMonth', Number(v), { shouldDirty: true })}>
                <SelectTrigger id="sp-fy" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Base currency</Label>
              <p className="rounded-md border px-3 py-2 text-sm">{org.baseCurrency} <span className="text-muted-foreground text-xs">(fixed in this demo)</span></p>
            </div>
          </div>
        </Section>
        <Section title="Display" description="Personal display options, applied immediately.">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-date">Date format</Label>
              <Select value={prefs.dateFormat} onValueChange={(v) => prefs.set({ dateFormat: v as Preferences['dateFormat'] })}>
                <SelectTrigger id="sp-date" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['dd MMM yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy'] as const).map((f) => <SelectItem key={f} value={f}>{format(now, f)} ({f})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="sp-compact">Compact tables</Label>
                <p className="text-muted-foreground text-xs">Tighter row spacing in data tables.</p>
              </div>
              <Switch id="sp-compact" checked={prefs.compactTables} onCheckedChange={(c) => prefs.set({ compactTables: c })} />
            </div>
          </div>
        </Section>
      </form>
    </>
  )
}
