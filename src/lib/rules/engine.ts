import type { BusinessRule, RuleCondition, RuleField, RuleOperator } from '@/domain'

/**
 * Constrained business-rule evaluator. Rules are plain data (field / operator /
 * value) — nothing is ever executed as code.
 */
export type RuleContext = Partial<Record<RuleField, string | number | boolean | undefined | null>>

export interface ConditionResult {
  condition: RuleCondition
  passed: boolean
  actual: RuleContext[RuleField]
}

export interface RuleEvaluation {
  rule: BusinessRule
  triggered: boolean
  conditions: ConditionResult[]
}

export const RULE_FIELD_LABELS: Record<RuleField, string> = {
  amount: 'Amount (LKR)',
  categoryId: 'Category',
  projectId: 'Project',
  departmentId: 'Department',
  budgetConsumptionPercent: 'Budget consumption %',
  daysUntilDue: 'Days until due',
  status: 'Status',
  billable: 'Billable',
}

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  gte: 'is at least',
  gt: 'is greater than',
  lte: 'is at most',
  lt: 'is less than',
  eq: 'equals',
  neq: 'does not equal',
  in: 'is one of',
}

export const NUMERIC_RULE_FIELDS: RuleField[] = ['amount', 'budgetConsumptionPercent', 'daysUntilDue']

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

export function evaluateCondition(condition: RuleCondition, context: RuleContext): ConditionResult {
  const actual = context[condition.field]
  const expected = condition.value
  let passed = false
  switch (condition.operator) {
    case 'gte':
    case 'gt':
    case 'lte':
    case 'lt': {
      const a = toNumber(actual)
      const b = toNumber(expected)
      if (a !== null && b !== null) {
        passed = condition.operator === 'gte' ? a >= b : condition.operator === 'gt' ? a > b : condition.operator === 'lte' ? a <= b : a < b
      }
      break
    }
    case 'eq':
      passed = String(actual ?? '') === String(expected ?? '')
      break
    case 'neq':
      passed = String(actual ?? '') !== String(expected ?? '')
      break
    case 'in':
      passed = Array.isArray(expected) ? expected.map(String).includes(String(actual ?? '')) : String(expected).split(',').map((s) => s.trim()).includes(String(actual ?? ''))
      break
  }
  return { condition, passed, actual }
}

export function evaluateRule(rule: BusinessRule, context: RuleContext): RuleEvaluation {
  const conditions = rule.conditions.map((c) => evaluateCondition(c, context))
  const triggered = conditions.length > 0 && (rule.match === 'all' ? conditions.every((c) => c.passed) : conditions.some((c) => c.passed))
  return { rule, triggered, conditions }
}

/** Evaluate all enabled rules for an entity, highest priority (lowest number) first. */
export function evaluateRules(rules: BusinessRule[], entity: BusinessRule['entity'], context: RuleContext): RuleEvaluation[] {
  return rules
    .filter((r) => r.enabled && r.entity === entity)
    .sort((a, b) => a.priority - b.priority)
    .map((r) => evaluateRule(r, context))
}
