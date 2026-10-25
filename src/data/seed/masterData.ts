import type { LedgerAccount, MasterListKey, MasterRecord } from '@/domain'
import { DEPARTMENT, EXPENSE_CATEGORY, INCOME_CATEGORY } from './ids'

type Row = [id: string, code: string, name: string, description?: string, attributes?: MasterRecord['attributes']]

const LISTS: Record<MasterListKey, Row[]> = {
  incomeCategories: [
    [INCOME_CATEGORY.development, 'INC-DEV', 'Custom software development', 'Project delivery for client builds'],
    [INCOME_CATEGORY.saas, 'INC-SAAS', 'SaaS subscriptions', 'Recurring product subscription revenue'],
    [INCOME_CATEGORY.support, 'INC-SUP', 'Support & maintenance', 'Retainers and maintenance agreements'],
    [INCOME_CATEGORY.consulting, 'INC-CON', 'Consulting & advisory', 'Architecture and cloud advisory'],
    [INCOME_CATEGORY.licensing, 'INC-LIC', 'Software licensing', 'On-premise licence sales'],
  ],
  expenseCategories: [
    [EXPENSE_CATEGORY.salaries, 'EXP-SAL', 'Salaries & benefits', 'Employee personnel cost (fictional)'],
    [EXPENSE_CATEGORY.contractors, 'EXP-CTR', 'Contractors & subcontractors'],
    [EXPENSE_CATEGORY.cloud, 'EXP-CLD', 'Cloud infrastructure', 'Compute, storage, databases, bandwidth'],
    [EXPENSE_CATEGORY.ai, 'EXP-AI', 'AI & API usage', 'Model inference and third-party APIs'],
    [EXPENSE_CATEGORY.software, 'EXP-SW', 'Software licences & SaaS tools'],
    [EXPENSE_CATEGORY.travel, 'EXP-TRV', 'Travel & accommodation'],
    [EXPENSE_CATEGORY.meals, 'EXP-MEL', 'Meals & client entertainment'],
    [EXPENSE_CATEGORY.office, 'EXP-OFF', 'Office & facilities'],
    [EXPENSE_CATEGORY.equipment, 'EXP-EQP', 'Equipment (below capitalisation threshold)'],
    [EXPENSE_CATEGORY.marketing, 'EXP-MKT', 'Marketing & events'],
    [EXPENSE_CATEGORY.training, 'EXP-TRN', 'Training & certifications'],
    [EXPENSE_CATEGORY.professional, 'EXP-PRO', 'Professional fees', 'Legal, audit and advisory'],
    [EXPENSE_CATEGORY.telecom, 'EXP-TEL', 'Internet & telecommunications'],
    [EXPENSE_CATEGORY.depreciation, 'EXP-DEP', 'Depreciation', 'Calculated from the fixed asset register'],
  ],
  departments: [
    [DEPARTMENT.engineering, 'ENG', 'Engineering'],
    [DEPARTMENT.delivery, 'DEL', 'Project Delivery'],
    [DEPARTMENT.cloudops, 'OPS', 'Cloud & DevOps'],
    [DEPARTMENT.product, 'PRD', 'Product & Design'],
    [DEPARTMENT.sales, 'SAL', 'Sales & Marketing'],
    [DEPARTMENT.finance, 'FIN', 'Finance & Administration'],
    [DEPARTMENT.people, 'PPL', 'People & Culture'],
  ],
  costCentres: [
    ['cc-100', 'CC-100', 'Client delivery'],
    ['cc-200', 'CC-200', 'Product R&D'],
    ['cc-300', 'CC-300', 'Platform operations'],
    ['cc-400', 'CC-400', 'Corporate overhead'],
  ],
  projectCategories: [
    ['pcat-web', 'WEB', 'Web platform'],
    ['pcat-mobile', 'MOB', 'Mobile application'],
    ['pcat-data', 'DAT', 'Data & integration'],
    ['pcat-cloud', 'CLD', 'Cloud migration'],
    ['pcat-support', 'SUP', 'Managed support'],
    ['pcat-internal', 'INT', 'Internal R&D'],
  ],
  costCodes: [
    ['cost-dev', 'CC-DEV', 'Development'],
    ['cost-qa', 'CC-QA', 'Quality assurance'],
    ['cost-pm', 'CC-PM', 'Project management'],
    ['cost-infra', 'CC-INF', 'Infrastructure'],
    ['cost-design', 'CC-DSN', 'Design'],
    ['cost-travel', 'CC-TRV', 'Travel'],
  ],
  billingModels: [
    ['bm-fixed', 'FIXED', 'Fixed price'],
    ['bm-tm', 'T&M', 'Time & materials'],
    ['bm-retainer', 'RET', 'Monthly retainer'],
    ['bm-sub', 'SUB', 'Subscription'],
    ['bm-milestone', 'MILE', 'Milestone billing'],
  ],
  paymentTerms: [
    ['pt-due', 'DUE', 'Due on receipt', undefined, { days: 0 }],
    ['pt-15', 'NET15', 'Net 15', undefined, { days: 15 }],
    ['pt-30', 'NET30', 'Net 30', undefined, { days: 30 }],
    ['pt-45', 'NET45', 'Net 45', undefined, { days: 45 }],
    ['pt-60', 'NET60', 'Net 60', undefined, { days: 60 }],
  ],
  supplierCategories: [
    ['scat-software', 'SW', 'Software vendor'],
    ['scat-subcontract', 'SUB', 'Subcontractor'],
    ['scat-facilities', 'FAC', 'Facilities'],
    ['scat-professional', 'PRO', 'Professional services'],
    ['scat-hardware', 'HW', 'Hardware'],
    ['scat-telecom', 'TEL', 'Telecommunications'],
  ],
  assetClasses: [
    ['ac-computers', 'IT-EQ', 'Computer equipment', undefined, { usefulLifeMonths: 36 }],
    ['ac-servers', 'SRV', 'Servers & networking', undefined, { usefulLifeMonths: 48 }],
    ['ac-furniture', 'FUR', 'Furniture & fittings', undefined, { usefulLifeMonths: 60 }],
    ['ac-leasehold', 'LHI', 'Leasehold improvements', undefined, { usefulLifeMonths: 60 }],
  ],
  taxCategories: [
    ['tc-standard', 'STD', 'Standard rated'],
    ['tc-zero', 'ZERO', 'Zero rated (export of services)'],
    ['tc-exempt', 'EXM', 'Exempt'],
  ],
  employeeRoles: [
    ['role-cto', 'CTO', 'Chief Technology Officer'],
    ['role-em', 'EM', 'Engineering Manager'],
    ['role-sse', 'SSE', 'Senior Software Engineer'],
    ['role-se', 'SE', 'Software Engineer'],
    ['role-qa', 'QA', 'QA Engineer'],
    ['role-devops', 'DVO', 'DevOps Engineer'],
    ['role-ux', 'UX', 'UI/UX Designer'],
    ['role-pm', 'PM', 'Project Manager'],
    ['role-ba', 'BA', 'Business Analyst'],
    ['role-fin', 'FIN', 'Finance Officer'],
    ['role-sales', 'SAL', 'Sales Executive'],
  ],
}

