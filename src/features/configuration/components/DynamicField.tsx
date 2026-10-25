import { useId } from 'react'
import { Paperclip } from 'lucide-react'
import type { FieldType } from '@/domain'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface DynamicFieldSpec {
  type: FieldType
  label: string
  description?: string
  placeholder?: string
  required?: boolean
  options?: string[]
}

/** Renders one configurable field as a working control. Files store only the name. */
export function DynamicField({ spec, value, onChange, error, disabled }: { spec: DynamicFieldSpec; value: unknown; onChange: (v: unknown) => void; error?: string; disabled?: boolean }) {
  const id = useId()
  const describedBy = error ? `${id}-err` : spec.description ? `${id}-desc` : undefined
  const common = { id, disabled, 'aria-invalid': !!error, 'aria-describedby': describedBy }
  let control: React.ReactNode
  switch (spec.type) {
    case 'textarea':
      control = <Textarea {...common} rows={3} placeholder={spec.placeholder} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      break
    case 'number':
    case 'currency':
    case 'percentage':
      control = (
        <div className="relative">
          {spec.type === 'currency' ? <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs">LKR</span> : null}
          <Input
            {...common}
            type="number"
            inputMode="decimal"
            className={cn('tabular', spec.type === 'currency' && 'pl-11', spec.type === 'percentage' && 'pr-8')}
            placeholder={spec.placeholder}
            value={value === undefined || value === null || Number.isNaN(value) ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {spec.type === 'percentage' ? <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">%</span> : null}
        </div>
      )
      break
    case 'date':
      control = <Input {...common} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      break
    case 'select':
      control = (
        <Select value={(value as string) || ''} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} className="w-full" aria-invalid={!!error}>
            <SelectValue placeholder={spec.placeholder || 'Select…'} />
          </SelectTrigger>
          <SelectContent>
            {(spec.options ?? []).filter(Boolean).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
      break
    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as string[]) : []
      control = (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border px-3 py-2">
          {(spec.options ?? []).filter(Boolean).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox checked={arr.includes(o)} disabled={disabled} onCheckedChange={(v) => onChange(v ? [...arr, o] : arr.filter((x) => x !== o))} />
              {o}
            </label>
          ))}
          {!(spec.options ?? []).length ? <span className="text-muted-foreground text-xs">No options configured</span> : null}
        </div>
      )
      break
    }
    case 'checkbox':
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox id={id} checked={value === true} disabled={disabled} onCheckedChange={(v) => onChange(!!v)} aria-invalid={!!error} />
            <Label htmlFor={id} className="text-sm font-normal">
              {spec.label}
              {spec.required ? <span className="text-destructive">*</span> : null}
            </Label>
          </div>
          {spec.description && !error ? <p id={`${id}-desc`} className="text-muted-foreground text-xs">{spec.description}</p> : null}
          {error ? <p id={`${id}-err`} role="alert" className="text-destructive text-xs">{error}</p> : null}
        </div>
      )
    case 'file':
      control = (
        <div className="flex items-center gap-2">
          <label className={cn('hover:bg-accent inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', disabled && 'pointer-events-none opacity-50')}>
            <Paperclip className="size-4" />
            Choose file
            <input
              id={id}
              type="file"
              className="sr-only"
              disabled={disabled}
              onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
            />
          </label>
          <span className="text-muted-foreground truncate text-xs">{(value as string) || 'No file chosen — only the file name is kept in this demo'}</span>
        </div>
      )
      break
    default:
      control = <Input {...common} type={spec.type === 'email' ? 'email' : spec.type === 'url' ? 'url' : 'text'} placeholder={spec.placeholder} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
  }
  return (
    <div className="space-y-1.5">
      <Label id={`${id}-label`} htmlFor={id} className="text-sm">
        {spec.label || 'Untitled field'}
        {spec.required ? <span className="text-destructive" aria-hidden>*</span> : null}
      </Label>
      {control}
      {spec.description && !error ? <p id={`${id}-desc`} className="text-muted-foreground text-xs">{spec.description}</p> : null}
      {error ? <p id={`${id}-err`} role="alert" className="text-destructive text-xs">{error}</p> : null}
    </div>
  )
}
