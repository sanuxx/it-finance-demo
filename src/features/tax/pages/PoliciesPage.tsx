import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, ScrollText, Trash2 } from 'lucide-react'
import type { FinancialPolicy } from '@/domain'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/layout/PageHeader'
import { Money } from '@/components/data-display/DetailList'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { EmptyState, SimulatedNotice } from '@/components/feedback/Feedback'
import { FormDialog } from '@/components/dialogs/FormDialog'
import { NumberField, SelectField, SwitchField, TextField, TextareaField } from '@/components/forms/fields'
import { useConfirm } from '@/components/dialogs/useConfirm'
import { useCollection } from '@/hooks/useData'
import { usePermission } from '@/hooks/useSession'
import { runWithToast, useAction } from '@/hooks/useAction'
import { policyRepository } from '@/services'
import { humanize } from '@/lib/formatting'

const CATEGORIES = ['expenses', 'procurement', 'billing', 'approvals', 'travel', 'security'] as const

const schema = z.object({
  title: z.string().trim().min(4, 'Enter a title').max(120),
  category: z.enum(CATEGORIES),
  summary: z.string().trim().min(10, 'Summarise the policy (10+ characters)').max(1000),
  limitAmount: z.number().min(0, 'Cannot be negative').optional(),
  active: z.boolean(),
})
type Values = z.infer<typeof schema>

function PolicyDialog({ open, onOpenChange, policy }: { open: boolean; onOpenChange: (o: boolean) => void; policy?: FinancialPolicy }) {
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) form.reset(policy ?? { title: '', category: 'expenses', summary: '', limitAmount: undefined, active: true })
  }, [open, policy, form])
  const save = useAction(async (v: Values) => (policy ? policyRepository.update(policy.id, v) : policyRepository.create(v)), { success: policy ? 'Policy updated' : 'Policy added' })
  const c = form.control
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={policy ? 'Edit policy' : 'New financial policy'} size="lg" pending={save.pending} onSubmit={form.handleSubmit(async (v) => { if (await save.run(v)) onOpenChange(false) })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={c} name="title" label="Title" required autoFocus className="sm:col-span-2" />
        <SelectField control={c} name="category" label="Category" options={CATEGORIES.map((v) => ({ value: v, label: humanize(v) }))} />
        <NumberField control={c} name="limitAmount" label="Limit (optional)" prefix="LKR" min={0} />
        <TextareaField control={c} name="summary" label="Policy summary" required rows={4} className="sm:col-span-2" />
        <SwitchField control={c} name="active" label="Active" className="sm:col-span-2" />
      </div>
    </FormDialog>
  )
}

export default function PoliciesPage() {
  const policies = useCollection('policies')
  const canEdit = usePermission('assets.edit')
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialPolicy | undefined>()

  return (
    <>
      <PageHeader title="Financial policies" description="Spending, approval and billing policies for reference. Use the rules and workflow builders to automate checks." actions={canEdit ? <Button onClick={() => { setEditing(undefined); setOpen(true) }}><Plus /> New policy</Button> : null} />
      <SimulatedNotice className="mb-6">Policies are illustrative text. They are not enforced automatically unless you configure a matching rule in the Configuration centre.</SimulatedNotice>
      {policies.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((p) => (
            <article key={p.id} className="bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{humanize(p.category)}</span>
                    <StatusBadge status={p.active ? 'active' : 'inactive'} />
                  </div>
                  <h2 className="font-semibold">{p.title}</h2>
                </div>
                {canEdit ? <Switch checked={p.active} onCheckedChange={(v) => runWithToast(policyRepository.update(p.id, { active: v }), `Policy ${v ? 'activated' : 'deactivated'}`)} aria-label={`${p.active ? 'Deactivate' : 'Activate'} ${p.title}`} /> : null}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.summary}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
                <span>{p.limitAmount ? <>Limit <Money value={p.limitAmount} className="font-medium" /></> : <span className="text-muted-foreground">No amount limit</span>}</span>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setOpen(true) }}><Pencil /> Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => { const { confirmed } = await confirm({ title: 'Delete this policy?', description: p.title, confirmLabel: 'Delete', destructive: true }); if (confirmed) await runWithToast(policyRepository.remove(p.id), 'Policy deleted') }}><Trash2 /> Delete</Button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ScrollText />} title="No policies" description="Add a financial policy to document spending rules." />
      )}
      <PolicyDialog open={open} onOpenChange={setOpen} policy={editing} />
    </>
  )
}
