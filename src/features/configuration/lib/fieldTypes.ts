import type { FieldType } from '@/domain'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text',
  textarea: 'Multiline text',
  number: 'Number',
  currency: 'Currency',
  percentage: 'Percentage',
  date: 'Date',
  select: 'Dropdown',
  multiselect: 'Multi-select',
  checkbox: 'Checkbox',
  email: 'Email',
  url: 'URL',
  file: 'File attachment',
}
