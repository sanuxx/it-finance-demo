import type { FormFieldDefinition } from '@/domain'
import { evaluateFormula, validateFormula } from './formula'
import { buildFormSchema, isFieldVisible, validateFormValues } from './formSchema'
import { simulateWorkflow } from '@/features/workflows/lib/simulate'

describe('formula engine', () => {
  const vars = { revenue: 4_500_000, direct_costs: 3_100_000, hours: 0 }

  it('evaluates arithmetic with precedence and parentheses', () => {
    expect(evaluateFormula('revenue - direct_costs', vars)).toEqual({ ok: true, value: 1_400_000 })
    expect(evaluateFormula('2 + 3 * 4', vars)).toEqual({ ok: true, value: 14 })
    expect(evaluateFormula('(2 + 3) * 4', vars)).toEqual({ ok: true, value: 20 })
    expect(evaluateFormula('-revenue / 1000', vars)).toEqual({ ok: true, value: -4500 })
  })

  it('supports IF, comparisons and functions', () => {
    const r = evaluateFormula('IF(revenue > 0, (revenue - direct_costs) / revenue * 100, 0)', vars)
    expect(r.ok && r.value).toBeCloseTo(31.111111, 5)
    expect(evaluateFormula('ROUND(10 / 3, 2)', vars)).toEqual({ ok: true, value: 3.33 })
    expect(evaluateFormula('MAX(1, 5, 3) + MIN(4, 2) + ABS(-1)', vars)).toEqual({ ok: true, value: 8 })
    expect(evaluateFormula('revenue >= 4500000', vars)).toEqual({ ok: true, value: 1 })
  })

  it('guards division with lazy IF and reports division by zero', () => {
    expect(evaluateFormula('IF(hours > 0, revenue / hours, 0)', vars)).toEqual({ ok: true, value: 0 })
    const r = evaluateFormula('revenue / hours', vars)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Division by zero/)
  })

  it('rejects unknown fields, functions and code-like input', () => {
    expect(validateFormula('profit * 2', ['revenue'])).toMatch(/Unknown field "profit"/)
    expect(validateFormula('EVAL(1)', [])).toMatch(/Unknown function/)
    expect(validateFormula('alert("x")', [])).toMatch(/Unknown function|Unexpected character/)
    expect(validateFormula('constructor.constructor', ['revenue'])).toMatch(/Unknown field|Unexpected|Invalid number/)
    expect(validateFormula('(1 + 2', [])).toMatch(/closing/)
    expect(validateFormula('1 +', [])).toMatch(/ends unexpectedly/)
    expect(validateFormula('IF(1, 2)', [])).toMatch(/IF received 2/)
  })
})

describe('dynamic form validation', () => {
  const fields: FormFieldDefinition[] = [
    { id: 'a', type: 'text', label: 'Title', required: true, sectionId: 's', width: 'full', validation: { minLength: 4 } },
    { id: 'b', type: 'currency', label: 'Amount', required: true, sectionId: 's', width: 'half', validation: { min: 1, max: 1000 } },
    { id: 'c', type: 'checkbox', label: 'Rechargeable', required: false, sectionId: 's', width: 'half' },
    { id: 'd', type: 'text', label: 'PO ref', required: true, sectionId: 's', width: 'full', visibleWhen: { fieldId: 'c', operator: 'is_checked' } },
    { id: 'e', type: 'email', label: 'Email', required: false, sectionId: 's', width: 'half' },
  ]
  const def = { fields }

  it('reports required, range and format errors for visible fields only', () => {
    const errors = validateFormValues(def, { a: 'ab', b: 5000, c: false, d: '', e: 'nope' })
    expect(Object.keys(errors).sort()).toEqual(['a', 'b', 'e'])
    expect(isFieldVisible(fields[3]!, def, { c: false })).toBe(false)
  })

  it('validates conditionally visible fields once shown', () => {
    const errors = validateFormValues(def, { a: 'Laptop', b: 500, c: true, d: '' })
    expect(errors).toEqual({ d: 'PO ref is required' })
    expect(buildFormSchema(def).safeParse({ a: 'Laptop', b: 500, c: true, d: 'PO-1' }).success).toBe(true)
  })
})

describe('workflow simulation', () => {
  const stages = [
    { id: 's1', name: 'Manager', type: 'approval' as const, assigneeRole: 'project_manager' as const, slaHours: 24, requireComment: false },
    { id: 's2', name: 'Finance', type: 'approval' as const, assigneeRole: 'finance_manager' as const, condition: { field: 'amount' as const, operator: 'gte' as const, value: 25_000 }, slaHours: 48, requireComment: false },
    { id: 's3', name: 'Notify', type: 'notification' as const, assigneeRole: 'accountant' as const, slaHours: 0, requireComment: false },
  ]

  it('skips stages whose condition is not met', () => {
    const r = simulateWorkflow({ stages }, { amount: 10_000 })
    expect(r.outcome).toBe('approved')
    expect(r.steps.map((s) => s.outcome)).toEqual(['approved', 'skipped', 'notified'])
    expect(r.steps[1]!.reason).toMatch(/Condition not met/)
  })

  it('stops at the first rejection', () => {
    const r = simulateWorkflow({ stages }, { amount: 50_000 }, { s2: 'rejected' })
    expect(r.outcome).toBe('rejected')
    expect(r.steps.map((s) => s.outcome)).toEqual(['approved', 'rejected', 'skipped'])
  })
})
