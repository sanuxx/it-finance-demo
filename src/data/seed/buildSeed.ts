import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type {
  AiUsageEntry,
  BankAccount,
  BankStatementLine,
  CloudCostEntry,
  Contract,
  CreditNote,
  Customer,
  CustomerSubscription,
  DemoDatabase,
  EmployeeProfile,
  ExpenseClaim,
  ExpenseStatus,
  FixedAsset,
  Invoice,
  InvoiceStatus,
  JournalEntry,
  LineItem,
  Milestone,
  Payment,
  Project,
  ProjectAllocation,
  ProjectCostEntry,
  PurchaseOrder,
  PurchaseRequest,
  Quotation,
  RecurringSchedule,
  SoftwareLicence,
  SoftwareProduct,
  Supplier,
  SupplierBill,
  TimesheetEntry,
} from '@/domain'
import { add, applyRate, divide, multiply, round2, subtract, sum } from '@/lib/calculations/money'
import { documentTotals } from '@/lib/calculations/invoices'
import { createRandom } from './random'
import { DEPARTMENT, EXPENSE_CATEGORY, INCOME_CATEGORY } from './ids'
import { EXPENSE_ACCOUNT, INCOME_ACCOUNT, buildAccounts, buildMasterData } from './masterData'
import { buildConfiguration } from './configuration'

export const SCHEMA_VERSION = 1
const VAT = 18

/**
 * Build the complete fictional demonstration dataset.
 *
 * All dates are generated relative to `anchor` (normally "today" when the demo
 * is first opened) so dashboards, ageing and due dates always look current.
 * The same anchor always yields the same dataset.
 */
