import type { MasterListKey } from '@/domain'

export const MASTER_LISTS: { key: MasterListKey; label: string; description: string; attribute?: { key: string; label: string; suffix: string } }[] = [
  { key: 'incomeCategories', label: 'Income categories', description: 'Revenue roll-up for products and invoices.' },
  { key: 'expenseCategories', label: 'Expense categories', description: 'Used by expense claims, bills and budgets.' },
  { key: 'departments', label: 'Departments', description: 'Organisational units for costs and budgets.' },
  { key: 'costCentres', label: 'Cost centres', description: 'Management reporting cost centres.' },
  { key: 'projectCategories', label: 'Project categories', description: 'Classify delivery projects.' },
  { key: 'costCodes', label: 'Project cost codes', description: 'Codes for project cost entries.' },
  { key: 'billingModels', label: 'Billing models', description: 'Commercial models for contracts.' },
  { key: 'paymentTerms', label: 'Payment terms', description: 'Standard credit terms.', attribute: { key: 'days', label: 'Days', suffix: 'days' } },
  { key: 'supplierCategories', label: 'Supplier categories', description: 'Classify suppliers and vendors.' },
  { key: 'assetClasses', label: 'Asset classes', description: 'Fixed asset classes and default useful life.', attribute: { key: 'usefulLifeMonths', label: 'Useful life', suffix: 'months' } },
  { key: 'taxCategories', label: 'Tax categories', description: 'Tax treatment categories (illustrative).' },
  { key: 'employeeRoles', label: 'Employee roles', description: 'Roles used for cost profiles and allocations.' },
]
