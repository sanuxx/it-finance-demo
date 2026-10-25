/**
 * Stable identifiers for system master-data records that calculations rely on.
 * Users can rename these records but not delete them (they can be deactivated).
 */
export const EXPENSE_CATEGORY = {
  salaries: 'exp-salaries',
  contractors: 'exp-contractors',
  cloud: 'exp-cloud',
  ai: 'exp-ai',
  software: 'exp-software',
  travel: 'exp-travel',
  meals: 'exp-meals',
  office: 'exp-office',
  equipment: 'exp-equipment',
  marketing: 'exp-marketing',
  training: 'exp-training',
  professional: 'exp-professional',
  telecom: 'exp-telecom',
  depreciation: 'exp-depreciation',
} as const

export const INCOME_CATEGORY = {
  development: 'inc-development',
  saas: 'inc-saas',
  support: 'inc-support',
  consulting: 'inc-consulting',
  licensing: 'inc-licensing',
} as const

export const DEPARTMENT = {
  engineering: 'dept-engineering',
  delivery: 'dept-delivery',
  cloudops: 'dept-cloudops',
  product: 'dept-product',
  sales: 'dept-sales',
  finance: 'dept-finance',
  people: 'dept-people',
} as const

export const SYSTEM_MASTER_IDS = new Set<string>([
  ...Object.values(EXPENSE_CATEGORY),
  ...Object.values(INCOME_CATEGORY),
  ...Object.values(DEPARTMENT),
])