export function buildMasterData(createdAt: string): MasterRecord[] {
  const out: MasterRecord[] = []
  for (const [list, rows] of Object.entries(LISTS) as [MasterListKey, Row[]][]) {
    for (const [id, code, name, description, attributes] of rows) {
      out.push({ id, list, code, name, description, attributes, active: true, createdAt, updatedAt: createdAt })
    }
  }
  return out
}

type AccRow = [id: string, code: string, name: string, type: LedgerAccount['type'], subtype: string]

const ACCOUNTS: AccRow[] = [
  ['acc-1000', '1000', 'Operating bank account', 'asset', 'Cash & bank'],
  ['acc-1010', '1010', 'Payroll bank account', 'asset', 'Cash & bank'],
  ['acc-1020', '1020', 'Savings reserve account', 'asset', 'Cash & bank'],
  ['acc-1100', '1100', 'Accounts receivable', 'asset', 'Receivables'],
  ['acc-1150', '1150', 'Unbilled revenue (WIP)', 'asset', 'Receivables'],
  ['acc-1200', '1200', 'Prepaid expenses', 'asset', 'Current assets'],
  ['acc-1500', '1500', 'Computer equipment', 'asset', 'Fixed assets'],
  ['acc-1510', '1510', 'Servers & networking', 'asset', 'Fixed assets'],
  ['acc-1520', '1520', 'Furniture & fittings', 'asset', 'Fixed assets'],
  ['acc-1590', '1590', 'Accumulated depreciation', 'asset', 'Fixed assets'],
  ['acc-2000', '2000', 'Accounts payable', 'liability', 'Payables'],
  ['acc-2100', '2100', 'VAT payable', 'liability', 'Tax'],
  ['acc-2110', '2110', 'Withholding tax payable', 'liability', 'Tax'],
  ['acc-2200', '2200', 'Accrued expenses', 'liability', 'Current liabilities'],
  ['acc-2300', '2300', 'Deferred revenue', 'liability', 'Current liabilities'],
  ['acc-2400', '2400', 'Employee reimbursements payable', 'liability', 'Current liabilities'],
  ['acc-3000', '3000', 'Share capital', 'equity', 'Equity'],
  ['acc-3100', '3100', 'Retained earnings', 'equity', 'Equity'],
  ['acc-4000', '4000', 'Development revenue', 'income', 'Operating revenue'],
  ['acc-4100', '4100', 'SaaS subscription revenue', 'income', 'Operating revenue'],
  ['acc-4200', '4200', 'Support & maintenance revenue', 'income', 'Operating revenue'],
  ['acc-4300', '4300', 'Consulting revenue', 'income', 'Operating revenue'],
  ['acc-4400', '4400', 'Licence revenue', 'income', 'Operating revenue'],
  ['acc-5000', '5000', 'Salaries & benefits', 'expense', 'Personnel'],
  ['acc-5100', '5100', 'Contractors', 'expense', 'Personnel'],
  ['acc-5200', '5200', 'Cloud infrastructure', 'expense', 'Technology'],
  ['acc-5210', '5210', 'AI & API usage', 'expense', 'Technology'],
  ['acc-5220', '5220', 'Software licences', 'expense', 'Technology'],
  ['acc-5300', '5300', 'Travel & meals', 'expense', 'Operating'],
  ['acc-5400', '5400', 'Office & facilities', 'expense', 'Operating'],
  ['acc-5500', '5500', 'Professional fees', 'expense', 'Operating'],
  ['acc-5600', '5600', 'Marketing', 'expense', 'Operating'],
  ['acc-5700', '5700', 'Training', 'expense', 'Operating'],
  ['acc-5800', '5800', 'Telecommunications', 'expense', 'Operating'],
  ['acc-5900', '5900', 'Depreciation', 'expense', 'Non-cash'],
]

