import { useId, type ReactNode } from 'react'
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/** Label + control + description + error message, wired for accessibility. */
export function Field({
  id,
  label,
  description,
  error,
  required,
  children,
  className,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-sm">
        {label}
        {required ? <span className="text-destructive" aria-hidden>*</span> : null}
      </Label>
      {children}
      {description && !error ? <p id={`${id}-desc`} className="text-muted-foreground text-xs">{description}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface BaseProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  description?: ReactNode
  required?: boolean
  className?: string
  disabled?: boolean
}

export function TextField<T extends FieldValues>({ control, name, label, description, required, className, disabled, type = 'text', placeholder, autoFocus }: BaseProps<T> & { type?: 'text' | 'email' | 'url' | 'date' | 'month' | 'tel'; placeholder?: string; autoFocus?: boolean }) {
  const id = useId()
  const { field, fieldState } = useController({ control, name })
  return (
    <Field id={id} label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={!!fieldState.error}
        aria-describedby={fieldState.error ? `${id}-error` : description ? `${id}-desc` : undefined}
        {...field}
        value={(field.value as string | undefined) ?? ''}
      />
    </Field>
  )
}

/** Numeric input that stores a number (or undefined when empty). */
export function NumberField<T extends FieldValues>({ control, name, label, description, required, className, disabled, step = 'any', min, prefix, suffix, placeholder }: BaseProps<T> & { step?: number | 'any'; min?: number; prefix?: string; suffix?: string; placeholder?: string }) {
  const id = useId()
  const { field, fieldState } = useController({ control, name })
  return (
    <Field id={id} label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
      <div className="relative">
        {prefix ? <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs">{prefix}</span> : null}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('tabular', prefix && 'pl-11', suffix && 'pr-9')}
          aria-invalid={!!fieldState.error}
          aria-describedby={fieldState.error ? `${id}-error` : undefined}
          name={field.name}
          ref={field.ref}
          onBlur={field.onBlur}
          value={field.value === undefined || field.value === null || Number.isNaN(field.value) ? '' : String(field.value)}
          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
        {suffix ? <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">{suffix}</span> : null}
      </div>
    </Field>
  )
}

export function TextareaField<T extends FieldValues>({ control, name, label, description, required, className, disabled, rows = 3, placeholder }: BaseProps<T> & { rows?: number; placeholder?: string }) {
  const id = useId()
  const { field, fieldState } = useController({ control, name })
  return (
    <Field id={id} label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
      <Textarea id={id} rows={rows} placeholder={placeholder} disabled={disabled} aria-invalid={!!fieldState.error} {...field} value={(field.value as string | undefined) ?? ''} />
    </Field>
  )
}

export interface Option {
  value: string
  label: string
}

export function SelectField<T extends FieldValues>({ control, name, label, description, required, className, disabled, options, placeholder = 'Select…', allowNone, noneLabel = 'None' }: BaseProps<T> & { options: Option[]; placeholder?: string; allowNone?: boolean; noneLabel?: string }) {
  const id = useId()
  const { field, fieldState } = useController({ control, name })
  const NONE = '__none__'
  return (
    <Field id={id} label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
      <Select
        value={(field.value as string | undefined) || (allowNone ? NONE : '')}
        onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={!!fieldState.error} onBlur={field.onBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function CheckboxField<T extends FieldValues>({ control, name, label, description, className, disabled }: Omit<BaseProps<T>, 'required'>) {
  const id = useId()
  const { field } = useController({ control, name })
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <Checkbox id={id} checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} disabled={disabled} className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
    </div>
  )
}

export function SwitchField<T extends FieldValues>({ control, name, label, description, className, disabled }: Omit<BaseProps<T>, 'required'>) {
  const id = useId()
  const { field } = useController({ control, name })
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} />
    </div>
  )
}
