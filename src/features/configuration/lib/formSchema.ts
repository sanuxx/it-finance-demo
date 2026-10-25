import { z } from 'zod'
import type { FormDefinition, FormFieldDefinition, VisibilityCondition } from '@/domain'

export type FormValues = Record<string, unknown>

export function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) || v === false
}

export function conditionMet(cond: VisibilityCondition, values: FormValues): boolean {
  const v = values[cond.fieldId]
  switch (cond.operator) {
    case 'is_checked':
      return v === true
    case 'is_not_empty':
      return !isEmptyValue(v)
    case 'equals':
      return Array.isArray(v) ? v.includes(cond.value) : String(v ?? '') === String(cond.value ?? '')
    case 'not_equals':
      return Array.isArray(v) ? !v.includes(cond.value) : String(v ?? '') !== String(cond.value ?? '')
    case 'greater_than':
      return Number(v) > Number(cond.value)
    case 'less_than':
      return Number(v) < Number(cond.value)
  }
}

/** A field is visible when it has no condition or its condition (and its controlling field's visibility) holds. */
export function isFieldVisible(field: FormFieldDefinition, def: Pick<FormDefinition, 'fields'>, values: FormValues, depth = 0): boolean {
  if (!field.visibleWhen) return true
  if (depth > 10) return false
  const controller = def.fields.find((f) => f.id === field.visibleWhen!.fieldId)
  if (controller && !isFieldVisible(controller, def, values, depth + 1)) return false
  return conditionMet(field.visibleWhen, values)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NUMERIC_TYPES = new Set(['number', 'currency', 'percentage'])

/** Returns an error message for one field value, or null when valid. */
export function validateField(field: FormFieldDefinition, value: unknown): string | null {
  const v = field.validation ?? {}
  if (field.type === 'checkbox') {
    return field.required && value !== true ? 'This box must be ticked' : null
  }
  if (isEmptyValue(value)) return field.required ? `${field.label} is required` : null
  if (NUMERIC_TYPES.has(field.type)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return 'Enter a number'
    if (v.min !== undefined && n < v.min) return `Must be at least ${v.min.toLocaleString('en-LK')}`
    if (v.max !== undefined && n > v.max) return `Must be at most ${v.max.toLocaleString('en-LK')}`
    if (field.type === 'percentage' && (n < 0 || n > 100) && v.min === undefined && v.max === undefined) return 'Enter a percentage between 0 and 100'
    return null
  }
  if (field.type === 'multiselect') {
    if (!Array.isArray(value)) return 'Choose one or more options'
    const bad = value.find((x) => !(field.options ?? []).includes(String(x)))
    return bad !== undefined ? 'Choose from the listed options' : null
  }
  const s = String(value)
  if (field.type === 'select' && !(field.options ?? []).includes(s)) return 'Choose one of the listed options'
  if (field.type === 'email' && !EMAIL.test(s)) return 'Enter a valid email address'
  if (field.type === 'url') {
    try {
      const u = new URL(s)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Enter an http(s) address'
    } catch {
      return 'Enter a valid URL, e.g. https://example.com'
    }
  }
  if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'Enter a valid date'
  if (v.minLength !== undefined && s.length < v.minLength) return `Enter at least ${v.minLength} characters`
  if (v.maxLength !== undefined && s.length > v.maxLength) return `Enter at most ${v.maxLength} characters`
  if (v.pattern) {
    let re: RegExp | null = null
    try {
      re = new RegExp(`^(?:${v.pattern})$`)
    } catch {
      re = null
    }
    if (re && !re.test(s)) return v.patternMessage || 'Value does not match the required format'
  }
  return null
}

/** Validate every visible field. Hidden fields are ignored. */
export function validateFormValues(def: Pick<FormDefinition, 'fields'>, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of def.fields) {
    if (!isFieldVisible(f, def, values)) continue
    const err = validateField(f, values[f.id])
    if (err) errors[f.id] = err
  }
  return errors
}

/** Zod schema built from a form definition (for react-hook-form's zodResolver). */
export function buildFormSchema(def: Pick<FormDefinition, 'fields'>) {
  return z.record(z.string(), z.unknown()).superRefine((values, ctx) => {
    for (const [fieldId, message] of Object.entries(validateFormValues(def, values))) {
      ctx.addIssue({ code: 'custom', path: [fieldId], message })
    }
  })
}

export function defaultValuesFor(def: Pick<FormDefinition, 'fields'>): FormValues {
  const out: FormValues = {}
  for (const f of def.fields) {
    if (f.type === 'checkbox') out[f.id] = f.defaultValue === 'true'
    else if (f.type === 'multiselect') out[f.id] = f.defaultValue ? f.defaultValue.split(',').map((s) => s.trim()).filter(Boolean) : []
    else if (NUMERIC_TYPES.has(f.type)) out[f.id] = f.defaultValue !== undefined && f.defaultValue !== '' ? Number(f.defaultValue) : undefined
    else out[f.id] = f.defaultValue ?? ''
  }
  return out
}

/** Strip values of hidden fields before saving a submission. */
export function visibleValues(def: Pick<FormDefinition, 'fields'>, values: FormValues): FormValues {
  const out: FormValues = {}
  for (const f of def.fields) if (isFieldVisible(f, def, values)) out[f.label] = values[f.id]
  return out
}