export function buildAccounts(createdAt: string): LedgerAccount[] {
  return ACCOUNTS.map(([id, code, name, type, subtype]) => ({ id, code, name, type, subtype, active: true, createdAt, updatedAt: createdAt }))
}

/** Ledger account each expense category posts to (illustrative mapping). */
export const EXPENSE_ACCOUNT: Record<string, string> = {
  [EXPENSE_CATEGORY.salaries]: 'acc-5000',
  [EXPENSE_CATEGORY.contractors]: 'acc-5100',
  [EXPENSE_CATEGORY.cloud]: 'acc-5200',
  [EXPENSE_CATEGORY.ai]: 'acc-5210',
  [EXPENSE_CATEGORY.software]: 'acc-5220',
  [EXPENSE_CATEGORY.travel]: 'acc-5300',
  [EXPENSE_CATEGORY.meals]: 'acc-5300',
  [EXPENSE_CATEGORY.office]: 'acc-5400',
  [EXPENSE_CATEGORY.equipment]: 'acc-5400',
  [EXPENSE_CATEGORY.marketing]: 'acc-5600',
  [EXPENSE_CATEGORY.training]: 'acc-5700',
  [EXPENSE_CATEGORY.professional]: 'acc-5500',
  [EXPENSE_CATEGORY.telecom]: 'acc-5800',
  [EXPENSE_CATEGORY.depreciation]: 'acc-5900',
}

export const INCOME_ACCOUNT: Record<string, string> = {
  [INCOME_CATEGORY.development]: 'acc-4000',
  [INCOME_CATEGORY.saas]: 'acc-4100',
  [INCOME_CATEGORY.support]: 'acc-4200',
  [INCOME_CATEGORY.consulting]: 'acc-4300',
  [INCOME_CATEGORY.licensing]: 'acc-4400',
}
