import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, Section } from '@/components/layout/PageHeader'
import { SelectField, TextField, TextareaField } from '@/components/forms/fields'
import { SimulatedNotice } from '@/components/feedback/Feedback'
import { usePermission } from '@/hooks/useSession'
import { useAction } from '@/hooks/useAction'
import { organizationRepository, useDemoStore } from '@/services'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a trading name').max(80),
  legalName: z.string().trim().min(2, 'Enter a legal name').max(120),
  registrationNo: z.string().trim().max(40),
  taxId: z.string().trim().max(40),
  address: z.string().trim().min(5, 'Enter an address').max(200),
  phone: z.string().trim().max(30),
  email: z.email('Enter a valid email'),
  website: z.url('Enter a valid URL, e.g. https://example.com').or(z.literal('')),
  timezone: z.string().min(1),
  fiscalYearStartMonth: z.string(),
})
type Values = z.infer<typeof schema>

const TIMEZONES = ['Asia/Colombo', 'Asia/Singapore', 'Asia/Kolkata', 'Australia/Sydney', 'Europe/London', 'UTC']

export default function OrganizationPage() {
  const org = useDemoStore((s) => s.db.organization)
  const canManage = usePermission('admin.manage')
  const toValues = (): Values => ({ ...org, fiscalYearStartMonth: String(org.fiscalYearStartMonth) })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues() })
  useEffect(() => form.reset(toValues()), [org]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useAction((v: Values) => organizationRepository.update({ ...v, fiscalYearStartMonth: Number(v.fiscalYearStartMonth) }), { success: 'Organisation settings saved' })
  const c = form.control
  const disabled = !canManage

  return (
    <>
      <PageHeader title="Organisation" description="Company profile used on documents and reports." actions={canManage ? <Button onClick={form.handleSubmit((v) => save.run(v))} disabled={save.pending}><Save /> Save changes</Button> : null} />
      <SimulatedNotice className="mb-5" tone="warning">This is a fictional demonstration organisation. Do not enter real company, tax or bank details — everything is stored in this browser only.</SimulatedNotice>
      <form onSubmit={form.handleSubmit((v) => save.run(v))} noValidate className="grid gap-5 lg:grid-cols-2">
        <Section title="Company details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={c} name="name" label="Trading name" required disabled={disabled} />
            <TextField control={c} name="legalName" label="Legal name" required disabled={disabled} />
            <TextField control={c} name="registrationNo" label="Registration number" disabled={disabled} />
            <TextField control={c} name="taxId" label="Tax identifier" disabled={disabled} />
            <TextareaField control={c} name="address" label="Address" rows={2} required disabled={disabled} className="sm:col-span-2" />
          </div>
        </Section>
        <Section title="Contact & settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={c} name="email" label="Finance email" type="email" required disabled={disabled} />
            <TextField control={c} name="phone" label="Phone" type="tel" disabled={disabled} />
            <TextField control={c} name="website" label="Website" type="url" disabled={disabled} className="sm:col-span-2" />
            <SelectField control={c} name="timezone" label="Time zone" disabled={disabled} options={TIMEZONES.map((t) => ({ value: t, label: t }))} />
            <SelectField control={c} name="fiscalYearStartMonth" label="Fiscal year starts" disabled={disabled} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: format(new Date(2026, i, 1), 'MMMM') }))} />
            <div className="space-y-1.5 sm:col-span-2">
              <div className="text-sm font-medium">Base currency</div>
              <p className="rounded-md border px-3 py-2 text-sm">{org.baseCurrency} <span className="text-muted-foreground text-xs">— fixed for the demo dataset; other currencies are configured under Multi-currency.</span></p>
            </div>
          </div>
        </Section>
      </form>
    </>
  )
}
