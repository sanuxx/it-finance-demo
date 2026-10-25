import { useMemo, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Send } from 'lucide-react'
import type { FormDefinition } from '@/domain'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildFormSchema, defaultValuesFor, isFieldVisible, type FormValues } from '../lib/formSchema'
import { DynamicField } from './DynamicField'
import { cn } from '@/lib/utils'

/** Live, working rendering of a form definition with dynamic validation. */
export function FormRenderer({ definition, onSubmit, submitLabel = 'Submit test' }: { definition: FormDefinition; onSubmit: (values: FormValues) => void | Promise<void>; submitLabel?: string }) {
  const schema = useMemo(() => buildFormSchema(definition), [definition])
  const defaults = useMemo(() => defaultValuesFor(definition), [definition])
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: 'onTouched' })
  const values = useWatch({ control: form.control }) as FormValues
  const [tab, setTab] = useState(definition.sections[0]?.id ?? '')

  const renderSection = (sectionId: string) => {
    const fields = definition.fields.filter((f) => f.sectionId === sectionId && isFieldVisible(f, definition, values))
    if (!fields.length) return <p className="text-muted-foreground text-sm">No visible fields in this section.</p>
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id} className={cn(f.width === 'full' && 'sm:col-span-2')}>
            <Controller
              control={form.control}
              name={f.id}
              render={({ field, fieldState }) => <DynamicField spec={f} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />}
            />
          </div>
        ))}
      </div>
    )
  }

  const submit = form.handleSubmit(async (v) => {
    await onSubmit(v)
    form.reset(defaults)
  }, (errors) => {
    // Jump to the tab containing the first error.
    const first = definition.fields.find((f) => errors[f.id])
    if (first && definition.layout === 'tabs') setTab(first.sectionId)
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {definition.layout === 'tabs' ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {definition.sections.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {definition.sections.map((s) => (
            <TabsContent key={s.id} value={s.id} className="pt-3">
              {s.description ? <p className="text-muted-foreground mb-3 text-xs">{s.description}</p> : null}
              {renderSection(s.id)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        definition.sections.map((s) => (
          <fieldset key={s.id} className="space-y-3">
            <legend className="text-sm font-semibold">{s.title}</legend>
            {s.description ? <p className="text-muted-foreground -mt-1 text-xs">{s.description}</p> : null}
            {renderSection(s.id)}
          </fieldset>
        ))
      )}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => form.reset(defaults)}>
          Reset
        </Button>
        <Button type="submit">
          <Send /> {submitLabel}
        </Button>
      </div>
    </form>
  )
}