export function buildSeed(anchor: Date = new Date()): DemoDatabase {
  const rnd = createRandom(20260424)
  const A = startOfDay(anchor)
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')
  const day = (offset: number) => iso(addDays(A, offset))
  const monthStart = (offset: number) => iso(addMonths(startOfMonth(A), offset))
  const ts = (date: string, hour = 9) => `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`
  const today = iso(A)
  const seededAt = new Date().toISOString()
  const created = ts(monthStart(-14))

  /* ------------------------------------------------------------ organisation */
  const organization: DemoDatabase['organization'] = {
    id: 'org-1',
    name: 'Kelani Byte Labs',
    legalName: 'Kelani Byte Labs (Pvt) Ltd — fictional',
    registrationNo: 'PV-000000 (demo)',
    taxId: 'VAT-000000000-7000 (demo)',
    baseCurrency: 'LKR',
    fiscalYearStartMonth: 1,
    address: '42 Demo Lane, Colombo 03, Sri Lanka (fictional)',
    phone: '+94 11 000 0000',
    email: 'finance@kelanibyte.example',
    website: 'https://kelanibyte.example',
    timezone: 'Asia/Colombo',
  }

  const users: DemoDatabase['users'] = [
    { id: 'u-director', name: 'Dilini Jayasekara', email: 'dilini@kelanibyte.example', role: 'director', title: 'Managing Director', department: DEPARTMENT.finance, initials: 'DJ' },
    { id: 'u-fm', name: 'Ruwan Fernando', email: 'ruwan@kelanibyte.example', role: 'finance_manager', title: 'Finance Manager', department: DEPARTMENT.finance, initials: 'RF' },
    { id: 'u-acct', name: 'Tharushi Silva', email: 'tharushi@kelanibyte.example', role: 'accountant', title: 'Senior Accountant', department: DEPARTMENT.finance, initials: 'TS' },
    { id: 'u-pm', name: 'Kasun Wickramasinghe', email: 'kasun@kelanibyte.example', role: 'project_manager', title: 'Delivery Manager', department: DEPARTMENT.delivery, initials: 'KW' },
    { id: 'u-emp', name: 'Ishara Gunawardena', email: 'ishara@kelanibyte.example', role: 'employee', title: 'Software Engineer', department: DEPARTMENT.engineering, initials: 'IG' },
  ]

  const masterData = buildMasterData(created)
  const accounts = buildAccounts(created)

  /* --------------------------------------------------------------- customers */
  const customerRows: [string, string, string, string, string, Customer['status'], number, 'good' | 'slow' | 'poor'][] = [
    ['cus-orchid', 'Orchid Retail Group', 'Retail', 'Amaya Ranatunga', 'Sri Lanka', 'active', 30, 'good'],
    ['cus-harbour', 'Harbourline Logistics', 'Logistics', 'Nimal de Mel', 'Sri Lanka', 'active', 30, 'slow'],
    ['cus-serendib', 'Serendib Health Network', 'Healthcare', 'Dr. Shanika Peiris', 'Sri Lanka', 'active', 45, 'good'],
    ['cus-bluepeak', 'Bluepeak Insurance', 'Insurance', 'Malith Karunaratne', 'Sri Lanka', 'active', 30, 'poor'],
    ['cus-lotus', 'Lotus Microfinance', 'Financial services', 'Sanduni Herath', 'Sri Lanka', 'active', 30, 'good'],
    ['cus-coral', 'Coral Bay Hotels', 'Hospitality', 'Chamara Wijeratne', 'Sri Lanka', 'active', 30, 'slow'],
    ['cus-meridian', 'Meridian Learning', 'Education', 'Hasini Abeywardena', 'Singapore', 'active', 15, 'good'],
    ['cus-greenfield', 'Greenfield Agritech', 'Agriculture', 'Pradeep Senanayake', 'Australia', 'active', 30, 'good'],
    ['cus-tidewater', 'Tidewater Energy', 'Energy', 'Roshan Dissanayake', 'Sri Lanka', 'active', 30, 'poor'],
    ['cus-nova', 'Nova Freight Partners', 'Logistics', 'Kavindi Mendis', 'Sri Lanka', 'active', 15, 'good'],
    ['cus-silverleaf', 'Silverleaf Pharmaceuticals', 'Pharmaceuticals', 'Asela Bandara', 'Sri Lanka', 'active', 30, 'good'],
    ['cus-kandy', 'Hill Country Crafts', 'Manufacturing', 'Nadeeka Rathnayake', 'Sri Lanka', 'active', 15, 'slow'],
    ['cus-azure', 'Azure Coast Realty', 'Real estate', 'Thilina Gamage', 'Sri Lanka', 'prospect', 30, 'good'],
  ]
  const payerBehaviour = new Map(customerRows.map((r) => [r[0], r[7]]))
  const customers: Customer[] = customerRows.map(([id, name, industry, contact, country, status, terms], i) => ({
    id,
    code: `C-${String(1001 + i)}`,
    name,
    industry,
    contactName: contact,
    email: `accounts@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
    phone: `+94 11 555 ${String(1000 + i * 37).slice(0, 4)}`,
    country,
    currency: 'LKR',
    paymentTermsDays: terms,
    creditLimit: [5_000_000, 10_000_000, 15_000_000][i % 3] ?? 5_000_000,
    status,
    createdAt: created,
    updatedAt: created,
  }))

  /* --------------------------------------------------------------- suppliers */
  const supplierRows: [string, string, string, boolean, number][] = [
    ['sup-workspace', 'Workspace Partners Colombo', 'scat-facilities', false, 15],
    ['sup-fibre', 'Lanka Fibre Connect', 'scat-telecom', false, 15],
    ['sup-pixel', 'Pixelcraft Design Studio', 'scat-subcontract', false, 30],
    ['sup-talent', 'TalentBridge Contractors', 'scat-subcontract', false, 30],
    ['sup-secure', 'SecureNet Assurance', 'scat-professional', false, 30],
    ['sup-legal', 'Summit Legal Associates', 'scat-professional', false, 30],
    ['sup-devtools', 'DevTools Collective', 'scat-software', true, 30],
    ['sup-byteware', 'Byteware Licensing', 'scat-software', true, 30],
    ['sup-metro', 'Metro Hardware Traders', 'scat-hardware', false, 30],
    ['sup-cloudcard', 'Cloud & API providers (card)', 'scat-software', true, 0],
    ['sup-events', 'Spotlight Events & Media', 'scat-professional', false, 30],
  ]
  const suppliers: Supplier[] = supplierRows.map(([id, name, categoryId, isVendor, terms], i) => ({
    id,
    code: `S-${String(2001 + i)}`,
    name,
    categoryId,
    contactName: ['Ayesha Fonseka', 'Dinesh Kumara', 'Rehana Cassim', 'Lahiru Jayawardena', 'Priyanka Samarakoon'][i % 5] ?? 'Accounts team',
    email: `billing@${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
    phone: `+94 11 777 ${String(2000 + i * 53).slice(0, 4)}`,
    country: 'Sri Lanka',
    currency: 'LKR',
    paymentTermsDays: terms,
    status: 'active',
    isSoftwareVendor: isVendor,
    createdAt: created,
    updatedAt: created,
  }))

  /* --------------------------------------------------------------- employees */
  // [id, name, roleId, dept, type, monthlyCost, billRate, startOffsetMonths]
  const empRows: [string, string, string, string, 'employee' | 'contractor', number, number, number][] = [
    ['emp-01', 'Sahan Liyanage', 'role-cto', DEPARTMENT.engineering, 'employee', 1_450_000, 16_000, -48],
    ['emp-02', 'Nethmi Wijesinghe', 'role-em', DEPARTMENT.engineering, 'employee', 980_000, 12_500, -40],
    ['emp-03', 'Kavinda Perera', 'role-sse', DEPARTMENT.engineering, 'employee', 760_000, 10_500, -36],
    ['emp-04', 'Hiruni Rajapaksha', 'role-sse', DEPARTMENT.engineering, 'employee', 720_000, 10_500, -30],
    ['emp-05', 'Ishara Gunawardena', 'role-se', DEPARTMENT.engineering, 'employee', 430_000, 7_500, -20],
    ['emp-06', 'Chathura Weerasinghe', 'role-se', DEPARTMENT.engineering, 'employee', 410_000, 7_500, -18],
    ['emp-07', 'Pavithra Kodikara', 'role-se', DEPARTMENT.engineering, 'employee', 395_000, 7_500, -10],
    ['emp-08', 'Yasiru Amarasinghe', 'role-qa', DEPARTMENT.engineering, 'employee', 380_000, 6_500, -26],
    ['emp-09', 'Dulani Ekanayake', 'role-qa', DEPARTMENT.engineering, 'employee', 350_000, 6_500, -9],
    ['emp-10', 'Supun Hettiarachchi', 'role-devops', DEPARTMENT.cloudops, 'employee', 690_000, 10_000, -34],
    ['emp-11', 'Minoli Senaratne', 'role-ux', DEPARTMENT.product, 'employee', 520_000, 8_500, -28],
    ['emp-12', 'Kasun Wickramasinghe', 'role-pm', DEPARTMENT.delivery, 'employee', 820_000, 11_000, -44],
    ['emp-13', 'Rashmi Alwis', 'role-pm', DEPARTMENT.delivery, 'employee', 640_000, 9_500, -22],
    ['emp-14', 'Gayan Pathirana', 'role-ba', DEPARTMENT.delivery, 'employee', 540_000, 8_500, -24],
    ['emp-15', 'Tharushi Silva', 'role-fin', DEPARTMENT.finance, 'employee', 480_000, 0, -38],
    ['emp-16', 'Lakmal Ranasinghe', 'role-sales', DEPARTMENT.sales, 'employee', 450_000, 0, -32],
    ['emp-17', 'Dinuka Jayalath', 'role-sse', DEPARTMENT.engineering, 'contractor', 680_000, 11_000, -7],
    ['emp-18', 'Oshadi Karunaratne', 'role-devops', DEPARTMENT.cloudops, 'contractor', 600_000, 10_000, -5],
  ]
  const employees: EmployeeProfile[] = empRows.map(([id, name, roleId, dept, type, monthly, bill, start], i) => ({
    id,
    code: `E-${String(301 + i)}`,
    name,
    email: `${name.split(' ')[0]?.toLowerCase()}@kelanibyte.example`,
    roleId,
    departmentId: dept,
    employmentType: type,
    monthlyCost: Math.round((monthly * 0.8) / 1000) * 1000,
    hourlyCostRate: round2(Math.round((monthly * 0.8) / 1000) * 1000 / 160),
    hourlyBillRate: bill,
    capacityHoursPerWeek: 40,
    startDate: iso(addMonths(startOfMonth(A), start)),
    active: true,
    createdAt: created,
    updatedAt: created,
  }))
  const empById = new Map(employees.map((e) => [e.id, e]))
  const roleName = new Map(masterData.filter((m) => m.list === 'employeeRoles').map((m) => [m.id, m.name]))

  /* ---------------------------------------------------------------- products */
  const products: SoftwareProduct[] = [
    { id: 'prod-dev', code: 'SVC-DEV', name: 'Custom software development', description: 'Bespoke web, mobile and platform engineering', kind: 'service', incomeCategoryId: INCOME_CATEGORY.development, active: true, plans: [], createdAt: created, updatedAt: created },
    { id: 'prod-consult', code: 'SVC-CON', name: 'Cloud & architecture consulting', description: 'Assessments, migration planning and advisory', kind: 'service', incomeCategoryId: INCOME_CATEGORY.consulting, active: true, plans: [], createdAt: created, updatedAt: created },
    { id: 'prod-support', code: 'SVC-SUP', name: 'Support & maintenance', description: 'SLA-backed application support retainers', kind: 'service', incomeCategoryId: INCOME_CATEGORY.support, active: true, plans: [], createdAt: created, updatedAt: created },
    {
      id: 'prod-peopledesk', code: 'SAAS-PD', name: 'PeopleDesk HR', description: 'Cloud HR, leave and attendance for SMEs', kind: 'saas', incomeCategoryId: INCOME_CATEGORY.saas, active: true, createdAt: created, updatedAt: created,
      plans: [
        { id: 'pd-starter', name: 'Starter', monthlyPrice: 1_200, annualPrice: 12_000 },
        { id: 'pd-growth', name: 'Growth', monthlyPrice: 2_200, annualPrice: 22_000 },
        { id: 'pd-enterprise', name: 'Enterprise', monthlyPrice: 3_600, annualPrice: 36_000 },
      ],
    },
    {
      id: 'prod-shopsphere', code: 'SAAS-SS', name: 'ShopSphere POS', description: 'Cloud point-of-sale and inventory per outlet', kind: 'saas', incomeCategoryId: INCOME_CATEGORY.saas, active: true, createdAt: created, updatedAt: created,
      plans: [
        { id: 'ss-basic', name: 'Basic outlet', monthlyPrice: 9_500, annualPrice: 95_000 },
        { id: 'ss-pro', name: 'Pro outlet', monthlyPrice: 16_500, annualPrice: 165_000 },
      ],
    },
    { id: 'prod-docuflow', code: 'LIC-DF', name: 'DocuFlow on-premise licence', description: 'Document workflow engine — perpetual licence', kind: 'licence', incomeCategoryId: INCOME_CATEGORY.licensing, active: true, plans: [], createdAt: created, updatedAt: created },
  ]

  /* ---------------------------------------------------------------- projects */
  type ProjectSeed = {
    id: string; code: string; name: string; customerId: string; categoryId: string; managerId: string; billing: Project['billingModel']
    status: Project['status']; start: number; end: number; value: number; budget: number; pct: number; factor: number; team: string[]; internal?: boolean
    description: string
  }
  const projectSeeds: ProjectSeed[] = [
    { id: 'prj-100', code: 'PRJ-100', name: 'Warehouse management system', customerId: 'cus-nova', categoryId: 'pcat-web', managerId: 'emp-13', billing: 'milestone', status: 'completed', start: -19, end: -5, value: 28_000_000, budget: 19_500_000, pct: 100, factor: 0.95, team: ['emp-04', 'emp-06', 'emp-08', 'emp-14'], description: 'Inbound, putaway and pick-pack workflows with handheld scanner app.' },
    { id: 'prj-101', code: 'PRJ-101', name: 'Omnichannel commerce platform', customerId: 'cus-orchid', categoryId: 'pcat-web', managerId: 'emp-12', billing: 'fixed_price', status: 'active', start: -10, end: 4, value: 38_500_000, budget: 27_000_000, pct: 68, factor: 0.97, team: ['emp-03', 'emp-05', 'emp-09', 'emp-11', 'emp-12'], description: 'Unified web storefront, loyalty and order management for 40+ retail outlets.' },
    { id: 'prj-102', code: 'PRJ-102', name: 'Fleet tracking & dispatch', customerId: 'cus-harbour', categoryId: 'pcat-mobile', managerId: 'emp-13', billing: 'time_and_materials', status: 'active', start: -8, end: 5, value: 21_000_000, budget: 14_500_000, pct: 45, factor: 1.0, team: ['emp-06', 'emp-13', 'emp-08'], description: 'Driver mobile app, telematics ingestion and live dispatch dashboard.' },
    { id: 'prj-103', code: 'PRJ-103', name: 'Patient portal & telehealth', customerId: 'cus-serendib', categoryId: 'pcat-web', managerId: 'emp-12', billing: 'milestone', status: 'active', start: -11, end: 3, value: 46_000_000, budget: 33_000_000, pct: 58, factor: 0.9, team: ['emp-02', 'emp-07', 'emp-17', 'emp-14', 'emp-11'], description: 'Appointment booking, e-prescriptions and secure video consultations.' },
    { id: 'prj-104', code: 'PRJ-104', name: 'Claims automation suite', customerId: 'cus-bluepeak', categoryId: 'pcat-data', managerId: 'emp-13', billing: 'fixed_price', status: 'active', start: -13, end: 1, value: 27_500_000, budget: 19_000_000, pct: 82, factor: 1.32, team: ['emp-04', 'emp-08', 'emp-03'], description: 'OCR intake, rules-based adjudication and claims analytics.' },
    { id: 'prj-105', code: 'PRJ-105', name: 'Mobile lending app', customerId: 'cus-lotus', categoryId: 'pcat-mobile', managerId: 'emp-12', billing: 'milestone', status: 'completed', start: -14, end: -3, value: 19_800_000, budget: 14_000_000, pct: 100, factor: 0.93, team: ['emp-05', 'emp-06', 'emp-09', 'emp-11'], description: 'Customer onboarding, loan origination and repayment reminders.' },
    { id: 'prj-106', code: 'PRJ-106', name: 'Booking engine revamp', customerId: 'cus-coral', categoryId: 'pcat-web', managerId: 'emp-13', billing: 'fixed_price', status: 'planning', start: 1, end: 7, value: 12_400_000, budget: 8_600_000, pct: 0, factor: 0, team: ['emp-07', 'emp-11'], description: 'Direct booking engine with dynamic pricing and channel manager integration.' },
    { id: 'prj-107', code: 'PRJ-107', name: 'LMS managed support', customerId: 'cus-meridian', categoryId: 'pcat-support', managerId: 'emp-13', billing: 'retainer', status: 'active', start: -9, end: 3, value: 7_200_000, budget: 4_300_000, pct: 75, factor: 0.9, team: ['emp-06', 'emp-10'], description: '12-month SLA support retainer for the learning management platform.' },
    { id: 'prj-108', code: 'PRJ-108', name: 'IoT farm data platform', customerId: 'cus-greenfield', categoryId: 'pcat-data', managerId: 'emp-12', billing: 'time_and_materials', status: 'active', start: -5, end: 7, value: 26_000_000, budget: 18_500_000, pct: 42, factor: 0.95, team: ['emp-18', 'emp-05', 'emp-14'], description: 'Sensor ingestion, crop analytics and grower dashboards.' },
    { id: 'prj-109', code: 'PRJ-109', name: 'Finance platform R&D', customerId: 'cus-orchid', categoryId: 'pcat-internal', managerId: 'emp-01', billing: 'fixed_price', status: 'active', start: -6, end: 6, value: 0, budget: 9_000_000, pct: 45, factor: 1.0, team: ['emp-01', 'emp-07', 'emp-10'], internal: true, description: 'Internal R&D for the configurable IT finance platform (this demo).' },
    { id: 'prj-110', code: 'PRJ-110', name: 'Cloud migration programme', customerId: 'cus-tidewater', categoryId: 'pcat-cloud', managerId: 'emp-13', billing: 'fixed_price', status: 'on_hold', start: -7, end: 2, value: 16_500_000, budget: 11_500_000, pct: 28, factor: 0.98, team: ['emp-10', 'emp-18', 'emp-04'], description: 'Lift-and-shift of 60 workloads with landing zone and cost guardrails. Paused pending client budget approval.' },
  ]

  // Contract values carry a healthy delivery margin over the cost budget.
  for (const p of projectSeeds) p.value = Math.round((p.value * 1.12) / 100_000) * 100_000

  const projects: Project[] = projectSeeds.map((p) => {
    const labour = round2(p.budget * 0.72)
    const infra = round2(p.budget * 0.14)
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      customerId: p.customerId,
      contractId: p.internal ? undefined : `con-${p.id.slice(4)}`,
      categoryId: p.categoryId,
      managerId: p.managerId,
      departmentId: p.internal ? DEPARTMENT.engineering : DEPARTMENT.delivery,
      billingModel: p.billing,
      status: p.status,
      startDate: monthStart(p.start),
      endDate: iso(addDays(addMonths(startOfMonth(A), p.end + 1), -1)),
      contractValue: p.value,
      budget: p.budget,
      plannedLabour: labour,
      plannedInfrastructure: infra,
      plannedOther: subtract(p.budget, add(labour, infra)),
      percentComplete: p.pct,
      description: p.description,
      isInternal: !!p.internal,
      createdAt: ts(monthStart(Math.min(p.start, 0) - 1)),
      updatedAt: ts(day(-3)),
    }
  })
  const projectById = new Map(projects.map((p) => [p.id, p]))

  /* -------------------------------------------------------------- contracts */
  const contracts: Contract[] = projectSeeds
    .filter((p) => !p.internal)
    .map((p) => ({
      id: `con-${p.id.slice(4)}`,
      number: `CTR-${p.code.slice(4)}`,
      title: `${p.name} — ${p.billing === 'retainer' ? 'support agreement' : 'statement of work'}`,
      customerId: p.customerId,
      projectId: p.id,
      billingModel: p.billing,
      value: p.value,
      currency: 'LKR' as const,
      startDate: monthStart(p.start),
      endDate: iso(addDays(addMonths(startOfMonth(A), p.end + 1), -1)),
      status: (p.status === 'completed' ? 'completed' : p.status === 'on_hold' ? 'on_hold' : p.status === 'planning' ? 'draft' : 'active') as Contract['status'],
      renewalDate: p.billing === 'retainer' ? monthStart(p.end + 1) : undefined,
      description: p.description,
      createdAt: ts(monthStart(p.start - 1)),
      updatedAt: ts(day(-10)),
    }))
  contracts.push(
    { id: 'con-saas-orchid', number: 'CTR-S01', title: 'ShopSphere POS master subscription agreement', customerId: 'cus-orchid', billingModel: 'subscription', value: 4_950_000, currency: 'LKR', startDate: monthStart(-16), endDate: iso(addDays(addMonths(startOfMonth(A), 8), -1)), status: 'active', renewalDate: monthStart(8), createdAt: created, updatedAt: created },
    { id: 'con-sup-silverleaf', number: 'CTR-S02', title: 'Annual application support — ERP connectors', customerId: 'cus-silverleaf', billingModel: 'retainer', value: 3_600_000, currency: 'LKR', startDate: monthStart(-13), endDate: iso(addDays(addMonths(startOfMonth(A), 5), -1)), status: 'active', renewalDate: monthStart(5), createdAt: created, updatedAt: created },
  )

  /* ------------------------------------------------- allocations & timesheets */
  const allocations: ProjectAllocation[] = []
  const timesheets: TimesheetEntry[] = []
  let tsCounter = 0
  for (const p of projectSeeds) {
    const project = projectById.get(p.id)!
    const start = parseISO(project.startDate)
    const end = parseISO(project.endDate)
    p.team.forEach((empId, i) => {
      const weeksTotal = Math.max(1, Math.round(differenceInCalendarDays(end, start) / 7))
      allocations.push({
        id: `alloc-${p.id.slice(4)}-${i + 1}`,
        projectId: p.id,
        employeeId: empId,
        plannedHours: Math.round(weeksTotal * (i === 0 ? 18 : 14)),
        startDate: project.startDate,
        endDate: project.endDate,
        roleOnProject: roleName.get(empById.get(empId)!.roleId) ?? 'Team member',
        createdAt: project.createdAt,
        updatedAt: project.createdAt,
      })
    })
    if (p.factor === 0) continue
    const lastWeek = startOfWeek(addDays(p.status === 'completed' ? end : A, -1), { weekStartsOn: 1 })
    const weeks: Date[] = []
    for (let w = startOfWeek(start, { weekStartsOn: 1 }); w <= lastWeek; w = addDays(w, 7)) weeks.push(w)
    if (p.status === 'on_hold') weeks.splice(Math.max(1, weeks.length - 6)) // paused for the last ~6 weeks
    const targetLabour = (project.plannedLabour * p.pct * p.factor) / 100
    const weeklyCost = targetLabour / Math.max(weeks.length, 1)
    for (const w of weeks) {
      const date = iso(w)
      const present = p.team.map((id) => empById.get(id)!).filter((e) => e.startDate <= date)
      if (!present.length) continue
      const rateSum = present.reduce((acc, e) => acc + e.hourlyCostRate, 0)
      const age = differenceInCalendarDays(A, w)
      for (const emp of present) {
        const hours = Math.max(0.5, Math.round(((weeklyCost * rnd.between(0.85, 1.15)) / rateSum) * 2) / 2)
        tsCounter++
        timesheets.push({
          id: `ts-${tsCounter}`,
          employeeId: emp.id,
          projectId: p.id,
          date,
          hours,
          billable: !p.internal && rnd.chance(0.9),
          description: rnd.pick(['Feature development', 'Sprint ceremonies & planning', 'Code review', 'Testing & QA', 'Client workshop', 'Bug fixing', 'Deployment & release', 'Documentation']),
          status: age > 14 ? 'approved' : age > 7 ? 'submitted' : 'draft',
          createdAt: ts(date, 17),
          updatedAt: ts(date, 17),
        })
      }
    }
  }
  // Respect a 40-hour week per person across projects.
  const weekLoad = new Map<string, TimesheetEntry[]>()
  for (const t of timesheets) {
    const key = `${t.employeeId}|${t.date}`
    const list = weekLoad.get(key)
    if (list) list.push(t)
    else weekLoad.set(key, [t])
  }
  for (const entries of weekLoad.values()) {
    const total = entries.reduce((acc, t) => acc + t.hours, 0)
    if (total <= 40) continue
    for (const t of entries) t.hours = Math.max(0.5, Math.floor(((t.hours * 40) / total) * 2) / 2)
  }

  /* ----------------------------------------------------- project cost entries */
  const projectCosts: ProjectCostEntry[] = []
  let pcCounter = 0
  const addCost = (projectId: string, date: string, type: ProjectCostEntry['type'], description: string, amount: number, billable: boolean, committed = false) => {
    pcCounter++
    projectCosts.push({ id: `pc-${pcCounter}`, projectId, date, type, description, amount: round2(amount), billable, committed, sourceType: 'manual', costCodeId: type === 'travel' ? 'cost-travel' : type === 'infrastructure' ? 'cost-infra' : 'cost-dev', createdAt: ts(date), updatedAt: ts(date) })
  }
  for (const p of projectSeeds) {
    if (p.factor === 0) continue
    const project = projectById.get(p.id)!
    const otherTarget = (project.plannedOther * p.pct * p.factor) / 100
    const startOff = Math.max(p.start, -18)
    const endOff = p.status === 'completed' ? p.end : 0
    const n = Math.max(2, Math.min(6, endOff - startOff + 1))
    for (let i = 0; i < n; i++) {
      const date = iso(addDays(addMonths(startOfMonth(A), startOff + Math.floor(((endOff - startOff) * i) / n)), rnd.int(2, 25)))
      if (date > today) continue
      const type = rnd.pick(['software', 'subcontractor', 'travel', 'other'] as const)
      const label = { software: 'Third-party SDK & API licences', subcontractor: 'Specialist subcontract work', travel: 'Client site visit', other: 'Testing devices & sundry costs' }[type]
      addCost(p.id, date, type, label, otherTarget / n, type !== 'other')
    }
    if (p.status === 'active') addCost(p.id, day(-4), 'subcontractor', 'Open PO — penetration test (committed)', rnd.nice(p.budget * 0.02, 1000), false, true)
  }

  /* ---------------------------------------------------------- subscriptions */
  type SubSeed = [customerId: string, productId: string, planId: string, cycle: 'monthly' | 'annual', seats: number, startOff: number, cancelOff?: number, trial?: boolean]
  const subSeeds: SubSeed[] = [
    ['cus-orchid', 'prod-shopsphere', 'ss-pro', 'monthly', 24, -16],
    ['cus-nova', 'prod-peopledesk', 'pd-growth', 'monthly', 120, -14],
    ['cus-silverleaf', 'prod-peopledesk', 'pd-enterprise', 'annual', 260, -13],
    ['cus-kandy', 'prod-shopsphere', 'ss-basic', 'monthly', 6, -11],
    ['cus-coral', 'prod-peopledesk', 'pd-growth', 'monthly', 85, -12],
    ['cus-coral', 'prod-shopsphere', 'ss-pro', 'monthly', 5, -9],
    ['cus-harbour', 'prod-peopledesk', 'pd-starter', 'monthly', 140, -10],
    ['cus-meridian', 'prod-peopledesk', 'pd-growth', 'annual', 70, -8],
    ['cus-lotus', 'prod-peopledesk', 'pd-enterprise', 'monthly', 95, -7],
    ['cus-greenfield', 'prod-shopsphere', 'ss-basic', 'monthly', 4, -6, -2],
    ['cus-tidewater', 'prod-peopledesk', 'pd-starter', 'monthly', 60, -15, -4],
    ['cus-serendib', 'prod-peopledesk', 'pd-growth', 'monthly', 180, -5],
    ['cus-bluepeak', 'prod-peopledesk', 'pd-starter', 'monthly', 45, -4, -1],
    ['cus-nova', 'prod-shopsphere', 'ss-basic', 'monthly', 3, -3],
    ['cus-azure', 'prod-peopledesk', 'pd-growth', 'monthly', 30, 0, undefined, true],
    ['cus-silverleaf', 'prod-shopsphere', 'ss-pro', 'monthly', 8, -2],
  ]
  const subscriptions: CustomerSubscription[] = subSeeds.map(([customerId, productId, planId, cycle, seatsIn, startOff, cancelOff, trial], i) => {
    const plan = products.find((p) => p.id === productId)!.plans.find((pl) => pl.id === planId)!
    const seats = Math.round(seatsIn * 1.3)
    const startDate = iso(addDays(addMonths(startOfMonth(A), startOff), 4))
    let renewal = addMonths(parseISO(startDate), cycle === 'annual' ? 12 : 1)
    while (iso(renewal) < today) renewal = addMonths(renewal, cycle === 'annual' ? 12 : 1)
    return {
      id: `sub-${i + 1}`,
      customerId,
      productId,
      planId,
      billingCycle: cycle,
      seats,
      unitPrice: cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice,
      startDate,
      renewalDate: iso(renewal),
      cancelledDate: cancelOff !== undefined ? iso(addDays(addMonths(startOfMonth(A), cancelOff), 9)) : undefined,
      status: trial ? 'trial' : cancelOff !== undefined ? 'cancelled' : customerId === 'cus-kandy' ? 'past_due' : 'active',
      createdAt: ts(startDate),
      updatedAt: ts(startDate),
    }
  })

  /* --------------------------------------------------------------- invoices */
  type DraftInvoice = Omit<Invoice, 'number' | 'history' | 'status'> & { draft?: boolean }
  const draftInvoices: DraftInvoice[] = []
  let invCounter = 0
  let lineCounter = 0
  const line = (description: string, productId: string, quantity: number, unitPrice: number, taxRatePercent = VAT, discountPercent = 0): LineItem => ({
    id: `ln-${++lineCounter}`,
    description,
    productId,
    quantity,
    unitPrice: round2(unitPrice),
    discountPercent,
    taxRatePercent,
  })
  const customerTerms = new Map(customers.map((c) => [c.id, c.paymentTermsDays]))
  const pushInvoice = (customerId: string, issueDate: string, lines: LineItem[], extra: Partial<DraftInvoice> = {}) => {
    invCounter++
    draftInvoices.push({
      id: `inv-${invCounter}`,
      customerId,
      issueDate,
      dueDate: iso(addDays(parseISO(issueDate), customerTerms.get(customerId) ?? 30)),
      currency: 'LKR',
      lines,
      discountPercent: 0,
      createdAt: ts(issueDate, 10),
      updatedAt: ts(issueDate, 10),
      ...extra,
    })
  }

  // Milestones & milestone/fixed-price invoicing
  const milestones: Milestone[] = []
  const milestoneNames = ['Discovery & solution design', 'MVP build complete', 'Integration & UAT sign-off', 'Production go-live', 'Hypercare closure']
  const fixedPriceNames = ['Mobilisation', 'Solution design sign-off', 'Build complete', 'UAT sign-off & go-live', 'Warranty closure']
  for (const p of projectSeeds) {
    if (p.internal || (p.billing !== 'fixed_price' && p.billing !== 'milestone')) continue
    const project = projectById.get(p.id)!
    const shares = p.billing === 'milestone' ? [0.15, 0.25, 0.25, 0.25, 0.1] : [0.1, 0.2, 0.3, 0.25, 0.15]
    const span = differenceInCalendarDays(parseISO(project.endDate), parseISO(project.startDate))
    let cumulative = 0
    shares.forEach((share, i) => {
      cumulative += share * 100
      const due = iso(addDays(parseISO(project.startDate), Math.round((span * cumulative) / 100)))
      const reached = cumulative <= p.pct + 0.001
      const amount = round2(p.value * share)
      const id = `ms-${p.id.slice(4)}-${i + 1}`
      let invoiceId: string | undefined
      if (reached) {
        const issue = due > today ? day(-rnd.int(3, 12)) : due
        pushInvoice(p.customerId, issue, [line(`${p.name} — milestone ${i + 1}: ${milestoneNames[i]}`, 'prod-dev', 1, amount)], { projectId: p.id, contractId: project.contractId })
        invoiceId = `inv-${invCounter}`
      }
      milestones.push({
        id,
        projectId: p.id,
        name: (p.billing === 'milestone' ? milestoneNames : fixedPriceNames)[i] ?? `Milestone ${i + 1}`,
        dueDate: due,
        amount,
        status: reached ? 'invoiced' : i === shares.findIndex((_, j) => shares.slice(0, j + 1).reduce((a, b) => a + b, 0) * 100 > p.pct + 0.001) ? 'in_progress' : 'pending',
        invoiceId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
    })
  }

  // Time & materials: monthly invoices from billable approved hours
  for (const p of projectSeeds) {
    if (p.billing !== 'time_and_materials') continue
    const byMonth = new Map<string, Map<string, number>>()
    for (const t of timesheets) {
      if (t.projectId !== p.id || !t.billable) continue
      const key = t.date.slice(0, 7)
      if (key >= today.slice(0, 7)) continue
      const m = byMonth.get(key) ?? new Map<string, number>()
      m.set(t.employeeId, (m.get(t.employeeId) ?? 0) + t.hours)
      byMonth.set(key, m)
    }
    for (const [month, hoursByEmp] of [...byMonth.entries()].sort()) {
      const issue = iso(addDays(addMonths(parseISO(`${month}-01`), 1), 2))
      const lines = [...hoursByEmp.entries()].map(([empId, hours]) => {
        const e = empById.get(empId)!
        return line(`${roleName.get(e.roleId)} — ${format(parseISO(`${month}-01`), 'MMMM yyyy')}`, 'prod-dev', hours, e.hourlyBillRate)
      })
      pushInvoice(p.customerId, issue, lines, { projectId: p.id, contractId: `con-${p.id.slice(4)}`, notes: 'Time & materials — hours per approved timesheets.' })
    }
  }

  // Retainers (project 107 + Silverleaf support contract)
  for (let m = -9; m <= 0; m++) {
    const issue = monthStart(m)
    pushInvoice('cus-meridian', issue, [line(`LMS managed support retainer — ${format(parseISO(issue), 'MMMM yyyy')}`, 'prod-support', 1, 600_000)], { projectId: 'prj-107', contractId: 'con-107', recurringScheduleId: 'rec-1' })
  }
  for (let m = -13; m <= 0; m++) {
    const issue = monthStart(m)
    pushInvoice('cus-silverleaf', issue, [line(`ERP connector support — ${format(parseISO(issue), 'MMMM yyyy')}`, 'prod-support', 1, 300_000)], { contractId: 'con-sup-silverleaf', recurringScheduleId: 'rec-2' })
  }

  // SaaS subscription invoices
  for (const s of subscriptions) {
    if (s.status === 'trial') continue
    const product = products.find((p) => p.id === s.productId)!
    const plan = product.plans.find((pl) => pl.id === s.planId)!
    const step = s.billingCycle === 'annual' ? 12 : 1
    for (let d = parseISO(s.startDate); iso(d) <= today; d = addMonths(d, step)) {
      if (s.cancelledDate && iso(d) >= s.cancelledDate) break
      if (iso(d) < monthStart(-12) && step === 1) continue
      pushInvoice(s.customerId, iso(d), [line(`${product.name} — ${plan.name} (${s.billingCycle}) · ${format(d, 'MMM yyyy')}`, product.id, s.seats, s.unitPrice)], { notes: 'Subscription billing.' })
    }
  }

  // Consulting & licence one-offs
  pushInvoice('cus-tidewater', day(-200), [line('Cloud readiness assessment', 'prod-consult', 1, 2_400_000)])
  pushInvoice('cus-nova', day(-150), [line('DocuFlow perpetual licence — 50 users', 'prod-docuflow', 50, 38_000), line('Implementation services', 'prod-consult', 40, 9_500)])
  pushInvoice('cus-kandy', day(-95), [line('E-commerce architecture advisory', 'prod-consult', 32, 9_000)])
  pushInvoice('cus-silverleaf', day(-60), [line('DocuFlow licence expansion — 20 users', 'prod-docuflow', 20, 38_000, VAT, 10)])
  pushInvoice('cus-azure', day(-2), [line('Discovery workshop — property CRM', 'prod-consult', 24, 9_500)], { draft: true })
  pushInvoice('cus-coral', day(-1), [line('Booking engine — mobilisation fee', 'prod-dev', 1, 1_240_000)], { projectId: 'prj-106', contractId: 'con-106', draft: true })

  draftInvoices.sort((a, b) => (a.issueDate === b.issueDate ? a.id.localeCompare(b.id) : a.issueDate.localeCompare(b.issueDate)))

  /* --------------------------------------------------------------- payments */
  const payments: Payment[] = []
  let payCounter = 0
  const bankOperating = 'bank-operating'
  const bankPayroll = 'bank-payroll'
  const pushPayment = (p: Omit<Payment, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'currency'>) => {
    payCounter++
    payments.push({ id: `pay-${payCounter}`, number: `PAY-${String(payCounter).padStart(5, '0')}`, currency: 'LKR', createdAt: ts(p.date, 11), updatedAt: ts(p.date, 11), ...p })
  }

  const invoices: Invoice[] = draftInvoices.map((d, i) => {
    const { draft, ...rest } = d
    const year = d.issueDate.slice(0, 4)
    const number = `INV-${year}-${String(i + 1).padStart(4, '0')}`
    const history: Invoice['history'] = [{ status: 'draft', at: ts(d.issueDate, 9), by: 'Tharushi Silva' }]
    if (draft) return { ...rest, number, status: 'draft' as InvoiceStatus, history }
    history.push({ status: 'issued', at: ts(d.issueDate, 10), by: 'Ruwan Fernando', note: 'Issued (simulated — no email sent)' })
    return { ...rest, number, status: 'issued' as InvoiceStatus, history }
  })

  /* ----------------------------------------------------------- credit notes */
  const creditNotes: CreditNote[] = []
  const creditTargets = [
    invoices.find((i) => i.customerId === 'cus-bluepeak' && i.status !== 'draft'),
    invoices.find((i) => i.customerId === 'cus-kandy' && i.lines[0]?.productId === 'prod-shopsphere' && i.status !== 'draft'),
    invoices.find((i) => i.customerId === 'cus-harbour' && i.projectId === 'prj-102' && i.status !== 'draft'),
  ]
  const creditReasons = ['Service credit — SLA breach in UAT environment', 'Duplicate outlet charge reversed', 'Rate correction on QA hours']
  creditTargets.forEach((inv, i) => {
    if (!inv) return
    const total = documentTotals(inv.lines, inv.discountPercent).total
    const date = iso(addDays(parseISO(inv.issueDate), 12))
    creditNotes.push({
      id: `cn-${i + 1}`,
      number: `CN-${date.slice(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      customerId: inv.customerId,
      invoiceId: inv.id,
      date: date > today ? today : date,
      reason: creditReasons[i] ?? 'Adjustment',
      amount: round2(total * (i === 1 ? 1 / 6 : 0.05)),
      status: 'applied',
      createdAt: ts(date),
      updatedAt: ts(date),
    })
  })

  const creditedByInvoice = new Map(creditNotes.map((c) => [c.invoiceId, c.amount]))
  for (const inv of invoices) {
    if (inv.status !== 'issued') continue
    const total = subtract(documentTotals(inv.lines, inv.discountPercent).total, creditedByInvoice.get(inv.id) ?? 0)
    const behaviour = payerBehaviour.get(inv.customerId) ?? 'good'
    const daysPastDue = differenceInCalendarDays(A, parseISO(inv.dueDate))
    const daysSinceIssue = differenceInCalendarDays(A, parseISO(inv.issueDate))
    let paidPortion = 0
    let payDate = inv.dueDate
    if (behaviour === 'good') {
      if (daysPastDue > -5) { paidPortion = 1; payDate = iso(addDays(parseISO(inv.dueDate), rnd.int(-6, 4))) }
      else if (daysSinceIssue > 10 && rnd.chance(0.25)) { paidPortion = 1; payDate = day(-rnd.int(1, 5)) }
    } else if (behaviour === 'slow') {
      if (daysPastDue > 35) { paidPortion = 1; payDate = iso(addDays(parseISO(inv.dueDate), rnd.int(18, 32))) }
      else if (daysPastDue > 5) { paidPortion = 0.5; payDate = iso(addDays(parseISO(inv.dueDate), rnd.int(1, 4))) }
    } else {
      if (daysPastDue > 120) { paidPortion = 1; payDate = iso(addDays(parseISO(inv.dueDate), rnd.int(40, 70))) }
      else if (daysPastDue > 60) { paidPortion = 0.4; payDate = iso(addDays(parseISO(inv.dueDate), rnd.int(20, 40))) }
    }
    if (payDate > today) payDate = today
    if (paidPortion <= 0) continue
    const amount = paidPortion === 1 ? total : round2(total * paidPortion)
    pushPayment({ direction: 'incoming', category: 'customer_receipt', date: payDate, amount, method: rnd.pick(['bank_transfer', 'bank_transfer', 'cheque', 'online'] as const), reference: `RCPT-${inv.number.slice(-4)}`, bankAccountId: bankOperating, customerId: inv.customerId, invoiceId: inv.id })
    if (paidPortion === 1) {
      inv.status = 'paid'
      inv.history.push({ status: 'paid', at: ts(payDate, 15), by: 'Tharushi Silva', note: 'Simulated receipt recorded' })
    } else {
      inv.status = 'partially_paid'
      inv.history.push({ status: 'partially_paid', at: ts(payDate, 15), by: 'Tharushi Silva', note: 'Part payment recorded' })
    }
  }

  /* -------------------------------------------------------------- cloud & AI */
  const cloudCosts: CloudCostEntry[] = []
  const aiUsage: AiUsageEntry[] = []
  let cloudCounter = 0
  type CloudLine = [provider: CloudCostEntry['provider'], service: string, category: CloudCostEntry['category'], base: number, growth: number, env: CloudCostEntry['environment'], tag: { projectId?: string; productId?: string; departmentId?: string }, fromOffset?: number, toOffset?: number]
  const cloudLines: CloudLine[] = [
    ['AWS', 'EC2 & Fargate compute', 'compute', 310_000, 0.025, 'production', { productId: 'prod-peopledesk', departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'RDS PostgreSQL', 'database', 165_000, 0.02, 'production', { productId: 'prod-peopledesk', departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'S3 storage & backups', 'storage', 48_000, 0.03, 'production', { productId: 'prod-peopledesk', departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'Data transfer & CloudFront', 'bandwidth', 36_000, 0.035, 'production', { productId: 'prod-shopsphere', departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'ECS compute — POS', 'compute', 140_000, 0.03, 'production', { productId: 'prod-shopsphere', departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'Aurora — POS', 'database', 92_000, 0.02, 'production', { productId: 'prod-shopsphere', departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'CloudWatch & logging', 'monitoring', 41_000, 0.04, 'production', { departmentId: DEPARTMENT.cloudops }],
    ['AWS', 'Staging & dev environments', 'compute', 75_000, 0.01, 'staging', { departmentId: DEPARTMENT.engineering }],
    ['Azure', 'App Service & SQL — telehealth', 'compute', 128_000, 0.04, 'staging', { projectId: 'prj-103', departmentId: DEPARTMENT.delivery }, -11],
    ['Azure', 'Media services — video consults', 'bandwidth', 54_000, 0.06, 'staging', { projectId: 'prj-103', departmentId: DEPARTMENT.delivery }, -8],
    ['Google Cloud', 'Pub/Sub & Dataflow — IoT', 'compute', 96_000, 0.07, 'development', { projectId: 'prj-108', departmentId: DEPARTMENT.delivery }, -5],
    ['Google Cloud', 'BigQuery analytics', 'database', 38_000, 0.08, 'development', { projectId: 'prj-108', departmentId: DEPARTMENT.delivery }, -4],
    ['AWS', 'Commerce platform — UAT', 'compute', 82_000, 0.03, 'staging', { projectId: 'prj-101', departmentId: DEPARTMENT.delivery }, -9],
    ['AWS', 'Landing zone — migration', 'networking', 61_000, 0.0, 'staging', { projectId: 'prj-110', departmentId: DEPARTMENT.delivery }, -6, -2],
    ['Cloudflare', 'CDN, WAF & DNS', 'networking', 27_000, 0.0, 'production', { departmentId: DEPARTMENT.cloudops }],
    ['DigitalOcean', 'Internal tools droplets', 'compute', 18_000, 0.0, 'production', { departmentId: DEPARTMENT.engineering }],
  ]
  for (let m = -12; m <= 0; m++) {
    const month = monthStart(m)
    for (const [provider, service, category, base, growth, env, tag, from = -12, to = 0] of cloudLines) {
      if (m < from || m > to) continue
      const amount = round2(base * Math.pow(1 + growth, m + 12) * rnd.between(0.94, 1.06))
      cloudCounter++
      cloudCosts.push({ id: `cl-${cloudCounter}`, provider, service, category, month, amount: m === 0 ? round2(amount * Math.min(1, A.getDate() / 30)) : amount, currency: 'LKR', environment: env, ...tag, createdAt: ts(month), updatedAt: ts(month) })
    }
    const aiLines: [string, string, string, number, number, { productId?: string; projectId?: string }][] = [
      ['Anthropic', 'Claude Sonnet', 'PeopleDesk HR assistant', 52_000, 0.09, { productId: 'prod-peopledesk' }],
      ['Anthropic', 'Claude Haiku', 'Claims document triage', 21_000, 0.05, { projectId: 'prj-104' }],
      ['Google', 'Gemini Flash', 'Crop image classification', 14_000, 0.12, { projectId: 'prj-108' }],
      ['OpenAI', 'GPT-4.1 mini', 'Internal developer tooling', 9_000, 0.04, {}],
    ]
    aiLines.forEach(([provider, model, useCase, base, growth, tag], i) => {
      if (i === 2 && m < -4) return
      if (i === 1 && m < -11) return
      const amount = round2(base * Math.pow(1 + growth, m + 12) * rnd.between(0.9, 1.1))
      const scaled = m === 0 ? round2(amount * Math.min(1, A.getDate() / 30)) : amount
      const requests = Math.round(scaled / 0.9)
      aiUsage.push({ id: `ai-${m + 13}-${i + 1}`, provider, model, month, useCase, requests, inputTokens: requests * rnd.int(900, 1600), outputTokens: requests * rnd.int(200, 500), amount: scaled, ...tag, createdAt: ts(month), updatedAt: ts(month) })
    })
  }

  /* --------------------------------------------------------------- licences */
  const licenceRows: [string, string, number, number, number, 'monthly' | 'annual', string, SoftwareLicence['category'], number][] = [
    ['Code hosting & CI — Team', 'sup-devtools', 24, 22, 1_350, 'monthly', DEPARTMENT.engineering, 'development', -30],
    ['Issue tracking & wiki', 'sup-devtools', 30, 27, 2_100, 'monthly', DEPARTMENT.engineering, 'development', -30],
    ['Design & prototyping suite', 'sup-byteware', 4, 3, 5_400, 'monthly', DEPARTMENT.product, 'design', -20],
    ['Office productivity suite', 'sup-byteware', 32, 29, 2_400, 'monthly', DEPARTMENT.finance, 'productivity', -40],
    ['Endpoint security & EDR', 'sup-secure', 34, 31, 18_000, 'annual', DEPARTMENT.cloudops, 'security', -12],
    ['Password & secrets manager', 'sup-devtools', 30, 26, 14_400, 'annual', DEPARTMENT.cloudops, 'security', -18],
    ['Accounting & payroll add-on', 'sup-byteware', 3, 3, 9_800, 'monthly', DEPARTMENT.finance, 'finance', -24],
    ['Error tracking & APM', 'sup-devtools', 1, 1, 64_000, 'monthly', DEPARTMENT.cloudops, 'infrastructure', -10],
    ['AI pair-programming seats', 'sup-devtools', 14, 12, 5_700, 'monthly', DEPARTMENT.engineering, 'development', -4],
  ]
  const licences: SoftwareLicence[] = licenceRows.map(([name, vendorId, seats, used, cost, cycle, dept, category, startOff], i) => {
    const startDate = monthStart(startOff)
    let renewal = addMonths(parseISO(startDate), cycle === 'annual' ? 12 : 1)
    while (iso(renewal) < today) renewal = addMonths(renewal, cycle === 'annual' ? 12 : 1)
    return { id: `lic-${i + 1}`, name, vendorId, seats, seatsUsed: used, costPerSeat: cost, billingCycle: cycle, startDate, renewalDate: iso(renewal), departmentId: dept, category, status: 'active', createdAt: ts(startDate), updatedAt: ts(startDate) }
  })

  /* ------------------------------------------------------- procurement & bills */
  const supplierBills: SupplierBill[] = []
  let billCounter = 0
  const pushBill = (supplierId: string, billDate: string, description: string, subtotal: number, categoryId: string, departmentId: string, extra: Partial<SupplierBill> = {}, taxRate = VAT) => {
    billCounter++
    const supplierTerms = suppliers.find((s) => s.id === supplierId)?.paymentTermsDays ?? 30
    const bill: SupplierBill = {
      id: `bill-${billCounter}`,
      number: `BILL-${String(billCounter).padStart(4, '0')}`,
      supplierReference: `${supplierId.slice(4, 7).toUpperCase()}-${rnd.int(10000, 99999)}`,
      supplierId,
      departmentId,
      categoryId,
      billDate,
      dueDate: iso(addDays(parseISO(billDate), supplierTerms)),
      currency: 'LKR',
      subtotal: round2(subtotal),
      taxAmount: applyRate(subtotal, taxRate),
      status: 'approved',
      history: [
        { status: 'awaiting_approval', at: ts(billDate, 10), by: 'Tharushi Silva' },
        { status: 'approved', at: ts(billDate, 15), by: 'Ruwan Fernando' },
      ],
      description,
      createdAt: ts(billDate, 10),
      updatedAt: ts(billDate, 15),
      ...extra,
    }
    supplierBills.push(bill)
    return bill
  }
  for (let m = -12; m <= 0; m++) {
    pushBill('sup-workspace', monthStart(m), `Office lease & service charge — ${format(parseISO(monthStart(m)), 'MMM yyyy')}`, 980_000, EXPENSE_CATEGORY.office, DEPARTMENT.finance)
    pushBill('sup-fibre', iso(addDays(parseISO(monthStart(m)), 4)), `Dedicated fibre & mobile plans — ${format(parseISO(monthStart(m)), 'MMM yyyy')}`, 92_000, EXPENSE_CATEGORY.telecom, DEPARTMENT.finance)
  }
  pushBill('sup-pixel', day(-160), 'Brand & UI design sprint — commerce platform', 1_150_000, EXPENSE_CATEGORY.contractors, DEPARTMENT.delivery, { projectId: 'prj-101' })
  pushBill('sup-pixel', day(-75), 'Telehealth UX research & usability testing', 860_000, EXPENSE_CATEGORY.contractors, DEPARTMENT.delivery, { projectId: 'prj-103' })
  pushBill('sup-talent', day(-120), 'Contract React Native developers — 2 FTE (month 1)', 1_480_000, EXPENSE_CATEGORY.contractors, DEPARTMENT.delivery, { projectId: 'prj-104' })
  pushBill('sup-talent', day(-90), 'Contract React Native developers — 2 FTE (month 2)', 1_480_000, EXPENSE_CATEGORY.contractors, DEPARTMENT.delivery, { projectId: 'prj-104' })
  pushBill('sup-secure', day(-210), 'ISO 27001 readiness assessment', 1_350_000, EXPENSE_CATEGORY.professional, DEPARTMENT.cloudops)
  pushBill('sup-secure', day(-35), 'Penetration test — patient portal', 720_000, EXPENSE_CATEGORY.professional, DEPARTMENT.delivery, { projectId: 'prj-103' })
  pushBill('sup-legal', day(-140), 'Commercial contract review — MSA templates', 420_000, EXPENSE_CATEGORY.professional, DEPARTMENT.finance)
  pushBill('sup-legal', day(-48), 'Annual statutory audit — interim fee', 1_100_000, EXPENSE_CATEGORY.professional, DEPARTMENT.finance)
  pushBill('sup-events', day(-100), 'Tech summit booth & sponsorship', 1_650_000, EXPENSE_CATEGORY.marketing, DEPARTMENT.sales)
  pushBill('sup-events', day(-20), 'Digital campaign — SaaS lead generation', 540_000, EXPENSE_CATEGORY.marketing, DEPARTMENT.sales)
  pushBill('sup-metro', day(-12), 'Test devices — Android & iOS handsets', 385_000, EXPENSE_CATEGORY.equipment, DEPARTMENT.engineering, { projectId: 'prj-102', status: 'awaiting_approval', history: [{ status: 'awaiting_approval', at: ts(day(-12), 10), by: 'Tharushi Silva' }] })
  pushBill('sup-talent', day(-6), 'Contract data engineer — IoT platform (month 1)', 940_000, EXPENSE_CATEGORY.contractors, DEPARTMENT.delivery, { projectId: 'prj-108', status: 'awaiting_approval', history: [{ status: 'awaiting_approval', at: ts(day(-6), 10), by: 'Tharushi Silva' }] })
  pushBill('sup-legal', day(-1), 'Employment contract templates refresh', 180_000, EXPENSE_CATEGORY.professional, DEPARTMENT.people, { status: 'draft', history: [{ status: 'draft', at: ts(day(-1), 10), by: 'Tharushi Silva' }] })

  // Pay bills: anything due more than 3 days ago is paid, except one deliberately overdue bill.
  const overdueBillId = supplierBills.find((b) => b.supplierId === 'sup-legal' && b.description.includes('audit'))?.id
  for (const b of supplierBills) {
    if (b.status !== 'approved') continue
    const total = add(b.subtotal, b.taxAmount)
    if (b.id === overdueBillId) {
      const partDate = iso(addDays(parseISO(b.dueDate), -2))
      if (partDate <= today) {
        pushPayment({ direction: 'outgoing', category: 'supplier_payment', date: partDate, amount: round2(total * 0.5), method: 'bank_transfer', reference: `${b.supplierReference}`, bankAccountId: bankOperating, supplierId: b.supplierId, billId: b.id })
        b.status = 'partially_paid'
        b.history.push({ status: 'partially_paid', at: ts(partDate, 14), by: 'Ruwan Fernando' })
      }
      continue
    }
    const payDate = iso(addDays(parseISO(b.dueDate), -rnd.int(0, 3)))
    if (payDate > iso(addDays(A, -3))) continue
    pushPayment({ direction: 'outgoing', category: 'supplier_payment', date: payDate, amount: total, method: 'bank_transfer', reference: b.supplierReference, bankAccountId: bankOperating, supplierId: b.supplierId, billId: b.id })
    b.status = 'paid'
    b.history.push({ status: 'paid', at: ts(payDate, 14), by: 'Ruwan Fernando', note: 'Simulated payment' })
  }

  const purchaseRequests: PurchaseRequest[] = [
    { id: 'pr-1', number: 'PR-0041', title: 'Additional test devices for fleet app', requesterId: 'emp-13', departmentId: DEPARTMENT.delivery, projectId: 'prj-102', supplierId: 'sup-metro', estimatedAmount: 385_000, neededBy: day(10), justification: 'Device matrix coverage for Android 12–15 and iOS 17–18.', status: 'converted', history: [{ status: 'submitted', at: ts(day(-25)), by: 'Rashmi Alwis' }, { status: 'approved', at: ts(day(-22)), by: 'Ruwan Fernando' }, { status: 'converted', at: ts(day(-20)), by: 'Tharushi Silva' }], createdAt: ts(day(-25)), updatedAt: ts(day(-20)) },
    { id: 'pr-2', number: 'PR-0042', title: 'GPU workstation for ML prototyping', requesterId: 'emp-17', departmentId: DEPARTMENT.engineering, projectId: 'prj-108', supplierId: 'sup-metro', estimatedAmount: 1_850_000, neededBy: day(30), justification: 'Local training of crop classification models before cloud deployment.', status: 'submitted', history: [{ status: 'submitted', at: ts(day(-3)), by: 'Dinuka Jayalath' }], createdAt: ts(day(-3)), updatedAt: ts(day(-3)) },
    { id: 'pr-3', number: 'PR-0043', title: 'Security awareness training licences', requesterId: 'emp-10', departmentId: DEPARTMENT.cloudops, supplierId: 'sup-secure', estimatedAmount: 260_000, neededBy: day(21), justification: 'Annual mandatory training for ISO 27001 certification.', status: 'approved', history: [{ status: 'submitted', at: ts(day(-9)), by: 'Supun Hettiarachchi' }, { status: 'approved', at: ts(day(-7)), by: 'Ruwan Fernando' }], createdAt: ts(day(-9)), updatedAt: ts(day(-7)) },
    { id: 'pr-4', number: 'PR-0044', title: 'Conference tickets — regional cloud summit', requesterId: 'emp-02', departmentId: DEPARTMENT.engineering, estimatedAmount: 540_000, neededBy: day(45), justification: 'Three engineers; talks on our serverless migration work.', status: 'submitted', history: [{ status: 'submitted', at: ts(day(-1)), by: 'Nethmi Wijesinghe' }], createdAt: ts(day(-1)), updatedAt: ts(day(-1)) },
    { id: 'pr-5', number: 'PR-0039', title: 'Ergonomic chairs — new hires', requesterId: 'emp-15', departmentId: DEPARTMENT.people, supplierId: 'sup-metro', estimatedAmount: 310_000, neededBy: day(-30), justification: 'Replacement and new-hire seating.', status: 'rejected', history: [{ status: 'submitted', at: ts(day(-50)), by: 'Tharushi Silva' }, { status: 'rejected', at: ts(day(-47)), by: 'Dilini Jayasekara', note: 'Defer to next quarter' }], createdAt: ts(day(-50)), updatedAt: ts(day(-47)) },
  ]

  let poLine = 0
  const poL = (description: string, quantity: number, unitPrice: number): LineItem => ({ id: `poln-${++poLine}`, description, quantity, unitPrice, discountPercent: 0, taxRatePercent: VAT })
  const purchaseOrders: PurchaseOrder[] = [
    { id: 'po-1', number: 'PO-0118', supplierId: 'sup-metro', requestId: 'pr-1', projectId: 'prj-102', departmentId: DEPARTMENT.delivery, orderDate: day(-20), expectedDate: day(-13), currency: 'LKR', lines: [poL('Android test handsets (assorted)', 5, 45_000), poL('iOS test handsets', 2, 80_000)], status: 'received', history: [{ status: 'approved', at: ts(day(-20)), by: 'Ruwan Fernando' }, { status: 'sent', at: ts(day(-19)), by: 'Tharushi Silva' }, { status: 'received', at: ts(day(-13)), by: 'Rashmi Alwis' }], createdAt: ts(day(-20)), updatedAt: ts(day(-13)) },
    { id: 'po-2', number: 'PO-0119', supplierId: 'sup-secure', requestId: 'pr-3', departmentId: DEPARTMENT.cloudops, orderDate: day(-6), expectedDate: day(14), currency: 'LKR', lines: [poL('Security awareness platform — annual seats', 34, 7_500)], status: 'sent', history: [{ status: 'approved', at: ts(day(-6)), by: 'Ruwan Fernando' }, { status: 'sent', at: ts(day(-5)), by: 'Tharushi Silva' }], createdAt: ts(day(-6)), updatedAt: ts(day(-5)) },
    { id: 'po-3', number: 'PO-0120', supplierId: 'sup-talent', projectId: 'prj-108', departmentId: DEPARTMENT.delivery, orderDate: day(-35), expectedDate: day(55), currency: 'LKR', lines: [poL('Contract data engineer — monthly fee', 3, 940_000)], status: 'approved', history: [{ status: 'pending_approval', at: ts(day(-36)), by: 'Kasun Wickramasinghe' }, { status: 'approved', at: ts(day(-35)), by: 'Dilini Jayasekara' }], createdAt: ts(day(-36)), updatedAt: ts(day(-35)) },
    { id: 'po-4', number: 'PO-0121', supplierId: 'sup-pixel', projectId: 'prj-106', departmentId: DEPARTMENT.delivery, orderDate: day(-2), expectedDate: day(28), currency: 'LKR', lines: [poL('Booking engine UX discovery', 1, 680_000)], status: 'pending_approval', history: [{ status: 'pending_approval', at: ts(day(-2)), by: 'Rashmi Alwis' }], createdAt: ts(day(-2)), updatedAt: ts(day(-2)) },
    { id: 'po-5', number: 'PO-0122', supplierId: 'sup-events', departmentId: DEPARTMENT.sales, orderDate: day(-1), expectedDate: day(40), currency: 'LKR', lines: [poL('Webinar series production', 3, 145_000)], status: 'draft', history: [{ status: 'draft', at: ts(day(-1)), by: 'Lakmal Ranasinghe' }], createdAt: ts(day(-1)), updatedAt: ts(day(-1)) },
  ]
  supplierBills.find((b) => b.supplierId === 'sup-metro' && b.projectId === 'prj-102')!.purchaseOrderId = 'po-1'
  supplierBills.find((b) => b.supplierId === 'sup-talent' && b.projectId === 'prj-108')!.purchaseOrderId = 'po-3'

  /* --------------------------------------------------------------- expenses */
  const expenseTemplates: [string, string, number, number, boolean][] = [
    [EXPENSE_CATEGORY.travel, 'Taxi to client site', 2_800, 9_500, true],
    [EXPENSE_CATEGORY.travel, 'Return flight — client workshop', 48_000, 120_000, true],
    [EXPENSE_CATEGORY.travel, 'Hotel — 2 nights onsite', 32_000, 68_000, true],
    [EXPENSE_CATEGORY.meals, 'Team lunch — sprint demo', 9_500, 28_000, false],
    [EXPENSE_CATEGORY.meals, 'Client dinner', 18_000, 42_000, false],
    [EXPENSE_CATEGORY.training, 'Cloud certification exam fee', 45_000, 92_000, false],
    [EXPENSE_CATEGORY.training, 'Online course subscription', 8_500, 22_000, false],
    [EXPENSE_CATEGORY.equipment, 'USB-C dock & peripherals', 14_000, 36_000, false],
    [EXPENSE_CATEGORY.telecom, 'Mobile data top-up (on-call)', 2_500, 6_500, false],
    [EXPENSE_CATEGORY.software, 'Developer tool licence (personal seat)', 6_500, 18_000, false],
  ]
  const claimants = ['emp-03', 'emp-04', 'emp-05', 'emp-06', 'emp-10', 'emp-11', 'emp-12', 'emp-13', 'emp-14', 'emp-16', 'emp-17', 'emp-02']
  const clientProjects = ['prj-101', 'prj-102', 'prj-103', 'prj-104', 'prj-108', 'prj-107']
  const expenses: ExpenseClaim[] = []
  for (let i = 0; i < 52; i++) {
    const tpl = rnd.pick(expenseTemplates)
    const [categoryId, description, min, max, projectish] = tpl
    const employeeId = rnd.pick(claimants)
    const emp = empById.get(employeeId)!
    const daysAgo = Math.round(Math.pow(rnd.next(), 1.4) * 330)
    const date = day(-daysAgo)
    const amount = rnd.nice(rnd.between(min, max), 50)
    const projectId = projectish || rnd.chance(0.2) ? rnd.pick(clientProjects) : undefined
    let status: ExpenseStatus
    if (daysAgo > 40) status = rnd.chance(0.08) ? 'rejected' : 'reimbursed'
    else if (daysAgo > 14) status = rnd.pick(['approved', 'reimbursed', 'approved', 'rejected'] as const)
    else status = rnd.pick(['submitted', 'submitted', 'draft', 'approved'] as const)
    const history: ExpenseClaim['history'] = [{ status: 'submitted', at: ts(date, 18), by: emp.name }]
    if (status === 'draft') history.splice(0, 1, { status: 'draft', at: ts(date, 18), by: emp.name })
    if (status === 'approved' || status === 'reimbursed') history.push({ status: 'approved', at: ts(iso(addDays(parseISO(date), 2)), 11), by: 'Ruwan Fernando' })
    if (status === 'rejected') history.push({ status: 'rejected', at: ts(iso(addDays(parseISO(date), 2)), 11), by: 'Ruwan Fernando', note: 'Receipt missing VAT details — please resubmit' })
    if (status === 'reimbursed') history.push({ status: 'reimbursed', at: ts(iso(addDays(parseISO(date), 9)), 11), by: 'Tharushi Silva', note: 'Included in reimbursement run (simulated)' })
    expenses.push({
      id: `exp-${i + 1}`,
      number: `EXP-${String(1001 + i)}`,
      employeeId,
      date,
      categoryId,
      description: projectId ? `${description} — ${projectById.get(projectId)!.code}` : description,
      amount,
      taxAmount: 0,
      currency: 'LKR',
      projectId,
      departmentId: emp.departmentId,
      billable: !!projectId && categoryId === EXPENSE_CATEGORY.travel,
      status,
      receipts: status === 'draft' ? [] : [{ id: `rcpt-${i + 1}`, name: `receipt-${1001 + i}.pdf`, sizeKb: rnd.int(80, 640), mimeType: 'application/pdf', addedAt: ts(date, 18) }],
      history,
      notes: [],
      createdAt: ts(date, 18),
      updatedAt: history[history.length - 1]!.at,
    })
  }
  expenses.sort((a, b) => a.date.localeCompare(b.date))
  expenses.forEach((e, i) => { e.number = `EXP-${String(1001 + i)}`; e.id = `exp-${i + 1}` })
  // Monthly reimbursement runs
  const reimbursedByMonth = new Map<string, number>()
  for (const e of expenses) {
    if (e.status !== 'reimbursed') continue
    const runDate = iso(addDays(parseISO(e.date), 9))
    const key = runDate.slice(0, 7)
    reimbursedByMonth.set(key, add(reimbursedByMonth.get(key) ?? 0, e.amount))
  }
  for (const [month, amount] of reimbursedByMonth) {
    const date = `${month}-25` > today ? today : `${month}-25`
    pushPayment({ direction: 'outgoing', category: 'reimbursement', date, amount, method: 'bank_transfer', reference: `Expense reimbursement run ${month}`, bankAccountId: bankPayroll })
  }

  /* ------------------------------------------- payroll & card settlements */
  for (let m = -12; m <= -1; m++) {
    const month = monthStart(m)
    const monthEnd = iso(addMonths(parseISO(month), 1))
    const payroll = sum(
      employees.filter((e) => e.startDate < monthEnd),
      (e) => e.monthlyCost,
    )
    pushPayment({ direction: 'outgoing', category: 'payroll', date: iso(addDays(parseISO(monthEnd), -3)), amount: payroll, method: 'bank_transfer', reference: `Payroll ${format(parseISO(month), 'MMM yyyy')} (simulated)`, bankAccountId: bankOperating })
    const card = add(
      sum(cloudCosts.filter((c) => c.month === month), (c) => c.amount),
      sum(aiUsage.filter((c) => c.month === month), (c) => c.amount),
      sum(licences.filter((l) => l.startDate < monthEnd), (l) => (l.billingCycle === 'annual' ? divide(multiply(l.seats, l.costPerSeat), 12) : multiply(l.seats, l.costPerSeat))),
    )
    pushPayment({ direction: 'outgoing', category: 'card_settlement', date: iso(addDays(parseISO(monthEnd), 4)) > today ? today : iso(addDays(parseISO(monthEnd), 4)), amount: card, method: 'card', reference: `Corporate card settlement — ${format(parseISO(month), 'MMM yyyy')}`, bankAccountId: bankOperating, supplierId: 'sup-cloudcard' })
    if (m % 3 === 0) {
      pushPayment({ direction: 'outgoing', category: 'tax', date: iso(addDays(parseISO(monthEnd), 19)) > today ? today : iso(addDays(parseISO(monthEnd), 19)), amount: rnd.nice(2_400_000 + rnd.between(-300_000, 300_000), 1000), method: 'online', reference: `VAT return — quarter to ${format(parseISO(month), 'MMM yyyy')} (illustrative)`, bankAccountId: bankOperating })
    }
  }
  payments.sort((a, b) => a.date.localeCompare(b.date))

  /* ---------------------------------------------------------- bank accounts */
  // Opening balances are chosen so simulated balances never go negative.
  const minRunning = (accountId: string) => {
    let running = 0
    let min = 0
    for (const p of payments.filter((x) => x.bankAccountId === accountId)) {
      running += p.direction === 'incoming' ? p.amount : -p.amount
      min = Math.min(min, running)
    }
    return min
  }
  const bankAccounts: BankAccount[] = [
    { id: bankOperating, name: 'Operating account', bankName: 'Harbour City Bank (fictional)', accountMask: '•••• 4821', currency: 'LKR', openingBalance: rnd.nice(18_000_000 - minRunning(bankOperating), 100_000), ledgerAccountId: 'acc-1000', active: true, createdAt: created, updatedAt: created },
    { id: bankPayroll, name: 'Payroll account', bankName: 'Harbour City Bank (fictional)', accountMask: '•••• 7730', currency: 'LKR', openingBalance: rnd.nice(4_000_000 - minRunning(bankPayroll), 100_000), ledgerAccountId: 'acc-1010', active: true, createdAt: created, updatedAt: created },
    { id: 'bank-reserve', name: 'Savings reserve', bankName: 'Kandyan Savings Bank (fictional)', accountMask: '•••• 0192', currency: 'LKR', openingBalance: 25_000_000, ledgerAccountId: 'acc-1020', active: true, createdAt: created, updatedAt: created },
  ]
  // Inter-account funding of payroll is netted out for simplicity: the payroll account is pre-funded.

  /* --------------------------------------------------------- bank statement */
  const bankStatementLines: BankStatementLine[] = []
  const recentPayments = payments.filter((p) => p.bankAccountId === bankOperating && p.date >= day(-45))
  recentPayments.forEach((p, i) => {
    const matched = i % 5 !== 3
    bankStatementLines.push({
      id: `bsl-${i + 1}`,
      bankAccountId: bankOperating,
      date: p.date,
      description: p.direction === 'incoming' ? `CR TRANSFER ${p.reference ?? ''}`.trim() : `DR ${p.reference ?? 'PAYMENT'}`.slice(0, 60),
      amount: p.direction === 'incoming' ? p.amount : -p.amount,
      reference: p.reference,
      matchedPaymentId: matched ? p.id : undefined,
      reconciled: matched && p.date < day(-10),
      createdAt: ts(p.date, 20),
      updatedAt: ts(p.date, 20),
    })
  })
  bankStatementLines.push(
    { id: `bsl-fee-1`, bankAccountId: bankOperating, date: day(-30), description: 'BANK SERVICE CHARGES', amount: -4_850, reconciled: false, createdAt: ts(day(-30)), updatedAt: ts(day(-30)) },
    { id: `bsl-int-1`, bankAccountId: bankOperating, date: day(-15), description: 'INTEREST CREDIT', amount: 12_430, reconciled: false, createdAt: ts(day(-15)), updatedAt: ts(day(-15)) },
  )

  /* ------------------------------------------------------- journal entries */
  const journalEntries: JournalEntry[] = []
  let jeCounter = 0
  const productCategory = new Map(products.map((p) => [p.id, p.incomeCategoryId]))
  for (const inv of invoices.filter((i) => i.status !== 'draft' && i.issueDate >= day(-60))) {
    const t = documentTotals(inv.lines, inv.discountPercent)
    jeCounter++
    const incomeAcc = INCOME_ACCOUNT[productCategory.get(inv.lines[0]?.productId ?? '') ?? INCOME_CATEGORY.development] ?? 'acc-4000'
    journalEntries.push({
      id: `je-${jeCounter}`, number: `JE-${String(jeCounter).padStart(5, '0')}`, date: inv.issueDate, memo: `Invoice ${inv.number}`, source: 'invoice', sourceId: inv.id, status: 'posted',
      lines: [
        { id: `jl-${jeCounter}-1`, accountId: 'acc-1100', debit: t.total, credit: 0 },
        { id: `jl-${jeCounter}-2`, accountId: incomeAcc, debit: 0, credit: t.netAmount, projectId: inv.projectId },
        { id: `jl-${jeCounter}-3`, accountId: 'acc-2100', debit: 0, credit: t.taxTotal },
      ],
      createdAt: ts(inv.issueDate), updatedAt: ts(inv.issueDate),
    })
  }
  for (const p of payments.filter((x) => x.date >= day(-60) && (x.category === 'customer_receipt' || x.category === 'supplier_payment'))) {
    jeCounter++
    const bankAcc = p.bankAccountId === bankPayroll ? 'acc-1010' : 'acc-1000'
    journalEntries.push({
      id: `je-${jeCounter}`, number: `JE-${String(jeCounter).padStart(5, '0')}`, date: p.date, memo: `${p.direction === 'incoming' ? 'Receipt' : 'Payment'} ${p.number}`, source: 'payment', sourceId: p.id, status: 'posted',
      lines: p.direction === 'incoming'
        ? [{ id: `jl-${jeCounter}-1`, accountId: bankAcc, debit: p.amount, credit: 0 }, { id: `jl-${jeCounter}-2`, accountId: 'acc-1100', debit: 0, credit: p.amount }]
        : [{ id: `jl-${jeCounter}-1`, accountId: 'acc-2000', debit: p.amount, credit: 0 }, { id: `jl-${jeCounter}-2`, accountId: bankAcc, debit: 0, credit: p.amount }],
      createdAt: ts(p.date), updatedAt: ts(p.date),
    })
  }
  for (const b of supplierBills.filter((x) => x.billDate >= day(-60) && x.status !== 'draft' && x.status !== 'awaiting_approval')) {
    jeCounter++
    journalEntries.push({
      id: `je-${jeCounter}`, number: `JE-${String(jeCounter).padStart(5, '0')}`, date: b.billDate, memo: `Supplier bill ${b.number}`, source: 'bill', sourceId: b.id, status: 'posted',
      lines: [
        { id: `jl-${jeCounter}-1`, accountId: EXPENSE_ACCOUNT[b.categoryId] ?? 'acc-5400', debit: b.subtotal, credit: 0, projectId: b.projectId, departmentId: b.departmentId },
        { id: `jl-${jeCounter}-2`, accountId: 'acc-2100', debit: b.taxAmount, credit: 0 },
        { id: `jl-${jeCounter}-3`, accountId: 'acc-2000', debit: 0, credit: add(b.subtotal, b.taxAmount) },
      ],
      createdAt: ts(b.billDate), updatedAt: ts(b.billDate),
    })
  }
  jeCounter++
  journalEntries.push({
    id: `je-${jeCounter}`, number: `JE-${String(jeCounter).padStart(5, '0')}`, date: day(-1), memo: 'Accrue October contractor invoice not yet received', source: 'manual', status: 'draft',
    lines: [
      { id: `jl-${jeCounter}-1`, accountId: 'acc-5100', debit: 940_000, credit: 0, projectId: 'prj-108', description: 'Contract data engineer — accrual' },
      { id: `jl-${jeCounter}-2`, accountId: 'acc-2200', debit: 0, credit: 940_000 },
    ],
    createdAt: ts(day(-1)), updatedAt: ts(day(-1)),
  })
  journalEntries.sort((a, b) => a.date.localeCompare(b.date))

  /* ------------------------------------------------------------- periods */
  const periods: DemoDatabase['periods'] = []
  for (let m = -12; m <= 1; m++) {
    const start = monthStart(m)
    periods.push({ id: `per-${m + 13}`, name: format(parseISO(start), 'MMMM yyyy'), startDate: start, endDate: iso(addDays(addMonths(parseISO(start), 1), -1)), status: m < -1 ? 'closed' : m === -1 ? 'closing' : 'open', createdAt: ts(start), updatedAt: ts(start) })
  }

  /* --------------------------------------------------------------- assets */
  const assetRows: [string, string, string, number, number, number, number, FixedAsset['method'], string, string][] = [
    ['FA-001', 'Developer laptops (batch of 10)', 'ac-computers', -26, 6_800_000, 400_000, 36, 'straight_line', DEPARTMENT.engineering, 'Colombo office'],
    ['FA-002', 'Developer laptops (batch of 6)', 'ac-computers', -9, 4_500_000, 300_000, 36, 'straight_line', DEPARTMENT.engineering, 'Colombo office'],
    ['FA-003', 'Design workstations', 'ac-computers', -14, 1_900_000, 100_000, 36, 'straight_line', DEPARTMENT.product, 'Colombo office'],
    ['FA-004', 'Core network switches & firewall', 'ac-servers', -30, 2_600_000, 200_000, 48, 'declining_balance', DEPARTMENT.cloudops, 'Server room'],
    ['FA-005', 'On-prem build server', 'ac-servers', -18, 1_450_000, 100_000, 48, 'straight_line', DEPARTMENT.cloudops, 'Server room'],
    ['FA-006', 'Office fit-out — Level 4', 'ac-leasehold', -34, 9_200_000, 0, 60, 'straight_line', DEPARTMENT.finance, 'Colombo office'],
    ['FA-007', 'Workstations & chairs', 'ac-furniture', -34, 2_350_000, 150_000, 60, 'straight_line', DEPARTMENT.finance, 'Colombo office'],
    ['FA-008', 'Meeting room AV systems', 'ac-furniture', -12, 1_250_000, 50_000, 60, 'straight_line', DEPARTMENT.sales, 'Colombo office'],
    ['FA-009', 'Device testing lab', 'ac-computers', -5, 980_000, 80_000, 36, 'straight_line', DEPARTMENT.engineering, 'QA lab'],
    ['FA-010', 'Legacy rack servers', 'ac-servers', -60, 3_100_000, 100_000, 48, 'straight_line', DEPARTMENT.cloudops, 'Disposed'],
  ]
  const assets: FixedAsset[] = assetRows.map(([tag, name, classId, off, cost, salvage, life, method, dept, location], i) => ({
    id: `asset-${i + 1}`, tag, name, assetClassId: classId, purchaseDate: iso(addDays(addMonths(startOfMonth(A), off), 9)), cost, salvageValue: salvage, usefulLifeMonths: life, method, departmentId: dept, location,
    status: tag === 'FA-010' ? 'disposed' : off + life < 0 ? 'fully_depreciated' : 'active', supplierId: 'sup-metro', createdAt: created, updatedAt: created,
  }))

  const rdExpenditure: DemoDatabase['rdExpenditure'] = [
    ['Rules engine prototype — engineering time', 1_850_000, 'staff', -5],
    ['Formula parser & workflow designer spikes', 1_420_000, 'staff', -4],
    ['UX research with finance teams', 380_000, 'contractors', -4],
    ['Sandbox cloud environment', 145_000, 'cloud', -3],
    ['Charting & table component licences', 96_000, 'software', -3],
    ['Multi-tenant data model experiments', 1_260_000, 'staff', -2],
    ['Accessibility audit of builder UI', 240_000, 'contractors', -1],
    ['Office snacks for hack week', 22_000, 'materials', -1],
  ].map(([description, amount, category, off], i) => ({
    id: `rd-${i + 1}`, projectId: 'prj-109', date: iso(addDays(addMonths(startOfMonth(A), off as number), 14)), description: description as string, amount: amount as number,
    category: category as DemoDatabase['rdExpenditure'][number]['category'], eligible: category !== 'materials', createdAt: created, updatedAt: created,
  }))

  const taxRates: DemoDatabase['taxRates'] = [
    { id: 'tax-vat18', name: 'VAT standard (illustrative)', code: 'VAT18', rate: 18, type: 'sales', active: true, createdAt: created, updatedAt: created },
    { id: 'tax-zero', name: 'Zero rated — export of services', code: 'ZERO', rate: 0, type: 'sales', active: true, createdAt: created, updatedAt: created },
    { id: 'tax-exempt', name: 'Exempt supply', code: 'EXEMPT', rate: 0, type: 'sales', active: true, createdAt: created, updatedAt: created },
    { id: 'tax-in18', name: 'Input VAT recoverable', code: 'INVAT18', rate: 18, type: 'purchase', active: true, createdAt: created, updatedAt: created },
    { id: 'tax-wht5', name: 'Withholding tax on services (illustrative)', code: 'WHT5', rate: 5, type: 'withholding', active: true, createdAt: created, updatedAt: created },
  ]
  const currencies: DemoDatabase['currencies'] = (
    [
      ['LKR', 'Sri Lankan rupee', 'Rs', 1],
      ['USD', 'US dollar', '$', 300],
      ['EUR', 'Euro', '€', 325],
      ['GBP', 'British pound', '£', 382],
      ['AUD', 'Australian dollar', 'A$', 196],
      ['SGD', 'Singapore dollar', 'S$', 228],
      ['INR', 'Indian rupee', '₹', 3.55],
    ] as const
  ).map(([code, name, symbol, rate]) => ({ id: `cur-${code}`, code, name, symbol, rateToBase: rate, active: code !== 'INR', createdAt: created, updatedAt: created }))

  const policies: DemoDatabase['policies'] = [
    { id: 'pol-1', title: 'Expense claims must include an itemised receipt', category: 'expenses', summary: 'Claims above LKR 5,000 require an itemised receipt showing VAT. Claims must be submitted within 30 days.', limitAmount: 5_000, active: true, createdAt: created, updatedAt: created },
    { id: 'pol-2', title: 'Purchase approval thresholds', category: 'procurement', summary: 'Up to LKR 250,000: department head. Up to LKR 1,500,000: finance manager. Above: director.', limitAmount: 1_500_000, active: true, createdAt: created, updatedAt: created },
    { id: 'pol-3', title: 'Client travel is billable by default', category: 'travel', summary: 'Travel for client delivery is recharged at cost unless the SOW states otherwise.', active: true, createdAt: created, updatedAt: created },
    { id: 'pol-4', title: 'Invoices issued within 3 working days of month end', category: 'billing', summary: 'T&M and retainer invoices must be issued within three working days after month end.', active: true, createdAt: created, updatedAt: created },
    { id: 'pol-5', title: 'Segregation of duties for payments', category: 'approvals', summary: 'The person who records a supplier bill cannot approve its payment. (Demonstration policy — not enforced by this prototype.)', active: true, createdAt: created, updatedAt: created },
  ]

  /* ---------------------------------------------------- quotations & billing */
  let qLine = 0
  const qL = (description: string, productId: string, quantity: number, unitPrice: number, discountPercent = 0): LineItem => ({ id: `qln-${++qLine}`, description, productId, quantity, unitPrice, discountPercent, taxRatePercent: VAT })
  const quotations: Quotation[] = [
    { id: 'quo-1', number: 'QUO-0071', customerId: 'cus-azure', title: 'Property CRM & tenant portal', issueDate: day(-8), validUntil: day(22), currency: 'LKR', status: 'sent', lines: [qL('Discovery & solution design', 'prod-consult', 80, 9_500), qL('CRM build — fixed price', 'prod-dev', 1, 9_800_000), qL('Support — first 6 months', 'prod-support', 6, 250_000, 10)], createdAt: ts(day(-8)), updatedAt: ts(day(-8)) },
    { id: 'quo-2', number: 'QUO-0070', customerId: 'cus-coral', title: 'Booking engine revamp', issueDate: day(-40), validUntil: day(-10), currency: 'LKR', status: 'accepted', lines: [qL('Booking engine — fixed price', 'prod-dev', 1, 12_400_000)], createdAt: ts(day(-40)), updatedAt: ts(day(-20)) },
    { id: 'quo-3', number: 'QUO-0069', customerId: 'cus-tidewater', title: 'Managed cloud operations', issueDate: day(-55), validUntil: day(-25), currency: 'LKR', status: 'expired', lines: [qL('Managed cloud operations — monthly', 'prod-support', 12, 450_000)], createdAt: ts(day(-55)), updatedAt: ts(day(-25)) },
    { id: 'quo-4', number: 'QUO-0072', customerId: 'cus-nova', title: 'PeopleDesk Enterprise upgrade', issueDate: day(-3), validUntil: day(27), currency: 'LKR', status: 'draft', lines: [qL('PeopleDesk HR — Enterprise (annual, per seat)', 'prod-peopledesk', 120, 36_000, 8)], createdAt: ts(day(-3)), updatedAt: ts(day(-3)) },
    { id: 'quo-5', number: 'QUO-0066', customerId: 'cus-kandy', title: 'Inventory forecasting add-on', issueDate: day(-90), validUntil: day(-60), currency: 'LKR', status: 'declined', lines: [qL('Forecasting module build', 'prod-dev', 1, 2_900_000)], createdAt: ts(day(-90)), updatedAt: ts(day(-70)) },
  ]

  const recurringSchedules: RecurringSchedule[] = [
    { id: 'rec-1', name: 'Meridian LMS support retainer', customerId: 'cus-meridian', contractId: 'con-107', frequency: 'monthly', amount: 600_000, description: 'LMS managed support retainer', startDate: monthStart(-9), nextRunDate: monthStart(1), endDate: projectById.get('prj-107')!.endDate, active: true, taxRatePercent: VAT, createdAt: created, updatedAt: created },
    { id: 'rec-2', name: 'Silverleaf ERP connector support', customerId: 'cus-silverleaf', contractId: 'con-sup-silverleaf', frequency: 'monthly', amount: 300_000, description: 'ERP connector support', startDate: monthStart(-13), nextRunDate: monthStart(1), active: true, taxRatePercent: VAT, createdAt: created, updatedAt: created },
    { id: 'rec-3', name: 'Tidewater managed cloud (proposed)', customerId: 'cus-tidewater', frequency: 'quarterly', amount: 1_350_000, description: 'Managed cloud operations', startDate: monthStart(2), nextRunDate: monthStart(2), active: false, taxRatePercent: VAT, createdAt: created, updatedAt: created },
  ]
  const revenueSchedules: DemoDatabase['revenueSchedules'] = [
    { id: 'rs-1', contractId: 'con-101', method: 'percent_complete', totalAmount: projectById.get('prj-101')!.contractValue, startDate: projectById.get('prj-101')!.startDate, endDate: projectById.get('prj-101')!.endDate, createdAt: created, updatedAt: created },
    { id: 'rs-2', contractId: 'con-103', method: 'milestone', totalAmount: projectById.get('prj-103')!.contractValue, startDate: projectById.get('prj-103')!.startDate, endDate: projectById.get('prj-103')!.endDate, createdAt: created, updatedAt: created },
    { id: 'rs-3', contractId: 'con-107', method: 'straight_line', totalAmount: projectById.get('prj-107')!.contractValue, startDate: projectById.get('prj-107')!.startDate, endDate: projectById.get('prj-107')!.endDate, createdAt: created, updatedAt: created },
    { id: 'rs-4', contractId: 'con-sup-silverleaf', method: 'straight_line', totalAmount: 5_700_000, startDate: monthStart(-13), endDate: iso(addDays(addMonths(startOfMonth(A), 5), -1)), createdAt: created, updatedAt: created },
  ]

  /* ---------------------------------------------------------------- budgets */
  const fy = A.getFullYear()
  const fyStart = `${fy}-01-01`
  const fyEnd = `${fy}-12-31`
  const personnelAnnual = sum(employees, (e) => (e.employmentType === 'employee' ? e.monthlyCost * 12 : 0))
  const contractorAnnual = sum(employees, (e) => (e.employmentType === 'contractor' ? e.monthlyCost * 12 : 0))
  const budgets: DemoDatabase['budgets'] = [
    {
      id: 'bud-company', name: `FY${fy} company operating budget`, scope: 'company', kind: 'expense', fiscalYear: fy, periodStart: fyStart, periodEnd: fyEnd, ownerId: 'u-fm', status: 'approved', notes: 'Approved by the board (fictional).',
      lines: [
        [EXPENSE_CATEGORY.salaries, rnd.nice(personnelAnnual * 1.03, 100_000)],
        [EXPENSE_CATEGORY.contractors, rnd.nice(contractorAnnual * 0.9 + 6_000_000, 100_000)],
        [EXPENSE_CATEGORY.cloud, 22_000_000],
        [EXPENSE_CATEGORY.ai, 1_900_000],
        [EXPENSE_CATEGORY.software, 3_100_000],
        [EXPENSE_CATEGORY.office, 12_000_000],
        [EXPENSE_CATEGORY.travel, 1_200_000],
        [EXPENSE_CATEGORY.meals, 400_000],
        [EXPENSE_CATEGORY.training, 900_000],
        [EXPENSE_CATEGORY.marketing, 3_500_000],
        [EXPENSE_CATEGORY.professional, 4_200_000],
        [EXPENSE_CATEGORY.telecom, 1_150_000],
        [EXPENSE_CATEGORY.equipment, 900_000],
        [EXPENSE_CATEGORY.depreciation, 6_200_000],
      ].map(([categoryId, amount], i) => ({ id: `bl-c-${i + 1}`, categoryId: categoryId as string, amount: amount as number })),
      createdAt: ts(`${fy - 1}-12-10`), updatedAt: ts(`${fy - 1}-12-18`),
    },
    {
      id: 'bud-revenue', name: `FY${fy} revenue plan`, scope: 'company', kind: 'revenue', fiscalYear: fy, periodStart: fyStart, periodEnd: fyEnd, ownerId: 'u-director', status: 'approved',
      lines: [
        [INCOME_CATEGORY.development, 150_000_000],
        [INCOME_CATEGORY.saas, 24_000_000],
        [INCOME_CATEGORY.support, 9_600_000],
        [INCOME_CATEGORY.consulting, 6_000_000],
        [INCOME_CATEGORY.licensing, 3_000_000],
      ].map(([categoryId, amount], i) => ({ id: `bl-r-${i + 1}`, categoryId: categoryId as string, amount: amount as number })),
      createdAt: ts(`${fy - 1}-12-10`), updatedAt: ts(`${fy - 1}-12-18`),
    },
    {
      id: 'bud-cloud', name: `FY${fy} cloud & AI budget`, scope: 'cloud', kind: 'expense', fiscalYear: fy, periodStart: fyStart, periodEnd: fyEnd, departmentId: DEPARTMENT.cloudops, ownerId: 'u-fm', status: 'approved',
      lines: [{ id: 'bl-cl-1', categoryId: EXPENSE_CATEGORY.cloud, amount: 14_500_000 }],
      createdAt: ts(`${fy - 1}-12-12`), updatedAt: ts(`${fy - 1}-12-18`),
    },
    {
      id: 'bud-eng', name: `FY${fy} engineering department`, scope: 'department', kind: 'expense', fiscalYear: fy, periodStart: fyStart, periodEnd: fyEnd, departmentId: DEPARTMENT.engineering, ownerId: 'u-director', status: 'approved',
      lines: [
        { id: 'bl-e-1', categoryId: EXPENSE_CATEGORY.salaries, amount: rnd.nice(sum(employees.filter((e) => e.departmentId === DEPARTMENT.engineering && e.employmentType === 'employee'), (e) => e.monthlyCost) * 12, 100_000) },
        { id: 'bl-e-2', categoryId: EXPENSE_CATEGORY.contractors, amount: 7_000_000 },
        { id: 'bl-e-3', categoryId: EXPENSE_CATEGORY.software, amount: 1_400_000 },
        { id: 'bl-e-4', categoryId: EXPENSE_CATEGORY.training, amount: 600_000 },
        { id: 'bl-e-5', categoryId: EXPENSE_CATEGORY.equipment, amount: 450_000 },
      ],
      createdAt: ts(`${fy - 1}-12-12`), updatedAt: ts(`${fy - 1}-12-18`),
    },
    {
      id: 'bud-sales', name: `FY${fy} sales & marketing`, scope: 'department', kind: 'expense', fiscalYear: fy, periodStart: fyStart, periodEnd: fyEnd, departmentId: DEPARTMENT.sales, ownerId: 'u-director', status: 'revision', notes: 'Revision requested to add Q4 SaaS campaign.',
      lines: [
        { id: 'bl-s-1', categoryId: EXPENSE_CATEGORY.marketing, amount: 2_600_000 },
        { id: 'bl-s-2', categoryId: EXPENSE_CATEGORY.travel, amount: 300_000 },
        { id: 'bl-s-3', categoryId: EXPENSE_CATEGORY.meals, amount: 150_000 },
      ],
      createdAt: ts(`${fy - 1}-12-12`), updatedAt: ts(day(-14)),
    },
    {
      id: 'bud-people', name: `FY${fy + 1} people & culture (draft)`, scope: 'department', kind: 'expense', fiscalYear: fy + 1, periodStart: `${fy + 1}-01-01`, periodEnd: `${fy + 1}-12-31`, departmentId: DEPARTMENT.people, ownerId: 'u-fm', status: 'submitted', notes: 'Submitted for budget revision approval workflow.',
      lines: [
        { id: 'bl-p-1', categoryId: EXPENSE_CATEGORY.training, amount: 1_200_000 },
        { id: 'bl-p-2', categoryId: EXPENSE_CATEGORY.professional, amount: 350_000 },
      ],
      createdAt: ts(day(-5)), updatedAt: ts(day(-5)),
    },
  ]

  const scenarios: DemoDatabase['scenarios'] = [
    { id: 'scn-base', name: 'Base case', description: 'Trailing 3-month average with current growth trends.', revenueGrowthPercent: 1.5, expenseGrowthPercent: 1.0, collectionRatePercent: 85, oneOffItems: [], isDefault: true, createdAt: created, updatedAt: created },
    { id: 'scn-best', name: 'Best case', description: 'Coral Bay project starts on time and SaaS growth accelerates.', revenueGrowthPercent: 3.5, expenseGrowthPercent: 1.2, collectionRatePercent: 92, oneOffItems: [{ id: 'oo-1', month: monthStart(2), label: 'Booking engine mobilisation fee', amount: 1_240_000 }], isDefault: false, createdAt: created, updatedAt: created },
    { id: 'scn-conservative', name: 'Conservative', description: 'Tidewater stays on hold and collections slow.', revenueGrowthPercent: -1.0, expenseGrowthPercent: 1.5, collectionRatePercent: 72, oneOffItems: [{ id: 'oo-2', month: monthStart(3), label: 'Annual audit final fee', amount: -1_100_000 }], isDefault: false, createdAt: created, updatedAt: created },
  ]

  const config = buildConfiguration({ day, ts, created, invoices, expenses, projects })

  const db: DemoDatabase = {
    meta: { schemaVersion: SCHEMA_VERSION, seededAt, anchorDate: today },
    organization,
    users,
    accounts,
    journalEntries,
    bankAccounts,
    bankStatementLines,
    periods,
    expenses,
    assets,
    rdExpenditure,
    taxRates,
    currencies,
    policies,
    customers,
    contracts,
    quotations,
    invoices,
    creditNotes,
    payments,
    recurringSchedules,
    revenueSchedules,
    suppliers,
    purchaseRequests,
    purchaseOrders,
    supplierBills,
    projects,
    projectCosts,
    milestones,
    employees,
    allocations,
    timesheets,
    products,
    subscriptions,
    cloudCosts,
    aiUsage,
    licences,
    budgets,
    scenarios,
    masterData,
    ...config,
  }
  return db
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

